// DSP-04: lista de compras. Base: o que a pessoa costuma comer (refeições dos últimos 14
// dias, na proporção dos dias pedidos) ou receitas (aberta / favoritas). Cozido vira cru
// para comprar, unidades para ovo/fruta/pão, e o que já está na despensa é descontado.
// Sem o modelo.
import { getMealsBetween, getPantry, getUser } from "./db.js";
import { FOOD_CATALOG, estimateMealFromText } from "./nutritionCatalog.js";
import { getRecipe } from "./recipes.js";
import { addDays } from "./dates.js";

const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
const byId = (id) => FOOD_CATALOG.find((food) => food.id === id);

// Peso cru para comprar a partir do cozido (rendimento médio do cozimento).
const RAW_FACTORS = [
  [/^arroz/, 0.4, "cru"], [/^feijao|^lentilha|^grao-de-bico|^ervilha/, 0.45, "cru"], [/^macarrao/, 0.45, "cru"],
  [/^cuscuz/, 0.5, "flocão"], [/grelhad|assad|cozid|refogad|desfiad|frit/, 1.3, "cru"]
];
const CATEGORIES = [
  ["🥩 Proteínas", /frango|patinho|carne|bife|musculo|alcatra|acem|coxao|lagarto|fraldinha|maminha|picanha|file|peixe|tilapia|salmao|atum|sardinha|merluza|pescada|camarao|ovo|peru|lombo|pernil|tofu/],
  ["🥛 Laticínios", /leite|iogurte|queijo|mucarela|muçarela|parmesao|requeijao|cottage|cream|creme-de-leite|whey/],
  ["🍚 Carboidratos e grãos", /arroz|feijao|lentilha|grao|macarrao|pao|aveia|tapioca|cuscuz|batata|mandioca|inhame|granola|torrada|milho/],
  ["🥦 Frutas, verduras e legumes", /banana|maca|morango|mamao|laranja|mexerica|abacaxi|manga|uva|melancia|melao|kiwi|goiaba|maracuja|acai|abacate|pera|tomate|folhas|alface|brocolis|cenoura|abobrinha|abobora|chuchu|beterraba|legumes|couve|pepino|cebola|pimentao|palmito|cogumelo|repolho|quiabo/]
];
const UNIT_ITEMS = /^(?:ovo|banana|maca|laranja|mexerica|pera|kiwi|pao-frances|pao-de-hamburguer|pao-sirio|goiaba|manga)/;

function toBuy(id, grams) {
  const food = byId(id);
  if (!food) return null;
  if (UNIT_ITEMS.test(id) && food.default_g) {
    return { id, name: food.name, unit: "un", amount: Math.max(1, Math.ceil(grams / food.default_g)) };
  }
  const factor = RAW_FACTORS.find(([pattern]) => pattern.test(id));
  const raw = grams * (factor ? factor[1] : 1);
  return { id, name: food.name, unit: "g", amount: Math.max(100, Math.ceil(raw / 100) * 100), raw: Boolean(factor && factor[1] !== 1) };
}

const fmt = (item) => (item.unit === "un"
  ? `${item.amount} ${item.amount === 1 ? "unidade" : "unidades"}`
  : item.amount >= 1000 ? `${String(Math.round(item.amount / 100) / 10).replace(".", ",")} kg` : `${item.amount} g`);

// Quanto da despensa cobre o item (mesma unidade). Retorna o que falta comprar.
function discountPantry(item, pantry) {
  const word = normalize(item.name).split(/\s+/)[0].replace(/s$/, "");
  const stock = pantry.find((entry) => (entry.food_id && entry.food_id === item.id) || normalize(entry.name).startsWith(word));
  if (!stock || stock.quantity == null) return { item, stock: null };
  const comparable = (stock.unit === "un" && item.unit === "un") || (["g", "ml"].includes(stock.unit) && item.unit === "g");
  if (!comparable) return { item, stock };
  const left = item.amount - stock.quantity;
  return { item: left > 0 ? { ...item, amount: item.unit === "un" ? Math.ceil(left) : Math.max(100, Math.ceil(left / 100) * 100) } : null, stock };
}

export function isShoppingListRequest(message) {
  return /\blistas? de compras?\b|\bo que (?:eu )?(?:preciso|tenho que) comprar\b|\bmonta(?:r)? (?:minha |uma )?lista (?:pro|para o|do) mercado\b/.test(normalize(message));
}

export function buildShoppingList(userId, message, today) {
  const text = normalize(message);
  const days = Number(text.match(/\b(\d{1,2})\s*dias?\b/)?.[1]) || (/\bmes\b/.test(text) ? 30 : 7);
  const totals = new Map();
  const add = (id, grams) => id && grams > 0 && totals.set(id, (totals.get(id) || 0) + grams);
  let source;

  const state = JSON.parse(getUser(userId)?.recipe_state || "{}");
  if (/\breceita/.test(text)) {
    const ids = /favorit/.test(text) ? state.favorites || [] : state.open ? [state.open] : [];
    const recipes = ids.map(getRecipe).filter(Boolean);
    if (!recipes.length) {
      return /favorit/.test(text)
        ? "⭐ Você ainda não tem receitas favoritas. Abra uma receita e mande *favoritar*, ou peça só *lista de compras* que eu uso o que você costuma comer."
        : "🍳 Abra uma receita primeiro (ex.: *receita rápida com frango* → número) e depois peça *lista de compras da receita*.";
    }
    const portions = Number(text.match(/\b(\d{1,2})\s*(?:porc(?:ao|oes)|vezes)\b/)?.[1]) || 1;
    for (const recipe of recipes) {
      const ingredients = recipe.id === state.open && state.ingredients ? state.ingredients : recipe.ingredients;
      for (const [id, grams] of ingredients) add(id, grams * portions);
    }
    source = recipes.length === 1 ? `para a receita *${recipes[0].name}*${portions > 1 ? ` (${portions} porções)` : ""}` : `para ${recipes.length} receitas favoritas`;
  } else {
    const meals = getMealsBetween(userId, addDays(today, -14), addDays(today, -1));
    const loggedDays = new Set(meals.map((meal) => String(meal.consumed_at).slice(0, 10))).size;
    if (loggedDays < 3) {
      return "🛒 Ainda tenho pouco histórico seu para montar a lista (preciso de pelo menos 3 dias de refeições registradas). Enquanto isso, peça *lista de compras das minhas receitas favoritas* ou *lista de compras da receita* com uma receita aberta.";
    }
    for (const meal of meals) {
      for (const item of estimateMealFromText(meal.description)?.matched_items || []) add(item.id, item.grams * days / loggedDays);
    }
    source = `para ${days} dias, pelo que você costuma comer`;
  }

  const pantry = getPantry(userId);
  const fromPantry = [];
  const list = [];
  for (const [id, grams] of totals) {
    if (/^(?:whey|sup-|cafe|agua|refrigerante|cerveja|suco)/.test(id)) continue;
    const item = toBuy(id, grams);
    if (!item) continue;
    const { item: left, stock } = discountPantry(item, pantry);
    if (stock) fromPantry.push(stock.name);
    if (left) list.push(left);
  }
  if (!list.length) return `🛒 Você já tem em casa tudo o que precisa ${source}. 🎉`;

  const lines = [`🛒 *Lista de compras* ${source}`];
  const used = new Set();
  for (const [title, pattern] of CATEGORIES) {
    const items = list.filter((item) => !used.has(item.id) && pattern.test(item.id));
    if (!items.length) continue;
    items.forEach((item) => used.add(item.id));
    lines.push("", `*${title}*`, ...items.map((item) => `☐ ${item.name}${item.raw ? " (cru)" : ""}: ${fmt(item)}`));
  }
  const others = list.filter((item) => !used.has(item.id));
  if (others.length) lines.push("", "*🧂 Outros*", ...others.map((item) => `☐ ${item.name}: ${fmt(item)}`));
  if (fromPantry.length) lines.push("", `🧺 Já descontei o que tem na despensa: ${[...new Set(fromPantry)].join(", ").toLocaleLowerCase("pt-BR")}.`);
  lines.push("", "_Quantidades arredondadas para cima. Quando comprar, mande *comprei…* que eu atualizo a despensa._");
  return lines.join("\n");
}
