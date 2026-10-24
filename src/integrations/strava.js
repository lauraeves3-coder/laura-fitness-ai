// INT-01: Strava. Conexão por OAuth, renovação do token, importação das atividades e
// ligação com o plano de treino. Chamadas de rede usam `fetchImpl` (testes passam um
// falso; nada aqui chama o Strava nos testes).
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  setStravaConnection, setStravaLastSync, getUser, saveImportedWorkout, getStravaUsers
} from "../db.js";
import { formatDuration, formatPace } from "../training/paces.js";
import { linkWorkoutToPlan } from "../training/service.js";

const API = "https://www.strava.com";
const FIRST_SYNC_DAYS = 14;

export function stravaConfigured() {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

function redirectUri() {
  const base = (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");
  return `${base}/strava/callback`;
}

// "state" assinado: só o WhatsApp de quem pediu o link pode ser ligado à conta.
function stateSecret() {
  return process.env.STRAVA_CLIENT_SECRET || "";
}

export function signState(userId) {
  const payload = Buffer.from(String(userId)).toString("base64url");
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyState(state) {
  const [payload, signature] = String(state || "").split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Buffer.from(payload, "base64url").toString();
}

export function buildAuthUrl(userId) {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state: signState(userId)
  });
  return `${API}/oauth/authorize?${params}`;
}

async function tokenRequest(body, fetchImpl) {
  const response = await fetchImpl(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, ...body })
  });
  if (!response.ok) throw new Error(`Strava recusou o token (${response.status}).`);
  return response.json();
}

// Troca o código da autorização pelos tokens e grava a conexão.
export async function connectWithCode(userId, code, fetchImpl = fetch) {
  const data = await tokenRequest({ code, grant_type: "authorization_code" }, fetchImpl);
  setStravaConnection(userId, {
    athleteId: String(data.athlete?.id ?? ""),
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at
  });
  return data.athlete || {};
}

export function disconnectStrava(userId) {
  setStravaConnection(userId, {});
  setStravaLastSync(userId, null);
}

async function freshAccessToken(user, fetchImpl, nowSeconds) {
  if (user.strava_access_token && Number(user.strava_expires_at) > nowSeconds + 60) return user.strava_access_token;
  const data = await tokenRequest({ refresh_token: user.strava_refresh_token, grant_type: "refresh_token" }, fetchImpl);
  setStravaConnection(user.id, {
    athleteId: user.strava_athlete_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || user.strava_refresh_token,
    expiresAt: data.expires_at
  });
  return data.access_token;
}

const SPORTS = [
  [/^(?:run|trailrun|virtualrun)$/i, "Corrida", "corr"],
  [/ride$|^(?:velomobile|handcycle)$/i, "Ciclismo", "cicl"],
  [/^swim$/i, "Natação", "nata"],
  [/^(?:walk|hike)$/i, "Caminhada", "caminh"],
  [/^weighttraining$/i, "Musculação", "muscula"],
  [/^(?:workout|crossfit|hiit|highintensityintervaltraining)$/i, "Funcional", "funcional"],
  [/^(?:yoga|pilates)$/i, "Yoga/Pilates", "yoga"]
];

// Atividade do Strava → treino do FitPulse (função pura).
export function normalizeActivity(activity) {
  const sport = activity.sport_type || activity.type || "";
  const [, workoutType, matchTerm] = SPORTS.find(([pattern]) => pattern.test(sport)) || [null, activity.name || sport || "Atividade", normalizeTerm(sport)];
  const distanceKm = Math.round((Number(activity.distance) || 0) / 10) / 100;
  return {
    workout_type: workoutType,
    match_term: matchTerm,
    duration_min: Math.round((Number(activity.moving_time) || Number(activity.elapsed_time) || 0) / 6) / 10,
    distance_km: distanceKm,
    trained_at: String(activity.start_date_local || activity.start_date || "").replace("T", " ").replace("Z", "").slice(0, 19),
    source: "strava",
    external_id: `strava:${activity.id}`,
    elevation_m: Number(activity.total_elevation_gain) || null,
    avg_hr: Number(activity.average_heartrate) || null,
    notes: activity.name ? `Strava: ${activity.name}` : "Strava"
  };
}

const normalizeTerm = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

export function describeImported(workout) {
  const parts = [`${workout.workout_type}`];
  if (workout.distance_km > 0) parts.push(`${Number(workout.distance_km).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`);
  if (workout.duration_min > 0) parts.push(formatDuration(workout.duration_min * 60));
  if (workout.distance_km > 0 && workout.duration_min > 0 && /corr|caminh/i.test(workout.workout_type)) parts.push(`${formatPace(workout.duration_min * 60 / workout.distance_km)}/km`);
  if (workout.elevation_m) parts.push(`↗ ${Math.round(workout.elevation_m)} m`);
  if (workout.avg_hr) parts.push(`❤️ ${Math.round(workout.avg_hr)} bpm`);
  return parts.join(" · ");
}

// Importa as atividades novas desde a última sincronização (primeira vez: 14 dias).
// onImported(workout, activityDate) liga ao plano e devolve linhas extras para a mensagem.
export async function syncStrava(userId, { fetchImpl = fetch, now = new Date(), onImported = () => [] } = {}) {
  const user = getUser(userId);
  if (!user?.strava_refresh_token) return { connected: false, imported: [] };
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const token = await freshAccessToken(user, fetchImpl, nowSeconds);
  const after = Number(user.strava_last_sync) || nowSeconds - FIRST_SYNC_DAYS * 86400;
  const response = await fetchImpl(`${API}/api/v3/athlete/activities?after=${after}&per_page=50`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Strava não devolveu as atividades (${response.status}).`);
  const activities = (await response.json()).sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
  const imported = [];
  for (const activity of activities) {
    const normalized = normalizeActivity(activity);
    const result = saveImportedWorkout(userId, normalized);
    if (!result.created && !result.merged) continue;
    const extra = onImported(result.workout, normalized.trained_at.slice(0, 10)) || [];
    imported.push({ workout: result.workout, merged: result.merged, lines: extra });
  }
  setStravaLastSync(userId, nowSeconds);
  return { connected: true, imported };
}

const linkToPlan = (userId) => (workout, date) => linkWorkoutToPlan(userId, workout, date);

// Comandos na conversa. Retorna a resposta ou null (não é sobre o Strava).
export async function handleStravaCommand(userId, message, { fetchImpl = fetch, now = new Date() } = {}) {
  const text = normalizeTerm(message);
  if (!/\bstrava\b/.test(text)) return null;
  if (/\bdesconect\w*|\bdesvincul\w*|\bdesliga\w*/.test(text)) {
    disconnectStrava(userId);
    return "🔌 Strava desconectado. Suas atividades já importadas continuam no histórico.";
  }
  if (/\b(?:sincroniz|atualiz|import|puxa|busca|traz)\w*/.test(text)) {
    try {
      return buildSyncReply(await syncStrava(userId, { fetchImpl, now, onImported: linkToPlan(userId) }));
    } catch (error) {
      console.error("Falha ao sincronizar o Strava:", error.message);
      return "Não consegui falar com o Strava agora. Tente de novo em alguns minutos.";
    }
  }
  if (/\b(?:conect|lig|integr|vincul|conecta)\w*/.test(text)) {
    if (!stravaConfigured()) {
      return "Para ligar o Strava, o servidor precisa de STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET no .env (veja o README, seção Strava).";
    }
    return [
      "🔗 *Conectar Strava*",
      "Abra o link, entre na sua conta do Strava e autorize o acesso às atividades:",
      buildAuthUrl(userId),
      "",
      "_Depois disso eu importo suas corridas e treinos sozinho, a cada 20 minutos._"
    ].join("\n");
  }
  return null;
}

// Agendador: sincroniza quem tem Strava conectado e avisa no WhatsApp o que entrou.
export async function syncAllStrava({ send, fetchImpl = fetch, now = new Date() }) {
  if (!stravaConfigured()) return [];
  const results = [];
  for (const user of getStravaUsers()) {
    try {
      const result = await syncStrava(user.id, { fetchImpl, now, onImported: linkToPlan(user.id) });
      if (result.imported.length) await send(user.id, buildSyncReply(result));
      results.push({ userId: user.id, imported: result.imported.length });
    } catch (error) {
      console.error(`Strava (${user.id}):`, error.message);
      results.push({ userId: user.id, error: error.message });
    }
  }
  return results;
}

export function buildSyncReply({ connected, imported }) {
  if (!connected) return "Seu Strava ainda não está conectado. Mande *conectar strava* para receber o link.";
  if (!imported.length) return "🔄 Strava sincronizado: nenhuma atividade nova.";
  return [
    `🔄 *Strava* — ${imported.length} ${imported.length === 1 ? "atividade importada" : "atividades importadas"}`,
    ...imported.flatMap(({ workout, merged, lines }) => [
      "",
      `🏃 ${describeImported(workout)}${merged ? " _(completou o treino que você já tinha registrado)_" : ""}`,
      ...lines.filter(Boolean)
    ])
  ].join("\n");
}
