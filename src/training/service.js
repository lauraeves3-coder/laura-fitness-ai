// Planos de treino na conversa: criação (pela ferramenta do agente), consultas sem o
// modelo ("treino de hoje", "treinos da semana", "progresso da corrida"), faltas,
// ajustes por cansaço/dor e ligação do treino feito com o plano.
import {
  saveTrainingPlan, getActiveTrainingPlan, getPendingTrainingRequest, setPendingTrainingRequest, getPlannedSessions, updatePlannedSession,
  linkWorkoutToSession, getRunsBetween, updateTrainingPlan
} from "../db.js";
import { addDays, weekdayOf } from "../dates.js";
import { buildTrainingPlan } from "./plan.js";
import { RUNNING_GOALS, describePaces, describeTargetAnalysis, expectedFiveK, paceForSession } from "./running.js";
import { STRENGTH_GOALS } from "./strength.js";
import { ENDURANCE_MODALITIES } from "./endurance.js";
import { fiveKFromReference, formatDuration, formatPace, parseDuration, trainingPaces } from "./paces.js";
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
  const merged = mergeRequests(getPendingTrainingRequest(userId), newRequest);
  const { request, note } = withRunningHistory(userId, merged, today);
  const reply = buildPlanFromRequest(userId, request, today);
  setPendingTrainingRequest(userId, reply.created ? null : merged);
  return reply.created && note ? reply.text.replace("\n\n*Primeira semana*", `\n\n${note}\n\n*Primeira semana*`) : reply.text;
}

// COR-02: o histórico das últimas 4 semanas (Strava ou registros) preenche o que a pessoa
// não informou: volume semanal, maior corrida, pace confortável e nível.
function withRunningHistory(userId, request, today) {
  if (!request.running_goal || request.running_goal === "comecar") return { request, note: null };
  const runs = getRunsBetween(userId, addDays(today, -27), today);
  if (runs.length < 2) return { request, note: null };
  const weeklyKm = Math.round(runs.reduce((sum, run) => sum + run.distance_km, 0) / 4);
  const longest = Math.max(...runs.map((run) => run.distance_km));
  const paces = runs.map((run) => run.pace_s_per_km).filter(Boolean).sort((a, b) => a - b);
  const medianPace = paces[Math.floor(paces.length / 2)];
  const filled = { ...request };
  filled.current_weekly_km ??= weeklyKm;
  filled.longest_run_km ??= Math.round(longest * 10) / 10;
  if (!filled.reference_time && !filled.easy_pace && medianPace) filled.easy_pace = formatPace(medianPace);
  filled.running_level ??= weeklyKm < 15 ? "iniciante" : weeklyKm < 35 ? "intermediario" : "avancado";
  return {
    request: filled,
    note: `📈 Usei suas corridas das últimas 4 semanas: ~${weeklyKm} km/semana, maior corrida ${String(Math.round(longest * 10) / 10).replace(".", ",")} km${medianPace ? `, pace médio ${formatPace(medianPace)}/km` : ""}.`
  };
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
    // COR-06: meta de tempo ("5 km abaixo de 25 min") ou de pace ("pace 5:00 nos 10 km").
    const distance = RUNNING_GOALS[runningGoal].distance;
    const targetSeconds = distance
      ? parseDuration(request.target_time) || (parseDuration(request.target_pace) ? Math.round(parseDuration(request.target_pace) * distance) : null)
      : null;
    goals.push({
      targetSeconds,
      fiveKEstimated: Boolean(targetSeconds && !(request.reference_distance_km > 0 && parseDuration(request.reference_time))),
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
  const running = goals.find((goal) => goal.modality === "corrida");
  if (running && built.analysis) {
    running.target = { seconds: built.analysis.target, five_k: built.analysis.target_five_k, pace: built.analysis.target_pace };
  }
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
    analysisLines: describeTargetAnalysis(built.analysis),
    warnings: built.warnings
  }) };
}

function describeGoals(goals) {
  return goals.map((goal) => {
    if (goal.modality === "corrida") return `🏃 Corrida: ${RUNNING_GOALS[goal.goal].label}${goal.targetSeconds ? ` em ${formatDuration(goal.targetSeconds)}` : ""} · ${LEVEL_LABEL[goal.level]} · ${goal.availableDays?.length || goal.daysPerWeek}×/semana${goal.eventDate ? ` · prova em ${goal.eventDate.split("-").reverse().join("/")}` : ""}`;
    if (goal.modality === "musculacao") return `🏋️ Musculação: ${STRENGTH_GOALS[goal.goal].label} · ${goal.daysPerWeek}×/semana · ${goal.equipment}`;
    return `🚴 ${ENDURANCE_MODALITIES[goal.modality].label}: ${goal.daysPerWeek}×/semana`;
  }).join("\n");
}

// Intenções de treino resolvidas sem o modelo.
export function detectTrainingIntent(message) {
  const text = normalize(message);
  // COR-06: resultado do teste ("teste 3 km em 15:10", "fiz o teste em 15 min e 20 s").
  const testTime = /\bteste\b/.test(text) && text.match(/\bem\s+(\d{1,2}:\d{2}(?::\d{2})?|\d+\s*(?:min|minutos?)(?:\s*e?\s*\d+\s*(?:s|seg|segundos?))?)/)?.[1];
  if (testTime && parseDuration(testTime)) {
    const distanceKm = Number(text.match(/(\d+(?:[.,]\d+)?)\s*(?:km|k\b|quilometros?)/)?.[1]?.replace(",", ".") || 3);
    return { type: "test", distanceKm, seconds: parseDuration(testTime) };
  }
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
  if (intent.type === "test") {
    const pending = getPlannedSessions(userId, addDays(today, -3), today).find((session) => session.session_type === "teste" && session.status === "planejado");
    if (pending) updatePlannedSession(pending.id, { status: "feito" });
    return recalibrateFromTest(userId, intent, today) || "Anotei o teste, mas você ainda não tem um plano de corrida para recalibrar. Me peça para montar um com sua meta (ex.: *5 km abaixo de 25 min*).";
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
  const comparison = linkWorkoutToPlan(userId, workout, today);
  return comparison.length ? [...lines, "", ...comparison] : lines;
}

// Liga o treino (manual ou importado do Strava) à sessão do plano daquele dia e devolve
// as linhas de comparação; [] sem plano ou sem sessão correspondente.
export function linkWorkoutToPlan(userId, workout, date) {
  if (!getActiveTrainingPlan(userId)) return [];
  const planned = getPlannedSessions(userId, addDays(date, -1), date);
  const session = matchPlannedSession({ modality: modalityOf(workout.workout_type), date }, planned);
  if (!session) return [];
  updatePlannedSession(session.id, { status: "feito", workout_id: workout.id });
  linkWorkoutToSession(workout.id, session.id);
  const lines = compareWithPlan(session, workout);
  if (session.session_type !== "teste") return lines;
  // Teste registrado só com os 3 km: recalibra direto; com aquecimento junto, pede o tempo.
  if (workout.distance_km >= 2.8 && workout.distance_km <= 3.4 && workout.duration_min > 0) {
    return [...lines, "", recalibrateFromTest(userId, { distanceKm: workout.distance_km, seconds: workout.duration_min * 60 }, date)];
  }
  return [...lines, "", "🔬 Me mande o tempo só dos 3 km do teste (ex.: _teste 3 km em 15:30_) para eu recalibrar seus ritmos."];
}

// COR-06: novo tempo medido num teste → 5 km atual. Os treinos futuros de corrida ganham
// ritmos novos: leves pelo condicionamento medido, qualidade pela progressão até a meta.
export function recalibrateFromTest(userId, { distanceKm, seconds }, today) {
  const plan = getActiveTrainingPlan(userId);
  const running = plan?.goals?.find((goal) => goal.modality === "corrida");
  const fiveK = fiveKFromReference({ distanceKm, timeSeconds: seconds });
  if (!running || !fiveK) return null;
  const before = plan.paces?.five_k ? plan.paces.five_k * 5 : running.fiveKSeconds;
  const recent = getPlannedSessions(userId, addDays(today, -6), today).filter((session) => session.week);
  const future = getPlannedSessions(userId, addDays(today, 1), addDays(today, 7 * 30))
    .filter((session) => session.modality === "corrida" && session.status === "planejado");
  const testWeek = recent.at(-1)?.week ?? Math.max(1, (future[0]?.week ?? 2) - 1);
  const target = running.target || null;
  for (const session of future) {
    const expected = expectedFiveK({ current: fiveK, target: target?.five_k, week: session.week || testWeek + 1, fromWeek: testWeek + 1, totalWeeks: plan.weeks });
    const pace = paceForSession(session, { current: fiveK, expected, targetPace: target?.pace, goal: running.goal });
    if (!pace) continue;
    updatePlannedSession(session.id, { target_pace: pace, duration_min: session.distance_km ? Math.round(session.distance_km * pace[1] / 60) : session.duration_min });
  }
  const paces = trainingPaces(fiveK);
  updateTrainingPlan(plan.id, { paces, goals: plan.goals.map((goal) => (goal === running ? { ...goal, fiveKSeconds: fiveK } : goal)) });

  const change = before ? (before - fiveK) / before : 0;
  const percent = String(Math.abs(Math.round(change * 1000) / 10)).replace(".", ",");
  const evolution = !before || Math.abs(change) < 0.005 ? "igual ao previsto" : change > 0 ? `${percent}% mais rápido 🎉` : `${percent}% mais lento — ajustei para não sobrecarregar`;
  const distance = RUNNING_GOALS[running.goal]?.distance;
  const currentAtGoal = distance ? Math.round(fiveK * (distance / 5) ** 1.06) : null;
  const targetLine = target?.seconds && distance
    ? currentAtGoal <= target.seconds
      ? `🎯 Você já está no ritmo da meta (${formatDuration(target.seconds)} nos ${String(distance).replace(".", ",")} km)!`
      : `🎯 Meta: ${formatDuration(target.seconds)} — hoje você faria ~${formatDuration(currentAtGoal)} (faltam ${String(Math.round((currentAtGoal - target.seconds) / currentAtGoal * 1000) / 10).replace(".", ",")}%)`
    : null;
  return [
    `🔬 *Teste registrado:* ${String(distanceKm).replace(".", ",")} km em ${formatDuration(seconds)} (${formatPace(seconds / distanceKm)}/km)`,
    `• 5 km estimado agora: *${formatDuration(fiveK)}*${before ? ` (antes ${formatDuration(before)}) — ${evolution}` : ""}`,
    targetLine,
    "",
    `✅ Atualizei os ritmos de ${future.length} treino${future.length === 1 ? "" : "s"} daqui em diante:`,
    ...describePaces(paces).slice(0, 4).map((line) => `• ${line}`)
  ].filter((line) => line !== null).join("\n");
}
