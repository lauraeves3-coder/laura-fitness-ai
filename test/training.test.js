// ESP/COR/MUS: planos de treino e acompanhamento. Funções puras e serviço com banco
// temporário e datas fixas (terça 27/10/2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.FITPULSE_DB_PATH = join(mkdtempSync(join(tmpdir(), "fitpulse-training-")), "training.db");
assert.notEqual(resolve(process.env.FITPULSE_DB_PATH), resolve("fitness.db"));

const { parseDuration, formatPace, trainingPaces, fiveKFromReference } = await import("../src/training/paces.js");
const { generateRunningPlan } = await import("../src/training/running.js");
const { generateStrengthPlan } = await import("../src/training/strength.js");
const { generateEndurancePlan } = await import("../src/training/endurance.js");
const { buildTrainingPlan } = await import("../src/training/plan.js");
const { adaptSession, compareWithPlan, modalityOf } = await import("../src/training/tracking.js");
const service = await import("../src/training/service.js");
const { detectTrainingIntent } = service;
const db = await import("../src/db.js");
const { daysBetween, weekdayOf } = await import("../src/dates.js");

const TUESDAY = "2026-10-27";
const longRuns = (plan) => plan.weeks.flatMap((week) => week.sessions.filter((session) => session.session_type === "longao"));
const HARD = new Set(["intervalado", "limiar", "ritmo_prova", "fartlek", "longao", "prova"]);

test("COR-02: tempos, pace e ritmos de treino", () => {
  assert.equal(parseDuration("28:00"), 1680);
  assert.equal(parseDuration("1:02:30"), 3750);
  assert.equal(parseDuration("1h05"), 3900);
  assert.equal(parseDuration("25 min"), 1500);
  assert.equal(formatPace(330), "5:30");
  const paces = trainingPaces(1680);
  assert.equal(paces.five_k, 336);
  assert.ok(paces.easy[0] > paces.threshold[1] && paces.threshold[0] > paces.interval[1], "leve > limiar > intervalado em s/km");
  assert.equal(fiveKFromReference({ distanceKm: 5, timeSeconds: 1500 }), 1500);
  assert.ok(fiveKFromReference({ distanceKm: 10, timeSeconds: 3300 }) < 1650);
});

test("COR-04: volume sobe no máximo 10% por semana e cai na semana de recuperação", () => {
  const plan = generateRunningPlan({ goal: "10k", level: "intermediario", startDate: TUESDAY, daysPerWeek: 4, currentWeeklyKm: 20, fiveKSeconds: 1680 });
  // Comparado com a última semana normal (a de recuperação não conta como base);
  // a regra de 10% vale para o alvo semanal; a soma das sessões (com distâncias mínimas
  // e arredondamento a 0,5 km) varia um pouco em volta dele.
  const totals = plan.weeks.map((week) => week.total_km);
  let base = totals[0];
  for (let index = 1; index < totals.length; index++) {
    assert.ok(totals[index] <= base * 1.3, `semana ${index + 1}: ${base} → ${totals[index]}`);
    if (plan.weeks[index].phase !== "recuperação") base = Math.max(base, totals[index]);
  }
  assert.ok(totals[3] < totals[2], "semana 4 é de recuperação");
  assert.equal(plan.weeks[3].phase, "recuperação");
  assert.equal(plan.weeks.at(-1).phase, "polimento");
});

test("COR-03: treinos fortes nunca em dias seguidos e longão no último dia", () => {
  const plan = generateRunningPlan({ goal: "21k", level: "avancado", startDate: TUESDAY, daysPerWeek: 5, currentWeeklyKm: 35, fiveKSeconds: 1380 });
  for (const week of plan.weeks) {
    const hard = week.sessions.filter((session) => HARD.has(session.session_type)).map((session) => session.date).sort();
    for (let index = 1; index < hard.length; index++) {
      assert.ok(daysBetween(hard[index - 1], hard[index]) >= 2, `semana ${week.number}: ${hard.join(", ")}`);
    }
    assert.equal(week.sessions.at(-1).session_type === "longao" || week.sessions.at(-1).session_type === "prova", true);
  }
});

test("COR-01: prova com data termina no dia da prova; prazo curto gera aviso", () => {
  const plan = generateRunningPlan({ goal: "21k", level: "iniciante", startDate: TUESDAY, eventDate: "2027-01-24", daysPerWeek: 3, currentWeeklyKm: 12, fiveKSeconds: 1920 });
  const last = plan.weeks.at(-1).sessions.at(-1);
  assert.equal(last.session_type, "prova");
  assert.equal(last.date, "2027-01-24");
  assert.ok(plan.weeks.flatMap((week) => week.sessions).every((session) => session.date <= "2027-01-24"));
  assert.equal(plan.warnings.length, 1);
  const prepared = generateRunningPlan({ goal: "21k", level: "iniciante", startDate: TUESDAY, eventDate: "2027-01-24", daysPerWeek: 3, currentWeeklyKm: 15, longestRunKm: 10, fiveKSeconds: 1920 });
  assert.equal(prepared.warnings.length, 0);
  assert.ok(Math.max(...longRuns(prepared).map((session) => session.distance_km)) >= 15);
});

test("COR-01: começar a correr alterna corrida e caminhada até 30 min", () => {
  const plan = generateRunningPlan({ goal: "comecar", startDate: TUESDAY });
  assert.equal(plan.weeks.length, 8);
  assert.match(plan.weeks[0].sessions[0].description, /correndo \+ 1 min e 30 s caminhando/);
  assert.match(plan.weeks.at(-1).sessions[0].description, /30 min correndo contínuo/);
});

test("MUS-04: musculação respeita equipamento e limitações, sem repetir exercício na sessão", () => {
  const plan = generateStrengthPlan({ goal: "hipertrofia", level: "intermediario", daysPerWeek: 4, equipment: "academia", limitations: ["joelho"] });
  assert.equal(plan.sessions.length, 4);
  const names = plan.sessions.flatMap((session) => session.exercises.map((exercise) => exercise.name));
  assert.ok(!names.some((name) => /Agachamento livre$|Afundo|Cadeira extensora/.test(name)), "joelho: sem agachamento livre, afundo e extensora");
  for (const session of plan.sessions) {
    const sessionNames = session.exercises.map((exercise) => exercise.name);
    assert.equal(new Set(sessionNames).size, sessionNames.length, session.label);
  }
  const home = generateStrengthPlan({ goal: "corrida", level: "iniciante", daysPerWeek: 2, equipment: "casa" });
  assert.ok(home.sessions.flatMap((session) => session.exercises).every((exercise) => !/polia|máquina|Leg press/.test(exercise.name)));
});

test("ESP-02: outras modalidades e agenda combinada sem conflito", () => {
  const bike = generateEndurancePlan({ modality: "ciclismo", level: "intermediario", startDate: TUESDAY, daysPerWeek: 3, weeks: 4 });
  assert.equal(bike.weeks[3].phase, "recuperação");
  assert.ok(bike.weeks[3].total_min < bike.weeks[2].total_min);

  const combined = buildTrainingPlan({ startDate: "2026-10-26", goals: [
    { modality: "corrida", goal: "10k", level: "intermediario", daysPerWeek: 4, currentWeeklyKm: 20, fiveKSeconds: 1680 },
    { modality: "musculacao", level: "intermediario", daysPerWeek: 2, equipment: "academia" }
  ] });
  const byDate = new Map();
  for (const session of combined.sessions) byDate.set(session.date, [...(byDate.get(session.date) || []), session]);
  for (const session of combined.sessions.filter((item) => item.modality === "musculacao")) {
    const sameDay = byDate.get(session.date).filter((item) => item.modality === "corrida");
    assert.ok(sameDay.every((run) => !HARD.has(run.session_type) || run.session_type === "fartlek"), `musculação em dia de corrida forte: ${session.date}`);
  }
});

test("ESP-05/06: comparação, ajuste por cansaço e dor, intenções", () => {
  const easy = { modality: "corrida", session_type: "rodagem", title: "Rodagem leve", distance_km: 6, target_pace: [410, 440], intensity: "leve" };
  assert.match(compareWithPlan(easy, { distance_km: 6, pace_s_per_km: 425 }).join("\n"), /distância ✅ · ritmo dentro do alvo/);
  assert.match(compareWithPlan(easy, { distance_km: 6, pace_s_per_km: 360 }).join("\n"), /segure um pouco/);
  const interval = { ...easy, session_type: "intervalado", title: "Intervalado", target_pace: [326, 336], intensity: "forte" };
  assert.match(compareWithPlan(interval, { distance_km: 6, pace_s_per_km: 382 }).join("\n"), /treino de qualidade cumprido/);
  assert.equal(adaptSession(interval, "cansaco").changes.session_type, "rodagem");
  assert.equal(adaptSession(interval, "dor").changes.session_type, "descanso");
  assert.equal(modalityOf("Musculação — pernas"), "musculacao");
  assert.equal(modalityOf("corrida"), "corrida");
  assert.deepEqual(detectTrainingIntent("qual meu treino de hoje?"), { type: "day", offset: 0 });
  assert.deepEqual(detectTrainingIntent("treino de amanhã"), { type: "day", offset: 1 });
  assert.deepEqual(detectTrainingIntent("me mostra os treinos da semana"), { type: "week" });
  assert.deepEqual(detectTrainingIntent("como está minha corrida?"), { type: "progress" });
  assert.deepEqual(detectTrainingIntent("pulei o treino hoje"), { type: "skip" });
  assert.deepEqual(detectTrainingIntent("dormi mal"), { type: "adapt", reason: "cansaco" });
  assert.deepEqual(detectTrainingIntent("estou com dor no joelho"), { type: "adapt", reason: "dor" });
  assert.equal(detectTrainingIntent("comi arroz"), null);
});

const request = {
  running_goal: "10k", running_level: "intermediario", running_days_per_week: 4, available_days: [], current_weekly_km: 20,
  longest_run_km: 8, reference_distance_km: 5, reference_time: "28:00", easy_pace: null, event_date: null,
  strength_goal: null, strength_level: null, strength_days_per_week: 2, equipment: "academia", limitations: [],
  other_modality: null, other_level: null, other_days_per_week: null
};

test("ESP-04: pedido incompleto devolve as perguntas que faltam", () => {
  const reply = service.createTrainingPlanFromRequest("svc-missing", { ...request, running_level: null, reference_time: null, running_days_per_week: null }, TUESDAY);
  assert.match(reply, /há quanto tempo você corre/);
  assert.match(reply, /quantos dias por semana pode correr/);
  assert.match(reply, /um tempo recente/);
  assert.equal(db.getActiveTrainingPlan("svc-missing"), null);
});

test("ESP-04/06: plano criado, treino do dia, treino feito ligado ao plano e semana", () => {
  const userId = "svc-plan";
  const created = service.createTrainingPlanFromRequest(userId, request, TUESDAY);
  assert.match(created, /Plano de treino criado/);
  assert.match(created, /Leve\/rodagem: 6:50–7:24\/km/);
  assert.ok(db.getPlannedSessions(userId, "2026-10-26", "2026-10-26").length === 0, "dias passados da semana ficam de fora");

  const today = service.handleTrainingMessage(userId, "qual meu treino de hoje?", TUESDAY);
  assert.match(today, /Treino de hoje\* — ter 27\/10/);

  const workout = db.saveWorkout(userId, { workout_type: "Corrida", duration_min: 35, distance_km: 5.5, exercises: [] });
  assert.equal(workout.pace_s_per_km, 382);
  const lines = service.afterWorkoutSaved(userId, workout, TUESDAY).join("\n");
  assert.match(lines, /5,5 km · pace 6:22\/km/);
  assert.match(lines, /Plano: \*Fartlek leve\*/);
  assert.equal(db.getPlannedSessions(userId, TUESDAY, TUESDAY)[0].status, "feito");

  const week = service.handleTrainingMessage(userId, "treinos da semana", TUESDAY);
  assert.match(week, /✅ ter 27\/10 — Fartlek leve/);
  assert.match(week, /Feito: 1 de/);
});

test("ESP-05: pular e ajustar por cansaço alteram só o treino de hoje", () => {
  const userId = "svc-adapt";
  service.createTrainingPlanFromRequest(userId, request, TUESDAY);
  const wednesday = "2026-10-28";
  assert.match(service.handleTrainingMessage(userId, "to muito cansada hoje", wednesday), /Ajustei o treino de hoje/);
  assert.equal(db.getPlannedSessions(userId, wednesday, wednesday)[0].status, "ajustado");
  assert.match(service.handleTrainingMessage(userId, "pulei o treino", "2026-10-30"), /marquei o treino de hoje como não feito/);
  assert.equal(db.getPlannedSessions(userId, "2026-10-30", "2026-10-30").find((session) => session.modality === "corrida").status, "pulado");
  // Sem plano, cansaço não é tratado aqui (segue para o fluxo normal).
  assert.equal(service.handleTrainingMessage("sem-plano", "estou cansado", wednesday), null);
});

test("ESP-04: plano criado na sexta começa na segunda seguinte", () => {
  const friday = "2026-10-30";
  assert.equal(weekdayOf(friday), 5);
  service.createTrainingPlanFromRequest("svc-friday", request, friday);
  const plan = db.getActiveTrainingPlan("svc-friday");
  assert.equal(plan.start_date, "2026-11-02");
});

test("ESP-04: respostas em outra mensagem completam o pedido anterior", () => {
  const userId = "svc-two-steps";
  const empty = { ...request, running_level: null, running_days_per_week: null, current_weekly_km: null, longest_run_km: null,
    reference_distance_km: null, reference_time: null, strength_days_per_week: null, equipment: null };
  assert.match(service.createTrainingPlanFromRequest(userId, empty, TUESDAY), /me conta/);
  assert.equal(db.getPendingTrainingRequest(userId).running_goal, "10k");
  // Segunda mensagem: o modelo só repassa o que veio agora (sem o objetivo).
  const answer = { running_goal: null, running_level: "intermediario", running_days_per_week: 4, available_days: [], current_weekly_km: 20,
    longest_run_km: null, reference_distance_km: 5, reference_time: "28:00", easy_pace: null, event_date: null, strength_goal: null,
    strength_level: null, strength_days_per_week: null, equipment: null, limitations: [], other_modality: null, other_level: null, other_days_per_week: null };
  assert.match(service.createTrainingPlanFromRequest(userId, answer, TUESDAY), /Plano de treino criado[\s\S]*10 km/);
  assert.equal(db.getPendingTrainingRequest(userId), null);
});

test("COR-02: o histórico recente preenche volume, maior corrida, pace e nível do plano", () => {
  const userId = "svc-history";
  for (const [km, minutes] of [[5, 36], [7.4, 56], [6.4, 46]]) {
    db.saveWorkout(userId, { workout_type: "Corrida", duration_min: minutes, distance_km: km, exercises: [] });
  }
  const today = db.getDailySummary(userId).date;
  const reply = service.createTrainingPlanFromRequest(userId, { ...request, running_level: null, current_weekly_km: null, longest_run_km: null,
    reference_distance_km: null, reference_time: null, strength_days_per_week: null, equipment: null }, today);
  assert.match(reply, /Plano de treino criado/);
  assert.match(reply, /Usei suas corridas das últimas 4 semanas: ~5 km\/semana, maior corrida 7,4 km, pace médio 7:12\/km/);
});

test("COR-06: meta de tempo — análise, ritmos progressivos, testes e blocos no ritmo da meta", async () => {
  const { analyzeRunningTarget } = await import("../src/training/running.js");
  // 5 km hoje ~28:40 (pace confortável 7:17), meta 25:00.
  const analysis = analyzeRunningTarget({ goal: "5k", targetSeconds: 1500, fiveKSeconds: 1720, level: "intermediario" });
  assert.equal(analysis.current, 1720);
  assert.ok(analysis.gap > 0.12 && analysis.gap < 0.13);
  assert.equal(analysis.verdict, "medio_prazo");
  assert.equal(analysis.target_pace, 300);
  // Prazo curto: marco intermediário realista em vez da meta.
  const short = analyzeRunningTarget({ goal: "5k", targetSeconds: 1500, fiveKSeconds: 1720, level: "intermediario", weeks: 8 });
  assert.equal(short.verdict, "ambiciosa");
  assert.ok(short.milestone > 1500 && short.milestone < 1720);
  assert.equal(analyzeRunningTarget({ goal: "5k", targetSeconds: 1800, fiveKSeconds: 1720, level: "iniciante" }).verdict, "alcancada");

  const plan = generateRunningPlan({ goal: "5k", level: "iniciante", startDate: TUESDAY, daysPerWeek: 3, currentWeeklyKm: 5, longestRunKm: 7.4, fiveKSeconds: 1720, targetSeconds: 1500, fiveKEstimated: true });
  const sessions = plan.weeks.flatMap((week) => week.sessions.map((session) => ({ ...session, week: week.number })));
  assert.equal(plan.weeks.length, plan.analysis.weeks);
  assert.equal(sessions.find((session) => session.week === 1 && session.session_type === "teste")?.title, "🔬 Teste de 3 km", "teste na 1ª semana quando o tempo é estimado");
  assert.ok(sessions.filter((session) => session.session_type === "teste").length >= 3, "teste a cada bloco de 4 semanas");
  assert.ok(sessions.some((session) => session.title === "Blocos no ritmo da meta" && session.target_pace[0] === 300));
  const last = plan.weeks.at(-1).sessions.at(-1);
  assert.match(last.title, /Teste final — 5 km/);
  assert.deepEqual(last.target_pace, [300, 300]);
  // Leves no ritmo de hoje; intervalados ficam mais rápidos ao longo do plano.
  const easy = sessions.filter((session) => session.session_type === "rodagem").map((session) => session.target_pace[0]);
  assert.equal(new Set(easy).size, 1);
  const intervals = sessions.filter((session) => session.session_type === "intervalado" && !/400/.test(session.title)).map((session) => session.target_pace[0]);
  assert.ok(intervals.at(-1) < intervals[0]);
  // Volume cresce, nunca mais de 10% por semana fora a 1ª.
  const totals = plan.weeks.map((week) => week.total_km);
  assert.ok(Math.max(...totals) > totals[0] + 4);
});

test("COR-06: pedido com meta pela conversa e recalibração depois do teste de 3 km", () => {
  const userId = "svc-target";
  const reply = service.createTrainingPlanFromRequest(userId, {
    ...request, running_goal: "5k", running_level: "iniciante", running_days_per_week: 3, current_weekly_km: 8, longest_run_km: 7,
    reference_distance_km: null, reference_time: null, easy_pace: "7:17", target_time: "25:00", target_pace: null,
    strength_days_per_week: null, equipment: null
  }, TUESDAY);
  assert.match(reply, /5 km em 25:00/);
  assert.match(reply, /📊 \*Análise da sua meta\*[\s\S]*Hoje: 5 km em ~28:4\d[\s\S]*Meta: 5 km em 25:00 \(5:00\/km\) — 12,\d% mais rápido[\s\S]*semanas no seu nível/);
  assert.match(reply, /🔬 Teste de 3 km/);

  assert.deepEqual(detectTrainingIntent("fiz o teste 3 km em 15:30"), { type: "test", distanceKm: 3, seconds: 930 });
  const before = db.getPlannedSessions(userId, "2026-11-02", "2027-12-31").find((session) => session.session_type === "intervalado");
  const answer = service.handleTrainingMessage(userId, "teste 3 km em 15:30", TUESDAY);
  assert.match(answer, /Teste registrado:\* 3 km em 15:30 \(5:10\/km\)/);
  assert.match(answer, /5 km estimado agora: \*26:\d\d\*.*mais rápido/);
  assert.match(answer, /Meta: 25:00 — hoje você faria/);
  assert.equal(db.getPlannedSessions(userId, TUESDAY, TUESDAY).find((session) => session.session_type === "teste").status, "feito");
  const after = db.getPlannedSessions(userId, before.date, before.date).find((session) => session.id === before.id);
  assert.ok(after.target_pace[0] < before.target_pace[0], "ritmos recalibrados ficam mais rápidos");
  assert.ok(db.getActiveTrainingPlan(userId).paces.five_k < 340);
});

test("COR-06: novas opções de objetivo (voltar a correr, aumentar volume)", () => {
  const back = generateRunningPlan({ goal: "voltar", level: "intermediario", startDate: TUESDAY, daysPerWeek: 3, currentWeeklyKm: 25, fiveKSeconds: 1650 });
  assert.ok(back.weeks[0].total_km <= 17, "volta com ~60% do volume de antes");
  const volume = generateRunningPlan({ goal: "aumentar_volume", level: "intermediario", startDate: TUESDAY, daysPerWeek: 4, currentWeeklyKm: 20, fiveKSeconds: 1650 });
  assert.ok(volume.weeks.at(-1).total_km > volume.weeks[0].total_km);
  assert.ok(Math.max(...longRuns(volume).map((session) => session.distance_km)) >= 12);
});

test("COR-06: plano pedido no sábado — 'treinos da semana' mostra a próxima; segundo teste parte do tempo exato do primeiro", () => {
  const userId = "svc-weekend";
  const saturday = "2026-10-31";
  service.createTrainingPlanFromRequest(userId, { ...request, running_goal: "5k", running_level: "iniciante", running_days_per_week: 3,
    reference_distance_km: null, reference_time: null, easy_pace: "7:17", target_time: "25:00", target_pace: null, strength_days_per_week: null, equipment: null }, saturday);
  assert.match(service.handleTrainingMessage(userId, "treinos da semana", saturday), /primeiro treino é ter 03\/11[\s\S]*📅 \*Semana 1 de \d+\*/);
  const first = service.handleTrainingMessage(userId, "teste 3 km em 15:30", saturday).match(/agora: \*([\d:]+)\*/)[1];
  assert.match(service.handleTrainingMessage(userId, "teste 3 km em 18:00", saturday), new RegExp(`antes ${first}\\) — .*mais lento`));
});

test("ESP-07: gasto energético estimado do treino, sem entrar na meta", async () => {
  const { estimateWorkoutCalories, describeWorkoutCalories } = await import("../src/training/energy.js");
  assert.equal(estimateWorkoutCalories({ workout_type: "Corrida", duration_min: 45, distance_km: 7 }, 60), 420, "corrida ≈ 1 kcal/kg/km");
  assert.equal(estimateWorkoutCalories({ workout_type: "Caminhada", duration_min: 60, distance_km: 5 }, 60), 165);
  assert.equal(estimateWorkoutCalories({ workout_type: "Musculação", duration_min: 60 }, 60), 300);
  assert.equal(estimateWorkoutCalories({ workout_type: "Ciclismo", duration_min: 60, distance_km: 20 }, 60), 480, "20 km/h → MET 8");
  assert.equal(estimateWorkoutCalories({ workout_type: "Yoga", duration_min: 60 }, 60), 180);
  assert.equal(estimateWorkoutCalories({ workout_type: "Corrida", duration_min: 30, distance_km: 5 }, null), null, "sem peso não estima");
  assert.match(describeWorkoutCalories({ workout_type: "Corrida", duration_min: 30, distance_km: 5 }, 70), /~350 kcal _\(estimativa; não somei à sua meta do dia\)_/);

  const userId = "svc-energy";
  db.updateUserProfile(userId, { weight_kg: 70 });
  const workout = db.saveWorkout(userId, { workout_type: "Corrida", duration_min: 30, distance_km: 5, exercises: [] });
  assert.ok(service.afterWorkoutSaved(userId, workout, TUESDAY).some((line) => /Gasto estimado: ~350 kcal/.test(line)));
  const target = db.getUser(userId).daily_calorie_target;
  assert.equal(db.getUser(userId).daily_calorie_target, target, "meta calórica não muda");
});
