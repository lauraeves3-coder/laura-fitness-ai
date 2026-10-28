// ACO-02: passos do dia pela conversa ("andei 8.000 passos", "dei 10 mil passos",
// "passos hoje: 7500") e meta de passos ("minha meta de passos é 10000"). Sem o modelo.
import { getStepsOn, getUser, saveSteps, setStepsGoal } from "./db.js";

const DEFAULT_GOAL = 8000;
const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

// "8.000" / "8000" / "8 mil" / "8,5 mil" / "8k" → número.
function parseSteps(raw, thousand) {
  const value = Number(String(raw).replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  const steps = Math.round(thousand ? value * 1000 : value);
  return steps >= 100 && steps <= 100000 ? steps : null;
}

export function detectSteps(message) {
  const text = normalize(message);
  if (!/\bpassos\b/.test(text)) return null;
  const goal = text.match(/\bmeta (?:diaria )?de passos (?:e |eh |para |pra |:)?\s*(\d{1,3}(?:[.,]\d{3})*|\d+(?:[.,]\d+)?)\s*(mil|k)?\b/);
  if (goal) {
    const steps = parseSteps(goal[1], goal[2]);
    return steps ? { type: "goal", steps } : null;
  }
  if (/\b(?:quantos|quantas|qual)\b/.test(text)) return { type: "query" };
  const count = text.match(/(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(mil|k)?\s*passos\b/) || text.match(/\bpassos\b[^\d]{0,15}(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(mil|k)?/);
  if (!count) return null;
  const steps = parseSteps(count[1], count[2]);
  return steps ? { type: "log", steps } : null;
}

export function stepsGoalFor(user) {
  return Number(user?.steps_goal) > 0 ? Number(user.steps_goal) : DEFAULT_GOAL;
}

export function stepsLine(steps, goal) {
  if (steps == null) return null;
  const pct = Math.round(steps / goal * 100);
  const filled = Math.min(10, Math.round(pct / 10));
  return `👟 *Passos:* ${steps.toLocaleString("pt-BR")} de ${goal.toLocaleString("pt-BR")} ${"▓".repeat(filled)}${"░".repeat(10 - filled)} ${pct}%`;
}

export function handleStepsMessage(userId, message, today) {
  const intent = detectSteps(message);
  if (!intent) return null;
  const user = getUser(userId);
  if (intent.type === "goal") {
    setStepsGoal(userId, intent.steps);
    return `🎯 Meta de passos definida: *${intent.steps.toLocaleString("pt-BR")} por dia*.`;
  }
  const goal = stepsGoalFor(user);
  if (intent.type === "query") {
    const steps = getStepsOn(userId, today);
    return steps == null ? "👟 Ainda não tenho seus passos de hoje. Me diga, por exemplo: *andei 8.000 passos*." : stepsLine(steps, goal);
  }
  saveSteps(userId, today, intent.steps);
  const left = goal - intent.steps;
  return [
    stepsLine(intent.steps, goal),
    left > 0
      ? `Faltam ${left.toLocaleString("pt-BR")} passos (~${Math.ceil(left / 100)} min de caminhada). Uma volta depois do almoço já ajuda!`
      : "✅ Meta de passos batida hoje! 🎉"
  ].join("\n");
}
