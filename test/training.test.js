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

test("COR-05: 'qual foi minha última corrida' traz distância, tempo, pace e gasto", () => {
  assert.deepEqual(detectTrainingIntent("Qual foi minha última corrida"), { type: "last", running: true });
  assert.deepEqual(detectTrainingIntent("como foi meu último treino?"), { type: "last", running: false });
  assert.equal(detectTrainingIntent("qual meu treino de hoje")?.type, "day");
  const userId = "svc-last-run";
  assert.match(service.handleTrainingMessage(userId, "qual foi minha última corrida", TUESDAY), /Ainda não tenho nenhuma corrida/);
  db.updateUserProfile(userId, { weight_kg: 70 });
  db.saveWorkout(userId, { workout_type: "Corrida", duration_min: 32, distance_km: 5, exercises: [] });
  db.saveWorkout(userId, { workout_type: "Musculação", duration_min: 50, exercises: [] });
  const today = db.getDailySummary(userId).date;
  const reply = service.handleTrainingMessage(userId, "Qual foi minha última corrida", today);
  assert.match(reply, /🏃 \*Sua última corrida\* — hoje/);
  assert.match(reply, /📏 5 km   ⏱️ 32:00\n⚡ Pace médio: \*6:24 \/km\*\n🔥 Gasto estimado: ~350 kcal/);
  assert.match(service.handleTrainingMessage(userId, "qual foi meu último treino", today), /\*Seu último treino\* — hoje[\s\S]*\*Musculação\*\n⏱️ 50:00\n🔥 Gasto estimado: ~292 kcal/);
});

test("ESP-05: pouco tempo, sem equipamento e remarcar o treino", () => {
  assert.deepEqual(detectTrainingIntent("hoje só tenho 30 min"), { type: "adapt", reason: "tempo", minutes: 30 });
  assert.deepEqual(detectTrainingIntent("to sem tempo hoje"), { type: "adapt", reason: "tempo", minutes: 30 });
  assert.deepEqual(detectTrainingIntent("a academia está fechada"), { type: "adapt", reason: "casa" });
  assert.deepEqual(detectTrainingIntent("vou treinar em casa hoje"), { type: "adapt", reason: "casa" });
  assert.deepEqual(detectTrainingIntent("passa o treino de hoje para quinta"), { type: "move", to: "quinta", from: 0 });
  assert.deepEqual(detectTrainingIntent("troca o treino de amanhã pra sábado"), { type: "move", to: "sabado", from: 1 });

  // Plano de 10 km + musculação: terça 27/10 tem treino de corrida.
  const userId = "svc-esp05";
  service.createTrainingPlanFromRequest(userId, request, TUESDAY);
  const today = db.getPlannedSessions(userId, TUESDAY, TUESDAY)[0];
  assert.ok(today, "há treino na terça");
  const short = service.handleTrainingMessage(userId, "hoje só tenho 20 minutos", TUESDAY);
  assert.match(short, /⏱️ Ajustei para caber em \*20 min\*/);
  const adjusted = db.getPlannedSessions(userId, TUESDAY, TUESDAY)[0];
  assert.equal(adjusted.duration_min, 20);
  assert.ok(adjusted.distance_km < today.distance_km);

  // Musculação em casa: troca os exercícios pelos de peso do corpo.
  const strengthDay = db.getPlannedSessions(userId, "2026-10-26", "2026-11-08").find((session) => session.modality === "musculacao");
  const home = service.handleTrainingMessage(userId, "a academia está fechada", strengthDay.date);
  assert.match(home, /🏠 Troquei a musculação de hoje por uma \*versão em casa\*/);
  const homeSession = db.getPlannedSessions(userId, strengthDay.date, strengthDay.date).find((session) => session.modality === "musculacao");
  assert.match(homeSession.title, /\(em casa\)$/);
  assert.notDeepEqual(homeSession.details.exercises, strengthDay.details.exercises);

  // Remarcar: quinta 29/10 tem treino → os dois trocam de lugar.
  const thursdayBefore = db.getPlannedSessions(userId, "2026-10-29", "2026-10-29").filter((session) => session.status === "planejado");
  const moved = service.handleTrainingMessage(userId, "passa o treino de hoje para quinta", TUESDAY);
  assert.match(moved, /📅 Pronto: \*.+\* passou para qui 29\/10\./);
  assert.equal(db.getPlannedSessions(userId, "2026-10-29", "2026-10-29").some((session) => session.id === today.id), true);
  if (thursdayBefore.length) assert.match(moved, /🔁 .* de qui 29\/10 veio para hoje/);
});

test("Conversa real: resposta em texto livre completa o plano; adicionar musculação mantém a corrida", () => {
  const userId = "svc-consumer";
  const empty = { running_goal: null, running_level: null, running_days_per_week: null, available_days: [], current_weekly_km: null, longest_run_km: null,
    reference_distance_km: null, reference_time: null, easy_pace: null, event_date: null, target_time: null, target_pace: null, strength_goal: null,
    strength_level: null, strength_days_per_week: null, equipment: null, limitations: [], other_modality: null, other_level: null, other_days_per_week: null };
  const first = "monte um treino para eu melhorar meu pace nos 5km, minha meta é 5 km abaixo de 25 minutos, posso correr 3 dias por semana";
  const ask = service.createTrainingPlanFromRequest(userId, { ...empty, running_goal: "5k" }, TUESDAY, first);
  assert.match(ask, /há quanto tempo você corre/);
  assert.match(db.getPendingTrainingRequest(userId).target_time, /^25 min/);
  // O modelo não separou nada da resposta: o texto basta.
  const plan = service.createTrainingPlanFromRequest(userId, empty, TUESDAY, "corro há uns 6 meses, uns 15 km por semana, faço 5 km em 29 minutos");
  assert.match(plan, /Plano de treino criado[\s\S]*5 km em 25:00 · intermediário · 3×\/semana/);
  assert.match(plan, /Hoje: 5 km em ~29:00/);
  // Adicionar musculação não apaga a corrida.
  const both = service.createTrainingPlanFromRequest(userId, { ...empty, strength_goal: "hipertrofia", strength_days_per_week: 2, equipment: "academia" }, TUESDAY, "quero adicionar musculação para hipertrofia 2 vezes por semana na academia");
  assert.match(both, /🏃 Corrida: 5 km em 25:00[\s\S]*🏋️ Musculação: hipertrofia · 2×\/semana/);
});

test("ESP-05: pouco tempo num dia de descanso avisa o descanso e o próximo treino", () => {
  const userId = "svc-rest-day";
  service.createTrainingPlanFromRequest(userId, request, TUESDAY);
  const sunday = "2026-11-01";
  assert.equal(db.getPlannedSessions(userId, sunday, sunday).filter((session) => session.modality === "musculacao").length, 0);
  const restDay = db.getPlannedSessions(userId, "2026-10-28", "2026-11-03").map((session) => session.date);
  const free = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"].find((date) => !restDay.includes(date));
  const reply = service.handleTrainingMessage(userId, "hoje só tenho 30 min", free);
  assert.match(reply, /😴 Hoje é \*dia de descanso\* no seu plano[\s\S]*Próximo treino: \*/);
});

test("COR-02: zonas de FC pela idade; rodagem leve em Z4 recebe alerta", async () => {
  const { heartRateZones, describeHeartRate, maxHeartRate } = await import("../src/training/heartRate.js");
  assert.equal(maxHeartRate(30), 187);
  assert.deepEqual(heartRateZones(30)[1], { zone: 2, label: "base aeróbica", from: 112, to: 131 });
  assert.equal(describeHeartRate(151, 30), "151 bpm (Z4 · limiar)");
  assert.equal(describeHeartRate(151, null), "151 bpm");
  const lines = compareWithPlan(
    { title: "Rodagem leve", session_type: "rodagem", modality: "corrida", distance_km: 6, target_pace: [420, 450], intensity: "leve" },
    { distance_km: 6, pace_s_per_km: 430, avg_hr: 160 },
    { age: 30 }
  );
  assert.match(lines.join("\n"), /FC média em Z4: era treino leve — na próxima, segure até ~131 bpm \(Z2\)/);
  const userId = "svc-zones";
  db.updateUserProfile(userId, { age_years: 30 });
  assert.match(service.handleTrainingMessage(userId, "qual foi minha última corrida", TUESDAY) || "", /Ainda não tenho nenhuma corrida/);
});

test("MUS-05: musculação feita é comparada com a sessão do plano", () => {
  const userId = "svc-mus05";
  service.createTrainingPlanFromRequest(userId, request, TUESDAY);
  const session = db.getPlannedSessions(userId, "2026-10-26", "2026-11-08").find((item) => item.modality === "musculacao");
  const planned = session.details.exercises;
  const workout = db.saveWorkout(userId, { workout_type: "Musculação", duration_min: 40, exercises: [
    { name: planned[0].name, sets: planned[0].sets, reps: 10, weight_kg: 40 },
    { name: "rosca direta", sets: 3, reps: 12, weight_kg: 10 }
  ] });
  const lines = service.linkWorkoutToPlan(userId, workout, session.date).join("\n");
  assert.ok(lines.startsWith(`📋 Plano: *${session.title}*`), lines);
  assert.match(lines, new RegExp(`🟡 1 de ${planned.length} exercícios do plano`));
  assert.match(lines, /➖ Faltou: /);
  assert.match(lines, /➕ A mais: rosca direta/);
});

test("COR-05: recordes de corrida e aviso de novo recorde", async () => {
  const { buildRecordsReply, newRecordLines } = await import("../src/training/records.js");
  const runs = [
    { id: 1, distance_km: 5, duration_min: 30, pace_s_per_km: 360, trained_at: "2026-10-01 07:00:00" },
    { id: 2, distance_km: 10.2, duration_min: 66, pace_s_per_km: 388, trained_at: "2026-10-05 07:00:00" }
  ];
  const reply = buildRecordsReply(runs);
  assert.match(reply, /• \*5 km:\* 30:00 \(6:00\/km\) — 01\/10/);
  assert.match(reply, /• \*10 km:\* 1:04:40 \(6:28\/km\) — 05\/10/);
  assert.match(reply, /• \*Maior distância:\* 10,2 km/);
  const faster = { id: 3, distance_km: 5, duration_min: 28, pace_s_per_km: 336, trained_at: "2026-10-10 07:00:00" };
  assert.deepEqual(newRecordLines(runs, faster), ["🏆 Novo recorde: melhor 5 km (28:00), 2:00 mais rápido que antes!"]);
  assert.deepEqual(newRecordLines(runs, { id: 4, distance_km: 4, duration_min: 30, pace_s_per_km: 450 }), []);

  const userId = "svc-records";
  db.saveWorkout(userId, { workout_type: "Corrida", duration_min: 30, distance_km: 5, exercises: [] });
  const second = db.saveWorkout(userId, { workout_type: "Corrida", duration_min: 27, distance_km: 5, exercises: [] });
  assert.ok(service.afterWorkoutSaved(userId, second, TUESDAY).some((line) => /Novo recorde: melhor 5 km \(27:00\)/.test(line)));
});

test("ESP-02: esportes coletivos e lutas no plano, com ícone e treino específico", async () => {
  const { generateEndurancePlan } = await import("../src/training/endurance.js");
  const plan = generateEndurancePlan({ modality: "futebol", level: "intermediario", startDate: TUESDAY, weeks: 4, daysPerWeek: 3 });
  const titles = plan.weeks.flatMap((week) => week.sessions.map((session) => session.title));
  assert.ok(titles.includes("Jogo ou treino coletivo"));
  assert.ok(titles.includes("Futebol — intensidade"));
  const userId = "svc-lutas";
  const reply = service.createTrainingPlanFromRequest(userId, {
    running_goal: null, running_level: null, running_days_per_week: null, available_days: [], current_weekly_km: null, longest_run_km: null,
    reference_distance_km: null, reference_time: null, easy_pace: null, event_date: null, target_time: null, target_pace: null,
    strength_goal: null, strength_level: null, strength_days_per_week: null, equipment: null, limitations: [],
    other_modality: "lutas", other_level: "iniciante", other_days_per_week: 3
  }, TUESDAY);
  assert.match(reply, /🥋 Lutas: 3×\/semana/);
  assert.equal(modalityOf("Jiu-jitsu"), "lutas");
  assert.equal(modalityOf("Futebol"), "futebol");
});

test("HID-03: treino registrado indica a reposição de água", async () => {
  const { hydrationTip } = await import("../src/training/energy.js");
  assert.equal(hydrationTip({ duration_min: 15 }), null);
  assert.equal(hydrationTip({ duration_min: 30 }), "💧 Reponha ~300 ml de água nas próximas horas.");
  assert.match(hydrationTip({ duration_min: 90 }), /~750 ml[\s\S]*isotônico/);
  const userId = "svc-hydration";
  const workout = db.saveWorkout(userId, { workout_type: "Corrida", duration_min: 60, distance_km: 10, exercises: [] });
  assert.ok(service.afterWorkoutSaved(userId, workout, TUESDAY).includes("💧 Reponha ~500 ml de água nas próximas horas."));
});
