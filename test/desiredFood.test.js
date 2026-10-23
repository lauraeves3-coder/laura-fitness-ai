// Alimentos desejados ("quero pizza", "quero sushi"): detecção, porções e opções.
// Testes com `todo` documentam defeitos confirmados (ver AUDITORIA-NUTRICAO.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ai } from "./helpers/aiPure.js";
import { generateDesiredFoodOptions } from "../src/nutrition.js";
import { FOOD_CATALOG } from "../src/nutritionCatalog.js";

const desired = (message) => ai.detectDesiredFood(message);

// ---------- Detecção da categoria ----------

test("regressão: 'quero pizza' = pizza; 'quero whey' não é craving", () => {
  assert.equal(desired("quero pizza"), "pizza");
  assert.equal(desired("quero whey"), "");
  assert.equal(desired("o que posso comer?"), "");
});
test("regressão: temaki de salmão reconhece a composição", () => {
  assert.equal(ai.detectDesiredComposition("quero temaki de salmão", desired("quero temaki de salmão")), "japonesa-temaki-salmao");
});
test("AI-07: 'pizza doce de chocolate' é pizza", () => {
  assert.equal(desired("quero pizza doce de chocolate"), "pizza");
});
test("AI-07: 'macarrão à bolonhesa' é massa, não bolo", () => {
  assert.equal(desired("quero macarrão à bolonhesa"), "massa");
});
test("AI-07: 'bolo de chocolate' é bolo", () => {
  assert.equal(desired("quero um bolo de chocolate"), "bolo");
});

// ---------- AI-02: sushi ----------

test("AI-02: 'sushi de salmão' tem composição alcançável", { todo: "AI-02 variantes de sushi inalcançáveis" }, () => {
  const food = desired("quero sushi de salmão");
  assert.ok(ai.detectDesiredComposition("quero sushi de salmão", food));
});
test("AI-02: '8 peças de sushi' não vira 8 temakis", { todo: "AI-02/AI-03" }, () => {
  const food = desired("quero 8 peças de sushi");
  const servings = ai.detectRequestedServings("quero 8 peças de sushi", food);
  const options = generateDesiredFoodOptions({ desiredFood: food, calorieBudget: 900, requestedServings: servings });
  for (const option of options) {
    assert.ok(!/temaki/i.test(option.name) || option.calories < 400, option.name);
  }
});

// ---------- AI-03: porções ----------

test("regressão: '3 temakis' e 'tres temakis' = 3", () => {
  assert.equal(ai.detectRequestedServings("quero 3 temakis", "japonesa"), 3);
  assert.equal(ai.detectRequestedServings("quero tres temakis", "japonesa"), 3);
});
const optionsFor = (message, desiredFood) => generateDesiredFoodOptions({
  desiredFood,
  calorieBudget: 900,
  requestedServings: ai.detectRequestedServings(message, desiredFood),
  requestedGrams: ai.detectRequestedGrams(message),
  preferredComposition: ai.detectDesiredComposition(message, desiredFood)
}).map((option) => `${option.name} ${option.calories}`);

test("regressão: 40 g de chocolate = 2 porções de 20 g", () => {
  assert.ok(optionsFor("quero 40 g de chocolate", "chocolate").includes("Chocolate amargo — 40 g 240"));
});
test("AI-03: 'três temakis' com acento = 3", () => {
  assert.equal(ai.detectRequestedServings("quero três temakis", "japonesa"), 3);
});
test("AI-03: 'duas fatias de pizza' = 2", () => {
  assert.equal(ai.detectRequestedServings("quero duas fatias de pizza", "pizza"), 2);
});
test("AI-03: 'meia porção' e '1 e meia fatia'", () => {
  assert.equal(ai.detectRequestedServings("quero meia porção de batata frita", "batata frita"), 0.5);
  assert.equal(ai.detectRequestedServings("quero 1 e meia fatia de bolo", "bolo"), 1.5);
});
test("AI-03: '300 g de yakisoba' = 1 porção de 300 g", () => {
  assert.deepEqual(optionsFor("quero 300 g de yakisoba", "japonesa"), ["Yakisoba brasileiro — 300 g 366"]);
});
test("AI-03: '150 g de yakisoba' oferece meia porção", () => {
  assert.ok(optionsFor("quero 150g de yakisoba", "japonesa").includes("Yakisoba brasileiro — 150 g 183"));
});
test("AI-03: gramas sem peso de referência não são convertidos", () => {
  assert.ok(!optionsFor("quero 200 g de pizza", "pizza").some((option) => /200 g/.test(option)));
});
test("AI-03: gramas em kg", () => {
  assert.equal(ai.detectRequestedGrams("quero 1,5 kg de batata frita"), 1500);
  assert.equal(ai.detectRequestedGrams("quero 2 goiabas"), null);
});

// ---------- AI-01: restrição específica x categoria ----------
// O gerador já trata isso corretamente; o bloqueio indevido está na pré-checagem inline
// de src/ai.js (`item.includes(desiredFood) || desiredFood.includes(item)`), que ainda
// não é testável isoladamente. Este teste protege o gerador.

test("AI-01: restrição 'pizza doce' não remove pizzas salgadas", () => {
  const options = generateDesiredFoodOptions({ desiredFood: "pizza", calorieBudget: 900, dislikes: ["pizza doce"], limit: 50 });
  assert.ok(options.some((option) => /calabresa|muçarela/i.test(option.name)));
});
test("EX-05: restrição curta 'sal' não remove salmão", () => {
  const options = generateDesiredFoodOptions({ desiredFood: "japonesa", calorieBudget: 900, dislikes: ["sal"], limit: 50 });
  assert.ok(options.some((option) => /salmão/i.test(option.name)));
});

// ---------- NC-02: sashimi ----------

test("NC-02: fatia de sashimi igual no catálogo e no gerador", { todo: "NC-02" }, () => {
  const catalog = FOOD_CATALOG.find((item) => item.id === "sashimi-salmao");
  const perSlice = catalog.kcal * catalog.default_g / 100;
  const [option] = generateDesiredFoodOptions({ desiredFood: "japonesa", calorieBudget: 900, preferredComposition: "japonesa-sashimi" });
  assert.ok(Math.abs(option.calories - perSlice) <= 2, `${option.calories} vs ${perSlice}`);
});
