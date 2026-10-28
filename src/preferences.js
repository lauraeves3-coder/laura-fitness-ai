// CONV-08: restrições e gostos alimentares pela conversa, sem o modelo. "sou vegetariana",
// "tenho intolerância à lactose", "sou celíaca", "não como carne de porco", "não gosto de
// peixe", "sou alérgica a camarão"; e o contrário ("voltei a comer peixe", "não sou mais
// vegetariana"). Ficam no perfil (dietary_preferences / food_dislikes) e valem nas opções,
// receitas e sugestões.
import { getUser, updateUserProfile } from "./db.js";

const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

const DIET_LABELS = [
  ["vegano", /\b(?:sou|virei|agora sou) vegan[oa]\b|\bdieta vegana\b/],
  ["vegetariano", /\b(?:sou|virei|agora sou) vegetarian[oa]\b|\bdieta vegetariana\b|\bnao como (?:nenhum tipo de )?carne(?: nenhuma)?\s*$/],
  ["sem lactose", /\bintoleran\w* (?:a |à )?lactose\b|\bsem lactose\b|\bnao (?:posso|tomo|consumo) (?:leite|lactose)\b/],
  ["sem glúten", /\bceliac[oa]\b|\bsem gluten\b|\bintoleran\w* (?:ao )?gluten\b/]
];

const splitFoods = (text) => text.split(/,|\s+e\s+|\s+nem\s+|\s+ou\s+/).map((item) => item.trim().replace(/^(?:de|do|da|a|o|os|as)\s+/, "").replace(/[.!]+$/, "")).filter((item) => item && item.length <= 30);

export function detectPreference(message) {
  const text = normalize(message).replace(/[?!.]+$/, "");
  if (/\b(?:minhas restricoes|minhas preferencias alimentares|o que (?:eu )?nao como|quais (?:sao )?minhas restricoes)\b/.test(text)) return { type: "query" };
  const removeDiet = text.match(/\bnao sou mais (vegetarian|vegan)/);
  if (removeDiet) return { type: "remove_diet", diet: removeDiet[1].startsWith("vegan") ? "vegano" : "vegetariano" };
  const allow = text.match(/\b(?:voltei a comer|agora (?:eu )?como|pode (?:incluir|colocar)|ja como)\s+(.+)$/);
  if (allow) return { type: "allow", foods: splitFoods(allow[1]) };
  for (const [diet, pattern] of DIET_LABELS) if (pattern.test(text)) return { type: "diet", diet };
  const dislike = text.match(/\b(?:nao como|nao gosto de|nao curto|nao suporto|nao posso comer|odeio|sou alergic[oa] (?:a|ao|à)|tenho alergia (?:a|ao|à))\s+(.+)$/);
  if (dislike && !/\b(?:hoje|ontem|agora|ainda|nada|muito|tanto)\b/.test(dislike[1])) return { type: "dislike", foods: splitFoods(dislike[1]) };
  return null;
}

const listOf = (value) => String(value || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean);

function describe(user) {
  const diets = listOf(user?.dietary_preferences);
  const dislikes = listOf(user?.food_dislikes);
  if (!diets.length && !dislikes.length) return "📝 Você ainda não me contou restrições. Pode dizer, por exemplo: *sou vegetariana*, *tenho intolerância à lactose* ou *não como carne de porco*.";
  return [
    "📝 *Suas restrições e preferências*",
    diets.length ? `🥗 Dieta: ${diets.join(", ")}` : null,
    dislikes.length ? `🚫 Não come: ${dislikes.join(", ")}` : null,
    "",
    "_Deixo isso de fora nas opções de refeição e nas receitas. Para mudar, diga por exemplo *voltei a comer peixe*._"
  ].filter((line) => line !== null).join("\n");
}

// Grafia original (com acentos) de um trecho já normalizado.
function originalSpelling(message, plain) {
  const source = String(message || "");
  const map = [];
  let flat = "";
  for (let index = 0; index < source.length; index += 1) {
    for (const piece of normalize(source[index]) || "") { flat += piece; map.push(index); }
  }
  const at = flat.indexOf(plain);
  return at < 0 ? plain : source.slice(map[at], map[at + plain.length - 1] + 1).toLocaleLowerCase("pt-BR");
}

export function handlePreferenceMessage(userId, message) {
  const intent = detectPreference(message);
  if (!intent) return null;
  if (intent.foods) intent.foods = intent.foods.map((food) => originalSpelling(message, food));
  const user = getUser(userId);
  if (intent.type === "query") return describe(user);
  const diets = listOf(user?.dietary_preferences);
  const dislikes = listOf(user?.food_dislikes);
  if (intent.type === "diet") {
    const next = [...new Set([...diets.filter((item) => !(intent.diet === "vegano" && item === "vegetariano")), intent.diet])];
    updateUserProfile(userId, { dietary_preferences: next.join(", ") });
    return `📝 Anotei: *${intent.diet}*. Vou respeitar isso nas opções de refeição e nas receitas.`;
  }
  if (intent.type === "remove_diet") {
    updateUserProfile(userId, { dietary_preferences: diets.filter((item) => item !== intent.diet && !(intent.diet === "vegetariano" && item === "vegano")).join(", ") });
    return `📝 Pronto, tirei *${intent.diet}* das suas preferências.`;
  }
  if (intent.type === "dislike") {
    const next = [...new Set([...dislikes, ...intent.foods])];
    updateUserProfile(userId, { food_dislikes: next.join(", ") });
    return `📝 Anotei: sem *${intent.foods.join(", ")}*. Vou deixar de fora nas opções de refeição e nas receitas.`;
  }
  const allowed = intent.foods.map(normalize);
  updateUserProfile(userId, {
    food_dislikes: dislikes.filter((item) => !allowed.some((food) => normalize(item).includes(food) || food.includes(normalize(item)))).join(", ")
  });
  return `📝 Pronto: *${intent.foods.join(", ")}* volta${intent.foods.length > 1 ? "m" : ""} a aparecer nas sugestões.`;
}

export { excludedTerms } from "./restrictions.js";
