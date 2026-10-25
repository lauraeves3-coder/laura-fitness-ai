// ESP-05/06, COR-05, MUS-05: acompanhamento do plano. Funções puras: casar treino feito
// com sessão planejada, comparar planejado x realizado, adaptar por cansaço/dor e montar
// as mensagens (formato do WhatsApp).
import { addDays, daysBetween, formatDay } from "../dates.js";
import { formatDuration, formatPace, paceRange } from "./paces.js";

const MODALITIES = [
  [/corr|run|trote|longao|rodagem|intervalad|tiro|fartlek/, "corrida"],
  [/muscula|academia|forca|peito|costas|perna|ombro|braco|biceps|triceps|gluteo|superior|inferior|treino [a-f]\b/, "musculacao"],
  [/cicl|bike|pedal|bicicleta|spinning/, "ciclismo"],
  [/nata|nado|piscina/, "natacao"],
  [/caminh/, "caminhada"],
  [/funcional|crossfit|circuito/, "funcional"],
  [/hiit|tabata/, "hiit"]
];

const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

export function modalityOf(workoutType) {
  const text = normalize(workoutType);
  return MODALITIES.find(([pattern]) => pattern.test(text))?.[1] || "outro";
}

// Sessão planejada que o treino feito cumpre: mesma modalidade, hoje; senão, a de ontem
// ainda pendente (treino feito com um dia de atraso).
export function matchPlannedSession({ modality, date }, planned) {
  const pending = planned.filter((session) => session.status === "planejado" && session.modality === modality);
  return pending.find((session) => session.date === date)
    || pending.find((session) => session.date === addDays(date, -1))
    || null;
}

const km = (value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// Linhas de comparação planejado x realizado para corrida (distância e pace).
export function compareWithPlan(session, workout) {
  const lines = [`📋 Plano: *${session.title}*${session.distance_km ? ` · ${km(session.distance_km)} km` : ""}${session.target_pace ? ` · ${paceRange(session.target_pace)}` : ""}`];
  if (session.modality !== "corrida" || !(workout.distance_km > 0)) {
    lines.push("✅ Treino do plano cumprido.");
    return lines;
  }
  const notes = [];
  if (session.distance_km) {
    const ratio = workout.distance_km / session.distance_km;
    notes.push(ratio >= 0.9 ? "distância ✅" : `distância ${Math.round(ratio * 100)}% do planejado`);
  }
  if (session.target_pace && workout.pace_s_per_km && !CONTINUOUS.has(session.session_type)) {
    notes.push("treino de qualidade cumprido (o pace médio inclui aquecimento e trote)");
  } else if (session.target_pace && workout.pace_s_per_km) {
    const [fast, slow] = session.target_pace;
    const pace = workout.pace_s_per_km;
    if (pace < fast - 10) {
      notes.push(session.intensity === "leve" || session.intensity === "muito leve" || session.session_type === "longao"
        ? "ritmo mais rápido que o indicado — em treino leve, segure um pouco para recuperar melhor"
        : "ritmo acima do alvo 💪");
    } else if (pace > slow + 15) {
      notes.push("ritmo mais lento que o alvo");
    } else {
      notes.push("ritmo dentro do alvo ✅");
    }
  }
  lines.push(`🔎 ${notes.join(" · ")}`);
  return lines;
}

// Sessões contínuas: o pace médio do treino é comparável ao alvo. Nas de qualidade o
// alvo vale para os tiros e o pace médio inclui aquecimento e trote.
const CONTINUOUS = new Set(["rodagem", "regenerativo", "longao", "prova", "rodagem_strides"]);

const MODALITY_ICONS = { corrida: "🏃", musculacao: "🏋️", ciclismo: "🚴", natacao: "🏊", caminhada: "🚶", funcional: "🔥", hiit: "🔥" };

const STATUS = { feito: "✅", pulado: "❌", ajustado: "🔄" };

function sessionLine(session, today) {
  const icon = STATUS[session.status] || (session.date < today ? "⚠️" : session.date === today ? "👉" : "▫️");
  const size = session.distance_km ? ` · ${km(session.distance_km)} km` : session.duration_min ? ` · ${Math.round(session.duration_min)} min` : "";
  return `${icon} ${formatDay(session.date)} — ${session.title}${size}`;
}

export function formatSessionDetails(session) {
  const lines = [`*${session.title}*${session.distance_km ? ` · ${km(session.distance_km)} km` : ""}${session.duration_min ? ` · ~${Math.round(session.duration_min)} min` : ""}`];
  if (session.target_pace) lines.push(`⏱️ ${CONTINUOUS.has(session.session_type) ? "Ritmo" : "Ritmo nos tiros/blocos"}: ${paceRange(session.target_pace)}`);
  if (session.details?.exercises?.length) {
    lines.push(...session.details.exercises.map((exercise) => `• ${exercise.name} — ${exercise.sets} × ${exercise.reps} (descanso ${Math.round(exercise.rest_s / 15) * 15} s)`));
  } else if (session.description) {
    lines.push(session.description);
  }
  if (session.note) lines.push(`_${session.note}_`);
  return lines;
}

export function buildDayReply({ sessions, date, today, next }) {
  const label = date === today ? "hoje" : date === addDays(today, 1) ? "amanhã" : formatDay(date);
  if (!sessions.length) {
    return [
      `😴 *Sem treino ${label}* — dia de descanso.`,
      next ? `Próximo: ${formatDay(next.date)} — ${next.title}${next.distance_km ? ` · ${km(next.distance_km)} km` : ""}` : null
    ].filter(Boolean).join("\n");
  }
  const icon = MODALITY_ICONS[sessions[0].modality] || "🏃";
  const header = `${icon} *Treino de ${label}* — ${formatDay(date)}`;
  return [header, "", ...sessions.flatMap((session, index) => [...(index ? [""] : []), ...formatSessionDetails(session), session.status === "feito" ? "✅ Já registrado." : null].filter(Boolean)),
    date === today && sessions.some((session) => session.status === "planejado") ? "\n_Quando terminar, me conte (ex.: \"corri 6 km em 40 min\")._" : null
  ].filter(Boolean).join("\n");
}

export function weekSummary(sessions) {
  const done = sessions.filter((session) => session.status === "feito");
  const plannedKm = sessions.reduce((sum, session) => sum + (session.modality === "corrida" ? session.distance_km || 0 : 0), 0);
  return { total: sessions.length, done: done.length, planned_km: plannedKm };
}

export function buildWeekReply({ sessions, today, plan, weekNumber, adaptationNote = null, upcoming = false }) {
  if (!sessions.length) return "📅 Não há treinos planejados nesta semana.";
  const summary = weekSummary(sessions);
  const phase = sessions.find((session) => session.phase)?.phase;
  return [
    upcoming ? `Seu plano começa na próxima semana; o primeiro treino é ${formatDay(sessions[0].date)}.\n` : null,
    `📅 *Semana ${weekNumber ?? ""}${plan?.weeks ? ` de ${plan.weeks}` : ""}*${phase ? ` — fase ${phase}` : ""}`,
    summary.planned_km ? `Corrida: ${km(summary.planned_km)} km planejados` : null,
    "",
    ...sessions.map((session) => sessionLine(session, today)),
    "",
    `Feito: ${summary.done} de ${summary.total}`,
    adaptationNote ? `\n🔄 ${adaptationNote}` : null
  ].filter((line) => line !== null).join("\n");
}

// "Qual foi minha última corrida/treino": dados completos do treino (distância, tempo,
// pace, FC, gasto estimado e sessão do plano que ele cumpriu).
export function buildLastWorkoutReply({ workout, today, running = false, energyLine = null, plannedTitle = null }) {
  if (!workout) {
    return running
      ? "🏃 Ainda não tenho nenhuma corrida registrada. Me conte a próxima (ex.: *corri 5 km em 30 min*) ou conecte o Strava."
      : "🏋️ Ainda não tenho nenhum treino registrado.";
  }
  const date = String(workout.trained_at || "").slice(0, 10);
  const time = String(workout.trained_at || "").slice(11, 16);
  const when = date === today ? "hoje" : date === addDays(today, -1) ? "ontem" : formatDay(date);
  const icon = MODALITY_ICONS[modalityOf(workout.workout_type)] || "🏅";
  const minutes = Number(workout.duration_min) || 0;
  const durationText = minutes ? formatDuration(minutes * 60) : null;
  const pace = workout.pace_s_per_km || (workout.distance_km > 0 && minutes ? minutes * 60 / workout.distance_km : null);
  const size = [workout.distance_km > 0 ? `📏 ${km(workout.distance_km)} km` : null, durationText ? `⏱️ ${durationText}` : null].filter(Boolean);
  const extra = [workout.elevation_m ? `⛰️ ${Math.round(workout.elevation_m)} m` : null, workout.avg_hr ? `❤️ ${Math.round(workout.avg_hr)} bpm` : null].filter(Boolean);
  return [
    `${icon} *${running ? "Sua última corrida" : "Seu último treino"}* — ${when}${time && time !== "00:00" ? `, ${time}` : ""}`,
    running ? null : `*${workout.workout_type}*`,
    size.length ? size.join("   ") : null,
    pace && /corr|caminh/i.test(workout.workout_type) ? `⚡ Pace médio: *${formatPace(pace)} /km*` : null,
    extra.length ? extra.join("   ") : null,
    energyLine,
    plannedTitle ? `📋 Cumpriu o plano: *${plannedTitle}*` : null,
    workout.source === "strava" ? "_Importada do Strava._" : null
  ].filter((line) => line !== null).join("\n");
}

// Cansaço, sono ruim ou dor: ajusta a sessão de hoje. Dor = descanso e orientação.
export function adaptSession(session, reason, options = {}) {
  if (reason === "tempo") return adaptForTime(session, options.minutes || 30);
  if (reason === "casa") return adaptForHome(session, options.homeExercises || null);
  if (reason === "dor") {
    return {
      changes: { status: "ajustado", title: "Descanso (dor)", description: "Descanso hoje. Se a dor for forte, persistir por mais de 2–3 dias ou piorar ao correr, procure avaliação de um profissional de saúde.", distance_km: null, duration_min: null, target_pace: null, intensity: "descanso", session_type: "descanso" },
      message: "🩹 Com dor, o melhor hoje é *descansar*. Troquei o treino de hoje por descanso.\nSe a dor for forte, durar mais de 2–3 dias ou piorar ao se movimentar, procure um profissional de saúde."
    };
  }
  const hard = ["intervalado", "limiar", "ritmo_prova", "fartlek", "forca", "qualidade"].includes(session.session_type);
  const reduce = (value) => (value ? Math.max(1, Math.round(value * 0.6 * 2) / 2) : value);
  if (session.modality === "musculacao") {
    return {
      changes: { status: "ajustado", note: "Ajustado por cansaço: faça 2 séries por exercício, sem chegar perto da falha." },
      message: "🔄 Ajustei a musculação de hoje: *2 séries por exercício*, carga confortável, sem ir à falha."
    };
  }
  return {
    changes: {
      status: "ajustado",
      title: hard ? "Rodagem leve (ajustado)" : `${session.title} (reduzido)`,
      session_type: hard ? "rodagem" : session.session_type,
      description: "Ajustado por cansaço/sono: ritmo bem confortável. Se não estiver bem, descansar também é treino.",
      distance_km: reduce(session.distance_km),
      duration_min: reduce(session.duration_min),
      intensity: "leve"
    },
    message: `🔄 Ajustei o treino de hoje para *${hard ? "rodagem leve" : "uma versão mais curta"}*${session.distance_km ? ` de ${km(reduce(session.distance_km))} km` : ""}, em ritmo confortável. Se não estiver bem, pode descansar.`
  };
}

// ESP-05: pouco tempo. Corrida contínua vira a distância que cabe no tempo; treino de
// qualidade mantém o estímulo com metade da parte principal; musculação fica com os
// exercícios principais em circuito.
function adaptForTime(session, minutes) {
  if (session.duration_min && session.duration_min <= minutes) {
    return { changes: {}, message: `👍 O treino de hoje (${session.title}) já cabe em ${minutes} min: dá para fazer como está.` };
  }
  const hard = ["intervalado", "limiar", "ritmo_prova", "fartlek", "teste"].includes(session.session_type);
  if (session.modality === "corrida") {
    const pace = session.target_pace?.[1] || 400;
    const distance = Math.max(2, Math.round(minutes * 60 / (hard ? pace * 1.15 : pace) * 2) / 2);
    const description = hard
      ? `Versão de ${minutes} min: 10 min de aquecimento leve, metade da parte principal no mesmo ritmo, 5 min de trote.`
      : `Versão de ${minutes} min no mesmo ritmo confortável.`;
    return {
      changes: { status: "ajustado", title: `${session.title} (versão curta)`, description, distance_km: distance, duration_min: minutes },
      message: `⏱️ Ajustei para caber em *${minutes} min*: ${session.title.toLocaleLowerCase("pt-BR")} com ~${km(distance)} km.\n${description}`
    };
  }
  if (session.modality === "musculacao" && session.details?.exercises?.length) {
    const count = minutes >= 40 ? 5 : minutes >= 25 ? 4 : 3;
    const exercises = session.details.exercises.slice(0, count).map((exercise) => ({ ...exercise, sets: Math.min(Number(exercise.sets) || 3, 3), rest_s: 60 }));
    return {
      changes: { status: "ajustado", title: `${session.title} (versão curta)`, details: { exercises }, duration_min: minutes, description: `Em ${minutes} min: só os ${count} exercícios principais, em circuito ou bi-set, descanso de 60 s.` },
      message: [`⏱️ Ajustei a musculação para *${minutes} min*: os ${count} exercícios principais, em circuito, descanso de 60 s.`, ...exercises.map((exercise) => `• ${exercise.name} — ${exercise.sets} × ${exercise.reps}`)].join("\n")
    };
  }
  return {
    changes: { status: "ajustado", duration_min: minutes, description: `Versão de ${minutes} min, mesma intensidade.` },
    message: `⏱️ Ajustei ${session.title.toLocaleLowerCase("pt-BR")} para *${minutes} min*, na mesma intensidade.`
  };
}

// ESP-05: sem academia/equipamento. Musculação troca pelos exercícios em casa (peso do
// corpo) do mesmo grupo; corrida e outras modalidades seguem iguais.
function adaptForHome(session, homeExercises) {
  if (session.modality !== "musculacao") {
    return { changes: {}, message: `👍 ${session.title} não precisa de equipamento: segue como está.` };
  }
  if (!homeExercises?.length) {
    return { changes: {}, message: "Não encontrei uma versão em casa para esse treino; faça os exercícios com o peso do corpo e mais repetições." };
  }
  return {
    changes: { status: "ajustado", title: `${session.title.replace(/ \(em casa\)$/, "")} (em casa)`, details: { exercises: homeExercises }, description: "Versão em casa, com o peso do corpo." },
    message: [`🏠 Troquei a musculação de hoje por uma *versão em casa*, sem equipamento:`, ...homeExercises.map((exercise) => `• ${exercise.name} — ${exercise.sets} × ${exercise.reps}`)].join("\n")
  };
}

// Progresso da corrida nas últimas semanas: volume, maior distância, melhor pace (≥ 5 km).
export function runningProgress(runs, today, weeks = 4) {
  // Semanas de calendário (segunda a domingo), a atual por último.
  const start = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) - 7 * (weeks - 1));
  const recent = runs.filter((run) => String(run.trained_at).slice(0, 10) >= start);
  const byWeek = Array.from({ length: weeks }, (_, index) => {
    const weekStart = addDays(start, index * 7);
    const weekEnd = addDays(weekStart, 6);
    const inWeek = recent.filter((run) => { const day = String(run.trained_at).slice(0, 10); return day >= weekStart && day <= weekEnd; });
    return { start: weekStart, km: inWeek.reduce((sum, run) => sum + run.distance_km, 0), runs: inWeek.length };
  });
  const longest = recent.reduce((best, run) => (!best || run.distance_km > best.distance_km ? run : best), null);
  const fastest = recent.filter((run) => run.distance_km >= 5 && run.pace_s_per_km)
    .reduce((best, run) => (!best || run.pace_s_per_km < best.pace_s_per_km ? run : best), null);
  return { byWeek, longest, fastest, total_km: byWeek.reduce((sum, week) => sum + week.km, 0), runs: recent.length };
}

export function buildProgressReply(progress, { adherence = null } = {}) {
  if (!progress.runs) return "📈 Ainda não há corridas com distância registradas nas últimas semanas. Registre assim: \"corri 5 km em 30 min\".";
  return [
    "📈 *Sua corrida — últimas 4 semanas*",
    "",
    ...progress.byWeek.map((week) => `• semana de ${formatDay(week.start)}: ${km(week.km)} km (${week.runs} ${week.runs === 1 ? "corrida" : "corridas"})`),
    "",
    `🛣️ Total: ${km(progress.total_km)} km`,
    progress.longest ? `📏 Maior corrida: ${km(progress.longest.distance_km)} km` : null,
    progress.fastest ? `⚡ Melhor pace (≥ 5 km): ${formatPace(progress.fastest.pace_s_per_km)}/km` : null,
    adherence !== null ? `🎯 Treinos do plano cumpridos: ${Math.round(adherence * 100)}%` : null
  ].filter((line) => line !== null).join("\n");
}

export function buildPlanCreatedReply({ plan, goalsDescription, firstWeek, today, paceLines = [], analysisLines = [], warnings = [] }) {
  return [
    "🗓️ *Plano de treino criado*",
    goalsDescription,
    `Duração: ${plan.weeks} semanas · início ${formatDay(plan.start_date)}`,
    ...(analysisLines.length ? ["", ...analysisLines] : []),
    paceLines.length ? "" : null,
    ...(paceLines.length ? ["⏱️ *Seus ritmos*", ...paceLines.map((line) => `• ${line}`)] : []),
    ...(warnings.length ? ["", ...warnings.map((warning) => `⚠️ ${warning}`)] : []),
    "",
    "*Primeira semana*",
    ...firstWeek.map((session) => sessionLine(session, today)),
    "",
    "_Peça \"treino de hoje\", \"treinos da semana\" ou \"progresso da corrida\" quando quiser. Me conte cada treino feito que eu comparo com o plano._",
    "_Este plano é uma orientação geral; em caso de dor, lesão ou condição de saúde, consulte um profissional._"
  ].filter((line) => line !== null).join("\n");
}

export { daysBetween };
