// ESP-02: modalidades aeróbicas além da corrida (ciclismo, natação, caminhada, funcional,
// HIIT). Plano por duração e intensidade, com a mesma regra de progressão da corrida:
// +10% por semana, recuperação a cada 4 semanas. Função pura.
import { addDays } from "../dates.js";
import { mondayOnOrAfter } from "./running.js";

export const ENDURANCE_MODALITIES = {
  ciclismo: { label: "ciclismo", long: "Pedal longo", easy: "Pedal leve (zona 2: dá para conversar)", quality: ["5 × 4 min forte com 3 min leve", "3 × 8 min em ritmo forte e controlado com 4 min leve", "Subidas: 6 × 2 min em cadência baixa e força"] },
  natacao: { label: "natação", long: "Nado contínuo longo", easy: "Nado leve e técnico (educativos + nado contínuo)", quality: ["8 × 50 m forte com 30 s de descanso", "4 × 200 m em ritmo forte com 45 s de descanso", "10 × 100 m moderado com 20 s de descanso"] },
  caminhada: { label: "caminhada", long: "Caminhada longa", easy: "Caminhada em ritmo confortável", quality: ["Caminhada com 6 × 2 min em ritmo acelerado", "Caminhada em subida ou escada: 20 min", "Caminhada rápida contínua"] },
  funcional: { label: "treino funcional", long: "Circuito longo (corpo inteiro)", easy: "Mobilidade + circuito leve", quality: ["Circuito: 4 voltas de 8 exercícios × 40 s, 20 s de descanso", "EMOM 20 min: agachamento, flexão, remada, prancha", "Circuito de força: 3 voltas de 6 exercícios × 12"] },
  hiit: { label: "HIIT", long: "Aeróbico leve longo (recuperação ativa)", easy: "Aeróbico leve 30 min", quality: ["Tabata: 2 blocos de 8 × (20 s forte + 10 s leve)", "10 × (30 s forte + 90 s leve)", "6 × (1 min forte + 1 min leve)"] }
};

const capitalize = (text) => text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);

const START_MIN = { iniciante: 25, intermediario: 40, avancado: 55 };
const PEAK_MIN = { iniciante: 50, intermediario: 75, avancado: 100 };
const DEFAULT_DAYS = { 1: [6], 2: [2, 6], 3: [2, 4, 6], 4: [2, 3, 5, 0], 5: [1, 2, 4, 5, 0], 6: [1, 2, 3, 4, 5, 0] };

export function generateEndurancePlan({ modality, level = "iniciante", startDate, weeks = 8, daysPerWeek = 3, availableDays = null }) {
  const config = ENDURANCE_MODALITIES[modality];
  if (!config) throw new Error(`modalidade desconhecida: ${modality}`);
  const days = [...new Set(availableDays?.length ? availableDays : DEFAULT_DAYS[Math.min(6, Math.max(1, daysPerWeek))])]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const monday = mondayOnOrAfter(startDate);
  let base = START_MIN[level] ?? START_MIN.iniciante;
  const peak = PEAK_MIN[level] ?? PEAK_MIN.iniciante;

  const plan = Array.from({ length: weeks }, (_, index) => {
    const number = index + 1;
    const recovery = number > 1 && number % 4 === 0;
    if (number > 1 && !recovery) base = Math.min(peak, base * 1.1);
    const minutes = Math.round((recovery ? base * 0.8 : base) / 5) * 5;
    const weekMonday = addDays(monday, index * 7);
    const sessions = days.map((day, dayIndex) => {
      const date = addDays(weekMonday, (day + 6) % 7);
      const isLong = dayIndex === days.length - 1 && days.length > 1;
      const isQuality = dayIndex === 0 && days.length > 1 && !(level === "iniciante" && number <= 2);
      if (isLong) return { date, modality, session_type: "longo", title: config.long, description: `${config.long}, intensidade leve a moderada.`, duration_min: Math.round(minutes * 1.4 / 5) * 5, intensity: "moderado" };
      if (isQuality) return { date, modality, session_type: "qualidade", title: `${capitalize(config.label)} — intensidade`, description: `Aquecimento 10 min, ${config.quality[(number - 1) % config.quality.length]}, 5 min leve no fim.`, duration_min: minutes, intensity: "forte" };
      return { date, modality, session_type: "leve", title: `${capitalize(config.label)} leve`, description: config.easy, duration_min: minutes, intensity: "leve" };
    });
    return { number, phase: recovery ? "recuperação" : number <= 3 ? "base" : "progressão", total_min: sessions.reduce((sum, session) => sum + session.duration_min, 0), sessions };
  });

  return { modality, level, weeks: plan, start_date: monday };
}
