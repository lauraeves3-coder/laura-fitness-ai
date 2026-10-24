// COR-01/03/04: plano de corrida personalizado. Função pura: recebe objetivo, nível e
// disponibilidade e devolve semanas com sessões datadas. Princípios: volume semanal sobe
// no máximo 10%, semana de recuperação a cada 4, polimento antes da prova, qualidade
// (intervalado/limiar/ritmo de prova) só depois da base e nunca em dias seguidos.
import { addDays, daysBetween, weekdayOf } from "../dates.js";
import { formatPace, paceRange, predictTime, trainingPaces } from "./paces.js";

export const RUNNING_GOALS = {
  comecar: { label: "começar a correr", weeks: 8, distance: null },
  "5k": { label: "5 km", weeks: 8, distance: 5 },
  "10k": { label: "10 km", weeks: 10, distance: 10 },
  "21k": { label: "meia maratona (21 km)", weeks: 12, distance: 21.0975 },
  "42k": { label: "maratona (42 km)", weeks: 16, distance: 42.195 },
  manter: { label: "condicionamento e saúde", weeks: 8, distance: null },
  voltar: { label: "voltar a correr depois de uma pausa", weeks: 6, distance: null },
  aumentar_volume: { label: "aumentar volume e resistência", weeks: 10, distance: null }
};

const PEAK_KM = { "5k": [18, 28, 40], "10k": [25, 35, 50], "21k": [32, 45, 60], "42k": [45, 60, 80], manter: [15, 25, 35], voltar: [12, 20, 30], aumentar_volume: [25, 40, 55] };
const PEAK_LONG_KM = { "5k": 8, "10k": 13, "21k": 19, "42k": 30, manter: 10, voltar: 8, aumentar_volume: 15 };
const START_KM = [10, 20, 30];
const TAPER = { "5k": [0.65], "10k": [0.6], "21k": [0.75, 0.5], "42k": [0.8, 0.65, 0.45], manter: [], voltar: [], aumentar_volume: [] };
// COR-06: melhora típica do tempo de prova a cada 4 semanas de treino bem feito, por nível.
const GAIN_PER_BLOCK = [0.04, 0.03, 0.015];
const LEVEL_LABEL = ["iniciante", "intermediário", "avançado"];
const LEVELS = ["iniciante", "intermediario", "avancado"];

// Dias padrão por quantidade de treinos (0 = domingo). O último é o do longão.
const DEFAULT_DAYS = { 2: [2, 6], 3: [2, 4, 6], 4: [2, 3, 5, 0], 5: [1, 2, 4, 5, 0], 6: [1, 2, 3, 4, 5, 0] };

const round1 = (value) => Math.round(value * 10) / 10;
const halfKm = (value) => Math.max(1, Math.round(value * 2) / 2);
const levelIndex = (level) => Math.max(0, LEVELS.indexOf(level));

export function mondayOnOrAfter(date) {
  const offset = (8 - weekdayOf(date)) % 7;
  return addDays(date, offset);
}

function orderedDays(days) {
  // Semana de segunda a domingo; o longão fica no último dia disponível.
  return [...new Set(days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}

// Volume semanal e longão por semana. Volume: +10% por semana até o pico; a cada 4
// semanas, recuperação com 80% da anterior. Longão: cresce sozinho (+1 km/semana; +0,5 no
// 5 km) até o teto do objetivo, cai 20% na recuperação; polimento reduz os dois.
function weeklyLoads({ weeks, startKm, peakKm, taper, startLongKm, peakLongKm, longStep }) {
  const build = weeks - taper.length;
  const loads = [];
  let volume = startKm;
  let long = startLongKm;
  for (let week = 1; week <= build; week++) {
    const recovery = week > 1 && week % 4 === 0;
    if (week > 1 && !recovery) {
      volume = Math.min(peakKm, volume * 1.1);
      long = Math.min(peakLongKm, long + longStep);
    }
    loads.push(recovery ? { volume: volume * 0.8, long: long * 0.8, recovery } : { volume, long, recovery });
  }
  for (const factor of taper) loads.push({ volume: volume * factor, long: long * factor, recovery: false });
  return loads.map(({ volume: v, long: l, recovery }) => ({ volume: round1(v), long: halfKm(l), recovery }));
}

// Dias de qualidade: o primeiro dia da semana e, se houver dois, outro com pelo menos um
// dia de folga entre eles e que não seja a véspera do longão.
function pickQualityDays(otherDays, longDay, count) {
  if (!count || !otherDays.length) return [];
  const position = (day) => (day + 6) % 7;
  const chosen = [otherDays[0]];
  if (count > 1) {
    const second = otherDays.slice(1).reverse().find((day) =>
      position(day) - position(chosen[0]) >= 2 && position(longDay) - position(day) >= 2);
    if (second !== undefined) chosen.push(second);
  }
  return chosen;
}

function phaseOf(week, weeks, taperWeeks) {
  if (week > weeks - taperWeeks) return "polimento";
  const progress = week / (weeks - taperWeeks);
  return progress <= 0.35 ? "base" : progress <= 0.75 ? "construção" : "específico";
}

// Sessão de qualidade conforme objetivo e fase. Distâncias em km (aquecimento e
// desaquecimento incluídos).
function qualitySession({ goal, phase, week, paces, beginner, slot, target }) {
  if ((beginner && !target) || phase === "base") {
    return slot === 0
      ? { session_type: "fartlek", title: "Fartlek leve", main: "6 × (1 min mais forte + 2 min leve)", extra_km: 2, pace: paces?.interval }
      : { session_type: "rodagem_strides", title: "Rodagem com acelerações", main: "rodagem leve + 6 acelerações de 20 s no fim", extra_km: 0.5, pace: paces?.easy };
  }
  if (phase === "polimento") {
    return { session_type: "ritmo_prova", title: "Ritmo de prova curto", main: "3 × 1 km no ritmo da prova, 2 min de trote entre eles", extra_km: 3, pace: racePace(goal, paces) };
  }
  if (slot === 1) {
    const minutes = phase === "construção" ? 15 + Math.min(10, week) : 25;
    return { session_type: "limiar", title: "Limiar (tempo run)", main: `${minutes} min contínuos em ritmo forte e controlado`, extra_km: minutes / ((paces?.threshold?.[1] || 330) / 60), pace: paces?.threshold };
  }
  if (phase === "específico" && ["10k", "21k", "42k"].includes(goal)) {
    const blocks = { "10k": "3 × 2 km", "21k": "2 × 4 km", "42k": "2 × 5 km" }[goal];
    const km = { "10k": 6, "21k": 8, "42k": 10 }[goal];
    return { session_type: "ritmo_prova", title: "Blocos no ritmo da prova", main: `${blocks} no ritmo da prova, 3 min de trote entre eles`, extra_km: km, pace: racePace(goal, paces) };
  }
  // Meta de tempo em 5/10 km: na fase específica alterna blocos no ritmo da meta com tiros
  // curtos mais rápidos que ela (ritmo de 3 km), que dão folga de velocidade.
  if (target && phase === "específico" && ["5k", "10k"].includes(goal)) {
    return week % 2
      ? { session_type: "ritmo_prova", title: "Blocos no ritmo da meta", main: `${goal === "5k" ? "5 × 1 km" : "4 × 2 km"} no ritmo da meta, 90 s de trote entre eles`, extra_km: goal === "5k" ? 5 : 8 }
      : { session_type: "intervalado", title: "Tiros de 400 m", main: "10 × 400 m rápidos, 1 min de trote entre eles", extra_km: 4 };
  }
  const repeats = week % 2 ? "6 × 800 m" : "5 × 1 km";
  return { session_type: "intervalado", title: "Intervalado", main: `${repeats} forte, 2 min de trote entre eles`, extra_km: week % 2 ? 4.8 : 5, pace: paces?.interval };
}

function racePace(goal, paces) {
  if (!paces) return null;
  const pace = { "5k": paces.five_k, "10k": paces.ten_k, "21k": paces.half, "42k": paces.marathon }[goal] ?? paces.threshold[1];
  return [pace, pace];
}

// COR-06: meta de tempo na distância do objetivo. Compara com o tempo atual (Riegel a
// partir do 5 km), estima as semanas necessárias pelo ganho típico do nível e, se o prazo
// não comporta, define um marco intermediário realista que o plano passa a mirar.
const MAX_TARGET_WEEKS = 20;

export function analyzeRunningTarget({ goal, targetSeconds, fiveKSeconds, level, weeks = null, estimated = false }) {
  const distance = RUNNING_GOALS[goal]?.distance;
  if (!distance || !(targetSeconds > 0) || !(fiveKSeconds > 0)) return null;
  const li = levelIndex(level);
  const rate = GAIN_PER_BLOCK[li];
  const taperWeeks = TAPER[goal].length;
  const current = Math.round(predictTime(fiveKSeconds, 5, distance));
  const gap = (current - targetSeconds) / current;
  const weeksNeeded = gap <= 0 ? 6 : Math.max(6, Math.ceil(gap / rate) * 4 + taperWeeks);
  const planWeeks = weeks || Math.min(MAX_TARGET_WEEKS, weeksNeeded);
  const reachable = gap <= 0 ? 0 : Math.min(gap, rate * Math.max(1, planWeeks - taperWeeks) / 4);
  const planTarget = gap <= 0 ? targetSeconds : Math.round(current * (1 - reachable));
  const milestone = planTarget > targetSeconds + 5 ? planTarget : null;
  return {
    goal, distance, level: LEVELS[li], rate, estimated, current, target: targetSeconds, gap, weeksNeeded, weeks: planWeeks,
    plan_target: planTarget, milestone,
    target_five_k: Math.round(predictTime(planTarget, distance, 5)),
    target_pace: Math.round(planTarget / distance),
    verdict: gap <= 0 ? "alcancada" : milestone ? "ambiciosa" : weeksNeeded > 12 ? "medio_prazo" : "realista"
  };
}

// 5 km esperado em cada semana: sobe em degraus a cada bloco de 4 semanas, do tempo atual
// até a meta (ou o marco). fromWeek: semana em que o tempo atual foi medido.
export function expectedFiveK({ current, target, week, fromWeek = 1, totalWeeks }) {
  if (!target || target >= current) return current;
  const blocks = Math.max(1, Math.ceil((totalWeeks - fromWeek + 1) / 4));
  const step = Math.max(0, Math.min(blocks, Math.floor((week - fromWeek) / 4)));
  return Math.round(current - (current - target) * step / blocks);
}

// Ritmo de cada sessão: leves e longão pelo condicionamento atual (current); qualidade pelo
// esperado naquela semana (expected); ritmo de prova/meta pelo pace alvo, quando há meta.
export function paceForSession(session, { current, expected = current, targetPace = null, goal }) {
  const now = trainingPaces(current);
  const next = trainingPaces(expected);
  if (!now) return session.target_pace ?? null;
  switch (session.session_type) {
    case "rodagem":
    case "rodagem_strides": return now.easy;
    case "regenerativo": return now.recovery;
    case "longao": return now.long;
    case "fartlek": return next.interval;
    case "limiar": return next.threshold;
    case "intervalado": return /400/.test(session.title) ? [Math.round(next.interval[0] * 0.97), next.interval[0]] : next.interval;
    case "teste": {
      const pace = Math.round(predictTime(expected, 5, 3) / 3);
      return [pace, pace];
    }
    case "ritmo_prova":
    case "prova": return targetPace ? [Math.round(targetPace), Math.round(targetPace)] : racePace(goal, next);
    default: return session.target_pace ?? null;
  }
}

const TEST_SESSION = {
  session_type: "teste",
  title: "🔬 Teste de 3 km",
  description: "Aquecimento 2 km leve + 4 acelerações curtas, 3 km no seu máximo sustentável (cronometre só esse trecho), 1 km de trote. Depois me mande: \"teste 3 km em 15:30\" que eu recalibro seus ritmos.",
  distance_km: 6,
  intensity: "forte"
};

const duration = (seconds) => {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};
const km = (value) => String(Math.round(value * 10) / 10).replace(".", ",");

export function describeTargetAnalysis(analysis) {
  if (!analysis) return [];
  const { distance, current, target, gap, rate, weeksNeeded, weeks, milestone, verdict, estimated } = analysis;
  const label = `${km(distance)} km`;
  const verdictLine = {
    alcancada: `🎯 Seu tempo estimado já bate essa meta. O plano consolida o ritmo e mira ${duration(target)}; se quiser mais, tente ${duration(Math.round(current * 0.97))}.`,
    realista: `✅ Meta realista: ~${weeksNeeded} semanas no seu nível.`,
    medio_prazo: `🟡 Meta realista, mas de médio prazo: ~${weeksNeeded} semanas no seu nível.`,
    ambiciosa: `⚠️ Em ${weeks} semanas o realista é chegar a ~${duration(milestone)}. O plano mira esse marco; a meta de ${duration(target)} fica para o ciclo seguinte (~${weeksNeeded} semanas no total).`
  }[verdict];
  return [
    "📊 *Análise da sua meta*",
    `• Hoje: ${label} em ~${duration(current)} (${formatPace(current / distance)}/km)${estimated ? " — estimado pelo seu pace confortável; o teste da 1ª semana confirma" : ""}`,
    `• Meta: ${label} em ${duration(target)} (${formatPace(target / distance)}/km)${gap > 0 ? ` — ${String(Math.round(gap * 1000) / 10).replace(".", ",")}% mais rápido` : ""}`,
    gap > 0 ? `• Ganho típico no seu nível: ~${String(rate * 100).replace(".", ",")}% a cada 4 semanas de treino consistente` : null,
    verdictLine,
    "",
    "🧭 *Estratégia*",
    "• Rodagens leves e longão no seu ritmo de hoje (a maior parte do volume): base aeróbica",
    "• Limiar para sustentar ritmo forte por mais tempo",
    "• Intervalados e tiros mais rápidos que a meta para ganhar velocidade",
    "• Blocos no ritmo da meta na fase final",
    "• Teste de 3 km a cada 4 semanas: recalibro os ritmos pelo seu resultado real"
  ].filter((line) => line !== null);
}

// Programa para começar do zero: alternar corrida e caminhada até 30 min contínuos.
const BEGINNER_WEEKS = [
  "8 × (1 min correndo + 1 min e 30 s caminhando)",
  "6 × (1 min e 30 s correndo + 2 min caminhando)",
  "5 × (2 min correndo + 2 min caminhando)",
  "4 × (3 min correndo + 2 min caminhando)",
  "3 × (5 min correndo + 2 min caminhando)",
  "2 × (8 min correndo + 2 min caminhando)",
  "20 min correndo contínuo, bem leve",
  "25 a 30 min correndo contínuo, bem leve"
];

function beginnerPlan({ startDate, days, weeks }) {
  return Array.from({ length: weeks }, (_, index) => {
    const main = BEGINNER_WEEKS[Math.min(index, BEGINNER_WEEKS.length - 1)];
    const monday = addDays(startDate, index * 7);
    return {
      number: index + 1,
      phase: index < 4 ? "adaptação" : "progressão",
      total_km: null,
      sessions: days.map((day) => ({
        date: addDays(monday, (day + 6) % 7),
        modality: "corrida",
        session_type: "corrida_caminhada",
        title: "Corrida + caminhada",
        description: `5 min de caminhada para aquecer, ${main}, 5 min de caminhada no fim. Ritmo em que dá para conversar.`,
        distance_km: null,
        duration_min: 35,
        target_pace: null,
        intensity: "leve"
      }))
    };
  });
}

// goal: chave de RUNNING_GOALS. level: iniciante|intermediario|avancado.
// startDate/eventDate "AAAA-MM-DD"; fiveKSeconds: tempo atual (ou estimado) de 5 km.
// targetSeconds: meta de tempo na distância do objetivo (COR-06); fiveKEstimated: o 5 km
// veio do pace confortável, não de uma prova/teste (agenda um teste na 1ª semana).
export function generateRunningPlan({
  goal = "manter", level = "iniciante", startDate, eventDate = null, weeks = null,
  daysPerWeek = 3, availableDays = null, currentWeeklyKm = null, longestRunKm = null, fiveKSeconds = null,
  targetSeconds = null, fiveKEstimated = false
}) {
  if (!RUNNING_GOALS[goal]) throw new Error(`objetivo de corrida desconhecido: ${goal}`);
  const days = orderedDays(availableDays?.length ? availableDays : DEFAULT_DAYS[Math.min(6, Math.max(2, daysPerWeek))]);
  const monday = mondayOnOrAfter(startDate);
  const fixedWeeks = eventDate
    ? Math.max(4, Math.min(24, Math.floor(daysBetween(monday, eventDate) / 7) + 1))
    : weeks;
  const analysis = targetSeconds && goal !== "comecar"
    ? analyzeRunningTarget({ goal, targetSeconds, fiveKSeconds, level, weeks: fixedWeeks, estimated: fiveKEstimated })
    : null;
  const totalWeeks = fixedWeeks || analysis?.weeks || RUNNING_GOALS[goal].weeks;
  const paces = trainingPaces(fiveKSeconds);

  if (goal === "comecar") {
    return { goal, level: "iniciante", weeks: beginnerPlan({ startDate: monday, days, weeks: totalWeeks }), paces: null, start_date: monday, event_date: eventDate };
  }

  const li = levelIndex(level);
  const dayFactor = Math.min(1.25, Math.max(0.75, days.length / 4));
  // Meta de tempo pede um pouco mais de volume que só completar a distância.
  const peakKm = PEAK_KM[goal][analysis ? Math.min(2, li + 1) : li] * dayFactor;
  // Voltando de pausa: começa em 60% do volume de antes.
  const startKm = Math.min(peakKm, Math.max(5, (currentWeeklyKm ?? START_KM[li]) * (goal === "voltar" ? 0.6 : 1)));
  const taper = eventDate || goal !== "manter" ? TAPER[goal] : [];
  const peakLongKm = PEAK_LONG_KM[goal];
  const startLongKm = Math.min(peakLongKm, Math.max(3, longestRunKm ?? startKm * 0.35));
  const loads = weeklyLoads({
    // Meta de tempo: a semana 1 já soma longão + sessões mínimas; os 10% partem daí.
    weeks: totalWeeks, peakKm, taper, peakLongKm, startLongKm,
    startKm: analysis ? Math.min(peakKm, Math.max(startKm, startLongKm + 3.5 * (days.length - 1))) : startKm,
    longStep: ["5k", "manter", "voltar"].includes(goal) ? 0.5 : 1
  });
  const beginner = li === 0;
  // Prazo curto: o longão mais longo do plano fica bem abaixo do necessário para a prova.
  const longestPlanned = Math.max(...loads.map(({ long }) => long));
  const warnings = eventDate && RUNNING_GOALS[goal].distance && longestPlanned < peakLongKm * 0.8
    ? [`Prazo curto para ${RUNNING_GOALS[goal].label} no seu nível: o longão chega a ${longestPlanned} km (o ideal seria perto de ${peakLongKm} km). Dá para fazer a prova com calma, mas considere uma prova mais distante ou uma distância menor.`]
    : [];

  const plan = loads.map(({ volume, long: longKm, recovery }, index) => {
    const number = index + 1;
    const phase = recovery ? "recuperação" : phaseOf(number, totalWeeks, taper.length);
    const weekMonday = addDays(monday, index * 7);
    const longDay = days[days.length - 1];
    const otherDays = days.slice(0, -1);
    const qualityCount = beginner ? Math.min(1, otherDays.length - 1) : otherDays.length >= 3 ? 2 : otherDays.length >= 2 ? 1 : 0;
    const qualityDays = pickQualityDays(otherDays, longDay, recovery ? Math.min(1, qualityCount) : qualityCount);
    // Sessão de qualidade: até 25% do volume da semana (4 a 8 km com aquecimento).
    const qualityKm = halfKm(Math.max(4, Math.min(volume * 0.25, 8)));
    const easyCount = otherDays.length - qualityDays.length;
    const easyKm = easyCount ? halfKm(Math.max(3, (volume - longKm - qualityKm * qualityDays.length) / easyCount)) : 0;
    const sessions = [];

    for (const day of otherDays) {
      const date = addDays(weekMonday, (day + 6) % 7);
      const slot = qualityDays.indexOf(day);
      // Meta de tempo: teste de 3 km na semana de recuperação (pernas descansadas) e na 1ª
      // semana se o tempo atual for só estimado.
      if (analysis && slot === 0 && number < totalWeeks - taper.length && (recovery || (number === 1 && fiveKEstimated))) {
        sessions.push({ date, modality: "corrida", ...TEST_SESSION });
        continue;
      }
      if (slot >= 0) {
        const quality = qualitySession({ goal, phase: phase === "recuperação" ? "base" : phase, week: number, paces, beginner, slot, target: Boolean(analysis) });
        const strides = quality.session_type === "rodagem_strides";
        sessions.push({
          date, modality: "corrida", session_type: quality.session_type, title: quality.title,
          description: strides ? `${quality.main[0].toLocaleUpperCase("pt-BR")}${quality.main.slice(1)}.` : `Aquecimento 2 km leve, ${quality.main}, desaquecimento 1,5 km leve.`,
          // Meta de tempo: distância real da sessão (aquecimento 2 + desaquecimento 1,5 + parte principal).
          distance_km: strides ? easyKm || qualityKm : analysis && quality.extra_km ? halfKm(3.5 + quality.extra_km) : qualityKm,
          target_pace: quality.pace || null, intensity: strides ? "leve" : "forte"
        });
      } else {
        sessions.push({ date, modality: "corrida", session_type: "rodagem", title: "Rodagem leve", description: "Corrida contínua em ritmo confortável (dá para conversar).", distance_km: easyKm, target_pace: paces?.easy || null, intensity: "leve" });
      }
    }
    const easySessions = sessions.filter((session) => session.session_type === "rodagem");
    if (phase !== "polimento" && days.length >= 5 && easySessions.length >= 2) {
      Object.assign(easySessions[easySessions.length - 1], {
        session_type: "regenerativo", title: "Regenerativo", description: "Trote bem leve para recuperar.",
        distance_km: halfKm(Math.min(easyKm, 5)), target_pace: paces?.recovery || null, intensity: "muito leve"
      });
    }

    const longDate = addDays(weekMonday, (longDay + 6) % 7);
    const raceWeek = eventDate && number === totalWeeks && RUNNING_GOALS[goal].distance;
    if (raceWeek) {
      sessions.push({ date: eventDate, modality: "corrida", session_type: "prova", title: `🏁 Prova — ${RUNNING_GOALS[goal].label}`, description: "Dia da prova: aqueça 10 min, comece controlado e acelere no fim.", distance_km: round1(RUNNING_GOALS[goal].distance), target_pace: racePace(goal, paces), intensity: "prova" });
    } else if (analysis && number === totalWeeks && analysis.distance <= 10) {
      sessions.push({ date: longDate, modality: "corrida", session_type: "prova", title: `🏁 Teste final — ${RUNNING_GOALS[goal].label}`, description: "Aqueça 10 min com 4 acelerações, corra no ritmo da meta e acelere no último km. Me mande o tempo!", distance_km: round1(analysis.distance), intensity: "prova" });
    } else {
      const finish = phase === "específico" && goal === "42k" ? " Últimos 8 km no ritmo de maratona." : phase === "específico" && goal === "21k" ? " Últimos 5 km no ritmo da meia." : "";
      sessions.push({ date: longDate, modality: "corrida", session_type: "longao", title: "Longão", description: `Corrida longa e leve, sem pressa.${finish}`, distance_km: longKm, target_pace: paces?.long || null, intensity: "moderado" });
    }

    if (analysis) {
      const expected = expectedFiveK({ current: fiveKSeconds, target: analysis.target_five_k, week: number, totalWeeks });
      for (const session of sessions) session.target_pace = paceForSession(session, { current: fiveKSeconds, expected, targetPace: analysis.target_pace, goal });
    }
    for (const session of sessions) {
      const pace = Array.isArray(session.target_pace) ? session.target_pace[1] : null;
      session.duration_min = session.distance_km && pace ? Math.round(session.distance_km * pace / 60) : null;
    }
    // Semana da prova: nada depois da prova.
    const kept = raceWeek ? sessions.filter((session) => session.date <= eventDate) : sessions;
    kept.sort((a, b) => a.date.localeCompare(b.date));
    return { number, phase, total_km: round1(kept.reduce((sum, session) => sum + (session.distance_km || 0), 0)), sessions: kept };
  });

  if (analysis && days.length < 3) warnings.push("Com 2 dias por semana a evolução é mais lenta; se conseguir 3 ou 4, a meta fica mais perto.");
  return { goal, level, weeks: plan, paces, start_date: monday, event_date: eventDate, warnings, analysis };
}

export function describePaces(paces) {
  if (!paces) return null;
  return [
    `Leve/rodagem: ${paceRange(paces.easy)}`,
    `Longão: ${paceRange(paces.long)}`,
    `Limiar: ${paceRange(paces.threshold)}`,
    `Intervalado: ${paceRange(paces.interval)}`,
    `Previsões: 5 km ${formatPace(paces.five_k)}/km · 10 km ${formatPace(paces.ten_k)}/km · 21 km ${formatPace(paces.half)}/km`
  ];
}
