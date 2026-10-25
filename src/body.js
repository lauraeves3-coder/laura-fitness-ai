// CRP-03: medidas corporais e tendências na conversa, sem o modelo. "cintura 78 cm,
// quadril 98", "meu percentual de gordura é 24%", "minhas medidas", "evolução do peso".
import { getMeasurements, getUser, getWeightsBetween, saveMeasurements } from "./db.js";
import { addDays, daysBetween, formatDay } from "./dates.js";

const PARTS = [
  ["cintura", /cintura/, "Cintura"],
  ["abdomen", /abdom[ea]n?|abdome|barriga/, "Abdômen"],
  ["quadril", /quadril|quadris/, "Quadril"],
  ["peito", /peito|torax|busto/, "Peito"],
  ["braco", /bracos?|biceps/, "Braço"],
  ["antebraco", /antebracos?/, "Antebraço"],
  ["coxa", /coxas?/, "Coxa"],
  ["panturrilha", /panturrilhas?/, "Panturrilha"],
  ["pescoco", /pescoco/, "Pescoço"],
  ["gordura", /(?:percentual de |% de |taxa de )?gordura(?: corporal)?|\bbf\b/, "Gordura corporal"]
];
const LABEL = Object.fromEntries(PARTS.map(([key, , label]) => [key, label]));
const ORDER = PARTS.map(([key]) => key);

const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
const fmt = (value, digits = 1) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: digits });
const signed = (value, unit) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${fmt(Math.abs(value))} ${unit}`;
const unitOf = (part) => (part === "gordura" ? "%" : "cm");
const withUnit = (value, part) => (part === "gordura" ? `${fmt(value)}%` : `${fmt(value)} cm`);

// Medidas citadas na mensagem: [{ part, value }]. Exige "cm"/"%"/"medida" ou 2+ partes,
// para "treino de braço 3x12" ou "40 min de perna" não virarem medida.
export function parseMeasurements(message) {
  const text = normalize(message);
  if (/\b(?:quero|meta|objetivo|chegar a|diminuir|reduzir)\b/.test(text)) return [];
  const found = [];
  for (const [part, pattern] of PARTS) {
    const regex = new RegExp(`\\b(?:${pattern.source})\\s*(?:direit[oa]|esquerd[oa]|relaxad[oa]|contraid[oa])?\\s*(?:e|eh|esta|ta|de|:|=|com|mede|medindo|deu)?\\s*(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*(cm|centimetros?|%|por cento)?(?![\\d.,]*\\s*(?:x|min|kg|reps?|series?|vezes))`, "g");
    const match = regex.exec(text);
    if (!match) continue;
    const value = Number(match[1].replace(",", "."));
    const okRange = part === "gordura" ? value >= 3 && value <= 60 : value >= 10 && value <= 250;
    if (okRange) found.push({ part, value, explicitUnit: Boolean(match[2]) });
  }
  const trigger = /\b(?:medidas?|medi|medindo|circunferencia|fita)\b|cm\b|%|por cento/.test(text)
    || /\b(?:minha|meu) (?:cintura|quadril|abdomen|abdome|barriga|pescoco|panturrilha|braco|coxa|antebraco)\b/.test(text);
  if (!found.length || (!trigger && found.length < 2 && !found.some((entry) => entry.explicitUnit))) return [];
  return found.map(({ part, value }) => ({ part, value }));
}

export function detectBodyQuery(message) {
  const text = normalize(message);
  if (/\b(?:minhas medidas|medidas corporais|evolucao das (?:minhas )?medidas|historico das medidas)\b/.test(text)) return "measurements";
  if (/\b(?:evolucao|historico|grafico|tendencia) do (?:meu )?peso\b|\bcomo (?:esta|anda|ta) (?:a evolucao do )?meu peso\b|\bmeu peso (?:esta )?(?:caindo|subindo|parado)\b/.test(text)) return "weight";
  return null;
}

// Linhas da última medição de cada parte, com variação desde a primeira e a anterior.
export function buildMeasurementsReply(history, { saved = [], today } = {}) {
  if (!history.length) {
    return "📏 Ainda não tenho medidas suas. Mande, por exemplo: *cintura 78 cm, quadril 98 cm, braço 31 cm* ou *meu percentual de gordura é 24%*.";
  }
  const byPart = new Map();
  for (const entry of history) byPart.set(entry.part, [...(byPart.get(entry.part) || []), entry]);
  const lines = [saved.length ? `📏 *Medidas registradas* — ${formatDay(today)}` : "📏 *Suas medidas*", ""];
  for (const part of ORDER.filter((key) => byPart.has(key))) {
    const entries = byPart.get(part);
    const last = entries.at(-1);
    const first = entries[0];
    const previous = entries.at(-2);
    const unit = unitOf(part);
    const changes = [
      previous ? `${signed(last.value - previous.value, unit)} desde ${formatDay(previous.date)}` : null,
      entries.length > 2 ? `${signed(last.value - first.value, unit)} desde ${formatDay(first.date)}` : null
    ].filter(Boolean);
    lines.push(`• *${LABEL[part]}:* ${withUnit(last.value, part)}${changes.length ? ` (${changes.join("; ")})` : ""}`);
  }
  const lastDate = history.at(-1).date;
  if (!saved.length && today && daysBetween(lastDate, today) >= 28) {
    lines.push("", `_Última medição em ${formatDay(lastDate)}. Medir a cada 2–4 semanas, no mesmo horário, ajuda a ver a tendência._`);
  } else if (saved.length) {
    lines.push("", "_Peça *minhas medidas* para ver a evolução. Medir a cada 2–4 semanas, de manhã e no mesmo ponto, deixa a comparação justa._");
  }
  return lines.join("\n");
}

const SPARK = "▁▂▃▄▅▆▇█";
function sparkline(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((value) => SPARK[max === min ? 3 : Math.round((value - min) / (max - min) * 7)]).join("");
}

// Evolução do peso nas últimas 12 semanas: mini gráfico, variação total e por semana.
export function buildWeightTrendReply(weights, { goal = "", today } = {}) {
  if (weights.length < 2) {
    return "⚖️ Preciso de pelo menos 2 pesagens para mostrar a evolução. Mande, por exemplo: *me pesei 68,5 kg*.";
  }
  const first = weights[0];
  const last = weights.at(-1);
  const change = last.weight_kg - first.weight_kg;
  const days = Math.max(1, daysBetween(first.date, last.date));
  const perWeek = change / days * 7;
  const dayLabel = `${days} ${days === 1 ? "dia" : "dias"}`;
  const losing = /emagrec|perder|defini/.test(normalize(goal));
  const gaining = /hipertrof|ganh|massa/.test(normalize(goal));
  const verdict = days < 14
    ? "_Ainda é pouco tempo para tendência: o peso oscila 1–2 kg de um dia para o outro (água, sal, intestino)._"
    : losing
      ? perWeek <= -1.2 ? "⚠️ Caindo rápido (mais de 1 kg/semana): vale conferir se está comendo o suficiente, principalmente proteína."
        : perWeek <= -0.2 ? "✅ No ritmo certo para emagrecer com segurança (0,2 a 1 kg por semana)."
          : "🟡 Estável: se seguir assim por 3 semanas, vale revisar a meta de calorias."
      : gaining
        ? perWeek >= 0.1 && perWeek <= 0.5 ? "✅ Ganho no ritmo certo (0,1 a 0,5 kg por semana)." : perWeek > 0.5 ? "🟡 Subindo rápido: parte pode ser gordura; vale revisar o superávit." : "🟡 Sem ganho: vale revisar a meta de calorias."
        : Math.abs(perWeek) < 0.2 ? "✅ Peso estável." : `ℹ️ ${perWeek > 0 ? "Subindo" : "Caindo"} cerca de ${fmt(Math.abs(perWeek))} kg por semana.`;
  const recent = weights.slice(-6).reverse();
  return [
    "⚖️ *Evolução do peso*",
    "",
    `${sparkline(weights.map((entry) => entry.weight_kg))}`,
    `${fmt(first.weight_kg)} kg (${formatDay(first.date)}) → *${fmt(last.weight_kg)} kg* (${formatDay(last.date)})`,
    // Ritmo por semana só com 1 semana ou mais de dados (antes disso é oscilação).
    `Variação: *${signed(change, "kg")}* em ${dayLabel}${days >= 7 ? ` · ${signed(perWeek, "kg")}/semana` : ""}`,
    "",
    verdict,
    "",
    "*Últimas pesagens*",
    ...recent.map((entry, index) => {
      const before = recent[index + 1];
      return `• ${formatDay(entry.date)}: ${fmt(entry.weight_kg)} kg${before ? ` (${signed(entry.weight_kg - before.weight_kg, "kg")})` : ""}`;
    })
  ].join("\n");
}

export function handleBodyMessage(userId, message, today) {
  const query = detectBodyQuery(message);
  if (query === "measurements") return buildMeasurementsReply(getMeasurements(userId), { today });
  if (query === "weight") {
    return buildWeightTrendReply(getWeightsBetween(userId, addDays(today, -84), today), { goal: getUser(userId)?.goal || "", today });
  }
  const entries = parseMeasurements(message);
  if (!entries.length) return null;
  saveMeasurements(userId, entries, today);
  return buildMeasurementsReply(getMeasurements(userId), { saved: entries, today });
}
