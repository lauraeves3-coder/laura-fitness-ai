// ACO-05: sequências e conquistas, sem culpa. Sequência quebrada nunca vira bronca:
// "recomeça hoje". Comemoração curta quando a sequência de registros chega a um marco.
import { getProgressData, getUser } from "./db.js";
import { addDays } from "./dates.js";

const MILESTONES = [3, 7, 14, 21, 30, 60, 100];

// Dias seguidos terminando hoje (ou ontem, se hoje ainda não teve registro).
export function currentStreak(dates, today) {
  const set = new Set(dates);
  let day = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export function bestStreak(dates) {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let previous = null;
  for (const day of sorted) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

export function computeAchievements({ mealDays, waterDays, workouts }, { today, waterGoalMl, proteinTarget }) {
  const mealDates = mealDays.map((day) => day.date);
  const waterHits = waterGoalMl ? waterDays.filter((day) => Number(day.ml) >= waterGoalMl).length : 0;
  const proteinHits = proteinTarget ? mealDays.filter((day) => Number(day.protein_g) >= proteinTarget * 0.9).length : 0;
  const best = bestStreak(mealDates);
  const list = [
    ["🍽️", "Primeiro registro", mealDates.length, 1, "dia registrado"],
    ["📅", "7 dias seguidos registrando", best, 7, "dias seguidos"],
    ["📅", "30 dias de registro", mealDates.length, 30, "dias registrados"],
    ["💧", "Meta de água em 5 dias", waterHits, 5, "dias na meta de água"],
    ["🥩", "Proteína em dia por 5 dias", proteinHits, 5, "dias com a proteína em dia"],
    ["🏃", "Primeiro treino", workouts, 1, "treino"],
    ["🏋️", "10 treinos", workouts, 10, "treinos"],
    ["🔥", "50 treinos", workouts, 50, "treinos"]
  ];
  return {
    streak: currentStreak(mealDates, today),
    best,
    unlocked: list.filter(([, , value, goal]) => value >= goal),
    next: list.filter(([, , value, goal]) => value < goal)
  };
}

export function isAchievementsRequest(message) {
  const text = String(message || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
  return /\b(?:minhas conquistas|conquistas|minha sequencia|meus marcos|minhas medalhas|quantos dias seguidos)\b/.test(text);
}

export function buildAchievementsReply(userId, today, { waterGoalMl, proteinTarget }) {
  const data = getProgressData(userId, addDays(today, -365));
  const { streak, best, unlocked, next } = computeAchievements(data, { today, waterGoalMl, proteinTarget });
  const lines = ["🏅 *Suas conquistas*", ""];
  lines.push(streak > 0
    ? `🔥 Sequência atual: *${streak} ${streak === 1 ? "dia" : "dias"}* registrando${best > streak ? ` (seu recorde: ${best})` : ""}`
    : best > 0 ? `🔥 Sua melhor sequência foi de ${best} dias. Recomeça hoje: um registro já conta.` : "🔥 Sua sequência começa no primeiro registro de refeição.");
  if (unlocked.length) lines.push("", "*Desbloqueadas*", ...unlocked.map(([icon, name]) => `✅ ${icon} ${name}`));
  if (next.length) {
    lines.push("", "*Próximas*", ...next.slice(0, 3).map(([icon, name, value, goal, unit]) => `▫️ ${icon} ${name} — faltam ${goal - value} ${goal - value === 1 ? unit.replace(/s\b/g, "") : unit}`));
  }
  return lines.join("\n");
}

// Comemoração no primeiro registro do dia, quando a sequência chega a um marco.
export function streakCelebration(userId, today) {
  const data = getProgressData(userId, addDays(today, -120));
  const todayMeals = data.mealDays.find((day) => day.date === today);
  if (!todayMeals) return null;
  const streak = currentStreak(data.mealDays.map((day) => day.date), today);
  if (!MILESTONES.includes(streak)) return null;
  const name = getUser(userId)?.name;
  // Nome padrão é o próprio id (telefone): só usa quando a pessoa disse o nome.
  const realName = name && name !== userId && !/\d/.test(name) ? name.split(/\s+/)[0] : null;
  return `🔥 *${streak} dias seguidos registrando!*${realName ? ` Mandou bem, ${realName}.` : ""} Constância é o que dá resultado.`;
}
