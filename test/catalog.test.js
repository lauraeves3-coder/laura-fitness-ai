// Testes do catálogo nutricional. Sem API, sem banco.
// Testes com `todo` documentam defeitos confirmados na auditoria (ver AUDITORIA-NUTRICAO.md);
// ao corrigir um defeito, remova o `todo` correspondente.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOOD_CATALOG, EXPANDED_TEMPLATES, estimateMealFromText,
  findFoodCandidates, getMissingMealQuantities
} from "../src/nutritionCatalog.js";

const ids = (estimate) => (estimate?.matched_items || []).map((item) => item.id);
const kcal = (message) => estimateMealFromText(message)?.calories;

// ---------- Integridade ----------

test("catálogo: IDs únicos", () => {
  const all = FOOD_CATALOG.map((item) => item.id);
  assert.equal(new Set(all).size, all.length);
});

test("catálogo: campos nutricionais numéricos e não negativos", () => {
  for (const item of FOOD_CATALOG) {
    for (const key of ["kcal", "protein", "carbs", "fat", "default_g"]) {
      assert.ok(Number.isFinite(item[key]) && item[key] >= 0, `${item.id}.${key}`);
    }
  }
});

test("catálogo: energia coerente com macros (tolerância 25% ou 40 kcal)", () => {
  for (const item of FOOD_CATALOG) {
    const fromMacros = item.protein * 4 + item.carbs * 4 + item.fat * 9;
    const diff = Math.abs(fromMacros - item.kcal);
    assert.ok(diff <= Math.max(40, item.kcal * 0.25), `${item.id}: ${item.kcal} vs ${Math.round(fromMacros)}`);
  }
});

test("modelos de refeição: nenhum componente descartado silenciosamente", () => {
  const templates = Object.values(EXPANDED_TEMPLATES).flat();
  assert.ok(templates.length > 0);
  for (const template of templates) {
    assert.ok(Array.isArray(template.foods) && template.foods.length > 0, template.name);
  }
});

test("NC-07: nenhum alias compartilhado entre alimentos diferentes", () => {
  const owners = new Map();
  for (const item of FOOD_CATALOG) {
    for (const alias of item.aliases || []) {
      const key = alias.toLowerCase();
      assert.ok(!owners.has(key) || owners.get(key) === item.id, `'${alias}': ${owners.get(key)} e ${item.id}`);
      owners.set(key, item.id);
    }
  }
});

// ---------- Regressões que já funcionam (não podem quebrar) ----------

test("regressão: 'Comi whey' = 123 kcal (30 g)", () => assert.equal(kcal("Comi whey"), 123));
test("regressão: 'Comi duas bananas' = 176 kcal", () => assert.equal(kcal("Comi duas bananas"), 176));
test("regressão: 'Comi 200 g de arroz' = 260 kcal", () => assert.equal(kcal("Comi 200 g de arroz"), 260));
test("regressão: 'pão de queijo' não vira queijo", () => assert.deepEqual(ids(estimateMealFromText("comi um pão de queijo")), ["pao-de-queijo"]));
test("regressão: '2 ovos e banana' contabiliza 100 g de ovo", () => {
  const ovo = estimateMealFromText("comi 2 ovos e banana").matched_items.find((item) => item.id === "ovo-inteiro");
  assert.equal(ovo.grams, 100);
});
test("regressão: 300 ml de leite", () => {
  assert.equal(estimateMealFromText("bebi 300 ml de leite").matched_items[0].grams, 300);
});

// ---------- NC-01: alias dentro de palavras ----------

test("NC-01: 'novo' não contém ovo; 'casa' não contém asa", () => {
  assert.deepEqual(findFoodCandidates("Tenho um novo whey em casa").map((item) => item.id), ["whey"]);
  assert.equal(kcal("Comi whey novo"), 123);
});

// ---------- NC-05: várias ocorrências ----------

test("NC-05: 'uma banana e depois mais uma banana' = 2 bananas", () => {
  assert.equal(kcal("Comi uma banana e depois mais uma banana"), 176);
});
test("NC-05: 'uma banana e depois mais duas bananas' = 3 bananas (270 g)", () => {
  assert.equal(kcal("Comi uma banana e depois mais duas bananas"), 265);
});

// ---------- NC-07: farofa ----------

test("NC-07: 'farofa temperada' escolhe farofa-pronta", () => {
  assert.deepEqual(ids(estimateMealFromText("Comi farofa temperada")), ["farofa-pronta"]);
});
test("NC-05: menção repetida sem quantidade não duplica", () => {
  assert.equal(estimateMealFromText("comi arroz, o arroz estava frio").matched_items[0].grams, 100);
});
test("NC-07: 'farofa' sozinha é a farofa pronta", () => {
  assert.deepEqual(ids(estimateMealFromText("comi farofa")), ["farofa-pronta"]);
});
test("NC-01: limites de palavra não perdem plurais e acentos", () => {
  assert.deepEqual(ids(estimateMealFromText("comi 2 ovos, 3 bananas e feijão")), ["ovo-inteiro", "banana-prata", "feijao-carioca-cozido"]);
  assert.deepEqual(ids(estimateMealFromText("comi pão de queijo e peito de frango")), ["pao-de-queijo", "peito-de-frango-grelhado"]);
});
test("regressão: 'farinha de mandioca' continua farinha", () => {
  assert.deepEqual(ids(estimateMealFromText("comi farinha de mandioca")), ["farinha-de-mandioca"]);
});

// ---------- NC-09: frações e medidas caseiras ----------

const grams = (message) => estimateMealFromText(message).matched_items[0].grams;

test("NC-09: '1/2 banana' = 45 g, não 180 g", () => assert.equal(grams("comi 1/2 banana"), 45));
test("NC-09: 'meia banana' = 45 g", () => assert.equal(grams("comi meia banana"), 45));
test("NC-09: '1 1/2 banana', '½ banana' e '1 e meia banana'", () => {
  assert.equal(grams("comi 1 1/2 banana"), 135);
  assert.equal(grams("comi ½ banana"), 45);
  assert.equal(grams("comi 1 e meia banana"), 135);
});
test("NC-09: números por extenso com acento", () => assert.equal(grams("comi três ovos"), 150));
test("NC-09: 'algum' não é lido como 'um'", () => {
  assert.deepEqual(getMissingMealQuantities("comi algum arroz").map((item) => item.id), ["arroz-branco-cozido"]);
});
test("NC-09: kg e litro", () => {
  assert.equal(grams("comi 1,5 kg de melancia"), 1500);
  assert.equal(grams("bebi 1 litro de suco de laranja"), 1000);
});
test("NC-06: 'uma colher de sopa de azeite' é quantidade explícita", () => {
  assert.deepEqual(getMissingMealQuantities("comi uma colher de sopa de azeite"), []);
  assert.equal(grams("comi uma colher de sopa de azeite"), 15);
});
test("NC-06: colher de sopa, sobremesa, chá e 'c. sopa'", () => {
  assert.equal(grams("comi 2 colheres de sopa de aveia"), 30);
  assert.equal(grams("comi 2 c. sopa de aveia"), 30);
  assert.equal(grams("comi 1 colher de chá de aveia"), 5);
});
test("NC-06: medida caseira genérica é marcada como aproximação", () => {
  const estimate = estimateMealFromText("tomei um copo de leite");
  assert.equal(estimate.matched_items[0].approximate_quantity, true);
  assert.deepEqual(estimate.matched_items[0].household_measures, ["copo"]);
  assert.equal(estimateMealFromText("bebi 200 ml de leite").matched_items[0].approximate_quantity, undefined);
});

// ---------- NC-10: negação e preparações ----------

test("NC-10: 'não comi arroz' não registra arroz", { todo: "NC-10" }, () => {
  assert.ok(!ids(estimateMealFromText("não comi arroz, comi batata")).includes("arroz-branco-cozido"));
});
test("NC-10: 'batata' sem preparo não vira batata frita", { todo: "NC-10" }, () => {
  assert.ok(!ids(estimateMealFromText("comi batata")).includes("batata-frita"));
});

// ---------- NC-11: cobertura de plurais / itens comuns ----------

test("NC-11: '2 pães franceses' é reconhecido", () => {
  assert.ok(ids(estimateMealFromText("comi 2 pães franceses")).includes("pao-frances"));
});
test("NC-11: 'bife' é reconhecido em prato feito", { todo: "NC-11" }, () => {
  assert.equal(ids(estimateMealFromText("comi um prato de arroz com feijão e bife")).length, 3);
});

// ---------- NC-04: confiança ----------

test("NC-04: confiança só é 'high' com fonte verificada", () => {
  const estimate = estimateMealFromText("comi farinha de mandioca");
  assert.notEqual(estimate.confidence, "high");
});
