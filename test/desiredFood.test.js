// Alimentos desejados ("quero pizza", "quero sushi"): detecção, porções e opções.
// Testes com `todo` documentam defeitos confirmados (ver AUDITORIA-NUTRICAO.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ai } from "./helpers/aiPure.js";
import { generateDesiredFoodOptions } from "../src/nutrition.js";
import { FOOD_CATALOG, estimateMealFromText, generateFreeMealOptions } from "../src/nutritionCatalog.js";
import { findFoodNames, JAPANESE_FILLINGS } from "../src/foodMatching.js";

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

// Reproduz a chamada de src/ai.js para comida japonesa.
const japaneseOptions = (message) => generateDesiredFoodOptions({
  desiredFood: desired(message),
  calorieBudget: 900,
  requestedServings: ai.detectRequestedServings(message, desired(message)),
  preferredComposition: ai.detectDesiredComposition(message, desired(message)),
  japaneseSubtype: ai.detectRequestedJapaneseSubtype(message),
  fillings: findFoodNames(message, JAPANESE_FILLINGS)
}).map((option) => option.name);

test("AI-02: 'sushi de salmão' só oferece peças de salmão", () => {
  const names = japaneseOptions("quero sushi de salmão");
  assert.ok(names.length > 0);
  for (const name of names) assert.match(name, /salmão/i);
  for (const name of names) assert.doesNotMatch(name, /temaki|sashimi|yakisoba/i);
});
test("AI-02: '8 peças de sushi' não vira 8 temakis", () => {
  const names = japaneseOptions("quero 8 peças de sushi");
  assert.ok(names.some((name) => /8 peças/.test(name)));
  for (const name of names) assert.doesNotMatch(name, /temaki|yakisoba|guioza|tempurá|sashimi/i);
});
test("AI-02: '8 peças de comida japonesa' também são peças de sushi", () => {
  for (const name of japaneseOptions("quero 8 peças de comida japonesa")) assert.doesNotMatch(name, /temaki|yakisoba/i);
});
test("AI-02: subtipo preservado (sashimi, temaki, hot roll)", () => {
  assert.deepEqual(japaneseOptions("quero 10 sashimis"), ["Sashimi de salmão — 1 fatia", "Sashimi de salmão — 10 fatias"]);
  for (const name of japaneseOptions("quero 3 temakis")) assert.match(name, /^Temaki/);
  assert.deepEqual(japaneseOptions("quero 4 hot rolls"), ["Hot Philadelphia (Hot Roll) — 1 peça", "Hot Philadelphia (Hot Roll) — 4 peças"]);
});
test("AI-02: recheio inexistente no subtipo não troca de preparação", () => {
  assert.deepEqual(japaneseOptions("quero sushi de kani"), []);
});
test("AI-02: 'comida japonesa' sem subtipo mantém todas as categorias", () => {
  assert.equal(ai.detectRequestedJapaneseSubtype("quero comida japonesa"), null);
  assert.equal(japaneseOptions("quero comida japonesa").length, 3);
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
const yakisobaKcal = (grams) => Math.round(FOOD_CATALOG.find((food) => food.id === "yakisoba-brasileiro").kcal * grams / 100);
test("AI-03: '300 g de yakisoba' = 1 porção de 300 g", () => {
  assert.deepEqual(optionsFor("quero 300 g de yakisoba", "japonesa"), [`Yakisoba brasileiro — 300 g ${yakisobaKcal(300)}`]);
});
test("AI-03: '150 g de yakisoba' oferece meia porção", () => {
  assert.ok(optionsFor("quero 150g de yakisoba", "japonesa").includes(`Yakisoba brasileiro — 150 g ${yakisobaKcal(150)}`));
});

test("NC-02: sugestão de pizza por fatia = registro de 1 fatia", () => {
  const options = generateDesiredFoodOptions({ desiredFood: "pizza", calorieBudget: 5000, limit: 50, requestedServings: 1 });
  for (const [name, message] of [["Pizza de calabresa", "comi 1 fatia de pizza de calabresa"], ["Pizza de muçarela", "comi 1 fatia de pizza de muçarela"]]) {
    const option = options.find((entry) => entry.name.startsWith(name));
    assert.equal(option.calories, estimateMealFromText(message).calories, name);
  }
});

test("CAT-02: sugestões de comida japonesa usam os valores do catálogo por peça", () => {
  const perPiece = (id) => { const food = FOOD_CATALOG.find((entry) => entry.id === id); return Math.round(food.kcal * food.default_g / 100 * 10) / 10; };
  const options = generateDesiredFoodOptions({ desiredFood: "japonesa", calorieBudget: 5000, limit: 50, requestedServings: 1 });
  const kcalOf = (name) => options.find((option) => option.name.startsWith(name))?.calories;
  assert.equal(kcalOf("Hossomaki de salmão"), Math.round(perPiece("hossomaki-salmao")));
  assert.equal(kcalOf("Uramaki Califórnia"), Math.round(perPiece("uramaki-california")));
  assert.equal(kcalOf("Uramaki de salmão"), Math.round(perPiece("uramaki-salmao-pepino")));
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

test("NC-02: fatia de sashimi igual no catálogo e no gerador", () => {
  const catalog = FOOD_CATALOG.find((item) => item.id === "sashimi-salmao");
  const perSlice = catalog.kcal * catalog.default_g / 100;
  const [option] = generateDesiredFoodOptions({ desiredFood: "japonesa", calorieBudget: 900, preferredComposition: "japonesa-sashimi" });
  assert.ok(Math.abs(option.calories - perSlice) <= 1, `${option.calories} vs ${perSlice}`);
  assert.equal(estimateMealFromText("comi 1 sashimi de salmão").calories, option.calories);
});

// ---------- NUT-20: refeições livres com ingredientes ----------

test("NUT-20: refeição livre com composição usa os valores do catálogo", () => {
  const options = generateFreeMealOptions({ remainingCalories: 2000, limit: 50 });
  const byKey = (key) => options.find((option) => option.key === key);
  assert.equal(byKey("pizza-mucarela-2").calories, Math.round(estimateMealFromText("comi 2 fatias de pizza de muçarela").calories));
  assert.deepEqual(byKey("feijoada-completa").ingredients.map(({ id, grams }) => [id, grams]),
    [["feijoada", 300], ["arroz-branco-cozido", 150], ["farofa-pronta", 40]]);
  assert.equal(byKey("feijoada-completa").source, "catalog");
  assert.equal(byKey("japones-combinado-20").source, "curated_estimate");
  assert.equal(byKey("japones-combinado-20").ingredients, undefined);
});
