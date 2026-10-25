// ESP-07: gasto energético estimado do treino (MET × peso × horas; corrida e caminhada pela
// distância, que varia menos com o ritmo). Sempre estimativa: não entra na meta calórica.
import { modalityOf } from "./tracking.js";

const MET = { musculacao: 5, natacao: 7, funcional: 6, hiit: 8, caminhada: 3.5, corrida: 9, ciclismo: 7 };
const OTHER_MET = [
  [/yoga|pilates|alongamento|mobilidade/, 3],
  [/futebol|futsal|basquete|volei|tenis|beach|luta|jiu|muay|boxe/, 7],
  [/danca|zumba/, 5]
];

function cyclingMet(speedKmh) {
  if (!(speedKmh > 0)) return MET.ciclismo;
  return speedKmh < 16 ? 4 : speedKmh < 19 ? 6.8 : speedKmh < 22 ? 8 : speedKmh < 25 ? 10 : 12;
}

// workout: { workout_type, duration_min, distance_km }. Retorna kcal (inteiro) ou null.
export function estimateWorkoutCalories(workout, weightKg) {
  const weight = Number(weightKg);
  const minutes = Number(workout?.duration_min) || 0;
  const km = Number(workout?.distance_km) || 0;
  if (!(weight >= 20 && weight <= 400) || (!(minutes > 0) && !(km > 0))) return null;
  const modality = modalityOf(workout.workout_type);
  if (modality === "corrida" && km > 0) return Math.round(weight * km);
  if (modality === "caminhada" && km > 0) return Math.round(0.55 * weight * km);
  if (!(minutes > 0)) return null;
  const text = String(workout.workout_type || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
  const met = modality === "ciclismo"
    ? cyclingMet(km / (minutes / 60))
    : MET[modality] ?? OTHER_MET.find(([pattern]) => pattern.test(text))?.[1] ?? 5;
  return Math.round(met * weight * minutes / 60);
}

export function describeWorkoutCalories(workout, weightKg) {
  const kcal = estimateWorkoutCalories(workout, weightKg);
  return kcal ? `🔥 Gasto estimado: ~${kcal.toLocaleString("pt-BR")} kcal _(estimativa; não somei à sua meta do dia)_` : null;
}
