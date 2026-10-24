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

test("CAT-01: 'tapioca com queijo' pergunta o tipo e 'minas' registra o queijo", async () => {
  const userId = newUser();
  const question = await send(userId, "comi 60 g de tapioca com 30 g de queijo");
  assert.match(question, /queijo: queijo muçarela, queijo minas frescal ou queijo prato/);
  assert.equal(db.getTodayMeals(userId).length, 0);

  await send(userId, "minas");
  const meals = db.getTodayMeals(userId);
  assert.equal(meals.length, 1);
  assert.equal(meals[0].calories, estimateMealFromText("comi 60 g de tapioca com 30 g de queijo minas frescal").calories);
  assert.ok(meals[0].calories > estimateMealFromText("comi 60 g de tapioca").calories);
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
  const ptBR = (value) => Math.round(value).toLocaleString("pt-BR").replace(".", "\\.");
  assert.match(reply, new RegExp(ptBR(summary.calories)));
  assert.match(reply, new RegExp(ptBR(summary.calorie_remaining)));
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
  assert.match(reply, /Calorias e macros não fecham/);
});

test("Fase 5: calorias e macros na mesma mensagem: um painel só, sem aviso desatualizado", async () => {
  const userId = userWithTargets();
  const reply = await send(userId, "Minha neta de calorias é 1800, proteína 140g carboidrato 180g gordura 60 g", fakeModel([
    toolCall("set_calorie_target", { calories: 1800 }, "c1"),
    toolCall("set_macro_targets", { protein_g: 140, carbs_g: 180, fat_g: 60 }, "c2"),
    finalText("Pronto!")
  ]));
  assert.match(reply, /🎯 \*Metas atualizadas\*\n🔥 Calorias: 1\.800 kcal\n🥩 P 140 g · 🍚 C 180 g · 🥑 G 60 g/);
  assert.doesNotMatch(reply, /não fecham|Entendi\. Como posso/);
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

// ---------- CONV-03 / NUT-14: datas relativas e histórico por período ----------

const { addDays } = await import("../src/dates.js");

test("CONV-03: 'ontem no jantar comi…' grava em ontem e não mexe no saldo de hoje", async () => {
  const userId = newUser();
  const yesterday = addDays(today(userId), -1);
  const reply = await send(userId, "ontem no jantar comi 2 ovos");
  assert.match(reply, /não entra no saldo de hoje/);
  const [meal] = db.getMealsBetween(userId, yesterday, yesterday);
  assert.equal(meal.consumed_at, `${yesterday} 20:00:00`);
  assert.equal(meal.meal_period, "jantar");
  assert.equal(db.getDailySummary(userId).calories, 0);
  assert.equal(db.getTodayMeals(userId).length, 0);
});

test("CONV-03: relato repetido do mesmo dia anterior não duplica", async () => {
  const userId = newUser();
  const yesterday = addDays(today(userId), -1);
  await send(userId, "ontem no jantar comi 2 ovos");
  assert.match(await send(userId, "ontem no jantar comi 2 ovos"), /já está registrada/);
  assert.equal(db.getMealsBetween(userId, yesterday, yesterday).length, 1);
});

test("CONV-03 / NUT-09: data passada segue válida depois da pergunta de quantidade", async () => {
  const userId = newUser();
  const dayBefore = addDays(today(userId), -2);
  assert.match(await send(userId, "anteontem comi arroz"), /quanto foi de:/);
  await send(userId, "150 g");
  const [meal] = db.getMealsBetween(userId, dayBefore, dayBefore);
  assert.equal(meal.calories, estimateMealFromText("comi 150 g de arroz").calories);
  assert.equal(db.getTodayMeals(userId).length, 0);
});

test("NUT-14: 'o que comi ontem?' lista as refeições e o total", async () => {
  const userId = userWithTargets();
  await send(userId, "ontem no almoço comi 2 ovos");
  await send(userId, "ontem no jantar comi uma banana");
  const model = fakeModel();
  const reply = await send(userId, "o que comi ontem?", model);
  assert.match(reply, /^📅 Ontem/);
  assert.match(reply, /12:30 — ontem no almoço comi 2 ovos/);
  assert.match(reply, /20:00 — ontem no jantar comi uma banana/);
  const total = db.getMealsBetween(userId, addDays(today(userId), -1), addDays(today(userId), -1))
    .reduce((sum, meal) => sum + meal.calories, 0);
  assert.match(reply, new RegExp(`Total: ${Math.round(total)} kcal`));
  assert.match(reply, /Meta atual:/);
  assert.equal(model.requests.length, 0);
});

test("NUT-14: dia sem registros", async () => {
  const userId = newUser();
  assert.match(await send(userId, "o que comi anteontem?"), /Não há refeições registradas nesse dia/);
});

test("NUT-14: resumo dos últimos 7 dias com média dos dias registrados", async () => {
  const userId = newUser();
  const day1 = addDays(today(userId), -1);
  const day3 = addDays(today(userId), -3);
  db.saveMeal(userId, { description: "almoço", calories: 1800, protein_g: 100, carbs_g: 200, fat_g: 60, consumed_at: `${day1} 12:00:00` });
  db.saveMeal(userId, { description: "almoço", calories: 2000, protein_g: 120, carbs_g: 210, fat_g: 70, consumed_at: `${day3} 12:00:00` });
  const reply = await send(userId, "me mostra o resumo dos últimos 7 dias");
  assert.match(reply, /^📊 Últimos 7 dias/);
  assert.match(reply, /Dias com registro: 2 de 7\./);
  assert.match(reply, /Média nos dias com registro: 1\.900 kcal · P 110 g · C 205 g · G 65 g/);
  assert.equal((reply.match(/sem registros/g) || []).length, 5);
});

test("NUT-14: pedido de sugestão com data não vira consulta de histórico", async () => {
  const userId = newUser();
  const reply = await send(userId, "o que posso comer hoje?", fakeModel([finalText("Resposta simulada.")]));
  assert.doesNotMatch(reply, /^📅|^📊/);
});

// ---------- NUT-19: refeições livres ----------

const WEEKDAY_NAMES = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const { weekdayOf } = await import("../src/dates.js");

test("NUT-19: configuração completa numa frase", async () => {
  const userId = userWithTargets();
  const reply = await send(userId, "faço 1 refeição livre por semana no sábado no jantar");
  assert.match(reply, /Sua configuração de refeição livre/);
  const settings = db.getFreeMealSettings(userId);
  assert.equal(settings.setup_status, "configured");
  assert.equal(settings.meals_per_week, 1);
  assert.deepEqual(settings.days, ["sábado"]);
  assert.equal(settings.period, "jantar");
});

test("NUT-19: configuração passo a passo aceita as respostas sugeridas pela própria pergunta", async () => {
  const userId = userWithTargets();
  assert.match(await send(userId, "quero configurar a minha refeição livre"), /Quantas refeições livres/);
  assert.match(await send(userId, "2"), /Em qual dia/);
  assert.match(await send(userId, "sábado e domingo"), /Em qual refeição/);
  assert.match(await send(userId, "jantar"), /Sua configuração de refeição livre/);
  const settings = db.getFreeMealSettings(userId);
  assert.equal(settings.meals_per_week, 2);
  assert.deepEqual(settings.days, ["domingo", "sábado"]);
  assert.equal(settings.period, "jantar");
});

test("NUT-19: pergunta após completar o perfil; 'não' desativa", async () => {
  const userId = newUser();
  db.setFreeMealSettings(userId, { setup_status: "asked" });
  assert.match(await send(userId, "não"), /Não vou considerar refeição livre/);
  const settings = db.getFreeMealSettings(userId);
  assert.equal(settings.enabled, false);
  assert.equal(settings.setup_status, "disabled");
});

test("NUT-19: 'não faço refeição livre' desativa", async () => {
  const userId = userWithTargets();
  await send(userId, "não faço refeição livre");
  assert.equal(db.getFreeMealSettings(userId).setup_status, "disabled");
});

test("NUT-19: consulta da configuração", async () => {
  const userId = userWithTargets();
  db.setFreeMealSettings(userId, { setup_status: "configured", enabled: true, meals_per_week: 1, days: ["sábado"], period: "jantar" });
  const reply = await send(userId, "qual dia é a minha refeição livre?");
  assert.match(reply, /1 refeição livre por semana/);
  assert.match(reply, /sábado/);
});

test("NUT-19: pedido de refeição livre sugere opções, aprende a categoria e não registra consumo", async () => {
  const userId = userWithTargets();
  db.setFreeMealSettings(userId, { setup_status: "configured", enabled: true, meals_per_week: 1, days: ["sábado"], period: "jantar" });
  const reply = await send(userId, "hoje vou fazer a refeição livre com pizza");
  assert.match(reply, /Sua refeição livre pode ser flexível/);
  assert.match(reply, /pizza/i);
  assert.match(reply, /Escolher uma opção não registra consumo/);
  assert.ok(db.getFreeMealSettings(userId).preferences.includes("pizza"));
  assert.ok(db.getLatestMealPlanEvent(userId, "suggestion_offered"));
  assert.equal(db.getTodayMeals(userId).length, 0);
});

test("NUT-19: no dia da refeição livre, 'o que posso comer?' sugere opções de refeição livre", async () => {
  const userId = userWithTargets();
  const todayName = WEEKDAY_NAMES[weekdayOf(today(userId))];
  db.setFreeMealSettings(userId, { setup_status: "configured", enabled: true, meals_per_week: 1, days: [todayName], period: "jantar" });
  const reply = await send(userId, "o que posso comer?");
  assert.match(reply, /Sua refeição livre pode ser flexível/);
});

// ---------- MUS-01 / CRP-01: séries, repetições, carga e peso ----------

test("MUS-01: treino registra cada exercício com séries, repetições e carga, e confirma", async () => {
  const userId = newUser();
  const reply = await send(userId, "fiz musculação hoje: supino 4x8 com 50 kg e agachamento 3x12 com 60 kg", fakeModel([
    toolCall("record_workout", { workout_type: "musculação", duration_min: 50, exercises: [
      { name: "supino", sets: 4, reps: 8, weight_kg: 50 },
      { name: "agachamento", sets: 3, reps: 12, weight_kg: 60 }
    ] }),
    finalText("ok")
  ]));
  assert.match(reply, /Registrei o treino: musculação — 50 min/);
  assert.match(reply, /supino: 4 × 8 com 50 kg/);
  assert.match(reply, /Volume total: 3\.760 kg/);
  const [workout] = db.getWorkoutsBetween(userId, today(userId), today(userId));
  assert.deepEqual(workout.exercises, [
    { name: "supino", sets: 4, reps: 8, weight_kg: 50 },
    { name: "agachamento", sets: 3, reps: 12, weight_kg: 60 }
  ]);
});

test("MUS-01: valores impossíveis são recusados e nada é gravado", async () => {
  const userId = newUser();
  const reply = await send(userId, "fiz supino", fakeModel([
    toolCall("record_workout", { workout_type: "musculação", duration_min: 30, exercises: [{ name: "supino", sets: 300, reps: 8, weight_kg: 40 }] }),
    finalText("ok")
  ]));
  assert.match(reply, /Não registrei o treino/);
  assert.match(reply, /séries deve ficar entre 0 e 100/);
  assert.deepEqual(db.getWorkoutsBetween(userId, today(userId), today(userId)), []);
});

test("MUS-01: treino sem exercícios (cardio) também confirma", async () => {
  const userId = newUser();
  const reply = await send(userId, "corri 30 minutos", fakeModel([
    toolCall("record_workout", { workout_type: "corrida", duration_min: 30, exercises: [] }),
    finalText("ok")
  ]));
  assert.match(reply, /Registrei o treino: corrida — 30 min/i);
  assert.doesNotMatch(reply, /Volume total/);
});

test("CRP-01: peso confirma; valor implausível é recusado e não altera o perfil", async () => {
  const userId = newUser();
  assert.match(await send(userId, "pesei 72,5 kg", fakeModel([toolCall("record_weight", { weight_kg: 72.5 }), finalText("ok")])), /Registrei seu peso: 72,5 kg/);
  const reply = await send(userId, "pesei 7250 kg", fakeModel([toolCall("record_weight", { weight_kg: 7250 }), finalText("ok")]));
  assert.match(reply, /Não registrei o peso/);
  assert.equal(db.getUser(userId).weight_kg, 72.5);
});

test("CRP-02: mudança de 2 kg ou mais sugere revisar as metas, sem recalcular", async () => {
  const userId = newUser();
  const weigh = (kg) => send(userId, `pesei ${kg} kg`, fakeModel([toolCall("record_weight", { weight_kg: kg }), finalText("ok")]));
  await weigh(80);
  const targetBefore = db.getUser(userId).daily_calorie_target;
  assert.doesNotMatch(await weigh(79), /Seu peso mudou/);
  const reply = await weigh(76.5);
  assert.match(reply, /Seu peso mudou −2,5 kg em relação ao anterior \(79 kg\)/);
  assert.match(reply, /restaure minhas metas automáticas/);
  assert.equal(db.getUser(userId).weight_kg, 76.5);
  assert.equal(db.getUser(userId).daily_calorie_target, targetBefore);
});

// ---------- CAT-09 ----------

test("CAT-09: 'cadastrar alimento' grava para a usuária e o registro passa a reconhecê-lo", async () => {
  const userId = newUser();
  const reply = await send(userId, "cadastrar alimento: bolo de fubá da vó, 100 g tem 330 kcal, 5 g de proteína, 50 g de carboidrato e 12 g de gordura");
  assert.match(reply, /Cadastrei Bolo de fubá da vó: por 100 g, 330 kcal/);
  assert.equal(db.getUserFoods(userId).length, 1);

  await send(userId, "comi 150 g de bolo de fubá da vó");
  const meals = db.getTodayMeals(userId);
  assert.equal(meals.length, 1);
  assert.equal(Math.round(meals[0].calories), 495);

  const other = newUser();
  assert.equal(db.getUserFoods(other).length, 0);
});

test("CAT-09: cadastro incompleto pede o que falta e não grava", async () => {
  const userId = newUser();
  const reply = await send(userId, "cadastrar alimento pão da padaria, 120 kcal");
  assert.match(reply, /faltou: proteína, carboidrato, gordura/);
  assert.equal(db.getUserFoods(userId).length, 0);
});

test("NUT-03: 'comi um pf' pergunta a proteína e 'frango' completa o prato", async () => {
  const userId = newUser();
  assert.match(await send(userId, "comi um pf"), /pf: peito de frango grelhado, patinho grelhado, ovo frito ou tilápia grelhada/);
  assert.equal(db.getTodayMeals(userId).length, 0);
  assert.match(await send(userId, "frango"), /quanto foi de:\n• peito de frango grelhado/);
  await send(userId, "padrão");
  const meals = db.getTodayMeals(userId);
  assert.equal(meals.length, 1);
  assert.equal(meals[0].calories, estimateMealFromText("comi um pf com peito de frango grelhado").calories);
});

// ---------- HID-01 / HID-02: água ----------

test("HID-02: água relatada é registrada sem o modelo e soma no dia", async () => {
  const userId = newUser();
  assert.match(await send(userId, "bebi 500 ml de água"), /\*\+500 ml de água\*\nHoje: 500 ml de 2 L\n▓▓▓░░░░░░░ 25%/);
  assert.match(await send(userId, "tomei 2 copos d'água"), /Hoje: 900 ml/);
  assert.equal(db.getTodayWaterTotal(userId), 900);
  assert.equal(db.getTodayMeals(userId).length, 0);
  assert.match(await send(userId, "quanto de água falta?"), /Faltam 1,1 L|Faltam 1100 ml/);
});

test("HID-01: meta de água pelo agente e registro pelo agente", async () => {
  const userId = newUser();
  assert.match(await send(userId, "minha meta de água é 3 litros", fakeModel([toolCall("set_water_goal", { goal_ml: 3000 }), finalText("ok")])), /Meta diária de água definida: 3 L/);
  assert.match(await send(userId, "bebi uma garrafinha", fakeModel([toolCall("record_water", { amount_ml: 500 }), finalText("ok")])), /de 3 L/);
  assert.equal(db.getTodayWaterTotal(userId), 500);
});

test("HID-01: sem meta definida, a meta de água é estimada pelo peso (35 ml/kg)", async () => {
  const userId = newUser();
  await send(userId, "pesei 70 kg", fakeModel([toolCall("record_weight", { weight_kg: 70 }), finalText("ok")]));
  assert.match(await send(userId, "bebi 500 ml de água"), /500 ml de 2,5 L/);
});

// ---------- Registros frequentes sem o modelo ----------

test("CRP-01 / MUS-01: peso e treino simples registram sem chamar o modelo", async () => {
  const userId = newUser();
  assert.match(await send(userId, "pesei 72,5 kg"), /Registrei seu peso: 72,5 kg/);
  assert.match(await send(userId, "meu peso hoje é 72 kg"), /Registrei seu peso: 72 kg/);
  assert.match(await send(userId, "corri 5 km em 30 minutos"), /Registrei o treino: Corrida — 30 min/);
  assert.match(await send(userId, "fiz 1h de musculação"), /Registrei o treino: Musculação — 60 min/);
  assert.equal(db.getUser(userId).weight_kg, 72);
});

test("ACO-02: resumo do dia sem o modelo, com água", async () => {
  const userId = newUser();
  await send(userId, "comi 2 ovos");
  await send(userId, "bebi 500 ml de água");
  const reply = await send(userId, "resumo do dia");
  assert.match(reply, /Resumo de hoje/);
  assert.match(reply, /💧 \*Água:\* 0,5 L de 2 L ▓▓▓░░░░░░░ 25%/);
  assert.match(await send(userId, "como estou hoje?"), /Resumo de hoje/);
});

// ---------- CONV-11 / ARQ-04: lembretes ----------

test("CONV-11: comandos de lembrete ativam e desativam", async () => {
  const userId = newUser();
  assert.match(await send(userId, "me lembre de beber água"), /Lembretes de água ativados/);
  assert.match(await send(userId, "me mande o resumo do dia às 21h"), /resumo do dia todos os dias às 21:00/);
  assert.equal(db.getUser(userId).reminder_water, 1);
  assert.equal(db.getUser(userId).reminder_summary_time, "21:00");
  assert.match(await send(userId, "pare os lembretes de água"), /Lembretes de água desativados/);
  assert.equal(db.getUser(userId).reminder_water, 0);
});

test("ARQ-04: lembretes devidos saem uma vez por horário e só abaixo do ritmo da meta", async () => {
  const { runReminders } = await import("../src/ai.js");
  const { brazilClock } = await import("../src/reminders.js");
  const userId = newUser();
  await send(userId, "me lembre de beber água");
  await send(userId, "me mande o resumo do dia às 21h");
  const outbox = [];
  const sendFake = async (to, text) => { outbox.push([to, text]); };
  const at = (hhmm) => new Date(`${brazilClock().date}T${hhmm}:00-03:00`);

  await runReminders({ now: at("12:00"), send: sendFake });
  const mine = () => outbox.filter(([to]) => to === userId);
  assert.equal(mine().length, 1);
  assert.match(mine()[0][1], /Lembrete de água/);
  await runReminders({ now: at("12:30"), send: sendFake });
  assert.equal(mine().length, 1, "não repete no mesmo horário");

  await send(userId, "bebi 2 litros de água");
  await runReminders({ now: at("14:00"), send: sendFake });
  assert.equal(mine().length, 1, "acima do ritmo não lembra");

  await runReminders({ now: at("21:05"), send: sendFake });
  assert.equal(mine().length, 2);
  assert.match(mine()[1][1], /Resumo de hoje/);
});

// ---------- VIS-01 / VIS-02: foto de refeição ----------

test("VIS-01: foto vira estimativa pelo catálogo e só registra após 'sim'", async () => {
  const { processMealPhoto } = await import("../src/ai.js");
  const userId = newUser();
  const model = fakeModel([finalText(JSON.stringify({
    items: [{ name: "arroz branco", grams: 150 }, { name: "feijão carioca", grams: 100 }, { name: "prato de cerâmica", grams: 300 }],
    confidence: "medium", notes: ""
  }))]);
  const reply = await processMealPhoto(userId, { imageBase64: "AAAA", mimeType: "image/jpeg" }, { apiClient: model });
  assert.match(reply, /Refeição pela foto/);
  assert.match(reply, /Não encontrei no catálogo: prato de cerâmica/);
  assert.match(reply, /Responda \*sim\* para registrar/);
  assert.match(model.requests[0].instructions, /arroz branco cozido/);
  assert.equal(model.requests[0].input[0].content[1].type, "input_image");
  assert.equal(db.getTodayMeals(userId).length, 0);

  await send(userId, "sim");
  const meals = db.getTodayMeals(userId);
  assert.equal(meals.length, 1);
  assert.equal(meals[0].calories, estimateMealFromText("comi 150 g de arroz branco e 100 g de feijão carioca").calories);
});

test("VIS-02: foto sem comida ou leitura inválida não registra e pede texto", async () => {
  const { processMealPhoto } = await import("../src/ai.js");
  const userId = newUser();
  const empty = fakeModel([finalText('{"items":[],"confidence":"low","notes":"imagem escura"}')]);
  assert.match(await processMealPhoto(userId, { imageBase64: "AAAA" }, { apiClient: empty }), /Não consegui identificar a refeição na foto \(imagem escura\)/);
  const broken = fakeModel([finalText("não sei")]);
  assert.match(await processMealPhoto(userId, { imageBase64: "AAAA" }, { apiClient: broken }), /Não consegui identificar/);
  assert.equal(db.getPendingMealClarification(userId), null);
});

test("VIS-01: outra mensagem descarta a leitura da foto", async () => {
  const { processMealPhoto } = await import("../src/ai.js");
  const userId = newUser();
  await processMealPhoto(userId, { imageBase64: "AAAA" }, { apiClient: fakeModel([finalText('{"items":[{"name":"arroz branco","grams":150}],"confidence":"high"}')]) });
  await send(userId, "comi 2 ovos");
  const meals = db.getTodayMeals(userId);
  assert.equal(meals.length, 1);
  assert.match(meals[0].description, /ovos/);
});

test("VIS-01: download da mídia do WhatsApp em duas etapas", async () => {
  const { downloadWhatsAppMedia } = await import("../src/app.js");
  const previous = process.env.WHATSAPP_ACCESS_TOKEN;
  process.env.WHATSAPP_ACCESS_TOKEN = "token-de-teste";
  const calls = [];
  const fetchFake = async (url, options) => {
    calls.push([url, options.headers.Authorization]);
    return url.includes("graph.facebook.com")
      ? { ok: true, json: async () => ({ url: "https://cdn.exemplo/foto", mime_type: "image/png" }) }
      : { ok: true, arrayBuffer: async () => new TextEncoder().encode("abc").buffer };
  };
  try {
    assert.deepEqual(await downloadWhatsAppMedia("123", fetchFake), { base64: "YWJj", mimeType: "image/png" });
    assert.equal(calls.length, 2);
    assert.equal(calls[1][1], "Bearer token-de-teste");
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN; else process.env.WHATSAPP_ACCESS_TOKEN = previous;
  }
});

// ---------- CONV-10: áudio ----------

test("CONV-10: áudio é transcrito e segue o fluxo de texto", async () => {
  const { processVoiceMessage } = await import("../src/ai.js");
  const userId = newUser();
  const requests = [];
  const apiClient = { audio: { transcriptions: { create: async (request) => { requests.push(request); return { text: "comi 2 ovos" }; } } } };
  const reply = await processVoiceMessage(userId, { base64: Buffer.from("ogg").toString("base64"), mimeType: "audio/ogg; codecs=opus" }, { apiClient });
  assert.match(reply, /^🎙️ Entendi: "comi 2 ovos"/);
  assert.match(reply, /✅ \*Refeição registrada\* · #\d+\n🍽️ 2 ovos/);
  assert.equal(requests[0].language, "pt");
  assert.equal(requests[0].file.name, "audio.ogg");
  assert.equal(db.getTodayMeals(userId).length, 1);
});

test("CONV-10: falha ou transcrição vazia pede texto e não registra", async () => {
  const { processVoiceMessage } = await import("../src/ai.js");
  const userId = newUser();
  const failing = { audio: { transcriptions: { create: async () => { throw new Error("rede"); } } } };
  assert.match(await processVoiceMessage(userId, { base64: "AAAA" }, { apiClient: failing }), /Não consegui ouvir o áudio/);
  const silent = { audio: { transcriptions: { create: async () => ({ text: "  " }) } } };
  assert.match(await processVoiceMessage(userId, { base64: "AAAA" }, { apiClient: silent }), /Não entendi o áudio/);
  assert.equal(db.getTodayMeals(userId).length, 0);
});

// ---------- CRP-05 / MUS-03 / HID-02 ----------

test("CRP-05: sono registrado sem o modelo e mostrado no resumo do dia", async () => {
  const userId = newUser();
  assert.match(await send(userId, "dormi 6 horas e 30 min, mal"), /Registrei 6 h 30 min de sono \(mal\)/);
  assert.match(await send(userId, "resumo do dia"), /😴 \*Sono:\* 6 h 30 min \(mal\)/);
  assert.match(await send(userId, "dormi 30 horas"), /Não registrei o sono/);
});

test("MUS-03: recorde por exercício e aviso de novo recorde", async () => {
  const userId = newUser();
  const workout = (kg) => fakeModel([toolCall("record_workout", {
    workout_type: "musculação", duration_min: 50,
    exercises: [{ name: "Supino reto", sets: 3, reps: 8, weight_kg: kg }]
  }), finalText("ok")]);
  assert.doesNotMatch(await send(userId, "treinei peito", workout(60)), /Novo recorde/);
  assert.match(await send(userId, "treinei peito de novo", workout(65)), /🏆 Novo recorde em Supino reto: 65 kg!/);
  assert.match(await send(userId, "qual meu recorde no supino?"), /🏆 Seu recorde em Supino reto: 65 kg × 8/);
  assert.match(await send(userId, "qual meu recorde no agachamento?"), /Ainda não tenho cargas registradas de agachamento/);
});

test("HID-02: 'apaga a última água' remove só o último registro de hoje", async () => {
  const userId = newUser();
  await send(userId, "bebi 500 ml de água");
  await send(userId, "bebi 300 ml de água");
  assert.match(await send(userId, "apaga a última água"), /Removi o último registro de água de hoje \(300 ml\)\. Total agora: 500 ml/);
  assert.equal(db.getTodayWaterTotal(userId), 500);
  assert.match(await send(userId, "pare os lembretes de água"), /Lembretes de água desativados/);
});

test("ACO-03: resumo de período inclui treinos, peso, água e sono", async () => {
  const userId = newUser();
  await send(userId, "comi 2 ovos");
  await send(userId, "pesei 80 kg");
  await send(userId, "pesei 79,5 kg");
  await send(userId, "corri 5 km em 30 minutos");
  await send(userId, "bebi 2 litros de água");
  await send(userId, "dormi 7 horas");
  const reply = await send(userId, "resumo dos últimos 7 dias");
  assert.match(reply, /Outras áreas:/);
  assert.match(reply, /🏋️ Treinos: 1 \(30 min\)/);
  assert.match(reply, /⚖️ Peso: 80 → 79,5 kg \(−0,5 kg\)/);
  assert.match(reply, /💧 Água: média de 2 L\/dia \(1 dia com registro\)/);
  assert.match(reply, /😴 Sono: média de 7 h \(1 noite\)/);
});

// ---------- Fase 5: comportamentos vistos com o modelo real ----------

test("Fase 5: meta de um macro só altera esse macro, mesmo se o modelo enviar os três", async () => {
  const userId = userWithTargets();
  const before = db.getUser(userId);
  await setMacros(userId, { protein_g: 140, carbs_g: 250, fat_g: 70 }, "minha meta de proteína é 140 g");
  const after = db.getUser(userId);
  assert.equal(after.daily_protein_target, 140);
  assert.equal(after.daily_carbs_target, before.daily_carbs_target);
  assert.equal(after.daily_fat_target, before.daily_fat_target);
});

test("VIS-01: termo genérico da foto usa o preparo visto e informa a escolha", async () => {
  const { processMealPhoto } = await import("../src/ai.js");
  const userId = newUser();
  const model = fakeModel([finalText(JSON.stringify({
    items: [{ name: "peixe grelhado", grams: 120 }, { name: "batata", grams: 100 }, { name: "carne assada", grams: 110 }],
    confidence: "medium"
  }))]);
  const reply = await processMealPhoto(userId, { imageBase64: "AAAA" }, { apiClient: model });
  assert.match(reply, /Considerei: peixe grelhado → Tilápia grelhada; batata → Batata inglesa cozida/);
  assert.match(reply, /Carne bovina grelhada — ~110 g/);
  assert.doesNotMatch(reply, /Não encontrei no catálogo/);
});

test("CONV-09: comando conhecido encerra a pergunta pendente e é atendido", async () => {
  const userId = newUser();
  assert.match(await send(userId, "comi arroz"), /Falta a quantidade/);
  assert.match(await send(userId, "resumo do dia"), /Resumo de hoje/);
  assert.equal(db.getPendingMealClarification(userId), null);
});

test("NUT-17 / Fase 5: meta calórica inválida já salva é ignorada e explicada", async () => {
  const userId = userWithTargets();
  const before = db.getUser(userId).daily_calorie_target;
  db.updateUserProfile(userId, { daily_calorie_target: 100000 });
  assert.equal(db.getUser(userId).daily_calorie_target, before, "o perfil recusa a meta absurda");

  // Valor legado gravado antes da validação, direto no banco temporário do teste.
  const { default: Database } = await import("better-sqlite3");
  const raw = new Database(process.env.FITPULSE_DB_PATH);
  raw.prepare("UPDATE users SET daily_calorie_target = 100000 WHERE id = ?").run(userId);
  raw.close();
  const summary = db.getDailySummary(userId);
  assert.equal(summary.calorie_target, null);
  assert.equal(summary.calorie_target_invalid, 100000);
  const reply = await send(userId, "Me de opções de cardápio para o almoço", fakeModel([toolCall("suggest_meals", {
    meal_period: "almoço", desired_food: null, requested_servings: null, available_foods: [], required_foods: [],
    explicit_excluded_foods: [], explicit_excluded_compositions: []
  }), finalText("ok")]));
  assert.match(reply, /meta calórica salva \(100\.000 kcal\) não é válida/);
  assert.match(await send(userId, "resumo do dia"), /não é válida/);
});

test("Fase 5: 'minha neta de calorias é 1800, proteína 140g…' (erro de digitação) atualiza as metas", async () => {
  const userId = userWithTargets();
  const message = "Minha neta de calorias é 1800, proteína 140g carboidrato 180g gordura 60 g";
  await send(userId, message, fakeModel([toolCall("set_calorie_target", { calories: 1800 }), finalText("ok")]));
  await send(userId, message, fakeModel([toolCall("set_macro_targets", { protein_g: 140, carbs_g: 180, fat_g: 60 }), finalText("ok")]));
  const user = db.getUser(userId);
  assert.deepEqual([user.daily_calorie_target, user.daily_protein_target, user.daily_carbs_target, user.daily_fat_target], [1800, 140, 180, 60]);
});

test("CONV-02: metas entendem erros de digitação nos nomes e na palavra 'meta'", async () => {
  const userId = userWithTargets();
  const message = "mta de calorias 1700, protiena 150 g, carboidrto 170g e gordra 55g";
  await send(userId, message, fakeModel([toolCall("set_calorie_target", { calories: 1700 }), finalText("ok")]));
  await send(userId, message, fakeModel([toolCall("set_macro_targets", { protein_g: 150, carbs_g: 170, fat_g: 55 }), finalText("ok")]));
  const user = db.getUser(userId);
  assert.deepEqual([user.daily_calorie_target, user.daily_protein_target, user.daily_carbs_target, user.daily_fat_target], [1700, 150, 170, 55]);
});

test("CONV-02: relato de consumo não vira meta, mesmo se o modelo chamar a ferramenta", async () => {
  const userId = userWithTargets();
  const before = db.getUser(userId).daily_protein_target;
  const reply = await send(userId, "comi 140 g de proteína hoje", fakeModel([toolCall("set_macro_targets", { protein_g: 140 }), finalText("ok")]));
  assert.match(reply, /Não alterei suas metas de macros/);
  assert.equal(db.getUser(userId).daily_protein_target, before);
});

// ---------- Treinos: integração com a conversa ----------

test("ESP-04: plano de treino pelo agente e consultas sem o modelo", async () => {
  const userId = newUser();
  const reply = await send(userId, "monta um treino pra eu correr 10 km, 4 dias por semana, faço 20 km por semana e corro 5 km em 28 min", fakeModel([
    toolCall("create_training_plan", {
      running_goal: "10k", running_level: "intermediario", running_days_per_week: 4, available_days: [], current_weekly_km: 20,
      longest_run_km: 8, reference_distance_km: 5, reference_time: "28:00", easy_pace: null, event_date: null,
      strength_goal: null, strength_level: null, strength_days_per_week: null, equipment: null, limitations: [],
      other_modality: null, other_level: null, other_days_per_week: null
    }),
    finalText("ok")
  ]));
  assert.match(reply, /Plano de treino criado/);
  assert.ok(db.getActiveTrainingPlan(userId));
  assert.match(await send(userId, "como está minha corrida?"), /Sua corrida|Ainda não há corridas/);
  assert.match(await send(userId, "treinos da semana"), /Semana|Não há treinos planejados/);
  const run = await send(userId, "corri 5 km em 30 minutos");
  assert.match(run, /5 km · pace 6:00\/km/);
});

test("ARQ-04: lembrete de treino só sai em dia com treino no plano", async () => {
  const { runReminders } = await import("../src/ai.js");
  const { brazilClock } = await import("../src/reminders.js");
  const userId = newUser();
  assert.match(await send(userId, "me lembre dos treinos às 6h"), /treino do dia às 06:00/);
  const outbox = [];
  const at = (hhmm) => new Date(`${brazilClock().date}T${hhmm}:00-03:00`);
  await runReminders({ now: at("06:30"), send: async (to, text) => outbox.push([to, text]) });
  assert.equal(outbox.filter(([to]) => to === userId).length, 0, "sem plano: nada a enviar");
});
