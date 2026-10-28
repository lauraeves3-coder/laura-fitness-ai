// CRP-05: análise do sono dos últimos 14 dias. Média, noites curtas, regularidade e
// cruzamentos com a energia do check-in e as calorias do dia, sempre como coincidência
// ("nos dias após…"), nunca como causa. Sem o modelo.
import { getActivityBetween, getCheckinsBetween, getDailyCaloriesBetween } from "./db.js";
import { addDays } from "./dates.js";

const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
const fmt = (value, digits = 1) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: digits });

export function isSleepQuery(message) {
  const text = normalize(message).replace(/[?!.]+$/, "");
  return /\b(?:como (?:esta|anda|ta|tem sido) (?:o )?meu sono|meu sono|analise do (?:meu )?sono|resumo do sono|quanto (?:eu )?(?:tenho dormido|dormi essa semana)|minhas noites)\b/.test(text)
    && !/\b(?:dormi \d|dormi mal|dormi bem)\b/.test(text);
}

// sleeps: [{ hours, quality, date }]; checkins: [{ date, energy }]; calories: [{ date, calories }].
export function buildSleepReport({ sleeps, checkins = [], calories = [] }) {
  if (sleeps.length < 3) {
    return "😴 Ainda tenho poucas noites registradas. Me conte como dormiu (ex.: *dormi 7h*) ou faça o *check-in* de manhã; com 3 noites eu já mostro a análise.";
  }
  const hours = sleeps.map((sleep) => Number(sleep.hours));
  const average = hours.reduce((sum, value) => sum + value, 0) / hours.length;
  const short = sleeps.filter((sleep) => Number(sleep.hours) < 7);
  const spread = Math.max(...hours) - Math.min(...hours);
  const best = sleeps.reduce((top, sleep) => (Number(sleep.hours) > Number(top.hours) ? sleep : top));
  const worst = sleeps.reduce((low, sleep) => (Number(sleep.hours) < Number(low.hours) ? sleep : low));
  const day = (date) => date.split("-").reverse().slice(0, 2).join("/");
  const lines = [
    "😴 *Seu sono — últimos 14 dias*",
    "",
    `• Média: *${fmt(average)} h* por noite (${sleeps.length} noites registradas)`,
    `• Noites com menos de 7 h: ${short.length} de ${sleeps.length}`,
    `• Melhor: ${fmt(best.hours)} h (${day(best.date)}) · pior: ${fmt(worst.hours)} h (${day(worst.date)})`,
    spread >= 2.5 ? "• Horas bem irregulares de uma noite para outra." : "• Horas regulares entre as noites. 👍"
  ];

  // Cruzamentos: só com dados suficientes dos dois lados, e como coincidência.
  const shortDays = new Set(short.map((sleep) => sleep.date));
  const crossings = [];
  const energyShort = checkins.filter((item) => shortDays.has(item.date) && item.energy);
  const energyRest = checkins.filter((item) => !shortDays.has(item.date) && item.energy);
  if (energyShort.length >= 2 && energyRest.length >= 2) {
    const mean = (list) => list.reduce((sum, item) => sum + Number(item.energy), 0) / list.length;
    crossings.push(`Nos dias após dormir menos de 7 h, sua energia no check-in foi em média ${fmt(mean(energyShort))}/5, contra ${fmt(mean(energyRest))}/5 nos outros dias.`);
  }
  const kcalShort = calories.filter((item) => shortDays.has(item.date) && item.calories > 0);
  const kcalRest = calories.filter((item) => !shortDays.has(item.date) && item.calories > 0);
  if (kcalShort.length >= 2 && kcalRest.length >= 2) {
    const mean = (list) => list.reduce((sum, item) => sum + Number(item.calories), 0) / list.length;
    const difference = mean(kcalShort) - mean(kcalRest);
    if (Math.abs(difference) >= 150) {
      crossings.push(`Nos dias após noites curtas você comeu em média ${fmt(Math.abs(difference), 0)} kcal ${difference > 0 ? "a mais" : "a menos"} que nos outros.`);
    }
  }
  if (crossings.length) {
    lines.push("", "🔗 *O que coincidiu*", ...crossings.map((line) => `• ${line}`), "_Coincidência nos seus dados, não prova de causa._");
  }
  lines.push("", average < 7
    ? "💡 Para dormir mais: horário fixo para deitar, telas longe 30 min antes, cafeína só até o meio da tarde e quarto escuro e fresco."
    : "💡 Sono em dia! Manter o horário regular, inclusive no fim de semana, ajuda a manter assim.");
  return lines.join("\n");
}

export function handleSleepQuery(userId, message, today) {
  if (!isSleepQuery(message)) return null;
  const start = addDays(today, -13);
  const sleeps = (getActivityBetween(userId, start, today).sleeps || [])
    .map((sleep) => ({ hours: sleep.hours, date: String(sleep.logged_at).slice(0, 10) }));
  // Uma noite por dia (o último registro do dia).
  const byDate = new Map(sleeps.map((sleep) => [sleep.date, sleep]));
  return buildSleepReport({
    sleeps: [...byDate.values()],
    checkins: getCheckinsBetween(userId, start, today),
    calories: getDailyCaloriesBetween(userId, start, today)
  });
}
