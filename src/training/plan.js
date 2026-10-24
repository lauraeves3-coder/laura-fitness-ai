// ESP-02/04: orquestra os planos por modalidade e junta numa agenda única. Musculação é
// encaixada nos dias sem corrida forte; treino de pernas nunca na véspera de longão,
// intervalado ou prova. Funções puras.
import { addDays, weekdayOf } from "../dates.js";
import { generateRunningPlan, mondayOnOrAfter } from "./running.js";
import { generateStrengthPlan } from "./strength.js";
import { generateEndurancePlan, ENDURANCE_MODALITIES } from "./endurance.js";

const HARD_RUN = new Set(["longao", "intervalado", "limiar", "ritmo_prova", "prova", "teste"]);
const LEG_HEAVY = /Pernas|Inferiores|Corpo inteiro|Fortalecimento/;
const STRENGTH_DAYS = { 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] };

// Sessões de musculação datadas, semana a semana, evitando conflito com a corrida.
export function scheduleStrength({ strengthPlan, startDate, weeks, runningSessions = [] }) {
  const monday = mondayOnOrAfter(startDate);
  const runByDate = new Map(runningSessions.map((session) => [session.date, session]));
  const sessions = [];
  for (let week = 0; week < weeks; week++) {
    const weekMonday = addDays(monday, week * 7);
    const preferred = STRENGTH_DAYS[strengthPlan.days_per_week].map((day) => addDays(weekMonday, (day + 6) % 7));
    const allDays = Array.from({ length: 7 }, (_, offset) => addDays(weekMonday, offset));
    const taken = new Set();
    strengthPlan.sessions.forEach((template, index) => {
      const legDay = LEG_HEAVY.test(template.label);
      const okDay = (date) => {
        if (taken.has(date)) return false;
        const run = runByDate.get(date);
        const nextRun = runByDate.get(addDays(date, 1));
        if (run && HARD_RUN.has(run.session_type)) return false;
        if (legDay && nextRun && HARD_RUN.has(nextRun.session_type)) return false;
        return true;
      };
      const date = [preferred[index], ...preferred, ...allDays].find((candidate) => candidate && okDay(candidate));
      if (!date) return;
      taken.add(date);
      sessions.push({
        date,
        modality: "musculacao",
        session_type: "forca",
        title: template.label,
        description: template.exercises.map((exercise) => `${exercise.name}: ${exercise.sets} × ${exercise.reps}`).join("; "),
        exercises: template.exercises,
        duration_min: 45 + Math.max(0, template.exercises.length - 5) * 8,
        intensity: "moderado"
      });
    });
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

// goals: [{ modality: "corrida"|"musculacao"|ciclismo..., ...parâmetros do gerador }].
// Retorna { sessions, summary, paces, warnings } com todas as sessões datadas.
export function buildTrainingPlan({ goals, startDate }) {
  const running = goals.find((goal) => goal.modality === "corrida");
  const strength = goals.find((goal) => goal.modality === "musculacao");
  const others = goals.filter((goal) => ENDURANCE_MODALITIES[goal.modality]);
  const result = { sessions: [], parts: [], paces: null, warnings: [] };

  let weeks = 8;
  if (running) {
    const plan = generateRunningPlan({ ...running, startDate });
    weeks = plan.weeks.length;
    result.sessions.push(...plan.weeks.flatMap((week) => week.sessions.map((session) => ({ ...session, week: week.number, phase: week.phase }))));
    result.paces = plan.paces;
    result.analysis = plan.analysis || null;
    result.warnings.push(...(plan.warnings || []));
    result.parts.push({ modality: "corrida", plan });
  }
  for (const goal of others) {
    const plan = generateEndurancePlan({ ...goal, startDate, weeks });
    result.sessions.push(...plan.weeks.flatMap((week) => week.sessions.map((session) => ({ ...session, week: week.number, phase: week.phase }))));
    result.parts.push({ modality: goal.modality, plan });
  }
  if (strength) {
    const plan = generateStrengthPlan({ ...strength, goal: strength.goal || (running ? "corrida" : "hipertrofia") });
    const scheduled = scheduleStrength({ strengthPlan: plan, startDate, weeks, runningSessions: result.sessions.filter((session) => session.modality === "corrida") });
    result.sessions.push(...scheduled);
    result.parts.push({ modality: "musculacao", plan });
  }
  result.sessions.sort((a, b) => a.date.localeCompare(b.date) || a.modality.localeCompare(b.modality));
  result.weeks = weeks;
  return result;
}

export { weekdayOf };
