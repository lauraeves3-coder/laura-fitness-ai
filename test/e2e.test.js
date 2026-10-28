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
  assert.match(ask, /Responda \*sim\* para excluir ou \*não\* para manter/);
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
  assert.match(reply, /✅ \*Refeição registrada\* · #\d+\n🍽️ .+\n\n🔥 \d+ kcal/);
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
  // Séries × repetições no texto: registra direto (duração opcional), sem o modelo.
  assert.match(reply, /Registrei o treino: Musculação\n/);
  assert.match(reply, /supino: 4 × 8 com 50 kg/);
  assert.match(reply, /Volume total: 3\.760 kg/);
  const [workout] = db.getWorkoutsBetween(userId, today(userId), today(userId));
  assert.deepEqual(workout.exercises.map(({ rpe, rir, ...exercise }) => exercise), [
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
  assert.match(await send(userId, "pesei 72,5 kg", fakeModel([toolCall("record_weight", { weight_kg: 72.5 }), finalText("ok")])), /Registrei seu peso: \*72,5 kg\*/);
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
  assert.match(await send(userId, "pesei 72,5 kg"), /Registrei seu peso: \*72,5 kg\*/);
  assert.match(await send(userId, "meu peso hoje é 72 kg"), /Registrei seu peso: \*72 kg\*/);
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

// ---------- NUT-27: ajuste do dia em tempo real ----------

test("NUT-27: refeição acima da sua fatia do dia redistribui o saldo, sem culpa", async () => {
  const { planDayAdjustment } = await import("../src/nutrition.js");
  // Meta 2000: almoço previsto ~600; almoço de 950 → resta para lanche, jantar e ceia.
  const lines = planDayAdjustment({ summary: { calorie_target: 2000, calories: 1350, calorie_remaining: 650, protein_remaining: 60 }, period: "almoço", mealCalories: 950 });
  const text = lines.join("\n");
  assert.match(text, /🔄 \*Ajuste do dia\*\nEssa refeição \(almoço\) ficou ~350 kcal acima do previsto \(~600\)/);
  assert.match(text, /Redistribuí os 650 kcal que restam:\n• Lanche da tarde: ~195 kcal\n• Jantar: ~325 kcal\n• Ceia: ~130 kcal/);
  assert.match(text, /faltam 60 g de proteína/);
  assert.doesNotMatch(text, /culpa|errou|exagerou/);
  // Dentro do previsto: nada a ajustar.
  assert.deepEqual(planDayAdjustment({ summary: { calorie_target: 2000, calorie_remaining: 1400 }, period: "almoço", mealCalories: 650 }), []);
  // Meta já batida.
  assert.match(planDayAdjustment({ summary: { calorie_target: 2000, calorie_remaining: -200 }, period: "jantar", mealCalories: 1100 }).join("\n"), /já chegou na meta de hoje \(passou ~200 kcal\)[\s\S]*Amanhã segue o plano normal/);

  // Pela conversa: meta 600 kcal e 6 ovos (~375 kcal) passam de qualquer fatia do dia.
  const userId = newUser();
  db.updateUserProfile(userId, { daily_calorie_target: 600 });
  const reply = await send(userId, "comi 6 ovos");
  assert.match(reply, /✅ \*Refeição registrada\*[\s\S]*🔄 \*Ajuste do dia\*/);
});

test("NUT-03/26: feijoada pergunta o acompanhamento; inteiros registram com o tamanho padrão avisado", async () => {
  const userId = newUser();
  const question = await send(userId, "almocei 2 pratos de feijoada");
  assert.match(question, /🍽️ \*Teve acompanhamento\?\*\nFeijoada costuma vir com arroz, farofa, couve e laranja/);
  assert.equal(db.getTodayMeals(userId).length, 0);
  const reply = await send(userId, "4 colheres de sopa de arroz e 2 colheres de sopa de farofa");
  assert.match(reply, /✅ \*Refeição registrada\*[\s\S]*com 4 colheres de sopa de arroz[\s\S]*📐 Considerei: prato de ~300 g/);
  const meal = db.getTodayMeals(userId)[0];
  assert.ok(meal.calories > 900, `feijoada + arroz + farofa: ${meal.calories}`);

  const only = newUser();
  await send(only, "almocei feijoada");
  assert.match(await send(only, "só feijoada"), /📏 \*Falta a quantidade\*[\s\S]*feijoada/);
  assert.match(await send(only, "1 prato"), /✅ \*Refeição registrada\*[\s\S]*📐 Considerei: prato de ~300 g/);

  const pizza = newUser();
  const pizzaReply = await send(pizza, "comi uma pizza inteira de calabresa");
  assert.match(pizzaReply, /✅ \*Refeição registrada\*[\s\S]*📐 Considerei: pizza grande inteira de 8 fatias \(~720 g\)\. Se foi diferente, me diga que eu corrijo\./);
});

// ---------- ACO-04: metas desatualizadas ----------

test("ACO-04: detecta metas desatualizadas e só sugere a revisão", async () => {
  const { reviewTargets, describeTargetReview } = await import("../src/goalReview.js");
  const today = "2026-10-25";
  const user = { goal: "emagrecer", weight_kg: 66, targets_weight_kg: 69, calorie_target_mode: "automatic", daily_calorie_target: 1800, activity_level: "light" };
  const weights = [{ date: "2026-09-28", weight_kg: 66.2 }, { date: "2026-10-10", weight_kg: 66.1 }, { date: "2026-10-24", weight_kg: 66 }];
  const days = Array.from({ length: 12 }, (_, index) => ({ date: `2026-10-${String(12 + index).padStart(2, "0")}`, calories: 2300 }));
  const review = reviewTargets({ user, weights, dailyCalories: days, plannedTrainingDays: 5, today });
  assert.equal(review.reasons.length, 4);
  const text = describeTargetReview(review).join("\n");
  assert.match(text, /🔎 \*Vale revisar suas metas\*/);
  assert.match(text, /calculadas com 69,0 kg e hoje você está com 66,0 kg/);
  assert.match(text, /peso está parado há 4 semanas \(66,2 → 66,0 kg\)/);
  assert.match(text, /média foi 2\.300 kcal por dia, acima da meta de 1\.800 kcal/);
  assert.match(text, /plano tem 5 treinos por semana, mas suas metas usam nível de atividade leve/);
  assert.match(text, /\*restaure minhas metas automáticas\*[\s\S]*Não mudei nada\./);
  // Emagrecendo de verdade, meta seguida, sem plano: nada a revisar.
  assert.deepEqual(reviewTargets({ user: { ...user, targets_weight_kg: 66 }, weights: [{ date: "2026-09-28", weight_kg: 68 }, { date: "2026-10-10", weight_kg: 67 }, { date: "2026-10-24", weight_kg: 66 }], dailyCalories: days.map((day) => ({ ...day, calories: 1750 })), plannedTrainingDays: null, today }).reasons, []);
  // Meta personalizada não acusa diferença de peso.
  assert.equal(reviewTargets({ user: { ...user, calorie_target_mode: "custom" }, today }).reasons.length, 0);

  // No resumo do dia: aparece uma vez e não repete na mesma semana.
  const userId = newUser();
  db.updateUserProfile(userId, { age_years: 30, sex: "female", height_cm: 165, weight_kg: 69, goal: "emagrecer", activity_level: "light" });
  db.calculateAndSaveNutritionTargets(userId);
  db.saveWeight(userId, 66.5);
  const first = await send(userId, "resumo do dia");
  assert.match(first, /🔎 \*Vale revisar suas metas\*[\s\S]*calculadas com 69,0 kg e hoje você está com 66,5 kg/);
  assert.doesNotMatch(await send(userId, "resumo do dia"), /Vale revisar/);
  assert.equal(db.getUser(userId).targets_weight_kg, 69, "nada recalculado sozinho");
});

// ---------- CRP-03: medidas corporais e tendências ----------

test("CRP-03: medidas pela conversa, evolução e tendência do peso", async () => {
  const { parseMeasurements, buildWeightTrendReply } = await import("../src/body.js");
  assert.deepEqual(parseMeasurements("cintura 78 cm, quadril 98 cm, braço 31 cm").map((entry) => entry.part), ["cintura", "quadril", "braco"]);
  assert.deepEqual(parseMeasurements("minha cintura está 78"), [{ part: "cintura", value: 78 }]);
  assert.deepEqual(parseMeasurements("meu percentual de gordura é 24%"), [{ part: "gordura", value: 24 }]);
  for (const text of ["treino de braço 3x12", "fiz 40 min de perna e braço", "comi 2 coxas de frango", "quero diminuir a cintura para 70 cm"]) {
    assert.deepEqual(parseMeasurements(text), [], text);
  }

  const userId = newUser();
  assert.match(await send(userId, "minhas medidas"), /Ainda não tenho medidas suas/);
  const saved = await send(userId, "cintura 80 cm, quadril 100 cm e gordura 26%");
  assert.match(saved, /📏 \*Medidas registradas\*[\s\S]*• \*Cintura:\* 80 cm\n• \*Quadril:\* 100 cm\n• \*Gordura corporal:\* 26%/);
  await send(userId, "minha cintura está 78,5");
  assert.match(await send(userId, "minhas medidas"), /• \*Cintura:\* 78,5 cm \(−1,5 cm desde/);

  const trend = buildWeightTrendReply([{ date: "2026-09-01", weight_kg: 70 }, { date: "2026-09-15", weight_kg: 69.2 }, { date: "2026-10-01", weight_kg: 68.6 }, { date: "2026-10-20", weight_kg: 68 }], { goal: "emagrecer" });
  assert.match(trend, /⚖️ \*Evolução do peso\*\n\n█▅▃▁\n70 kg \(ter 01\/09\) → \*68 kg\* \(ter 20\/10\)\nVariação: \*−2 kg\* em 49 dias · −0,3 kg\/semana/);
  assert.match(trend, /✅ No ritmo certo para emagrecer/);
  assert.match(await send(userId, "evolução do peso"), /Preciso de pelo menos 2 pesagens/);
});

// ---------- ACO-01: check-in diário ----------

test("ACO-01: check-in pergunta, registra e ajusta o treino do dia", async () => {
  const { parseCheckinAnswer } = await import("../src/checkin.js");
  const { parseReminderCommand, dueReminders } = await import("../src/reminders.js");
  const service = await import("../src/training/service.js");
  assert.deepEqual(parseCheckinAnswer("dormi 7h, energia 4, sem dor"), { sleepHours: 7, sleepQuality: null, energy: 4, pain: null });
  assert.equal(parseCheckinAnswer("energia baixa, dor no joelho").pain, "joelho");
  assert.equal(parseCheckinAnswer("energia baixa, dor no joelho").energy, 2);
  assert.equal(parseCheckinAnswer("dormi 7h"), null, "sem energia não é check-in");

  const userId = newUser();
  assert.match(await send(userId, "check-in"), /☀️ \*Check-in de hoje\*[\s\S]*Energia de 1 a 5/);
  const today = db.getDailySummary(userId).date;
  // Plano com treino hoje: cria e força uma sessão forte para hoje.
  service.createTrainingPlanFromRequest(userId, {
    running_goal: "10k", running_level: "intermediario", running_days_per_week: 6, available_days: [], current_weekly_km: 25,
    longest_run_km: 10, reference_distance_km: 5, reference_time: "27:00", easy_pace: null, event_date: null, strength_goal: null,
    strength_level: null, strength_days_per_week: null, equipment: null, limitations: [], other_modality: null, other_level: null, other_days_per_week: null
  }, today);
  const todaySession = db.getPlannedSessions(userId, today, today)[0];
  const tired = await send(userId, "dormi 5h, energia 2, sem dor");
  assert.match(tired, /✅ \*Check-in registrado\*\n😴 Sono: 5 h · ⚡ Energia: 2\/5 · 🩹 Dor: nenhuma/);
  if (todaySession) {
    assert.match(tired, /🔄 Ajustei/);
    assert.equal(db.getPlannedSessions(userId, today, today)[0].status, "ajustado");
  } else {
    assert.match(tired, /energia baixa/);
  }
  assert.equal(db.getSleepOn(userId, today).hours, 5, "sono vai para o registro de sono");

  const fine = newUser();
  assert.match(await send(fine, "dormi 8h, energia 5, sem dor"), /💪 Energia boa, bora!/);

  // Lembrete do check-in.
  assert.deepEqual(parseReminderCommand("me lembre do check-in às 7h"), { kind: "checkin", time: "07:00" });
  assert.match(await send(fine, "me lembre do check-in às 6h30"), /☀️ Vou mandar o check-in todos os dias às 06:30/);
  const due = dueReminders([{ id: fine, reminder_checkin_time: "06:30" }], new Date("2026-10-27T10:00:00Z"), () => false);
  assert.deepEqual(due.map((item) => item.kind), ["checkin"]);
});

// ---------- CONV-12: perfil de comunicação ----------

test("CONV-12: preferência por respostas curtas ou detalhadas vai para as instruções do agente", async () => {
  const { detectReplyStyle } = await import("../src/replyStyle.js");
  assert.equal(detectReplyStyle("prefiro respostas curtas"), "curta");
  assert.equal(detectReplyStyle("isso ficou muito longo"), "curta");
  assert.equal(detectReplyStyle("quero respostas mais detalhadas"), "detalhada");
  assert.equal(detectReplyStyle("pode voltar ao normal de responder"), "normal");
  assert.equal(detectReplyStyle("comi um pão curto"), null);
  assert.equal(detectReplyStyle("quero um treino curto"), null);

  const userId = newUser();
  assert.match(await send(userId, "prefiro respostas curtas"), /vou responder de forma mais \*curta e direta\*/);
  assert.equal(db.getUser(userId).reply_style, "curta");
  const model = fakeModel([finalText("Oi!")]);
  await send(userId, "me dá uma dica para dormir melhor", model);
  assert.match(model.requests[0].instructions, /respostas curtas e diretas, no máximo 3 a 4 linhas/);

  await send(userId, "volte ao normal de responder");
  const normal = fakeModel([finalText("Oi!")]);
  await send(userId, "me dá uma dica para dormir melhor", normal);
  assert.doesNotMatch(normal.requests[0].instructions, /Preferência de estilo/);
});

// ---------- MUS-02: esforço e progressão ----------

test("MUS-02: RPE/RIR por exercício, esforço da sessão, progressão de carga e alerta de fadiga", async () => {
  const { applyEffortFromText, progressionAdvice, fatigueAdvice } = await import("../src/workouts.js");
  const parsed = applyEffortFromText({ workout_type: "Musculação", exercises: [{ name: "supino", sets: 3, reps: 10, weight_kg: 40 }] }, "supino 3x10 com 40 kg, rir 3, esforço 7/10");
  assert.equal(parsed.exercises[0].rir, 3);
  assert.equal(parsed.effort, 7);
  assert.match(progressionAdvice(parsed.exercises).join("\n"), /⬆️ supino: sobrou fôlego \(RIR 3\)\. Suba a carga ~2 kg \(para 42 kg\)/);
  assert.match(progressionAdvice([{ name: "agachamento", weight_kg: 60, rpe: 10 }]).join("\n"), /⏸️ agachamento: foi até a falha/);
  assert.deepEqual(progressionAdvice([{ name: "remada", weight_kg: 30, rir: 2 }]), [], "RIR 1–2 é a faixa certa");
  assert.equal(fatigueAdvice([9, 9.5]), null);
  assert.match(fatigueAdvice([9, 9, 10]), /semana mais leve/);

  const userId = newUser();
  const reply = await send(userId, "treinei supino 3x10 com 40 kg, rir 3, esforço 9/10", fakeModel([
    toolCall("record_workout", { workout_type: "musculação", effort: null, duration_min: 45, exercises: [{ name: "supino", sets: 3, reps: 10, weight_kg: 40, rpe: null, rir: null }] }),
    finalText("ok")
  ]));
  assert.match(reply, /• supino: 3 × 10 com 40 kg \(RIR 3\)/);
  assert.match(reply, /💢 Esforço da sessão: 9\/10/);
  assert.match(reply, /📈 \*Próximo treino\*\n⬆️ supino/);
  const workout = db.getWorkoutsBetween(userId, "2000-01-01", "2100-01-01")[0];
  assert.equal(workout.effort, 9);
  assert.equal(workout.exercises[0].rir, 3);
  let lastReply = "";
  for (const effort of [9, 10]) {
    lastReply = await send(userId, `treinei agachamento 4x8 com 60 kg, esforço ${effort}/10`, fakeModel([
      toolCall("record_workout", { workout_type: "musculação", effort: null, duration_min: 50, exercises: [{ name: "agachamento", sets: 4, reps: 8, weight_kg: 60, rpe: null, rir: null }] }),
      finalText("ok")
    ]));
  }
  assert.match(db.getRecentStrengthEfforts(userId).join(","), /9,9,10/);
  assert.match(lastReply, /😮‍💨 Suas últimas 3 sessões foram muito pesadas/);
});

// ---------- DSP-01/02: despensa ----------

test("DSP-01/02: despensa com quantidade, local e validade; baixa ao registrar refeição; vai para o agente", async () => {
  const userId = newUser();
  const today = db.getDailySummary(userId).date;
  assert.match(await send(userId, "minha despensa"), /Sua despensa está vazia/);
  const added = await send(userId, "comprei 1 kg de frango, 2 dúzias de ovos e 500 g de arroz");
  assert.match(added, /🧺 \*Despensa atualizada\*\n• Frango: 1 kg\n• Ovos: 24 un\n• Arroz: 500 g/);
  const [year, month, day] = today.split("-").map(Number);
  const soon = new Date(Date.UTC(year, month - 1, day + 2)).toISOString().slice(0, 10);
  await send(userId, `coloquei 2 litros de leite na geladeira, vence ${soon.slice(8, 10)}/${soon.slice(5, 7)}`);
  const pantry = await send(userId, "o que tenho em casa?");
  assert.match(pantry, /\*Geladeira\*\n• Leite: 2 L — ⚠️ vence em 2 dias/);
  assert.match(pantry, /💡 Use primeiro: leite/);
  assert.match(await send(userId, "o que está para vencer?"), /Leite: 2 L — ⚠️ vence em 2 dias/);

  // Refeição com itens da despensa dá baixa.
  const meal = await send(userId, "comi 3 ovos");
  assert.match(meal, /🧺 Ovos: restam 21 un/);
  assert.match(await send(userId, "acabou o leite"), /Tirei da despensa: leite/);
  assert.equal(db.getPantry(userId).some((item) => item.name === "Leite"), false);

  // Sugestão com o que há em casa: a despensa vai no contexto do agente.
  const model = fakeModel([finalText("ok")]);
  await send(userId, "o que posso fazer de almoço com o que tenho em casa?", model);
  const input = JSON.parse(model.requests[0].input);
  assert.deepEqual(input.current_context.pantry.map((item) => item.name), ["Arroz", "Frango", "Ovos"]);
  assert.match(await send(userId, "comprei um açaí e comi", fakeModel([finalText("ok")])), /Refeição registrada/, "comprar e comer é refeição, não estoque");
  assert.equal(db.getPantry(userId).some((item) => /açaí/i.test(item.name)), false);
});

// ---------- REC: receitas ----------

test("REC: busca com filtros, ficha, troca de ingrediente, favoritas e registro por porção", async () => {
  const { allRecipes, recipeNutrition, parseRecipeQuery, searchRecipes } = await import("../src/recipes.js");
  const { FOOD_CATALOG, estimateMealFromText } = await import("../src/nutritionCatalog.js");
  const ids = new Set(FOOD_CATALOG.map((food) => food.id));
  assert.ok(allRecipes().length >= 40);
  assert.deepEqual(allRecipes().flatMap((recipe) => recipe.ingredients.filter(([id]) => id && !ids.has(id)).map(([id]) => `${recipe.id}:${id}`)), [], "todo ingrediente existe no catálogo");
  // REC-07: o mesmo cálculo do registro de refeições.
  const pf = allRecipes().find((recipe) => recipe.id === "ovos-cozidos-fruta");
  assert.equal(Math.round(recipeNutrition(pf).calories), Math.round(estimateMealFromText("comi 2 ovos e 1 maçã").calories));
  // REC-04: filtros.
  const names = (query, options) => searchRecipes(parseRecipeQuery(query), options).map(({ recipe }) => recipe.name);
  assert.ok(names("receita rápida com frango").every((name) => /frango/i.test(name)));
  assert.ok(names("receitas vegetarianas de almoço").length >= 2);
  assert.ok(names("receita na airfryer").includes("Tilápia na airfryer com legumes"));
  assert.ok(names("receita de café da manhã com ovo").length >= 3);
  // DSP-03/REC-03: despensa ordena.
  const fromPantry = searchRecipes(parseRecipeQuery("receita com o que tenho em casa"), { pantryNames: ["Frango", "Batata-doce", "Brócolis"] });
  assert.equal(fromPantry[0].recipe.name, "Frango com batata-doce e brócolis");

  const userId = newUser();
  const list = await send(userId, "me dá uma receita rápida com frango");
  assert.match(list, /🍳 \*Receitas para você\*\n\n\*1\. .*frango.*\*\n⏱️ \d+ min · 🔥 \d+ kcal · 🥩 \d+ g de proteína\n\n\*2\. /i);
  const card = await send(userId, "1");
  assert.match(card, /\*Ingredientes\*[\s\S]*\*Modo de preparo\*\n1\. [\s\S]*\*Por porção:\* 🔥 \d+ kcal/);
  const swapped = await send(userId, "troca o requeijão por cottage");
  assert.match(swapped, /🔁 Troquei requeijão cremoso por queijo cottage|🔁 Troquei .*requeij.* por .*cottage/i);
  assert.match(await send(userId, "favoritar"), /⭐ \*.+\* salva nas favoritas/);
  const meal = await send(userId, "comi 2 porções");
  assert.match(meal, /✅ \*Refeição registrada\*[\s\S]*· 2 porções/);
  assert.equal(db.getTodayMeals(userId).length, 1);
  assert.match(await send(userId, "minhas receitas favoritas"), /⭐ \*Suas receitas favoritas\*\n\n\*1\. .+\*\n⏱️ \d+ min/);
  assert.match(await send(userId, "receita de strogonoff"), /🍳 \*Strogonoff fit de frango\*/);
});

// ---------- Whey da pessoa e receitas pelo sabor ----------

test("Whey: pergunta a marca, guarda o whey e sugere receitas que combinam com o sabor", async () => {
  const userId = newUser();
  const ask = await send(userId, "Tenho whey de morango me mande alguma receita");
  assert.match(ask, /Qual é a \*marca\* do seu whey\?/);
  assert.doesNotMatch(ask, /Qual o \*sabor\*/, "sabor já foi dito");
  const reply = await send(userId, "growth");
  assert.match(reply, /✅ Anotei seu \*Whey Growth Morango\* \(tabela do rótulo da marca\) e coloquei na despensa\./);
  assert.match(reply, /🍳 \*Receitas para você\*/);
  assert.match(reply, /Shake proteico de frutas|Picolé proteico/);
  assert.doesNotMatch(reply, /Brownie de caneca/, "brownie é para whey de chocolate/neutro");
  assert.ok(db.getPantry(userId).some((item) => item.name === "Whey Growth Morango"));
  // A ficha usa o whey da pessoa.
  const list = reply.split("\n");
  const shakeIndex = list.filter((line) => /^\*\d\. /.test(line)).findIndex((line) => /Shake proteico/.test(line)) + 1;
  assert.ok(shakeIndex > 0, "shake está na lista");
  const card = await send(userId, String(shakeIndex));
  assert.match(card, /🍳 \*Shake proteico de frutas\*/);
  assert.match(card, /do seu whey Growth morango \(30 g\)/);

  // Pedido de receita com whey sem ter contado qual é: pergunta marca e sabor.
  const other = newUser();
  const both = await send(other, "me mande receita com whey");
  assert.match(both, /Para sugerir receitas que combinem com o seu whey:[\s\S]*\*marca\*[\s\S]*\*sabor\*/);
  const chocolate = await send(other, "dux chocolate");
  assert.match(chocolate, /Whey Dux Chocolate/);
  assert.match(chocolate, /Brownie de caneca proteico/);
  assert.doesNotMatch(chocolate, /Picolé proteico/);
  // Depois, "receitas com whey" já usa o sabor salvo.
  assert.match(await send(other, "receitas com whey"), /Brownie de caneca proteico/);
  // "não sei" a marca: usa valores médios.
  const generic = newUser();
  await send(generic, "comprei whey de baunilha");
  assert.match(await send(generic, "não sei"), /Whey Baunilha\* \(valores médios de whey\)/);
});

test("Whey: 'opções de lanche com whey' vira receitas com o whey salvo", async () => {
  const userId = newUser();
  await send(userId, "tenho whey dux cookies");
  const reply = await send(userId, "me dá opções de lanche com whey");
  assert.match(reply, /🍳 \*Receitas para você\*/);
  assert.match(reply, /Brownie de caneca proteico|Mousse proteica/);
});

test("Opções de refeição: responder só o número escolhe a opção (mesmo com configuração antiga de refeição livre pendente)", async () => {
  const userId = userWithTargets();
  // Configuração de refeição livre parada há dias em "asked_frequency" (o caso real).
  db.setFreeMealSettings(userId, { setup_status: "asked_frequency", enabled: true });
  const { default: Database } = await import("better-sqlite3");
  const raw = new Database(process.env.FITPULSE_DB_PATH);
  raw.prepare("UPDATE users SET free_meal_setup_at = ? WHERE id = ?").run(Date.now() - 3 * 24 * 3600 * 1000, userId);
  raw.close();
  const options = await send(userId, "Me mande opções para o almoço", fakeModel([toolCall("suggest_meals", {
    meal_period: "almoço", desired_food: null, requested_servings: null, available_foods: [], required_foods: [],
    explicit_excluded_foods: [], explicit_excluded_compositions: []
  }), finalText("ok")]));
  assert.match(options, /\*Opção 1\* — /);
  const firstName = options.match(/\*Opção 1\* — (.+)/)[1];
  const secondName = options.match(/\*Opção 2\* — (.+)/)[1];
  const reply = await send(userId, "1");
  assert.doesNotMatch(reply, /refeição livre/i, "não cai na configuração da refeição livre");
  assert.ok(reply.startsWith(`✅ *${firstName}*`), reply);
  assert.match(reply, /📊 \*Como fica seu dia com essa opção\*\n🔥 Calorias: ainda restariam [\d.]+ kcal/);
  assert.match(reply, /👉 Comeu\? Mande \*comi essa opção\* que eu registro/);
  assert.ok((await send(userId, "quero a 2")).startsWith(`✅ *${secondName}*`));
  assert.match(await send(userId, "comi essa opção"), /Refeição registrada|registr/i);
});

test("Consumidora: perfil completo calcula metas, metas estouradas viram orientação leve e descrição corrige 'aros'", async () => {
  const userId = newUser();
  const profile = await send(userId, "quero emagrecer. tenho 30 anos, sou mulher, 165 cm, 68 kg e treino 4 vezes por semana", fakeModel([
    toolCall("update_user_profile", { name: null, age_years: 30, sex: "female", height_cm: 165, weight_kg: 68, goal: "emagrecer", activity_level: null, training_days_per_week: null, dietary_preferences: null, food_dislikes: null }),
    finalText("ok")
  ]));
  assert.match(profile, /👤 \*Perfil salvo\*\n30 anos · feminino · 165 cm · 68 kg\n🎯 Objetivo: emagrecer · treina 4×\/semana \(atividade moderada\)/);
  assert.match(profile, /📊 \*Suas metas diárias\*\n🔥 \*[\d.]+ kcal\*/);
  assert.ok(db.getUser(userId).daily_calorie_target > 0);
  assert.match(await send(userId, "quais são minhas metas?"), /📊 \*Suas metas diárias\*/);
  assert.equal(db.getWeightsBetween(userId, "2000-01-01", "2100-01-01").length, 1, "peso do perfil entra no histórico");

  await send(userId, "comi uma pizza inteira de calabresa");
  const over = await send(userId, "me mande opções para o jantar", fakeModel([toolCall("suggest_meals", {
    meal_period: "jantar", desired_food: null, requested_servings: null, available_foods: [], required_foods: [],
    explicit_excluded_foods: [], explicit_excluded_compositions: []
  }), finalText("ok")]));
  assert.match(over, /🍽️ \*Você já chegou na meta de hoje\*[\s\S]*\*Opção 1\* — Omelete de 2 ovos com salada\n🔥 ~\d+ kcal/);
  assert.doesNotMatch(over, /Restam -/);

  await send(userId, "comi aros e feijão com frango");
  const saved = await send(userId, "100 g de arroz, 1 concha de feijão e 150 g de frango");
  assert.match(saved, /🍽️ 100 g de arroz e 1 concha de feijão com 150 g de frango/);
});

test("Opções para ganho de massa não encolhem por proteína já atingida", async () => {
  const userId = newUser();
  db.updateUserProfile(userId, { age_years: 28, sex: "homem", height_cm: 178, weight_kg: 82, goal: "ganhar massa", activity_level: "moderate" });
  db.calculateAndSaveNutritionTargets(userId);
  await send(userId, "comi 400 g de peito de frango grelhado");
  const reply = await send(userId, "me mande opções para o jantar", fakeModel([toolCall("suggest_meals", {
    meal_period: "jantar", desired_food: null, requested_servings: null, available_foods: [], required_foods: [],
    explicit_excluded_foods: [], explicit_excluded_compositions: []
  }), finalText("ok")]));
  const calories = [...reply.matchAll(/🔥 (\d[\d.]*) kcal/g)].map((match) => Number(match[1].replace(".", "")));
  assert.ok(calories.length >= 2, reply);
  assert.ok(calories.every((kcal) => kcal >= 450), `porções pequenas demais: ${calories.join(", ")}`);
});

test("ACO-03: resumo da semana traz análise e comparação com a semana anterior", async () => {
  const { buildPeriodHistoryReply } = await import("../src/mealIntent.js");
  const days = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
  // Dias úteis ~1.800 kcal; sábado e domingo ~2.800 kcal; proteína baixa.
  const meals = days.map((day, index) => ({ consumed_at: `${day} 12:00:00`, description: "x", calories: index >= 5 ? 2800 : 1800, protein_g: 70, carbs_g: 200, fat_g: 60 }));
  const previousDays = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
  const reply = buildPeriodHistoryReply({
    range: { start: days[0], end: days[6], label: "últimos 7 dias", single: false },
    meals, calorieTarget: 1850, proteinTarget: 120, waterGoalMl: 2400, goal: "emagrecer",
    activity: { workouts: [{}, {}, {}], weights: [{ weight_kg: 68 }, { weight_kg: 67.6 }], water: [{ logged_at: "2026-10-20 10:00:00", amount_ml: 1000 }], sleeps: [{ hours: 6 }, { hours: 6.5 }] },
    previous: { days: previousDays, meals: previousDays.map((day) => ({ consumed_at: `${day} 12:00:00`, calories: 2100, protein_g: 80, carbs_g: 220, fat_g: 70 })), activity: { workouts: [{}] } }
  });
  assert.match(reply, /🧠 \*Análise\*/);
  assert.match(reply, /Dentro da meta \(±10%\) em 5 de 7 dias registrados/);
  assert.match(reply, /No fim de semana você comeu ~56% a mais que nos dias úteis/);
  assert.match(reply, /Proteína abaixo: média de 70 g de 120 g/);
  assert.match(reply, /Sono médio de 6,3 h/);
  assert.match(reply, /Água abaixo da meta/);
  assert.match(reply, /Peso caindo: no caminho certo/);
  assert.match(reply, /Comparado ao período anterior: média de 2\.086 kcal \(antes 2\.100\) · 3 treinos \(antes 1\)/);
});

// ---------- DSP-04: lista de compras ----------

test("DSP-04: lista de compras pelo que costuma comer, em cru, por categoria e descontando a despensa", async () => {
  const { addDays: plusDays } = await import("../src/dates.js");
  const userId = newUser();
  const today = db.getDailySummary(userId).date;
  assert.match(await send(userId, "lista de compras"), /pouco histórico/);
  for (const offset of [1, 2, 3]) {
    const day = plusDays(today, -offset);
    const { estimateMealFromText: estimate } = await import("../src/nutritionCatalog.js");
    for (const description of ["comi 2 ovos e 1 banana", "almocei 100 g de arroz, 100 g de feijão e 150 g de peito de frango grelhado"]) {
      const meal = estimate(description);
      db.saveMeal(userId, { description, calories: meal.calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g, consumed_at: `${day} 12:00:00` });
    }
  }
  await send(userId, "comprei 6 ovos");
  const list = await send(userId, "monta minha lista de compras da semana");
  assert.match(list, /🛒 \*Lista de compras\* para 7 dias, pelo que você costuma comer/);
  assert.match(list, /\*🥩 Proteínas\*[\s\S]*☐ Peito de frango grelhado \(cru\): 1,4 kg/);
  assert.match(list, /☐ Ovo cozido: 8 unidades/, "14 ovos menos os 6 da despensa");
  assert.match(list, /\*🍚 Carboidratos e grãos\*[\s\S]*☐ Arroz branco cozido \(cru\): 300 g/);
  assert.match(list, /\*🥦 Frutas, verduras e legumes\*[\s\S]*☐ Banana prata: 7 unidades/);
  assert.match(list, /🧺 Já descontei o que tem na despensa: ovos/);

  // Receita aberta.
  await send(userId, "receita de strogonoff");
  assert.match(await send(userId, "lista de compras da receita"), /para a receita \*Strogonoff fit de frango\*[\s\S]*☐ /);
});

// ---------- MUS-03: volume por músculo e progressão ----------

test("MUS-03: volume semanal por músculo e evolução de um exercício", async () => {
  const userId = newUser();
  assert.match(await send(userId, "volume por músculo"), /Ainda não tenho treinos de musculação/);
  await send(userId, "treinei supino 4x10 com 40 kg, remada 4x10 com 35 kg e agachamento 4x8 com 60 kg");
  await send(userId, "treinei supino 4x8 com 45 kg e rosca direta 3x12 com 12 kg");
  const volume = await send(userId, "como está minha musculação?");
  assert.match(volume, /💪 \*Volume por músculo — últimos 7 dias\*/);
  assert.match(volume, /• \*Peito:\* 8 séries .* ⬇️ abaixo/);
  assert.match(volume, /• \*Bíceps:\* 3 séries/);
  assert.match(volume, /Sem séries na semana: ombros, posteriores, glúteos/);
  const progress = await send(userId, "evolução no supino");
  assert.match(progress, /📈 \*Evolução — supino\*\n\n• \d{2}\/\d{2}: 45 kg × 8 \(1RM est\. 57 kg\)/);
});

// ---------- ACO-05: sequências e conquistas ----------

test("ACO-05: sequência de registros comemora marcos e conquistas mostram o que falta", async () => {
  const { currentStreak, bestStreak } = await import("../src/achievements.js");
  assert.equal(currentStreak(["2026-10-25", "2026-10-26", "2026-10-27"], "2026-10-28"), 3, "conta até ontem se hoje ainda não registrou");
  assert.equal(currentStreak(["2026-10-20", "2026-10-28"], "2026-10-28"), 1);
  assert.equal(bestStreak(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-10"]), 3);

  const { addDays: plusDays } = await import("../src/dates.js");
  const userId = newUser();
  const today = db.getDailySummary(userId).date;
  assert.match(await send(userId, "minhas conquistas"), /Sua sequência começa no primeiro registro/);
  for (const offset of [1, 2]) {
    db.saveMeal(userId, { description: "comi 2 ovos", calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10, consumed_at: `${plusDays(today, -offset)} 08:00:00` });
  }
  const first = await send(userId, "comi 2 ovos");
  assert.match(first, /🔥 \*3 dias seguidos registrando!\* Constância é o que dá resultado/);
  assert.doesNotMatch(await send(userId, "comi 1 banana"), /dias seguidos/, "só no primeiro registro do dia");
  const achievements = await send(userId, "minhas conquistas");
  assert.match(achievements, /🔥 Sequência atual: \*3 dias\* registrando/);
  assert.match(achievements, /✅ 🍽️ Primeiro registro/);
  assert.match(achievements, /▫️ 📅 7 dias seguidos registrando — faltam 4 dias seguidos/);
});

// ---------- NUT-22: fome e saciedade ----------

test("NUT-22: fome registra e sugere lanches que cabem; comeu há pouco sugere água; padrão de fome", async () => {
  const userId = userWithTargets();
  const hungry = await send(userId, "estou morrendo de fome");
  assert.match(hungry, /😋 Fome forte![\s\S]*\*1\.\* Iogurte natural com 1 fruta\n🔥 ~\d+ kcal · 🥩 P \d+ g/);
  await send(userId, "comi 2 ovos");
  assert.match(await send(userId, "estou com fome"), /🤔 Você comeu há \d+ min\. Às vezes é sede/);
  assert.match(await send(userId, "fiquei estufada"), /Anotei que você ficou estufado/);
  assert.match(await send(userId, "qual meu padrão de fome?"), /Ainda tenho poucos registros de fome/);
  await send(userId, "fome 4");
  assert.match(await send(userId, "qual meu padrão de fome?"), /📊 \*Seu padrão de fome — últimos 14 dias\*[\s\S]*Mais frequente: \*/);
  assert.equal(db.getHungerLogs(userId, "2000-01-01").length, 4);
});

// ---------- CONV-04: várias ações numa mensagem ----------

test("CONV-04: refeição, água, treino e peso numa mensagem só", async () => {
  const userId = newUser();
  const reply = await send(userId, "comi 2 ovos e 1 banana, bebi 500 ml de água, corri 5 km em 30 min e me pesei 70 kg");
  assert.match(reply, /💧 \*\+500 ml de água\*/);
  assert.match(reply, /🏃 Registrei o treino: Corrida — 30 min/);
  assert.match(reply, /⚖️ Registrei seu peso: \*70 kg\*/);
  assert.match(reply, /✅ \*Refeição registrada\*[\s\S]*2 ovos e 1 banana/);
  assert.ok(reply.indexOf("Refeição registrada") > reply.indexOf("Registrei o treino"), "refeição por último");
  assert.equal(db.getTodayMeals(userId).length, 1);
  assert.equal(db.getTodayWaterTotal(userId), 500);
  // "comi 2 ovos e 1 banana" sozinho não é dividido; "comi arroz e feijão" também não.
  const single = newUser();
  await send(single, "comi arroz e feijão");
  assert.equal(db.getTodayMeals(single).length, 0, "pergunta a quantidade, não divide");
});

// ---------- CAT-09: alimento desconhecido ----------

test("CAT-09: alimento fora do catálogo pede o rótulo, cadastra e registra; 'estima' segue para o modelo", async () => {
  const userId = newUser();
  const ask = await send(userId, "comi um mochi");
  assert.match(ask, /🔎 Não tenho \*mochi\* no meu catálogo ainda\.[\s\S]*foto da tabela nutricional[\s\S]*responda \*estima\*/);
  assert.equal(db.getTodayMeals(userId).length, 0);
  const saved = await send(userId, "1 unidade de 60 g tem 180 kcal, 3 g de proteína, 22 g de carboidrato e 9 g de gordura");
  assert.match(saved, /✅ Cadastrei Mochi[\s\S]*✅ \*Refeição registrada\*/);
  assert.equal(Math.round(db.getTodayMeals(userId)[0].calories), 180);
  // Depois de cadastrado, é reconhecido direto.
  assert.match(await send(userId, "comi de novo um mochi"), /✅ \*Refeição registrada\*/);

  const other = newUser();
  await send(other, "comi um onigiri");
  const estimate = await send(other, "estima", fakeModel([finalText("Estimei cerca de 120 kcal.")]));
  assert.match(estimate, /Estimei cerca de 120 kcal/);
});

// ---------- VIS-03 / SUP-06: foto do rótulo ----------

test("VIS-03: foto da tabela nutricional cadastra o alimento e registra a refeição pendente", async () => {
  const { processMealPhoto } = await import("../src/ai.js");
  const label = (name) => fakeModel([finalText(JSON.stringify({ items: [], label: { name, portion_g: 40, kcal: 160, protein_g: 4, carbs_g: 26, fat_g: 4.5 }, confidence: "high", notes: "" }))]);
  // Alimento desconhecido esperando o rótulo.
  const userId = newUser();
  await send(userId, "comi um mochi");
  const reply = await processMealPhoto(userId, { imageBase64: "AAAA", mimeType: "image/jpeg" }, { apiClient: label(null) });
  assert.match(reply, /📸 \*Li a tabela nutricional\*\n📋 Por porção \(40 g\): 160 kcal · P 4 g · C 26 g · G 4,5 g/);
  assert.match(reply, /✅ Cadastrei Mochi[\s\S]*✅ \*Refeição registrada\*/);
  assert.equal(Math.round(db.getTodayMeals(userId)[0].calories), 160);

  // Rótulo sem nome e sem pendência: pergunta o nome e cadastra.
  const other = newUser();
  const ask = await processMealPhoto(other, { imageBase64: "AAAA" }, { apiClient: label(null) });
  assert.match(ask, /Qual o \*nome\* desse produto\?/);
  assert.match(await send(other, "barrinha de castanhas"), /✅ Cadastrei Barrinha de castanhas/);
  assert.match(await send(other, "comi 1 barrinha de castanhas"), /✅ \*Refeição registrada\*/);
});

test("CAT-09/NUT-02: alimento principal desconhecido com sabor conhecido não vira só o sabor", async () => {
  const userId = newUser();
  assert.match(await send(userId, "comi um mochi de morango"), /🔎 Não tenho \*mochi de morango\* no meu catálogo/);
  const known = newUser();
  assert.match(await send(known, "comi uma fatia de bolo de chocolate"), /Refeição registrada/, "bolo existe no catálogo");
  assert.doesNotMatch(await send(known, "comi 1 copo de suco de laranja"), /Não tenho/, "medida + 'de' não conta");
});

// ---------- CRP-05: análise do sono ----------

test("CRP-05: análise do sono com média, noites curtas e cruzamento sem causalidade", async () => {
  const { buildSleepReport, isSleepQuery } = await import("../src/sleep.js");
  assert.equal(isSleepQuery("como está meu sono?"), true);
  assert.equal(isSleepQuery("dormi 7h"), false);
  const report = buildSleepReport({
    sleeps: [{ hours: 5.5, date: "2026-10-20" }, { hours: 6, date: "2026-10-21" }, { hours: 8, date: "2026-10-22" }, { hours: 7.5, date: "2026-10-23" }],
    checkins: [{ date: "2026-10-20", energy: 2 }, { date: "2026-10-21", energy: 2 }, { date: "2026-10-22", energy: 4 }, { date: "2026-10-23", energy: 5 }],
    calories: [{ date: "2026-10-20", calories: 2400 }, { date: "2026-10-21", calories: 2300 }, { date: "2026-10-22", calories: 1800 }, { date: "2026-10-23", calories: 1900 }]
  });
  assert.match(report, /• Média: \*6,8 h\* por noite \(4 noites registradas\)/);
  assert.match(report, /• Noites com menos de 7 h: 2 de 4/);
  assert.match(report, /energia no check-in foi em média 2\/5, contra 4,5\/5/);
  assert.match(report, /comeu em média 500 kcal a mais/);
  assert.match(report, /Coincidência nos seus dados, não prova de causa/);
  const userId = newUser();
  assert.match(await send(userId, "como está meu sono?"), /Ainda tenho poucas noites registradas/);
});

test("NUT-02: sabor que não está no catálogo pergunta e oferece o parecido", async () => {
  const userId = newUser();
  const ask = await send(userId, "comi um pastel de queijo");
  assert.match(ask, /🔎 Não tenho \*pastel de queijo\* no meu catálogo; o mais parecido é \*Pastel de carne\*/);
  assert.equal(db.getTodayMeals(userId).length, 0);
  assert.match(await send(userId, "usa esse"), /✅ \*Refeição registrada\*/);
  assert.equal(db.getTodayMeals(userId).length, 1);
  const other = newUser();
  assert.match(await send(other, "comi um pastel de belém"), /Não tenho \*pastel de belém\*/);
  assert.match(await send(newUser(), "comi uma coxinha de frango"), /Refeição registrada/, "sabor do catálogo registra direto");
  assert.match(await send(newUser(), "comi um pastel"), /Refeição registrada/, "sem sabor usa o padrão");
});

// ---------- ACO-02: passos ----------

test("ACO-02: passos do dia, meta de passos e passos no resumo", async () => {
  const userId = newUser();
  assert.match(await send(userId, "andei 6.000 passos"), /👟 \*Passos:\* 6\.000 de 8\.000 .* 75%\nFaltam 2\.000 passos/);
  assert.match(await send(userId, "minha meta de passos é 10000"), /Meta de passos definida: \*10\.000 por dia\*/);
  assert.match(await send(userId, "dei 10 mil passos"), /✅ Meta de passos batida hoje!/);
  assert.match(await send(userId, "resumo do dia"), /👟 \*Passos:\* 10\.000 de 10\.000/);
});

test("COR-02: 'minhas zonas' mostra as faixas de bpm", async () => {
  const userId = newUser();
  assert.match(await send(userId, "minhas zonas de frequência cardíaca"), /preciso da sua idade/);
  db.updateUserProfile(userId, { age_years: 30 });
  assert.match(await send(userId, "minhas zonas"), /FC máx\. estimada: 187 bpm[\s\S]*\*Z2\* base aeróbica: 112–131 bpm/);
});

// ---------- REC-06: receita própria ----------

test("REC-06: cadastrar receita própria calcula a porção e registra pelo nome", async () => {
  const userId = newUser();
  const saved = await send(userId, "cadastrar receita: bolo de banana fit — 2 bananas, 2 ovos e 50 g de aveia; rende 4 porções");
  assert.match(saved, /🍳 \*Receita salva: Bolo de banana fit\*\nRende 4 porções de ~\d+ g/);
  assert.match(saved, /• Banana prata — 180 g\n• Ovo cozido — 100 g\n• Aveia em flocos — 50 g/);
  assert.match(saved, /\*Por porção:\* 🔥 \d+ kcal/);
  const perPortion = Number(saved.match(/\*Por porção:\* 🔥 (\d+) kcal/)[1]);
  assert.match(await send(userId, "comi 1 porção de bolo de banana fit"), /✅ \*Refeição registrada\*/);
  assert.ok(Math.abs(db.getTodayMeals(userId)[0].calories - perPortion) <= 2);
  assert.match(await send(userId, "minhas receitas"), /📒 \*Suas receitas\*\n\n• \*Bolo de banana fit\* — porção de \d+ g/);
});

test("DSP-03: receitas com a despensa priorizam o que vence logo", async () => {
  const userId = newUser();
  const today = db.getDailySummary(userId).date;
  const { addDays: plusDays } = await import("../src/dates.js");
  const soon = plusDays(today, 2);
  await send(userId, "comprei 1 kg de frango e 12 ovos");
  await send(userId, `comprei 1 kg de abobrinha, vence ${soon.slice(8, 10)}/${soon.slice(5, 7)}`);
  const list = await send(userId, "receita com o que tenho em casa");
  assert.match(list, /\*1\. .+\*\n⏱️ .+\n🧺 Usa \d+ ite[mn]s? da sua despensa\n⏰ Usa o que vence logo: abobrinha/);
  const expiring = await send(userId, "receita com o que vai vencer");
  assert.match(expiring, /⏰ Usa o que vence logo: abobrinha/);
  assert.doesNotMatch(expiring, /Panqueca|Smoothie/);
});
