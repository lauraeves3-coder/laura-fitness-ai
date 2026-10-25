// DSP-01/02: despensa = estoque confirmado ("comprei", "coloquei na geladeira"), diferente
// de alimento só mencionado ou desejado. Quantidade, unidade, local e validade; refeição
// registrada com item da despensa dá baixa. Sem o modelo.
import { addPantryItem, getPantry, removePantryItem, updatePantryItem } from "./db.js";
import { FOOD_CATALOG, findFoodCandidates } from "./nutritionCatalog.js";
import { addDays, daysBetween, formatDay } from "./dates.js";

const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
const NUMBERS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, meia: 0.5, meio: 0.5, dez: 10, doze: 12 };
const UNITS = [
  [/^(?:kg|quilos?)$/, "g", 1000], [/^(?:g|gr|gramas?)$/, "g", 1], [/^(?:l|litros?)$/, "ml", 1000], [/^ml$/, "ml", 1],
  [/^duzias?$/, "un", 12], [/^(?:unidades?|un|unid)$/, "un", 1],
  [/^pacotes?$/, "pacote", 1], [/^caixas?$/, "caixa", 1], [/^latas?$/, "lata", 1], [/^garrafas?$/, "garrafa", 1],
  [/^bandejas?$/, "bandeja", 1], [/^potes?$/, "pote", 1], [/^sacos?$/, "saco", 1], [/^macos?$/, "maço", 1], [/^cachos?$/, "cacho", 1]
];
const LOCATIONS = [[/\bgeladeira\b/, "geladeira"], [/\bfreezer|congelador\b/, "freezer"], [/\barmario|despensa\b/, "armário"]];

const ADD_TRIGGER = /^(?:hoje\s+|ontem\s+)?(?:eu\s+)?(?:comprei|adiciona\w*|acrescenta\w*|coloquei|guardei|botei|chegou|chegaram)\b|\b(?:na|pra|para a) despensa\b/;
const REMOVE_TRIGGER = /^(?:acabou|acabaram|terminou|terminaram)\s+(?:o|a|os|as)?\s*(.+)$|^(?:tira|tirar|remove|remover|apaga|apagar)\s+(?:o|a|os|as)?\s*(.+?)\s+da despensa$/;

function parseQuantity(text) {
  const match = text.match(/^(\d+(?:[.,]\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|meia|meio|dez|doze)\s*(kg|quilos?|gramas?|gr|g|litros?|ml|l|duzias?|unidades?|unid|un|pacotes?|caixas?|latas?|garrafas?|bandejas?|potes?|sacos?|macos?|cachos?)?(?![a-z])\s*(?:de\s+|do\s+|da\s+)?(.+)$/);
  if (!match) return { quantity: null, unit: null, rest: text };
  const amount = NUMBERS[match[1]] ?? Number(match[1].replace(",", "."));
  const unit = match[2] ? UNITS.find(([pattern]) => pattern.test(match[2])) : null;
  return unit
    ? { quantity: amount * unit[2], unit: unit[1], rest: match[3] }
    : { quantity: amount, unit: "un", rest: match[3] };
}

function parseExpiry(text, today) {
  const date = text.match(/\b(?:vence|vencimento|validade|vale ate)\s*(?:dia|em|:)?\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (date) {
    const year = date[3] ? (date[3].length === 2 ? `20${date[3]}` : date[3]) : today.slice(0, 4);
    let iso = `${year}-${date[2].padStart(2, "0")}-${date[1].padStart(2, "0")}`;
    if (!date[3] && iso < addDays(today, -60)) iso = `${Number(year) + 1}${iso.slice(4)}`;
    return iso;
  }
  const days = text.match(/\bvence\s*(?:em|daqui a)\s*(\d{1,3})\s*dias?\b/);
  if (days) return addDays(today, Number(days[1]));
  if (/\bvence (?:hoje)\b/.test(text)) return today;
  if (/\bvence amanha\b/.test(text)) return addDays(today, 1);
  return null;
}

// Trecho da mensagem original (com acentos) que corresponde ao nome já normalizado.
function originalName(message, normalizedName) {
  const original = String(message || "");
  const map = [];
  let normalized = "";
  for (let index = 0; index < original.length; index += 1) {
    const char = normalize(original[index]) || "";
    for (const piece of char) { normalized += piece; map.push(index); }
  }
  const at = normalized.indexOf(normalizedName);
  if (at < 0) return normalizedName;
  return original.slice(map[at], map[at + normalizedName.length - 1] + 1);
}

// "comprei 1 kg de frango, 2 dúzias de ovos e 500 g de arroz; o frango vence 30/10"
export function parsePantryAddition(message, today) {
  const text = normalize(message).replace(/[.!]+$/, "");
  // "comprei um açaí e comi" é refeição, não estoque.
  if (!ADD_TRIGGER.test(text) || /\b(?:comi|tomei|bebi|almocei|jantei|lanchei)\b/.test(text)) return null;
  const body = text
    .replace(/^(?:hoje\s+|ontem\s+)?(?:eu\s+)?(?:comprei|adiciona\w*|acrescenta\w*|coloquei|guardei|botei|chegou|chegaram)\s*/, "")
    .replace(/\b(?:na|pra|para a|a) despensa\s*:?\s*/, "");
  const expiry = parseExpiry(text, today);
  const location = LOCATIONS.find(([pattern]) => pattern.test(text))?.[1] || null;
  const segments = body
    .split(/[;,]|\s+e\s+/)
    .map((part) => part.replace(/\b(?:que |e )?(?:vence|vencimento|validade|vale ate)\b.*$/, "").replace(/\b(?:na|no|pro|pra)\s+(?:geladeira|freezer|congelador|armario)\b.*$/, "").trim())
    .filter(Boolean);
  const items = segments.map((segment) => {
    const { quantity, unit, rest } = parseQuantity(segment);
    const plain = rest.replace(/^(?:o|a|os|as)\s+/, "").trim();
    if (!plain || plain.length > 40) return null;
    const food = findFoodCandidates(plain)[0] || null;
    const name = originalName(message, plain).toLocaleLowerCase("pt-BR");
    return { name: name.charAt(0).toLocaleUpperCase("pt-BR") + name.slice(1), foodId: food?.id || null, quantity, unit, location, expiresOn: expiry };
  }).filter((item) => item && (item.quantity != null || item.foodId));
  return items.length ? items : null;
}

const fmtQuantity = (item) => {
  if (item.quantity == null) return "";
  if (item.unit === "g") return item.quantity >= 1000 ? `${String(Math.round(item.quantity / 100) / 10).replace(".", ",")} kg` : `${Math.round(item.quantity)} g`;
  if (item.unit === "ml") return item.quantity >= 1000 ? `${String(Math.round(item.quantity / 100) / 10).replace(".", ",")} L` : `${Math.round(item.quantity)} ml`;
  const amount = String(Math.round(item.quantity * 10) / 10).replace(".", ",");
  return item.unit === "un" ? `${amount} un` : `${amount} ${item.unit}${item.quantity > 1 ? "s" : ""}`;
};

function expiryNote(item, today) {
  if (!item.expires_on) return "";
  const days = daysBetween(today, item.expires_on);
  if (days < 0) return ` — ⚠️ venceu ${formatDay(item.expires_on)}`;
  if (days <= 3) return ` — ⚠️ vence ${days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}`;
  return ` — vence ${formatDay(item.expires_on)}`;
}

export function buildPantryReply(items, today, { title = "🧺 *Sua despensa*", onlyExpiring = false } = {}) {
  const list = onlyExpiring ? items.filter((item) => item.expires_on && daysBetween(today, item.expires_on) <= 7) : items;
  if (!list.length) {
    return onlyExpiring
      ? "🧺 Nada da despensa vence nos próximos 7 dias."
      : "🧺 Sua despensa está vazia. Mande, por exemplo: *comprei 1 kg de frango, 12 ovos e 1 kg de arroz* (pode incluir *na geladeira* e *vence 30/10*).";
  }
  const groups = new Map();
  for (const item of list) groups.set(item.location || "sem local", [...(groups.get(item.location || "sem local") || []), item]);
  const order = ["geladeira", "freezer", "armário", "sem local"];
  const lines = [title];
  for (const location of order.filter((key) => groups.has(key))) {
    lines.push("", groups.size > 1 || location !== "sem local" ? `*${location.charAt(0).toLocaleUpperCase("pt-BR")}${location.slice(1)}*` : null);
    lines.push(...groups.get(location).map((item) => `• ${item.name}${item.quantity != null ? `: ${fmtQuantity(item)}` : ""}${expiryNote(item, today)}`));
  }
  const soon = list.filter((item) => item.expires_on && daysBetween(today, item.expires_on) <= 3 && daysBetween(today, item.expires_on) >= 0);
  if (soon.length && !onlyExpiring) lines.push("", `💡 Use primeiro: ${soon.map((item) => item.name.toLocaleLowerCase("pt-BR")).join(", ")}. Posso sugerir uma refeição com ${soon.length > 1 ? "eles" : "ele"}.`);
  return lines.filter((line) => line !== null).join("\n");
}

function findPantryItem(items, name) {
  const target = normalize(name).replace(/^(?:o|a|os|as)\s+/, "");
  const foodId = findFoodCandidates(target)[0]?.id;
  return items.find((item) => normalize(item.name) === target)
    || (foodId && items.find((item) => item.food_id === foodId))
    || items.find((item) => normalize(item.name).includes(target) || target.includes(normalize(item.name)));
}

export function handlePantryMessage(userId, message, today) {
  const text = normalize(message).replace(/[?!.]+$/, "");
  const asksSuggestion = /\b(?:sugest|sugir|receita|fazer|comer|cozinhar|preparar|montar|almocar|jantar|lanchar)\w*/.test(text);
  if (!asksSuggestion && /\b(?:minha despensa|o que (?:eu )?tenho (?:em casa|na despensa|na geladeira)|ver (?:a )?despensa|meu estoque)\b/.test(text)) {
    return buildPantryReply(getPantry(userId), today);
  }
  if (/\bo que (?:esta|ta) (?:para |pra )?vencer\b|\bo que vence\b/.test(text)) {
    return buildPantryReply(getPantry(userId), today, { onlyExpiring: true });
  }
  const remove = text.match(REMOVE_TRIGGER);
  if (remove) {
    const items = getPantry(userId);
    const names = (remove[1] || remove[2]).split(/,|\s+e\s+/).map((name) => name.trim()).filter(Boolean);
    const removed = names.map((name) => findPantryItem(items, name)).filter(Boolean);
    if (!removed.length) return null;
    for (const item of removed) removePantryItem(item.id);
    return `🧺 Tirei da despensa: ${removed.map((item) => item.name.toLocaleLowerCase("pt-BR")).join(", ")}.`;
  }
  const additions = parsePantryAddition(message, today);
  if (!additions) return null;
  const saved = additions.map((item) => addPantryItem(userId, item));
  return [
    "🧺 *Despensa atualizada*",
    ...saved.map((item) => `• ${item.name}${item.quantity != null ? `: ${fmtQuantity(item)}` : ""}${item.location ? ` (${item.location})` : ""}${expiryNote(item, today)}`),
    "",
    "_Quando você registrar uma refeição com esses itens, eu dou baixa sozinha. Peça *minha despensa* para ver tudo._"
  ].join("\n");
}

// Baixa dos itens da refeição registrada: gramas para itens em g/ml; unidades pela
// porção do catálogo (ex.: ovo de 50 g). Devolve as linhas da resposta.
export function consumeFromPantry(userId, matchedItems = []) {
  const pantry = getPantry(userId);
  const lines = [];
  for (const meal of matchedItems) {
    const item = pantry.find((entry) => entry.food_id && entry.food_id === meal.id && entry.quantity != null);
    if (!item) continue;
    let used = null;
    if (item.unit === "g" || item.unit === "ml") used = meal.grams;
    else if (item.unit === "un") {
      const portion = FOOD_CATALOG.find((food) => food.id === meal.id)?.default_g;
      if (portion) used = Math.max(1, Math.round(meal.grams / portion));
    }
    if (!used) continue;
    const left = item.quantity - used;
    const updated = updatePantryItem(item.id, { quantity: Math.round(left * 10) / 10 });
    lines.push(updated ? `🧺 ${item.name}: restam ${fmtQuantity(updated)}` : `🧺 ${item.name} acabou na despensa.`);
  }
  return lines;
}
