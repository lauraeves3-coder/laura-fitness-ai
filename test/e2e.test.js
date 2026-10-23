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
  const question = await send(userId, "comi 100 g de arroz, 100 g de feijão e 150 g de bife");
  assert.match(question, /Antes de registrar/);
  assert.match(question, /patinho grelhado, alcatra grelhada ou bife acebolado/);
  assert.equal(db.getTodayMeals(userId).length, 0);
  assert.ok(db.getPendingMealClarification(userId));

  await send(userId, "patinho");
  const meals = db.getTodayMeals(userId);
  assert.equal(meals.length, 1);
  assert.match(meals[0].description, /patinho grelhado/);
  assert.equal(meals[0].calories, estimateMealFromText("comi 100 g de arroz, 100 g de feijão e 150 g de patinho grelhado").calories);
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

// ---------- NUT-13: duplicatas ----------

test("NUT-13: mesma mensagem reenviada não grava duas vezes", async () => {
  const userId = newUser();
  await send(userId, "comi uma banana");
  const reply = await send(userId, "comi uma banana");
  assert.match(reply, /já está registrada/);
  assert.equal(db.getTodayMeals(userId).length, 1);
});

test("NUT-13: agente chamando record_meal duas vezes na mesma conversa grava uma vez", async () => {
  const userId = newUser();
  const args = { description: "banana", calories: 90, protein_g: 1, carbs_g: 21, fat_g: 0 };
  const message = "comi banana: 90 kcal, 1 g de proteína, 21 g de carboidratos e 0 g de gordura";
  await send(userId, message, fakeModel([
    toolCall("record_meal", args, "call-1"),
    toolCall("record_meal", args, "call-2"),
    finalText("ok")
  ]));
  assert.equal(db.getTodayMeals(userId).length, 1);
});

test("NUT-13: 'de novo' registra a repetição intencional", async () => {
  const userId = newUser();
  const args = { description: "banana", calories: 90, protein_g: 1, carbs_g: 21, fat_g: 0 };
  await send(userId, "comi banana: 90 kcal, 1 g de proteína, 21 g de carboidratos e 0 g de gordura", fakeModel([toolCall("record_meal", args), finalText("ok")]));
  await send(userId, "comi banana de novo: 90 kcal, 1 g de proteína, 21 g de carboidratos e 0 g de gordura", fakeModel([toolCall("record_meal", args), finalText("ok")]));
  assert.equal(db.getTodayMeals(userId).length, 2);
});

// ---------- NUT-18 / NUT-12 / NUT-15: plano, escolha, confirmação e saldo ----------

function userWithTargets() {
  const userId = newUser();
  db.updateUserProfile(userId, { age_years: 30, sex: "female", height_cm: 165, weight_kg: 65, goal: "maintain", activity_level: "moderate" });
  db.calculateAndSaveNutritionTargets(userId);
  return userId;
}
const today = (userId) => db.getDailySummary(userId).date;

async function createPlan(userId) {
  const reply = await send(userId, "monte um plano alimentar para hoje", fakeModel([
    toolCall("create_daily_meal_plan", { current_meal_period: null }),
    finalText("ok")
  ]));
  return { reply, plan: db.getMealPlan(userId, today(userId)) };
}

test("NUT-18: plano diário é criado e salvo sem registrar consumo", async () => {
  const userId = userWithTargets();
  const { reply, plan } = await createPlan(userId);
  assert.match(reply, /Plano alimentar de hoje/);
  assert.ok(plan, "plano salvo");
  assert.ok(plan.plan.meals.length >= 1);
  for (const meal of plan.plan.meals) assert.ok(meal.options.length >= 1, meal.period);
  assert.equal(db.getTodayMeals(userId).length, 0);
  assert.equal(db.getDailySummary(userId).calories, 0);
});

test("NUT-18: orçamentos das refeições não passam do saldo do dia", async () => {
  const userId = userWithTargets();
  await send(userId, "comi 2 ovos");
  const { plan } = await createPlan(userId);
  const remaining = db.getDailySummary(userId).calorie_remaining;
  const totalBudget = plan.plan.meals.reduce((sum, meal) => sum + Number(meal.calorie_budget || 0), 0);
  assert.ok(totalBudget <= remaining + plan.plan.meals.length, `${totalBudget} > ${remaining}`);
});

test("NUT-18: sem meta calórica o plano não é criado", async () => {
  const userId = newUser();
  const { reply, plan } = await createPlan(userId);
  assert.match(reply, /preciso primeiro da sua meta diária/);
  assert.equal(plan, null);
});

test("NUT-18: plano sem pedido explícito não é criado", async () => {
  const userId = userWithTargets();
  await send(userId, "o que acha da minha alimentação?", fakeModel([
    toolCall("create_daily_meal_plan", { current_meal_period: null }),
    finalText("ok")
  ]));
  assert.equal(db.getMealPlan(userId, today(userId)), null);
});

test("NUT-18: 'sim' após o plano registra a intenção de seguir", async () => {
  const userId = userWithTargets();
  await createPlan(userId);
  const reply = await send(userId, "sim", fakeModel([toolCall("set_meal_plan_intent", { intends_to_follow: true }), finalText("ok")]));
  assert.match(reply, /Vou usar o plano como referência/);
  assert.equal(db.getMealPlan(userId, today(userId)).status, "intended");
  assert.equal(db.getTodayMeals(userId).length, 0);
});

async function chooseFirstOption(userId) {
  const { plan } = await createPlan(userId);
  const meal = plan.plan.meals[0];
  const reply = await send(userId, "escolho a opção 1", fakeModel([
    toolCall("choose_meal_option", { meal_period: meal.period, option_index: 1 }),
    finalText("ok")
  ]));
  return { meal, option: meal.options[0], reply };
}

test("NUT-12: escolher uma opção não registra consumo", async () => {
  const userId = userWithTargets();
  const { reply } = await chooseFirstOption(userId);
  assert.ok(db.getLatestMealPlanEvent(userId, "option_chosen"), reply);
  assert.equal(db.getTodayMeals(userId).length, 0);
});

test("NUT-12 / NUT-15: confirmação registra a opção escolhida e atualiza o saldo", async () => {
  const userId = userWithTargets();
  const before = db.getDailySummary(userId);
  const { option } = await chooseFirstOption(userId);
  const reply = await send(userId, "comi a opção 1");
  assert.match(reply, /Registrei como consumida/);
  const meals = db.getTodayMeals(userId);
  assert.equal(meals.length, 1);
  assert.equal(meals[0].calories, option.calories);
  const after = db.getDailySummary(userId);
  assert.equal(after.calories, option.calories);
  assert.equal(Math.round(after.calorie_remaining), Math.round(before.calorie_remaining - option.calories));
});

test("NUT-12: confirmar duas vezes não duplica", async () => {
  const userId = userWithTargets();
  await chooseFirstOption(userId);
  await send(userId, "comi a opção 1");
  await send(userId, "comi a opção 1");
  assert.equal(db.getTodayMeals(userId).length, 1);
});

test("NUT-12: confirmação sem escolha prévia não registra nada", async () => {
  const userId = userWithTargets();
  await send(userId, "comi a opção 1", fakeModel([finalText("Resposta simulada.")]));
  assert.equal(db.getTodayMeals(userId).length, 0);
});

test("NUT-15: saldo acompanha registro, correção e exclusão", async () => {
  const userId = userWithTargets();
  const target = db.getDailySummary(userId).calorie_target;
  await send(userId, "comi uma banana");
  const [meal] = db.getTodayMeals(userId);
  assert.equal(Math.round(db.getDailySummary(userId).calorie_remaining), Math.round(target - meal.calories));

  await send(userId, `corrija a refeição #${meal.id} para 150 kcal, 2 g de proteína, 34 g de carboidratos e 0,5 g de gordura`, fakeModel([
    toolCall("correct_meal", { meal_id: meal.id, calories: 150, protein_g: 2, carbs_g: 34, fat_g: 0.5 }),
    finalText("ok")
  ]));
  assert.equal(db.getDailySummary(userId).calories, 150);
  assert.equal(Math.round(db.getDailySummary(userId).calorie_remaining), Math.round(target - 150));

  await send(userId, `apague a refeição #${meal.id}`);
  await send(userId, "sim, excluir");
  assert.equal(db.getDailySummary(userId).calories, 0);
  assert.equal(Math.round(db.getDailySummary(userId).calorie_remaining), Math.round(target));
});

test("NUT-15: resumo pelo agente mostra consumo e saldo atuais", async () => {
  const userId = userWithTargets();
  await send(userId, "comi 2 ovos");
  const summary = db.getDailySummary(userId);
  const reply = await send(userId, "como está o meu dia?", fakeModel([toolCall("get_nutrition_state", {}), finalText("ok")]));
  assert.match(reply, new RegExp(String(Math.round(summary.calories))));
  assert.match(reply, new RegExp(String(Math.round(summary.calorie_remaining))));
});

// ---------- NUT-17: coerência das metas ----------

const setCalories = (userId, calories, message = `mude minha meta de calorias para ${calories} kcal`) =>
  send(userId, message, fakeModel([toolCall("set_calorie_target", { calories }), finalText("Meta personalizada salva.")]));
const setMacros = (userId, macros, message) =>
  send(userId, message, fakeModel([toolCall("set_macro_targets", macros), finalText("Metas de macros salvas.")]));

test("NUT-17: meta coerente com os macros é salva sem aviso", async () => {
  const userId = userWithTargets();
  const { daily_protein_target: p, daily_carbs_target: c, daily_fat_target: f } = db.getUser(userId);
  const coherent = Math.round(p * 4 + c * 4 + f * 9);
  const reply = await setCalories(userId, coherent);
  assert.equal(db.getUser(userId).daily_calorie_target, coherent);
  assert.doesNotMatch(reply, /incompatíveis/);
});

test("NUT-17: meta incompatível com os macros é salva com aviso, sem ajuste silencioso", async () => {
  const userId = userWithTargets();
  const macrosBefore = db.getUser(userId);
  const reply = await setCalories(userId, 1000);
  assert.equal(db.getUser(userId).daily_calorie_target, 1000);
  assert.equal(db.getUser(userId).daily_protein_target, macrosBefore.daily_protein_target);
  assert.match(reply, /matematicamente incompatíveis/);
});

test("NUT-17: meta calórica zero, negativa ou absurda é recusada e informada", async () => {
  const userId = userWithTargets();
  const before = db.getUser(userId).daily_calorie_target;
  for (const calories of [0, -500, 50000]) {
    const reply = await setCalories(userId, calories);
    assert.equal(db.getUser(userId).daily_calorie_target, before, String(calories));
    assert.match(reply, /Não alterei/, `${calories}: ${reply}`);
  }
});

test("NUT-17: macro negativo ou absurdo é recusado e informado", async () => {
  const userId = userWithTargets();
  const before = db.getUser(userId).daily_protein_target;
  for (const protein of [-10, 5000]) {
    const reply = await setMacros(userId, { protein_g: protein }, `mude minha meta de proteína para ${protein} g`);
    assert.equal(db.getUser(userId).daily_protein_target, before, String(protein));
    assert.match(reply, /Não alterei/, `${protein}: ${reply}`);
  }
});

test("NUT-17: meta de macros válida é salva", async () => {
  const userId = userWithTargets();
  await setMacros(userId, { protein_g: 140 }, "mude minha meta de proteína para 140 g");
  assert.equal(db.getUser(userId).daily_protein_target, 140);
});

// ---------- NUT-09: quantidade ausente com estado ----------

test("NUT-09: item de peso sem quantidade pergunta só ele; item por unidade não pergunta", async () => {
  const userId = newUser();
  const question = await send(userId, "comi 2 ovos e arroz");
  assert.match(question, /quanto foi de:/);
  assert.match(question, /arroz branco cozido \(porção padrão: 100 g\)/);
  assert.doesNotMatch(question, /ovo/);
  assert.equal(db.getTodayMeals(userId).length, 0);

  await send(userId, "150 g");
  const [meal] = db.getTodayMeals(userId);
  assert.equal(meal.calories, estimateMealFromText("comi 2 ovos e 150 g de arroz").calories);
  assert.equal(db.getPendingMealClarification(userId), null);
});

test("NUT-09: vários itens respondidos pelo nome", async () => {
  const userId = newUser();
  await send(userId, "comi arroz e feijão");
  await send(userId, "200 g de arroz e 1 concha de feijão");
  const [meal] = db.getTodayMeals(userId);
  assert.equal(meal.calories, estimateMealFromText("comi 200 g de arroz e 1 concha de feijão").calories);
});

test("NUT-09: resposta parcial pergunta só o que faltou", async () => {
  const userId = newUser();
  await send(userId, "comi arroz e feijão");
  const again = await send(userId, "200 g de arroz");
  assert.match(again, /feijão carioca cozido/);
  assert.doesNotMatch(again, /arroz branco/);
  assert.equal(db.getTodayMeals(userId).length, 0);
  await send(userId, "1 concha");
  assert.equal(db.getTodayMeals(userId)[0].calories, estimateMealFromText("comi 200 g de arroz e 1 concha de feijão").calories);
});

test("NUT-09: 'padrão' registra com as porções padrão", async () => {
  const userId = newUser();
  await send(userId, "comi arroz e feijão");
  await send(userId, "padrão");
  assert.equal(db.getTodayMeals(userId)[0].calories, estimateMealFromText("comi arroz e feijão").calories);
});

test("NUT-09: resposta ambígua pergunta de novo; mudança de assunto encerra", async () => {
  const userId = newUser();
  await send(userId, "comi feijão");
  assert.match(await send(userId, "2"), /Não identifiquei a quantidade/);
  await send(userId, "qual é a minha meta de proteína para hoje?", fakeModel([finalText("Resposta simulada.")]));
  assert.equal(db.getPendingMealClarification(userId), null);
  assert.equal(db.getTodayMeals(userId).length, 0);
});

test("NUT-09: whey e itens com quantidade não perguntam", async () => {
  const userId = newUser();
  await send(userId, "tomei whey");
  await send(userId, "comi 150 g de arroz");
  assert.equal(db.getTodayMeals(userId).length, 2);
});

test("NUT-09: cadeia corte → quantidade → registro", async () => {
  const userId = newUser();
  assert.match(await send(userId, "comi arroz e bife"), /Antes de registrar/);
  assert.match(await send(userId, "patinho"), /quanto foi de:/);
  await send(userId, "padrão");
  const [meal] = db.getTodayMeals(userId);
  assert.match(meal.description, /patinho grelhado/);
  assert.equal(meal.calories, estimateMealFromText("comi arroz e patinho grelhado").calories);
});
