// NUT-22: fome e saciedade. Registra o nível e o horário e responde como nutricionista:
// comeu há pouco → pode ser sede/vontade; senão, lanches que saciam e cabem no saldo do
// dia (valores do catálogo); perto da meta → opções bem leves. "Meu padrão de fome" mostra
// o horário em que a fome mais aparece. Sem o modelo.
import { getHungerLogs, getTodayMeals, saveHungerLog } from "./db.js";
import { estimateMealFromText } from "./nutritionCatalog.js";
import { addDays } from "./dates.js";

const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

const SNACKS = [
  ["Iogurte natural com 1 fruta", "1 iogurte natural e 1 banana"],
  ["2 ovos cozidos", "2 ovos"],
  ["Maçã com pasta de amendoim", "1 maçã e 15 g de pasta de amendoim"],
  ["Cottage com tomate e torrada", "60 g de cottage, 1 tomate e 30 g de torrada integral"],
  ["Whey batido com água", "1 scoop de whey"]
];
const LIGHT = "água com gás ou chá, pepino ou cenoura em palitos, gelatina zero ou 1 ovo cozido";

export function detectHunger(message) {
  const text = normalize(message).replace(/[?!.]+$/, "");
  if (/\b(?:padrao de fome|quando (?:eu )?(?:sinto|tenho|bate) mais fome|minha fome)\b/.test(text)) return { type: "pattern" };
  if (/\b(?:sem fome|nao (?:estou|to|tô) com fome|perdi a fome)\b/.test(text)) return { type: "log", kind: "saciedade", level: 2 };
  if (/\b(?:estufad[oa]|empanturrad[oa]|cheio demais|cheia demais|passei do ponto)\b/.test(text)) return { type: "log", kind: "saciedade", level: 5 };
  if (/\b(?:satisfeit[oa]|saciad[oa]|bem alimentad[oa])\b/.test(text) && !/\bfome\b/.test(text)) return { type: "log", kind: "saciedade", level: 3 };
  const number = text.match(/\bfome\s*(?:nivel|de)?\s*([1-5])(?:\s*(?:\/|de)\s*5)?\b/);
  if (number) return { type: "hungry", level: Number(number[1]) };
  if (/\b(?:morrendo de fome|muita fome|fome demais|faminta|faminto|varad[oa] de fome)\b/.test(text)) return { type: "hungry", level: 5 };
  if (/\b(?:um pouco de fome|fominha|leve fome|beliscar)\b/.test(text)) return { type: "hungry", level: 2 };
  if (/\b(?:estou|to|tô|fiquei|bateu|deu|sinto|sentindo|com)\s+(?:uma\s+)?fome\b/.test(text)) return { type: "hungry", level: 3 };
  return null;
}

function snackLines(remaining) {
  const options = SNACKS
    .map(([name, text]) => ({ name, estimate: estimateMealFromText(`comi ${text}`) }))
    .filter(({ estimate }) => estimate && (remaining == null || estimate.calories <= Math.max(150, remaining * 0.6)))
    .slice(0, 3);
  return options.flatMap(({ name, estimate }, index) => [
    `*${index + 1}.* ${name}`,
    `🔥 ~${Math.round(estimate.calories)} kcal · 🥩 P ${Math.round(estimate.protein_g)} g`
  ]);
}

function minutesSinceLastMeal(userId) {
  const last = getTodayMeals(userId).at(-1);
  if (!last) return null;
  const at = Date.parse(`${String(last.consumed_at).replace(" ", "T")}-03:00`);
  return Number.isFinite(at) ? Math.round((Date.now() - at) / 60000) : null;
}

export function buildHungerPattern(logs) {
  const hungry = logs.filter((log) => log.kind === "fome");
  if (hungry.length < 3) return "📊 Ainda tenho poucos registros de fome. Quando bater fome, me diga (ex.: *estou com fome* ou *fome 4*) que em alguns dias eu mostro o seu padrão.";
  const bands = [["manhã (6h–11h)", 6, 11], ["almoço (11h–14h)", 11, 14], ["tarde (14h–18h)", 14, 18], ["noite (18h–22h)", 18, 22], ["madrugada (22h–6h)", 22, 30]];
  const hourOf = (log) => { const hour = Number(String(log.logged_at).slice(11, 13)); return hour < 6 ? hour + 24 : hour; };
  const counts = bands.map(([label, start, end]) => [label, hungry.filter((log) => hourOf(log) >= start && hourOf(log) < end).length, start]);
  const [label, count, start] = counts.sort((a, b) => b[1] - a[1])[0];
  const average = hungry.reduce((sum, log) => sum + (Number(log.level) || 3), 0) / hungry.length;
  const tip = start === 14 ? "um lanche com proteína e fibra por volta das 15h (ex.: iogurte com fruta) costuma segurar até o jantar"
    : start === 18 || start === 22 ? "jantar com mais proteína e verduras e não pular o lanche da tarde ajuda a fome da noite"
    : start === 6 ? "um café da manhã com proteína (ovos, iogurte) segura melhor que só pão ou café"
    : "manter intervalos de 3–4 h entre as refeições ajuda";
  return [
    "📊 *Seu padrão de fome — últimos 14 dias*",
    `• Mais frequente: *${label}* (${count} de ${hungry.length} registros)`,
    `• Intensidade média: ${average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/5`,
    "",
    `💡 Dica: ${tip}.`
  ].join("\n");
}

export function handleHungerMessage(userId, message, { today, remainingCalories = null } = {}) {
  const intent = detectHunger(message);
  if (!intent) return null;
  if (intent.type === "pattern") return buildHungerPattern(getHungerLogs(userId, addDays(today, -13)));
  if (intent.type === "log") {
    saveHungerLog(userId, { kind: intent.kind, level: intent.level });
    return intent.level >= 5
      ? "📝 Anotei que você ficou estufado(a). Acontece! Na próxima, comer mais devagar e começar pela salada ajuda a perceber a saciedade a tempo."
      : "📝 Anotei. Perceber a saciedade é metade do caminho. 😉";
  }
  saveHungerLog(userId, { kind: "fome", level: intent.level });
  const since = minutesSinceLastMeal(userId);
  if (since !== null && since >= 0 && since < 60 && intent.level <= 3) {
    return `🤔 Você comeu há ${since} min. Às vezes é sede ou vontade: tome um copo de água e espere 15–20 min. Se a fome continuar, me avise que eu sugiro um lanche.`;
  }
  if (remainingCalories !== null && remainingCalories <= 150) {
    return `🍃 Você já está perto da meta de hoje. Para a fome, vá de algo bem leve: ${LIGHT}.`;
  }
  return [
    intent.level >= 4 ? "😋 Fome forte! Bora resolver com algo que sacia de verdade:" : "😋 Anotado. Opções que saciam e cabem no seu dia:",
    "",
    ...snackLines(remainingCalories),
    "",
    "_Proteína e fibra seguram a fome por mais tempo. Comeu? Me conta que eu registro._"
  ].join("\n");
}
