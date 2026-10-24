// INT-01: Strava com servidor falso (fetch simulado) e banco temporário. Nenhuma chamada
// real ao Strava.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.FITPULSE_DB_PATH = join(mkdtempSync(join(tmpdir(), "fitpulse-strava-")), "strava.db");
assert.notEqual(resolve(process.env.FITPULSE_DB_PATH), resolve("fitness.db"));
delete process.env.OPENAI_API_KEY;
process.env.STRAVA_CLIENT_ID = "12345";
process.env.STRAVA_CLIENT_SECRET = "segredo-de-teste";
process.env.PUBLIC_BASE_URL = "https://fitpulse.exemplo.test";

const strava = await import("../src/integrations/strava.js");
const db = await import("../src/db.js");
const service = await import("../src/training/service.js");

const NOW = new Date("2026-10-27T15:00:00Z");
const nowSeconds = Math.floor(NOW.getTime() / 1000);

// Strava falso: registra as chamadas e responde token/atividades.
function fakeStrava({ activities = [], token = "access-novo" } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/oauth/token")) {
      return { ok: true, json: async () => ({ access_token: token, refresh_token: "refresh-1", expires_at: nowSeconds + 21600, athlete: { id: 987, firstname: "Laura" } }) };
    }
    if (url.includes("/athlete/activities")) {
      const after = Number(new URL(url).searchParams.get("after"));
      return { ok: true, json: async () => activities.filter((activity) => Date.parse(activity.start_date) / 1000 > after) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchImpl, calls };
}

const run = (id, day, km, minutes, extra = {}) => ({
  id, name: `Corrida ${id}`, sport_type: "Run", distance: km * 1000, moving_time: minutes * 60,
  start_date: `${day}T09:00:00Z`, start_date_local: `${day}T06:00:00Z`, total_elevation_gain: 42, average_heartrate: 151, ...extra
});

test("INT-01: link de autorização com state assinado; state adulterado é recusado", () => {
  const url = new URL(strava.buildAuthUrl("5511999999999"));
  assert.equal(url.origin + url.pathname, "https://www.strava.com/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "12345");
  assert.equal(url.searchParams.get("redirect_uri"), "https://fitpulse.exemplo.test/strava/callback");
  assert.match(url.searchParams.get("scope"), /activity:read_all/);
  assert.equal(strava.verifyState(url.searchParams.get("state")), "5511999999999");
  const [payload] = url.searchParams.get("state").split(".");
  assert.equal(strava.verifyState(`${payload}.assinatura-falsa`), null);
  assert.equal(strava.verifyState(`${Buffer.from("outra-pessoa").toString("base64url")}.${url.searchParams.get("state").split(".")[1]}`), null);
});

test("INT-01: atividade do Strava vira treino do FitPulse", () => {
  const workout = strava.normalizeActivity(run(1, "2026-10-26", 8.234, 45));
  assert.equal(workout.workout_type, "Corrida");
  assert.equal(workout.distance_km, 8.23);
  assert.equal(workout.duration_min, 45);
  assert.equal(workout.trained_at, "2026-10-26 06:00:00");
  assert.equal(workout.external_id, "strava:1");
  assert.equal(strava.normalizeActivity({ id: 2, sport_type: "MountainBikeRide", distance: 20000, moving_time: 3600, start_date_local: "2026-10-26T07:00:00Z" }).workout_type, "Ciclismo");
  assert.equal(strava.normalizeActivity({ id: 3, sport_type: "WeightTraining", distance: 0, moving_time: 3000, start_date_local: "2026-10-26T18:00:00Z" }).workout_type, "Musculação");
});

test("INT-01: conectar, importar sem duplicar e renovar o token vencido", async () => {
  const userId = "strava-user";
  const fake = fakeStrava({ activities: [run(10, "2026-10-20", 5, 30), run(11, "2026-10-25", 10, 58)] });
  const athlete = await strava.connectWithCode(userId, "codigo", fake.fetchImpl);
  assert.equal(athlete.id, 987);
  assert.equal(db.getUser(userId).strava_refresh_token, "refresh-1");

  const first = await strava.syncStrava(userId, { fetchImpl: fake.fetchImpl, now: NOW });
  assert.equal(first.imported.length, 2);
  assert.match(strava.buildSyncReply(first), /2 atividades importadas[\s\S]*Corrida · 10 km · 58:00 · 5:48\/km · ↗ 42 m · ❤️ 151 bpm/);
  const again = await strava.syncStrava(userId, { fetchImpl: fake.fetchImpl, now: new Date(NOW.getTime() + 60000) });
  assert.equal(again.imported.length, 0, "segunda sincronização não duplica");

  // Token vencido: renova antes de buscar.
  db.setStravaConnection(userId, { athleteId: "987", accessToken: "velho", refreshToken: "refresh-1", expiresAt: nowSeconds - 10 });
  const renewed = fakeStrava({ token: "access-renovado" });
  await strava.syncStrava(userId, { fetchImpl: renewed.fetchImpl, now: NOW });
  assert.ok(renewed.calls[0].url.endsWith("/oauth/token"));
  assert.match(JSON.parse(renewed.calls[0].options.body).grant_type, /refresh_token/);
  assert.equal(renewed.calls[1].options.headers.Authorization, "Bearer access-renovado");
});

test("INT-01: treino já registrado à mão no mesmo dia é completado, não duplicado", async () => {
  const userId = "strava-merge";
  const manual = db.saveWorkout(userId, { workout_type: "Corrida", duration_min: 30, distance_km: 5, exercises: [] });
  const day = String(manual.trained_at).slice(0, 10);
  const fake = fakeStrava({ activities: [run(20, day, 5.12, 31)] });
  await strava.connectWithCode(userId, "codigo", fake.fetchImpl);
  const result = await strava.syncStrava(userId, { fetchImpl: fake.fetchImpl, now: new Date(Date.parse(`${day}T23:00:00Z`)) });
  assert.equal(result.imported.length, 1);
  assert.equal(result.imported[0].merged, true);
  const runs = db.getRunsBetween(userId, day, day);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].distance_km, 5.12);
});

test("INT-01: atividade importada cumpre a sessão do plano daquele dia", async () => {
  const userId = "strava-plan";
  service.createTrainingPlanFromRequest(userId, {
    running_goal: "10k", running_level: "intermediario", running_days_per_week: 4, available_days: [], current_weekly_km: 20,
    longest_run_km: 8, reference_distance_km: 5, reference_time: "28:00", easy_pace: null, event_date: null, strength_goal: null,
    strength_level: null, strength_days_per_week: null, equipment: null, limitations: [], other_modality: null, other_level: null, other_days_per_week: null
  }, "2026-10-27");
  const fake = fakeStrava({ activities: [run(30, "2026-10-27", 5.5, 35)] });
  await strava.connectWithCode(userId, "codigo", fake.fetchImpl);
  const result = await strava.syncStrava(userId, {
    fetchImpl: fake.fetchImpl, now: new Date("2026-10-27T23:00:00Z"),
    onImported: (workout, date) => service.linkWorkoutToPlan(userId, workout, date)
  });
  assert.match(strava.buildSyncReply(result), /Plano: \*Fartlek leve\*/);
  assert.equal(db.getPlannedSessions(userId, "2026-10-27", "2026-10-27")[0].status, "feito");
});

test("INT-01: comandos na conversa", async () => {
  const userId = "strava-chat";
  assert.match(await strava.handleStravaCommand(userId, "quero conectar meu strava"), /https:\/\/www\.strava\.com\/oauth\/authorize/);
  assert.match(await strava.handleStravaCommand(userId, "sincronizar strava"), /ainda não está conectado/);
  const fake = fakeStrava({ activities: [run(40, "2026-10-26", 6, 36)] });
  await strava.connectWithCode(userId, "codigo", fake.fetchImpl);
  assert.match(await strava.handleStravaCommand(userId, "sincroniza o strava", { fetchImpl: fake.fetchImpl, now: NOW }), /1 atividade importada/);
  assert.match(await strava.handleStravaCommand(userId, "desconectar strava"), /Strava desconectado/);
  assert.equal(db.getUser(userId).strava_refresh_token, null);
  assert.equal(await strava.handleStravaCommand(userId, "comi arroz"), null);
});

test("INT-01: retorno do Strava com state inválido ou sem permissão de atividades é recusado", async () => {
  const { default: app } = await import("../src/app.js");
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const invalid = await fetch(`${base}/strava/callback?code=abc&state=forjado.assinatura&scope=read,activity:read_all`);
    assert.equal(invalid.status, 400);
    assert.match(await invalid.text(), /link de conexão é inválido/);
    const state = new URL(strava.buildAuthUrl("5511888888888")).searchParams.get("state");
    const noScope = await fetch(`${base}/strava/callback?code=abc&state=${encodeURIComponent(state)}&scope=read`);
    assert.equal(noScope.status, 400);
    assert.equal(db.getUser("5511888888888")?.strava_refresh_token ?? null, null);
  } finally {
    server.close();
  }
});

test("INT-01: endereço de retorno colado no WhatsApp conclui a conexão (autorização feita no celular)", async () => {
  const userId = "5511777777777";
  const state = new URL(strava.buildAuthUrl(userId)).searchParams.get("state");
  const fake = fakeStrava({ activities: [run(50, "2026-10-26", 7, 42)] });
  const pasted = `http://localhost:3000/strava/callback?state=${encodeURIComponent(state)}&code=codigo-do-celular&scope=read,activity:read_all`;
  const reply = await strava.handleStravaCommand(userId, pasted, { fetchImpl: fake.fetchImpl, now: NOW });
  assert.match(reply, /Strava conectado, Laura/);
  assert.match(reply, /1 atividade importada/);
  assert.equal(JSON.parse(fake.calls[0].options.body).code, "codigo-do-celular");
  assert.equal(db.getUser(userId).strava_refresh_token, "refresh-1");
  // Endereço de outra conversa não conecta.
  assert.match(await strava.handleStravaCommand("5511666666666", pasted, { fetchImpl: fake.fetchImpl, now: NOW }), /não é desta conversa/);
  // Sem a permissão de atividades.
  assert.match(await strava.handleStravaCommand(userId, pasted.replace("read,activity:read_all", "read"), { fetchImpl: fake.fetchImpl, now: NOW }), /Faltou permitir/);
});
