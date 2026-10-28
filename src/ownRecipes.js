// REC-06: receita própria. "cadastrar receita: bolo de banana fit — 2 bananas, 2 ovos e
// 50 g de aveia; rende 6 porções". Os ingredientes passam pelo catálogo (mesmo cálculo das
// refeições); a receita vira um alimento da pessoa em que 1 porção = peso total ÷ porções,
// então "comi 1 porção do bolo de banana fit" já registra. Sem o modelo.
import { getUserFoods, saveUserFood } from "./db.js";
import { estimateMealFromText, getMissingMealQuantities } from "./nutritionCatalog.js";

const TRIGGER = /^\s*(?:cadastr\w*|salv\w*|cri\w*|adicion\w*|registr\w* (?:a |uma )?minha)\s+(?:a\s+|uma\s+|minha\s+)*receita\b\s*:?\s*/i;
const slug = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const fmt = (value) => Math.round(value).toLocaleString("pt-BR");

export function parseOwnRecipe(message) {
  const text = String(message || "").normalize("NFC");
  const trigger = text.match(TRIGGER);
  if (!trigger) return null;
  const rest = text.slice(trigger[0].length);
  const split = rest.match(/^(.+?)\s*(?:—|–|:|\s-\s|\s+com\s+(?=\d))\s*(.+)$/s);
  if (!split) return { missing: "ingredients" };
  const name = split[1].trim().replace(/[.,;]+$/, "");
  const servingsMatch = split[2].match(/\b(?:rende|serve|faz|da|dá)\s*(\d{1,2})\s*(?:porc(?:ao|ões|oes)|pedaços?|pedacos?|fatias?|unidades?|potes?)?/i);
  const servings = servingsMatch ? Number(servingsMatch[1]) : 1;
  const ingredients = split[2].replace(/[;.]?\s*\b(?:rende|serve|faz|da|dá)\s*\d.*$/i, "").trim().replace(/[.;,]+$/, "");
  if (!name || !ingredients) return { missing: "ingredients" };
  return { name, ingredients, servings };
}

export function handleOwnRecipeMessage(userId, message) {
  const parsed = parseOwnRecipe(message);
  if (!parsed) return null;
  if (parsed.missing) {
    return "Para salvar sua receita, mande o nome, os ingredientes com quantidade e quantas porções rende. Ex.: *cadastrar receita: bolo de banana fit — 2 bananas, 2 ovos e 50 g de aveia; rende 6 porções*.";
  }
  const text = `comi ${parsed.ingredients}`;
  const extraFoods = getUserFoods(userId);
  const estimate = estimateMealFromText(text, { extraFoods });
  if (!estimate?.matched_items?.length) {
    return "Não reconheci os ingredientes. Mande com quantidade, por exemplo: *2 bananas, 2 ovos e 50 g de aveia*.";
  }
  const defaults = getMissingMealQuantities(text, extraFoods).map((item) => item.name.toLocaleLowerCase("pt-BR"));
  const totalGrams = estimate.matched_items.reduce((sum, item) => sum + item.grams, 0);
  const portion = Math.round(totalGrams / parsed.servings);
  const per100 = (value) => Math.round(value / totalGrams * 100 * 100) / 100;
  const displayName = parsed.name.charAt(0).toLocaleUpperCase("pt-BR") + parsed.name.slice(1);
  const lower = parsed.name.toLocaleLowerCase("pt-BR");
  const food = {
    id: `receita-${slug(parsed.name)}`,
    name: displayName,
    aliases: [lower, `receita de ${lower}`],
    kcal: per100(estimate.calories), protein: per100(estimate.protein_g), carbs: per100(estimate.carbs_g), fat: per100(estimate.fat_g),
    default_g: portion,
    unit: `1 porção (${portion} g)`
  };
  saveUserFood(userId, food);
  const serving = (value) => fmt(value / parsed.servings);
  return [
    `🍳 *Receita salva: ${displayName}*`,
    `Rende ${parsed.servings} ${parsed.servings === 1 ? "porção" : "porções"} de ~${portion} g`,
    "",
    "*Ingredientes considerados*",
    ...estimate.matched_items.map((item) => `• ${item.name} — ${fmt(item.grams)} g`),
    defaults.length ? `_Sem quantidade, usei a porção padrão de: ${defaults.join(", ")}._` : null,
    "",
    `*Por porção:* 🔥 ${serving(estimate.calories)} kcal · 🥩 P ${serving(estimate.protein_g)} g · 🍚 C ${serving(estimate.carbs_g)} g · 🥑 G ${serving(estimate.fat_g)} g`,
    "",
    `_Para registrar: *comi 1 porção de ${lower}* (ou *2 pedaços*)._`
  ].filter((line) => line !== null).join("\n");
}

export function buildOwnRecipesList(userId) {
  const own = getUserFoods(userId).filter((food) => String(food.id).startsWith("receita-"));
  if (!own.length) return null;
  return ["📒 *Suas receitas*", "", ...own.map((food) => `• *${food.name}* — porção de ${fmt(food.default_g)} g · ${fmt(food.kcal * food.default_g / 100)} kcal`)].join("\n");
}
