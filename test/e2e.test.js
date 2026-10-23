// ARQ-07: testes ponta a ponta de processMessage (src/ai.js) com banco SQLite temporário
// e modelo simulado. Nenhuma chamada à API: a chave é removida antes do import, então
// qualquer caminho que tentasse criar o cliente real falharia em vez de gastar créditos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const tempDir = mkdtempSync(join(tmpdir(), "fitpulse-e2e-"));
process.env.FITPULSE_DB_PATH = join(tempDir, "e2e.db");
assert.notEqual(resolve(process.env.FITPULSE_DB_PATH), resolve("fitness.db"));
delete process.env.OPENAI_API_KEY;

const { processMessage } = await import("../src/ai.js");
const db = await import("../src/db.js");
const { estimateMealFromText } = await import("../src/nutritionCatalog.js");

// Modelo simulado no formato da Responses API usado por src/agent/agent.js.
function fakeModel(script = []) {
  const requests = [];
  return {
    requests,
    responses: {
      create: async (request) => {
        requests.push(request);
        const next = script.shift();
        if (!next) throw new Error("modelo simulado sem resposta programada");
        return next;
      }
    }
  };
}
const toolCall = (name, args, callId = "call-1") => ({
  id: `resp-${callId}`,
  output: [{ type: "function_call", name, arguments: JSON.stringify(args), call_id: callId }]
});
const finalText = (text) => ({ id: "resp-final", output: [], output_text: text });

let userCounter = 0;
const newUser = () => `e2e-user-${++userCounter}`;
const send = (userId, message, model = fakeModel()) => processMessage(userId, message, { apiClient: model });

// ---------- Registro direto ----------

test("ARQ-07: refeição relatada é estimada e gravada sem chamar o modelo", async () => {
  const userId = newUser();
  const model = fakeModel();
  await send(userId, "comi 2 ovos e uma banana", model);
  const meals = db.getTodayMeals(userId);
  assert.equal(meals.length, 1);
  assert.equal(meals[0].calories, estimateMealFromText("comi 2 ovos e uma banana").calories);
  assert.equal(model.requests.length, 0);
});

test("ARQ-07: 'não comi arroz' não grava arroz", async () => {
  const userId = newUser();
  await send(userId, "não comi arroz, comi 2 ovos");
  const [meal] = db.getTodayMeals(userId);
  assert.equal(meal.calories, estimateMealFromText("comi 2 ovos").calories);
});

// ---------- CONV-09 ----------

test("CONV-09: 'bife' pergunta o corte e 'patinho' completa o registro", async () => {
  const userId = newUser();
  const question = await send(userId, "comi arroz, feijão e bife");
  assert.match(question, /Antes de registrar/);
  assert.match(question, /patinho grelhado, alcatra grelhada ou bife acebolado/);
  assert.equal(db.getTodayMeals(userId).length, 0);
  assert.ok(db.getPendingMealClarification(userId));

  await send(userId, "patinho");
  const meals = db.getTodayMeals(userId);
  assert.equal(meals.length, 1);
  assert.match(meals[0].description, /patinho grelhado/);
  assert.equal(meals[0].calories, estimateMealFromText("comi arroz, feijão e patinho grelhado").calories);
  assert.equal(db.getPendingMealClarification(userId), null);
});

test("CONV-09: resposta curta sem opção válida pergunta de novo e não grava", async () => {
  const userId = newUser();
  await send(userId, "comi batata");
  const reply = await send(userId, "grelhado");
  assert.match(reply, /Não identifiquei a opção/);
  assert.equal(db.getTodayMeals(userId).length, 0);
  assert.ok(db.getPendingMealClarification(userId));
});

test("CONV-09: mudança de assunto encerra a pergunta pendente", async () => {
  const userId = newUser();
  await send(userId, "comi bife");
  await send(userId, "quanto de proteína ainda falta para a minha meta hoje?", fakeModel([finalText("Resposta simulada.")]));
  assert.equal(db.getPendingMealClarification(userId), null);
  assert.equal(db.getTodayMeals(userId).length, 0);
});

// ---------- NUT-11 ----------

test("NUT-11: exclusão pede confirmação e só apaga depois de 'sim, excluir'", async () => {
  const userId = newUser();
  await send(userId, "comi 2 ovos");
  const [meal] = db.getTodayMeals(userId);

  const ask = await send(userId, `apague a refeição #${meal.id}`);
  assert.match(ask, /Para confirmar, responda "sim, excluir"/);
  assert.ok(db.getMeal(userId, meal.id));

  const done = await send(userId, "sim, excluir");
  assert.match(done, /Excluí a refeição/);
  assert.equal(db.getMeal(userId, meal.id), null);
  assert.equal(db.getDailySummary(userId).calories, 0);
});

test("NUT-11: 'não' cancela e mantém a refeição", async () => {
  const userId = newUser();
  await send(userId, "comi uma banana");
  const [meal] = db.getTodayMeals(userId);
  await send(userId, "exclua a última refeição");
  assert.equal(await send(userId, "não"), "Tudo bem, não excluí nada.");
  assert.ok(db.getMeal(userId, meal.id));
  assert.equal(db.getPendingMealDeletion(userId), null);
});

test("NUT-11: não exclui refeição de outro usuário", async () => {
  const owner = newUser();
  await send(owner, "comi uma banana");
  const [meal] = db.getTodayMeals(owner);
  const reply = await send(newUser(), `apague a refeição #${meal.id}`);
  assert.match(reply, /Não encontrei a refeição/);
  assert.ok(db.getMeal(owner, meal.id));
});

// ---------- NUT-10 / NUT-24 pelo agente ----------

test("NUT-10: correção pelo agente sem descrição mantém a descrição original", async () => {
  const userId = newUser();
  await send(userId, "comi uma banana");
  const [meal] = db.getTodayMeals(userId);
  const model = fakeModel([
    toolCall("correct_meal", { meal_id: meal.id, calories: 120, protein_g: 1.5, carbs_g: 28, fat_g: 0.4 }),
    finalText("ok")
  ]);
  const reply = await send(userId, `corrija a refeição #${meal.id} para 120 kcal, 1,5 g de proteína, 28 g de carboidratos e 0,4 g de gordura`, model);
  assert.match(reply, /Corrigi a refeição/);
  const corrected = db.getMeal(userId, meal.id);
  assert.equal(corrected.calories, 120);
  assert.equal(corrected.description, meal.description);
  assert.equal(db.getTodayMeals(userId).length, 1);
});

test("NUT-24: registro pelo agente com macros incoerentes não é gravado", async () => {
  const userId = newUser();
  const model = fakeModel([
    toolCall("record_meal", { description: "lanche", calories: 100, protein_g: 40, carbs_g: 40, fat_g: 20 }),
    finalText("ok")
  ]);
  const reply = await send(userId, "comi um lanche de 100 kcal com 40 g de proteína, 40 g de carboidratos e 20 g de gordura", model);
  assert.match(reply, /Não registrei a refeição porque os dados nutricionais não são válidos/);
  assert.equal(db.getTodayMeals(userId).length, 0);
});

// ---------- AI-06 ----------

test("AI-06: combinação rejeitada responde com a combinação real, sem modelo", async () => {
  const userId = newUser();
  const model = fakeModel();
  const reply = await send(userId, "nao quero arroz com feijao", model);
  assert.match(reply, /Não vou sugerir arroz com feijão/);
  assert.equal(model.requests.length, 0);
});

test("ARQ-07: 'não comi nada hoje' não registra refeição", async () => {
  const userId = newUser();
  await send(userId, "não comi nada hoje", fakeModel([finalText("Resposta simulada.")]));
  assert.equal(db.getTodayMeals(userId).length, 0);
});

// ---------- NUT-16: metas ----------

test("NUT-16: meta calórica personalizada e restauração das automáticas", async () => {
  const userId = newUser();
  db.updateUserProfile(userId, { age_years: 30, sex: "female", height_cm: 165, weight_kg: 65, goal: "maintain", activity_level: "moderate" });
  db.calculateAndSaveNutritionTargets(userId);
  const automatic = db.getUser(userId).daily_calorie_target;

  await send(userId, "mude minha meta de calorias para 1800 kcal", fakeModel([toolCall("set_calorie_target", { calories: 1800 }), finalText("ok")]));
  assert.equal(db.getUser(userId).daily_calorie_target, 1800);

  await send(userId, "restaure minhas metas automáticas", fakeModel([toolCall("restore_automatic_targets", {}), finalText("ok")]));
  assert.equal(db.getUser(userId).daily_calorie_target, automatic);
});

test("NUT-16: meta sem pedido explícito não é alterada", async () => {
  const userId = newUser();
  db.ensureUser(userId);
  const before = db.getUser(userId).daily_calorie_target;
  await send(userId, "como estou hoje?", fakeModel([toolCall("set_calorie_target", { calories: 900 }), finalText("ok")]));
  assert.equal(db.getUser(userId).daily_calorie_target, before);
});

// ---------- CRP-01 / ESP-01 ----------

test("CRP-01: peso informado é registrado e atualiza o perfil", async () => {
  const userId = newUser();
  await send(userId, "pesei 72,5 kg hoje", fakeModel([toolCall("record_weight", { weight_kg: 72.5 }), finalText("ok")]));
  assert.equal(db.getUser(userId).weight_kg, 72.5);
});

test("ESP-01: treino realizado é registrado com exercícios", async () => {
  const userId = newUser();
  await send(userId, "fiz musculação hoje, 45 minutos, supino 3x10 com 40 kg", fakeModel([
    toolCall("record_workout", { workout_type: "musculação", duration_min: 45, exercises: [{ name: "supino", sets: 3, reps: 10, weight_kg: 40 }] }),
    finalText("ok")
  ]));
  const summary = db.getDailySummary(userId);
  assert.equal(summary.workout_count, 1);
  assert.equal(summary.total_duration_min, 45);
});
