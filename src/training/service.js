// Planos de treino na conversa: criação (pela ferramenta do agente), consultas sem o
// modelo ("treino de hoje", "treinos da semana", "progresso da corrida"), faltas,
// ajustes por cansaço/dor e ligação do treino feito com o plano.
import {
  saveTrainingPlan, getActiveTrainingPlan, getPendingTrainingRequest, setPendingTrainingRequest, getPlannedSessions, updatePlannedSession,
  linkWorkoutToSession, getRunsBetween
} from "../db.js";
import { addDays, weekdayOf } from "../dates.js";
import { buildTrainingPlan } from "./plan.js";
import { RUNNING_GOALS, describePaces } from "./running.js";
import { STRENGTH_GOALS } from "./strength.js";
import { ENDURANCE_MODALITIES } from "./endurance.js";
import { fiveKFromReference, formatPace, parseDuration } from "./paces.js";
import {
  adaptSession, buildDayReply, buildPlanCreatedReply, buildProgressReply, buildWeekReply,
  compareWithPlan, matchPlannedSession, modalityOf, runningProgress, weekSummary
} from "./tracking.js";

const WEEKDAY_NUMBERS = { dom: 0, domingo: 0, seg: 1, segunda: 1, ter: 2, terca: 2, qua: 3, quarta: 3, qui: 4, quinta: 4, sex: 5, sexta: 5, sab: 6, sabado: 6 };
const LEVEL_LABEL = { iniciante: "iniciante", intermediario: "intermediário", avancado: "avançado" };
const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

export function parseWeekdays(list) {
  return [...new Set((list || []).map((day) => WEEKDAY_NUMBERS[normalize(day).replace(/-feira$/, "").slice(0, 7)] ?? WEEKDAY_NUMBERS[normalize(day).slice(0, 3)]).filter((day) => day !== undefined))];
}

const mondayOf = (date) => addDays(date, -((weekdayOf(date) + 6) % 7));

// Pedido vindo do agente (ferramenta create_training_plan). Retorna o texto da resposta:
// as perguntas que faltam ou o plano criado.
export function createTrainingPlanFromRequest(userId, newRequest, today) {
  // Junta com o pedido anterior ainda incompleto: a resposta às perguntas chega em outra
  // mensagem, e o que já foi dito (objetivo, dias…) não pode se perder.
  const request = mergeRequests(getPendingTrainingRequest(userId), newRequest);
  const reply = buildPlanFromRequest(userId, request, today);
  setPendingTrainingRequest(userId, reply.created ? null : request);
  return reply.text;
}

function mergeRequests(previous, next) {
  if (!previous) return next;
  const merged = { ...previous };
  for (const [key, value] of Object.entries(next || {})) {
    if (value === null || value === undefined || (Array.isArray(value) && !value.length)) continue;
    merged[key] = value;
  }
  return merged;
}

function buildPlanFromRequest(userId, request, today) {
  const goals = [];
  const missing = [];
  const runningGoal = request.running_goal && RUNNING_GOALS[request.running_goal] ? request.running_goal : null;

  if (runningGoal) {
    if (!request.running_level && runningGoal !== "comecar") missing.push("há quanto tempo você corre e quantos km faz por semana hoje");
    if (!request.running_days_per_week && !request.available_days?.length) missing.push("quantos dias por semana pode correr (e quais dias)");
    const fiveK = fiveKFromReference({
      distanceKm: request.reference_distance_km,
      timeSeconds: parseDuration(request.reference_time),
      easyPaceSeconds: parseDuration(request.easy_pace)
    });
    if (!fiveK && runningGoal !== "comecar") missing.push("um tempo recente (ex.: 5 km em 30 min) ou o pace em que corre conversando, para calcular seus ritmos");
    goals.push({
      modality: "corrida",
      goal: runningGoal,
      level: runningGoal === "comecar" ? "iniciante" : request.running_level || "iniciante",
      daysPerWeek: request.running_days_per_week || parseWeekdays(request.available_days).length || 3,
      availableDays: parseWeekdays(request.available_days),
      currentWeeklyKm: request.current_weekly_km ?? null,
      longestRunKm: request.longest_run_km ?? null,
      fiveKSeconds: fiveK,
      eventDate: request.event_date && request.event_date > today ? request.event_date : null
    });
  }
  if (request.strength_goal || request.strength_days_per_week) {
    const goal = STRENGTH_GOALS[request.strength_goal] ? request.strength_goal : (runningGoal ? "corrida" : "hipertrofia");
    if (!request.strength_days_per_week) missing.push("quantos dias por semana quer fazer musculação");
    if (!request.equipment) missing.push("onde treina a musculação (academia, em casa com halteres ou só com o peso do corpo)");
    goals.push({
      modality: "musculacao",
      goal,
      level: request.strength_level || request.running_level || "iniciante",
      daysPerWeek: request.strength_days_per_week || 2,
      equipment: request.equipment || "academia",
      limitations: (request.limitations || []).map(normalize)
    });
  }
  if (request.other_modality && ENDURANCE_MODALITIES[request.other_modality]) {
    if (!request.other_days_per_week) missing.push(`quantos dias por semana de ${ENDURANCE_MODALITIES[request.other_modality].label}`);
    goals.push({ modality: request.other_modality, level: request.other_level || "iniciante", daysPerWeek: request.other_days_per_week || 2 });
  }

  if (!goals.length) {
    return { created: false, text: "Para montar seu plano, me diga o objetivo: por exemplo *começar a correr*, *correr 5 km / 10 km / meia / maratona* (com a data da prova, se tiver), *musculação para hipertrofia* ou outra modalidade." };
  }
  if (missing.length) {
    return { created: false, text: ["Para montar um plano sob medida, me conta:", ...missing.map((item) => `• ${item}`), "", "_Pode responder tudo numa mensagem só._"].join("\n") };
  }

  // Segunda a quinta: começa nesta semana (sem os dias que já passaram); sexta a domingo:
  // na segunda seguinte.
  const startDate = [1, 2, 3, 4].includes(weekdayOf(today)) ? mondayOf(today) : today;
  const built = buildTrainingPlan({ goals, startDate });
  const saved = saveTrainingPlan(userId, {
    goals, startDate: built.parts[0]?.plan?.start_date || startDate, weeks: built.weeks,
    paces: built.paces, warnings: built.warnings, sessions: built.sessions.filter((session) => session.date >= today)
  });
  const firstMonday = saved.start_date;
  const firstWeek = getPlannedSessions(userId, firstMonday, addDays(firstMonday, 6));
  return { created: true, text: buildPlanCreatedReply({
    plan: saved,
    goalsDescription: describeGoals(goals),
    firstWeek,
    today,
    paceLines: describePaces(built.paces) || [],
    warnings: built.warnings
  }) };
}

function describeGoals(goals) {
  return goals.map((goal) => {
    if (goal.modality === "corrida") return `🏃 Corrida: ${RUNNING_GOALS[goal.goal].label} · ${LEVEL_LABEL[goal.level]} · ${goal.availableDays?.length || goal.daysPerWeek}×/semana${goal.eventDate ? ` · prova em ${goal.eventDate.split("-").reverse().join("/")}` : ""}`;
    if (goal.modality === "musculacao") return `🏋️ Musculação: ${STRENGTH_GOALS[goal.goal].label} · ${goal.daysPerWeek}×/semana · ${goal.equipment}`;
    return `🚴 ${ENDURANCE_MODALITIES[goal.modality].label}: ${goal.daysPerWeek}×/semana`;
  }).join("\n");
}

// Intenções de treino resolvidas sem o modelo.
export function detectTrainingIntent(message) {
  const text = normalize(message);
  if (/\b(?:progresso|evolucao|desempenho|resultado)\b.*\b(?:corrida|correr|corridas|treinos?)\b|\bcomo (?:esta|anda|vai) (?:a )?minha corrida\b/.test(text)) return { type: "progress" };
  if (/\btreinos?\b.*\bamanha\b|\bamanha\b.*\btreino\b/.test(text)) return { type: "day", offset: 1 };
  if (/\btreinos? da semana\b|\bplano da semana\b|\bsemana de treinos?\b|\bmeu plano de treino\b|\bmeus treinos\b/.test(text)) return { type: "week" };
  if (/\b(?:treino|treinar)\b.*\bhoje\b|\bqual (?:e |eh )?(?:o )?meu treino\b|\bo que (?:eu )?(?:vou )?treino hoje\b/.test(text)
    && !/\b(?:pulei|faltei|nao)\b/.test(text)) return { type: "day", offset: 0 };
  if (/\b(?:pulei|faltei|perdi) (?:o )?treino\b|\bnao (?:consegui|deu|vou conseguir|vou) (?:pra |para )?treinar\b|\bnao treinei\b/.test(text)) return { type: "skip" };
  if (/\b(?:dor|doendo|doi|lesao|lesionei|machuquei|torci)\b/.test(text) && !/\bdor de cabeca\b/.test(text)) return { type: "adapt", reason: "dor" };
  if (/\b(?:cansad[oa]|exaust[oa]|esgotad[oa]|dormi mal|dormi pouco|sem energia|indispost[oa])\b/.test(text)) return { type: "adapt", reason: "cansaco" };
  return null;
}

// Semana anterior com menos de 60% feito: a corrida desta semana não sobe de carga
// (as sessões ainda pendentes ficam no volume da semana passada).
function holdLoadIfBehind(userId, today, plan) {
  const monday = mondayOf(today);
  const previous = getPlannedSessions(userId, addDays(monday, -7), addDays(monday, -1));
  if (previous.length < 2) return null;
  const summary = weekSummary(previous);
  if (summary.done / summary.total >= 0.6) return null;
  const current = getPlannedSessions(userId, monday, addDays(monday, 6));
  const pending = current.filter((session) => session.status === "planejado" && session.modality === "corrida" && session.distance_km && session.date >= today && !session.note);
  const currentKm = weekSummary(current).planned_km;
  if (!pending.length || !(currentKm > summary.planned_km) || !plan) return null;
  const factor = summary.planned_km / currentKm;
  for (const session of pending) {
    updatePlannedSession(session.id, {
      distance_km: Math.max(2, Math.round(session.distance_km * factor * 2) / 2),
      duration_min: session.duration_min ? Math.round(session.duration_min * factor) : null,
      note: "Carga mantida: semana passada teve menos de 60% dos treinos feitos."
    });
  }
  return `Semana passada você fez ${summary.done} de ${summary.total} treinos, então mantive a carga desta semana no nível da anterior em vez de aumentar.`;
}

export function handleTrainingMessage(userId, message, today) {
  const intent = detectTrainingIntent(message);
  if (!intent) return null;
  const plan = getActiveTrainingPlan(userId);

  if (intent.type === "progress") {
    const runs = getRunsBetween(userId, addDays(today, -27), today);
    const pastSessions = plan ? getPlannedSessions(userId, plan.start_date, addDays(today, -1)) : [];
    const adherence = pastSessions.length ? pastSessions.filter((session) => session.status === "feito").length / pastSessions.length : null;
    return buildProgressReply(runningProgress(runs, today), { adherence });
  }
  if (!plan) {
    return intent.type === "adapt" || intent.type === "skip"
      ? null
      : "Você ainda não tem um plano de treino. Me diga seu objetivo (ex.: *quero correr 10 km em 2 meses, 4 dias por semana*) que eu monto um sob medida.";
  }
  if (intent.type === "day") {
    const date = addDays(today, intent.offset);
    if (intent.offset === 0) holdLoadIfBehind(userId, today, plan);
    const sessions = getPlannedSessions(userId, date, date);
    const next = getPlannedSessions(userId, addDays(date, 1), addDays(date, 14))[0] || null;
    return buildDayReply({ sessions, date, today, next });
  }
  if (intent.type === "week") {
    const note = holdLoadIfBehind(userId, today, plan);
    const monday = mondayOf(today);
    const sessions = getPlannedSessions(userId, monday, addDays(monday, 6));
    return buildWeekReply({ sessions, today, plan, weekNumber: sessions[0]?.week, adaptationNote: note });
  }
  const todaySessions = getPlannedSessions(userId, today, today).filter((session) => session.status === "planejado");
  if (!todaySessions.length) return null;
  if (intent.type === "skip") {
    for (const session of todaySessions) updatePlannedSession(session.id, { status: "pulado" });
    const next = getPlannedSessions(userId, addDays(today, 1), addDays(today, 14))[0];
    return [
      "👍 Tudo bem, marquei o treino de hoje como não feito. Não precisa compensar: seguimos o plano normalmente.",
      next ? `Próximo: ${next.title}${next.distance_km ? ` · ${next.distance_km.toLocaleString("pt-BR")} km` : ""} (${next.date.split("-").reverse().slice(0, 2).join("/")}).` : null
    ].filter(Boolean).join("\n");
  }
  const messages = todaySessions.map((session) => {
    const { changes, message: reply } = adaptSession(session, intent.reason);
    updatePlannedSession(session.id, changes);
    return reply;
  });
  return messages.join("\n\n");
}

// Depois de gravar um treino: liga ao plano e devolve linhas extras para a resposta.
export function afterWorkoutSaved(userId, workout, today) {
  const lines = [];
  if (workout.distance_km > 0 && workout.duration_min > 0) {
    lines.push(`🏃 ${Number(workout.distance_km).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km · pace ${formatPace(workout.duration_min * 60 / workout.distance_km)}/km`);
  }
  const plan = getActiveTrainingPlan(userId);
  if (!plan) return lines;
  const planned = getPlannedSessions(userId, addDays(today, -1), today);
  const session = matchPlannedSession({ modality: modalityOf(workout.workout_type), date: today }, planned);
  if (!session) return lines;
  updatePlannedSession(session.id, { status: "feito", workout_id: workout.id });
  linkWorkoutToSession(workout.id, session.id);
  lines.push("", ...compareWithPlan(session, workout));
  return lines;
}
