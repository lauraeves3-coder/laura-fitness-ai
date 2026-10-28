// COR-05: recordes de corrida. Melhor marca em cada distância a partir do pace médio das
// corridas que cobriram ao menos aquela distância (é a melhor marca registrada, não a
// "melhor parcial"), maior distância e melhor pace (corridas de 3 km+). Funções puras.
import { formatDuration, formatPace } from "./paces.js";

const DISTANCES = [[5, "5 km"], [10, "10 km"], [21.0975, "meia maratona"], [42.195, "maratona"]];
const fmtDay = (trainedAt) => String(trainedAt).slice(0, 10).split("-").reverse().slice(0, 2).join("/");

const paceOfRun = (run) => Number(run.pace_s_per_km) || (run.distance_km > 0 && run.duration_min > 0 ? run.duration_min * 60 / run.distance_km : null);

export function runningRecords(runs) {
  const valid = runs.filter((run) => Number(run.distance_km) > 0 && paceOfRun(run));
  const records = { distances: [], longest: null, bestPace: null };
  for (const [km, label] of DISTANCES) {
    const candidates = valid.filter((run) => Number(run.distance_km) >= km * 0.98);
    if (!candidates.length) continue;
    const best = candidates.reduce((top, run) => (paceOfRun(run) < paceOfRun(top) ? run : top));
    records.distances.push({ km, label, seconds: Math.round(paceOfRun(best) * km), run: best });
  }
  if (valid.length) records.longest = valid.reduce((top, run) => (Number(run.distance_km) > Number(top.distance_km) ? run : top));
  const paced = valid.filter((run) => Number(run.distance_km) >= 3);
  if (paced.length) records.bestPace = paced.reduce((top, run) => (paceOfRun(run) < paceOfRun(top) ? run : top));
  return records;
}

export function buildRecordsReply(runs) {
  const records = runningRecords(runs);
  if (!records.longest) return "🏆 Ainda não tenho corridas com distância registradas. Mande, por exemplo: *corri 5 km em 30 min*, ou conecte o Strava.";
  const km = (value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return [
    "🏆 *Seus recordes de corrida*",
    "",
    ...records.distances.map(({ km: distance, label, seconds, run }) => `• *${label}:* ${formatDuration(seconds)} (${formatPace(seconds / distance)}/km) — ${fmtDay(run.trained_at)}`),
    `• *Maior distância:* ${km(records.longest.distance_km)} km — ${fmtDay(records.longest.trained_at)}`,
    records.bestPace ? `• *Melhor pace (3 km+):* ${formatPace(paceOfRun(records.bestPace))}/km em ${km(records.bestPace.distance_km)} km — ${fmtDay(records.bestPace.trained_at)}` : null,
    "",
    "_Marcas pelo pace médio de cada corrida inteira; uma prova ou teste costuma render tempos melhores._"
  ].filter((line) => line !== null).join("\n");
}

// Recordes que esta corrida bateu em relação às anteriores.
export function newRecordLines(previousRuns, run) {
  if (!(Number(run?.distance_km) > 0) || !paceOfRun(run)) return [];
  const before = runningRecords(previousRuns);
  const after = runningRecords([...previousRuns, run]);
  const lines = [];
  for (const record of after.distances) {
    const old = before.distances.find((item) => item.km === record.km);
    if (record.run === run && (!old || record.seconds < old.seconds) && previousRuns.length) {
      lines.push(`🏆 Novo recorde: melhor ${record.label} (${formatDuration(record.seconds)})${old ? `, ${formatDuration(old.seconds - record.seconds)} mais rápido que antes` : ""}!`);
    }
  }
  if (previousRuns.length && before.longest && Number(run.distance_km) > Number(before.longest.distance_km)) {
    lines.push(`🏆 Sua maior corrida até hoje: ${Number(run.distance_km).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km!`);
  }
  return lines;
}

export function isRecordsQuery(message) {
  const text = String(message || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
  return /\b(?:recordes? de corrida|meus recordes|melhores? (?:tempos?|marcas?)|meu melhor tempo|recorde nos? \d+ ?k)\b/.test(text);
}
