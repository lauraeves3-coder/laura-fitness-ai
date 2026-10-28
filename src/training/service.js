// Planos de treino na conversa: criação (pela ferramenta do agente), consultas sem o
// modelo ("treino de hoje", "treinos da semana", "progresso da corrida"), faltas,
// ajustes por cansaço/dor e ligação do treino feito com o plano.
import {
  saveTrainingPlan, getActiveTrainingPlan, getPendingTrainingRequest, setPendingTrainingRequest, getPlannedSessions, updatePlannedSession,
  linkWorkoutToSession, getRunsBetween, updateTrainingPlan, getUser, getWorkoutsBetween
} from "../db.js";
import { describeWorkoutCalories } from "./energy.js";
import { newRecordLines } from "./records.js";
import { addDays, formatDay, weekdayOf } from "../dates.js";
import { buildTrainingPlan } from "./plan.js";
import { RUNNING_GOALS, describePaces, describeTargetAnalysis, expectedFiveK, paceForSession } from "./running.js";
import { STRENGTH_GOALS, generateStrengthPlan } from "./strength.js";
import { ENDURANCE_MODALITIES, MODALITY_EMOJI } from "./endurance.js";
import { fiveKFromReference, formatDuration, formatPace, parseDuration, trainingPaces } from "./paces.js";
import {
  adaptSession, buildDayReply, buildLastWorkoutReply, buildPlanCreatedReply, buildProgressReply, buildWeekReply,
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
export function createTrainingPlanFromRequest(userId, newRequest, today, message = "") {
  // Junta com o pedido anterior ainda incompleto: a resposta às perguntas chega em outra
  // mensagem, e o que já foi dito (objetivo, dias…) não pode se perder.
  const merged = keepOtherModalities(userId, mergeRequests(getPendingTrainingRequest(userId), fillFromMessage(newRequest, message)), message);
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

// O que a pessoa escreveu e o modelo não separou: tempo de corrida, km por semana, tempo
// recente, meta de tempo e dias por semana. Só preenche campos vazios.
function fillFromMessage(request, message) {
  const text = normalize(message);
  if (!text) return request;
  const filled = { ...request };
  const time = "(\\d{1,2}:\\d{2}(?::\\d{2})?|\\d{1,3}\\s*(?:min|minutos?)(?:\\s*e\\s*\\d{1,2}\\s*(?:s|seg|segundos?))?)";
  const target = text.match(new RegExp(`\\b(?:abaixo de|menos de|sub[- ]?|baixar (?:para|pra)|chegar a|meta (?:e |eh |de )?(?:fazer |correr )?(?:(?:os |o )?\\d+(?:[.,]\\d+)?\\s*km\\s*)?(?:em |abaixo de |em menos de )?)\\s*${time}`));
  if (target && !filled.target_time && !filled.target_pace) filled.target_time = target[1];
  const reference = text.match(new RegExp(`\\b(?:faco|fiz|corro|consigo|consegui|meu tempo (?:e |nos |no )?|hoje faco)[^.]*?(\\d+(?:[.,]\\d+)?)\\s*(?:km|k)\\s*em\\s*${time}`));
  if (reference && !filled.reference_time) {
    filled.reference_distance_km = Number(reference[1].replace(",", "."));
    filled.reference_time = reference[2];
  }
  const weekly = text.match(/(\d+(?:[.,]\d+)?)\s*km\s*(?:por|na|\/|a)\s*semana/);
  if (weekly && filled.current_weekly_km == null) filled.current_weekly_km = Number(weekly[1].replace(",", "."));
  const days = text.match(/\b(\d)\s*(?:dias|vezes|x)\s*(?:por|na|\/|a)\s*semana/);
  if (days && filled.running_goal && filled.running_days_per_week == null && !/musculac|academia/.test(text)) filled.running_days_per_week = Number(days[1]);
  if (!filled.running_level) {
    const since = text.match(/\b(?:ha|faz|tem)\s+(?:uns |umas |cerca de |quase |mais de )?(\d+)\s*(mes|meses|ano|anos)\b/);
    const months = since ? Number(since[1]) * (/^ano/.test(since[2]) ? 12 : 1) : /\b(?:comecei agora|nunca corri|to comecando|estou comecando)\b/.test(text) ? 0 : null;
    const km = filled.current_weekly_km;
    if (months !== null || km != null) {
      filled.running_level = (months !== null && months < 6) || (km != null && km < 15) ? "iniciante"
        : (months === null || months >= 24) && km != null && km >= 35 ? "avancado" : "intermediario";
    }
  }
  return filled;
}

const DAY_NAMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

// "Quero adicionar musculação" mantém a corrida do plano atual (e vice-versa); "só
// musculação" / "parar de correr" troca de verdade.
function keepOtherModalities(userId, request, message) {
  const plan = getActiveTrainingPlan(userId);
  if (!plan?.goals?.length) return request;
  const text = normalize(message);
  const filled = { ...request };
  const running = plan.goals.find((goal) => goal.modality === "corrida");
  const strength = plan.goals.find((goal) => goal.modality === "musculacao");
  const onlyNew = /\b(?:so|apenas|somente)\b|\b(?:sem|parar de|nao quero mais)\s+(?:correr|corrida|musculacao|academia)\b/.test(text);
  if (onlyNew) return request;
  if (!filled.running_goal && running && (filled.strength_goal || filled.strength_days_per_week || filled.other_modality)) {
    Object.assign(filled, {
      running_goal: running.goal, running_level: running.level, running_days_per_week: running.daysPerWeek,
      available_days: (running.availableDays || []).map((day) => DAY_NAMES[day]),
      current_weekly_km: running.currentWeeklyKm, longest_run_km: running.longestRunKm,
      reference_distance_km: running.fiveKSeconds ? 5 : null, reference_time: running.fiveKSeconds ? formatDuration(running.fiveKSeconds) : null,
      target_time: running.targetSeconds ? formatDuration(running.targetSeconds) : null, event_date: running.eventDate
    });
  }
  if (!filled.strength_goal && !filled.strength_days_per_week && strength && filled.running_goal && !request.strength_goal) {
    Object.assign(filled, {
      strength_goal: strength.goal, strength_level: strength.level, strength_days_per_week: strength.daysPerWeek,
      equipment: strength.equipment, limitations: strength.limitations || []
    });
  }
  return filled;
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
    return `${MODALITY_EMOJI[goal.modality] || "🏅"} ${ENDURANCE_MODALITIES[goal.modality].label.charAt(0).toLocaleUpperCase("pt-BR")}${ENDURANCE_MODALITIES[goal.modality].label.slice(1)}: ${goal.daysPerWeek}×/semana`;
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
  const last = text.match(/\b(?:ultim[ao]|minha|meu) (corrida|treino|atividade|pedal)\b(?! de amanha)/);
  if (last && (/\bultim[ao]\b/.test(text) || /\b(?:qual|como) foi\b/.test(text)) && !/\b(?:corri|registr|anot|pulei|faltei)\b/.test(text)) {
    return { type: "last", running: last[1] === "corrida" };
  }
  // ESP-05: remarcar ("passa o treino de hoje para quinta"), pouco tempo e sem equipamento.
  const move = text.match(/\b(?:passa|passar|mude|muda|mudar|troca|trocar|move|mover|remarca|remarcar|adia|adiar|joga|jogar|deixa|deixar)\b[^.?!]*\btreinos?\b[^.?!]*\b(?:para|pra|pro)\s+(?:a |o )?(amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/);
  if (move) return { type: "move", to: move[1], from: /\btreino de amanha\b/.test(text) ? 1 : 0 };
  const minutes = text.match(/\b(?:so|apenas|somente) (?:tenho|tem|vou ter|terei|da|consigo|posso)(?: uns| tipo| umas?)? (\d{1,3}) ?(?:min|minutos)\b|\b(?:tenho|terei) (?:so|apenas|somente) (\d{1,3}) ?(?:min|minutos)\b/);
  if (minutes || /\b(?:sem tempo|pouco tempo|dia corrido|to corrid[oa]|estou corrid[oa])\b/.test(text)) {
    return { type: "adapt", reason: "tempo", minutes: Number(minutes?.[1] || minutes?.[2]) || 30 };
  }
  if (/\bsem (?:academia|equipamentos?|aparelhos?|halteres?|pesos?)\b|\bacademia (?:(?:esta|ta|tava|estava) )?(?:fechada|lotada)\b|\b(?:treinar|treino|treinando) em casa\b|\bnao (?:vou|consigo|da pra|vai dar pra) (?:ir|chegar) (?:na|a|pra|para a) academia\b/.test(text)) {
    return { type: "adapt", reason: "casa" };
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
  if (intent.type === "last") {
    const workouts = getWorkoutsBetween(userId, addDays(today, -365), today)
      .filter((workout) => !intent.running || modalityOf(workout.workout_type) === "corrida");
    const workout = workouts.at(-1) || null;
    const planned = workout?.planned_session_id
      ? getPlannedSessions(userId, String(workout.trained_at).slice(0, 10), String(workout.trained_at).slice(0, 10)).find((session) => session.id === workout.planned_session_id)
      : null;
    return buildLastWorkoutReply({
      workout, today, running: intent.running, plannedTitle: planned?.title || null, age: getUser(userId)?.age_years ?? null,
      energyLine: workout ? describeWorkoutCalories(workout, getUser(userId)?.weight_kg) : null
    });
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
    let sessions = getPlannedSessions(userId, monday, addDays(monday, 6));
    // Plano que começa na segunda seguinte (pedido de sexta a domingo): mostra a próxima semana.
    const upcoming = !sessions.length;
    if (upcoming) sessions = getPlannedSessions(userId, addDays(monday, 7), addDays(monday, 13));
    return buildWeekReply({ sessions, today, plan, weekNumber: sessions[0]?.week, adaptationNote: note, upcoming });
  }
  if (intent.type === "move") return moveSessions(userId, intent, today);
  const todaySessions = getPlannedSessions(userId, today, today).filter((session) => session.status === "planejado");
  if (!todaySessions.length) {
    // Pouco tempo / sem equipamento num dia sem treino: avisa o descanso e o próximo treino.
    if (intent.type === "adapt" && ["tempo", "casa"].includes(intent.reason)) {
      const next = getPlannedSessions(userId, addDays(today, 1), addDays(today, 14)).find((session) => session.status === "planejado");
      return [
        "😴 Hoje é *dia de descanso* no seu plano, então não precisa encaixar treino.",
        intent.reason === "tempo" && intent.minutes ? `Se quiser se mexer nesses ${intent.minutes} min, uma caminhada ou trote bem leve já ajuda na recuperação.` : null,
        next ? `Próximo treino: *${next.title}* — ${formatDay(next.date)}.` : null
      ].filter(Boolean).join("\n");
    }
    return null;
  }
  if (intent.type === "skip") {
    for (const session of todaySessions) updatePlannedSession(session.id, { status: "pulado" });
    const next = getPlannedSessions(userId, addDays(today, 1), addDays(today, 14))[0];
    return [
      "👍 Tudo bem, marquei o treino de hoje como não feito. Não precisa compensar: seguimos o plano normalmente.",
      next ? `Próximo: ${next.title}${next.distance_km ? ` · ${next.distance_km.toLocaleString("pt-BR")} km` : ""} (${next.date.split("-").reverse().slice(0, 2).join("/")}).` : null
    ].filter(Boolean).join("\n");
  }
  const messages = todaySessions.map((session) => {
    const options = intent.reason === "casa" ? { homeExercises: homeVersion(plan, session) } : { minutes: intent.minutes };
    const { changes, message: reply } = adaptSession(session, intent.reason, options);
    updatePlannedSession(session.id, changes);
    return reply;
  });
  return messages.join("\n\n");
}

// ACO-01: ajuste do treino de hoje pedido pelo check-in ("dor" ou "cansaco"). null quando
// não há plano ou treino pendente hoje.
export function adaptTodayTraining(userId, reason, today) {
  if (!getActiveTrainingPlan(userId)) return null;
  const sessions = getPlannedSessions(userId, today, today).filter((session) => session.status === "planejado");
  if (!sessions.length) return null;
  return sessions.map((session) => {
    const { changes, message } = adaptSession(session, reason);
    updatePlannedSession(session.id, changes);
    return message;
  }).join("\n\n");
}

// ESP-05: mesma sessão de musculação gerada com equipamento "casa".
function homeVersion(plan, session) {
  if (session.modality !== "musculacao") return null;
  const goal = plan.goals?.find((item) => item.modality === "musculacao");
  if (!goal) return null;
  const home = generateStrengthPlan({ ...goal, equipment: "casa" });
  const label = session.title.replace(/ \((?:em casa|versão curta)\)$/, "");
  return (home.sessions.find((item) => item.label === label) || home.sessions[0])?.exercises || null;
}

const HARD_SESSIONS = new Set(["intervalado", "limiar", "ritmo_prova", "longao", "teste", "prova"]);

// ESP-05: "passa o treino de hoje para quinta". Se o dia de destino já tem treino, os dois
// trocam de lugar; avisa quando dois treinos fortes ficam em dias seguidos.
function moveSessions(userId, { from, to }, today) {
  const source = addDays(today, from);
  const target = to === "amanha"
    ? addDays(today, 1)
    : Array.from({ length: 7 }, (_, index) => addDays(source, index + 1)).find((date) => weekdayOf(date) === WEEKDAY_NUMBERS[to.slice(0, 3)]);
  if (!target || target === source) return "Não entendi para qual dia passar o treino. Diga, por exemplo: *passa o treino de hoje para quinta*.";
  const open = (session) => ["planejado", "ajustado"].includes(session.status);
  const moving = getPlannedSessions(userId, source, source).filter(open);
  if (!moving.length) return `Não há treino pendente ${from ? "amanhã" : "hoje"} para remarcar.`;
  const swapped = getPlannedSessions(userId, target, target).filter(open);
  for (const session of moving) updatePlannedSession(session.id, { date: target });
  for (const session of swapped) updatePlannedSession(session.id, { date: source });
  const hardNear = moving.some((session) => HARD_SESSIONS.has(session.session_type))
    && getPlannedSessions(userId, addDays(target, -1), addDays(target, 1))
      .some((session) => session.date !== target && HARD_SESSIONS.has(session.session_type) && session.status === "planejado");
  const names = (list) => list.map((session) => `*${session.title}*`).join(" e ");
  return [
    `📅 Pronto: ${names(moving)} ${moving.length > 1 ? "passaram" : "passou"} para ${formatDay(target)}.`,
    swapped.length ? `🔁 ${names(swapped)} de ${formatDay(target)} veio para ${from ? "amanhã" : "hoje"}.` : null,
    hardNear ? "⚠️ Ficaram dois treinos fortes em dias seguidos: faça o segundo mais leve se sentir as pernas pesadas." : null
  ].filter(Boolean).join("\n");
}

// Depois de gravar um treino: liga ao plano e devolve linhas extras para a resposta.
export function afterWorkoutSaved(userId, workout, today) {
  const lines = [];
  if (workout.distance_km > 0 && workout.duration_min > 0) {
    lines.push(`🏃 ${Number(workout.distance_km).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km · pace ${formatPace(workout.duration_min * 60 / workout.distance_km)}/km`);
  }
  const energy = describeWorkoutCalories(workout, getUser(userId)?.weight_kg);
  if (energy) lines.push(energy);
  lines.push(...runRecordLines(userId, workout));
  const comparison = linkWorkoutToPlan(userId, workout, today);
  return comparison.length ? [...lines, "", ...comparison] : lines;
}

// COR-05: recordes que esta corrida bateu (manual ou Strava).
export function runRecordLines(userId, workout) {
  if (modalityOf(workout.workout_type) !== "corrida") return [];
  const runs = getRunsBetween(userId, "2000-01-01", "2999-12-31");
  const previous = runs.filter((run) => run.id !== workout.id);
  const current = runs.find((run) => run.id === workout.id) || workout;
  return newRecordLines(previous, current);
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
  const lines = compareWithPlan(session, workout, { age: getUser(userId)?.age_years ?? null });
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
  const before = running.fiveKSeconds || (plan.paces?.five_k ? plan.paces.five_k * 5 : null);
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
