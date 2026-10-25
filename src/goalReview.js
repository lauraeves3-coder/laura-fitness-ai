// ACO-04: metas que ficaram para trás. Função pura: recebe perfil, pesagens, calorias por
// dia e treinos por semana do plano e devolve os motivos para revisar. Nunca altera nada:
// a resposta só sugere (DEC-07), e o recálculo fica com a pessoa.
import { addDays, daysBetween } from "./dates.js";

const LOW_ACTIVITY = new Set(["sedentary", "light", "sedentario", "sedentaria", "sedentária", "leve"]);
const fmt = (value, digits = 0) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function reviewTargets({ user = {}, weights = [], dailyCalories = [], plannedTrainingDays = null, today }) {
  const reasons = [];
  const actions = new Set();
  const goal = String(user.goal || "").toLocaleLowerCase("pt-BR");
  const losing = /emagrec|perder|defini/.test(goal);
  const gaining = /hipertrof|ganh|massa|bulk/.test(goal);
  const automatic = user.calorie_target_mode !== "custom";

  // 1. Metas calculadas com um peso que já mudou 2 kg ou mais (DEC-07).
  const weight = Number(user.weight_kg);
  const base = Number(user.targets_weight_kg);
  if (automatic && weight > 0 && base > 0 && Math.abs(weight - base) >= 2) {
    reasons.push(`Suas metas foram calculadas com ${fmt(base, 1)} kg e hoje você está com ${fmt(weight, 1)} kg.`);
    actions.add("restaure minhas metas automáticas");
  }

  // 2. Platô: 3+ pesagens cobrindo 3+ semanas sem o peso andar na direção do objetivo.
  const recent = weights.filter((entry) => daysBetween(entry.date, today) <= 35);
  if ((losing || gaining) && recent.length >= 3 && daysBetween(recent[0].date, recent.at(-1).date) >= 21) {
    const change = recent.at(-1).weight_kg - recent[0].weight_kg;
    const weeks = Math.round(daysBetween(recent[0].date, recent.at(-1).date) / 7);
    if (losing && change > -0.3) {
      reasons.push(change > 0.3
        ? `Seu objetivo é emagrecer, mas o peso subiu ${fmt(change, 1)} kg nas últimas ${weeks} semanas.`
        : `Seu peso está parado há ${weeks} semanas (${fmt(recent[0].weight_kg, 1)} → ${fmt(recent.at(-1).weight_kg, 1)} kg).`);
      actions.add("revisar a meta de calorias");
    } else if (gaining && change < 0.2) {
      reasons.push(`Seu objetivo é ganhar massa, mas o peso não subiu nas últimas ${weeks} semanas (${fmt(recent[0].weight_kg, 1)} → ${fmt(recent.at(-1).weight_kg, 1)} kg).`);
      actions.add("revisar a meta de calorias");
    }
  }

  // 3. Meta difícil de seguir: 10+ dias registrados nas últimas 2 semanas com média bem
  // acima (15%+) ou bem abaixo (25%+) da meta.
  const target = Number(user.daily_calorie_target);
  const logged = dailyCalories.filter((day) => day.date < today && day.date >= addDays(today, -14) && day.calories > 0);
  if (target > 0 && target <= 10000 && logged.length >= 10) {
    const average = logged.reduce((sum, day) => sum + day.calories, 0) / logged.length;
    if (average > target * 1.15 || average < target * 0.75) {
      reasons.push(`Nas últimas 2 semanas sua média foi ${fmt(average)} kcal por dia, ${average > target ? "acima" : "abaixo"} da meta de ${fmt(target)} kcal. Talvez a meta precise caber melhor na sua rotina.`);
      actions.add("revisar a meta de calorias");
    }
  }

  // 4. Plano de treino mais intenso que o nível de atividade usado no cálculo.
  if (plannedTrainingDays >= 4 && LOW_ACTIVITY.has(String(user.activity_level || "sedentary").toLocaleLowerCase("pt-BR"))) {
    reasons.push(`Seu plano tem ${plannedTrainingDays} treinos por semana, mas suas metas usam nível de atividade ${/light|leve/.test(user.activity_level || "") ? "leve" : "sedentário"}.`);
    actions.add("meu nível de atividade é moderado");
  }

  return { reasons, actions: [...actions] };
}

export function describeTargetReview({ reasons, actions }) {
  if (!reasons.length) return [];
  const commands = actions.filter((action) => !action.startsWith("revisar")).map((action) => `*${action}*`);
  return [
    "",
    "🔎 *Vale revisar suas metas*",
    ...reasons.map((reason) => `• ${reason}`),
    commands.length
      ? `Se quiser ajustar, mande ${commands.join(" ou ")}${actions.includes("revisar a meta de calorias") ? ", ou me diga a nova meta de calorias" : ""}. Não mudei nada.`
      : "Se quiser, me diga a nova meta de calorias (ex.: *minha meta é 1700 kcal*). Não mudei nada."
  ];
}
