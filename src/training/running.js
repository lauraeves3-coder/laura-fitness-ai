// COR-01/03/04: plano de corrida personalizado. Função pura: recebe objetivo, nível e
// disponibilidade e devolve semanas com sessões datadas. Princípios: volume semanal sobe
// no máximo 10%, semana de recuperação a cada 4, polimento antes da prova, qualidade
// (intervalado/limiar/ritmo de prova) só depois da base e nunca em dias seguidos.
import { addDays, daysBetween, weekdayOf } from "../dates.js";
import { formatPace, paceRange, trainingPaces } from "./paces.js";

export const RUNNING_GOALS = {
  comecar: { label: "começar a correr", weeks: 8, distance: null },
  "5k": { label: "5 km", weeks: 8, distance: 5 },
  "10k": { label: "10 km", weeks: 10, distance: 10 },
  "21k": { label: "meia maratona (21 km)", weeks: 12, distance: 21.0975 },
  "42k": { label: "maratona (42 km)", weeks: 16, distance: 42.195 },
  manter: { label: "condicionamento e saúde", weeks: 8, distance: null }
};

const PEAK_KM = { "5k": [18, 28, 40], "10k": [25, 35, 50], "21k": [32, 45, 60], "42k": [45, 60, 80], manter: [15, 25, 35] };
const PEAK_LONG_KM = { "5k": 8, "10k": 13, "21k": 19, "42k": 30, manter: 10 };
const START_KM = [10, 20, 30];
const TAPER = { "5k": [0.65], "10k": [0.6], "21k": [0.75, 0.5], "42k": [0.8, 0.65, 0.45], manter: [] };
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
function qualitySession({ goal, phase, week, paces, beginner, slot }) {
  if (beginner || phase === "base") {
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
  const repeats = week % 2 ? "6 × 800 m" : "5 × 1 km";
  return { session_type: "intervalado", title: "Intervalado", main: `${repeats} forte, 2 min de trote entre eles`, extra_km: week % 2 ? 4.8 : 5, pace: paces?.interval };
}

function racePace(goal, paces) {
  if (!paces) return null;
  const pace = { "5k": paces.five_k, "10k": paces.ten_k, "21k": paces.half, "42k": paces.marathon }[goal] ?? paces.threshold[1];
  return [pace, pace];
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
export function generateRunningPlan({
  goal = "manter", level = "iniciante", startDate, eventDate = null, weeks = null,
  daysPerWeek = 3, availableDays = null, currentWeeklyKm = null, longestRunKm = null, fiveKSeconds = null
}) {
  if (!RUNNING_GOALS[goal]) throw new Error(`objetivo de corrida desconhecido: ${goal}`);
  const days = orderedDays(availableDays?.length ? availableDays : DEFAULT_DAYS[Math.min(6, Math.max(2, daysPerWeek))]);
  const monday = mondayOnOrAfter(startDate);
  const totalWeeks = eventDate
    ? Math.max(4, Math.min(24, Math.floor(daysBetween(monday, eventDate) / 7) + 1))
    : (weeks || RUNNING_GOALS[goal].weeks);
  const paces = trainingPaces(fiveKSeconds);

  if (goal === "comecar") {
    return { goal, level: "iniciante", weeks: beginnerPlan({ startDate: monday, days, weeks: totalWeeks }), paces: null, start_date: monday, event_date: eventDate };
  }

  const li = levelIndex(level);
  const dayFactor = Math.min(1.25, Math.max(0.75, days.length / 4));
  const peakKm = PEAK_KM[goal][li] * dayFactor;
  const startKm = Math.min(peakKm, Math.max(5, currentWeeklyKm ?? START_KM[li]));
  const taper = eventDate || goal !== "manter" ? TAPER[goal] : [];
  const peakLongKm = PEAK_LONG_KM[goal];
  const loads = weeklyLoads({
    weeks: totalWeeks, startKm, peakKm, taper, peakLongKm,
    startLongKm: Math.min(peakLongKm, Math.max(3, longestRunKm ?? startKm * 0.35)),
    longStep: goal === "5k" || goal === "manter" ? 0.5 : 1
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
      if (slot >= 0) {
        const quality = qualitySession({ goal, phase: phase === "recuperação" ? "base" : phase, week: number, paces, beginner, slot });
        const strides = quality.session_type === "rodagem_strides";
        sessions.push({
          date, modality: "corrida", session_type: quality.session_type, title: quality.title,
          description: strides ? `${quality.main[0].toLocaleUpperCase("pt-BR")}${quality.main.slice(1)}.` : `Aquecimento 2 km leve, ${quality.main}, desaquecimento 1,5 km leve.`,
          distance_km: strides ? easyKm || qualityKm : qualityKm, target_pace: quality.pace || null, intensity: strides ? "leve" : "forte"
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
    } else {
      const finish = phase === "específico" && goal === "42k" ? " Últimos 8 km no ritmo de maratona." : phase === "específico" && goal === "21k" ? " Últimos 5 km no ritmo da meia." : "";
      sessions.push({ date: longDate, modality: "corrida", session_type: "longao", title: "Longão", description: `Corrida longa e leve, sem pressa.${finish}`, distance_km: longKm, target_pace: paces?.long || null, intensity: "moderado" });
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

  return { goal, level, weeks: plan, paces, start_date: monday, event_date: eventDate, warnings };
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
