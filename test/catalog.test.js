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
// Valores derivados do catálogo: o teste verifica a contagem/quantidade, não um número
// fixo que muda quando a fonte nutricional é atualizada.
const kcalFor = (id, grams) => Math.round(FOOD_CATALOG.find((food) => food.id === id).kcal * grams / 100);

test("regressão: 'Comi duas bananas' = 2 × 90 g", () => assert.equal(kcal("Comi duas bananas"), kcalFor("banana-prata", 180)));
test("regressão: 'Comi 200 g de arroz' = 200 g", () => assert.equal(kcal("Comi 200 g de arroz"), kcalFor("arroz-branco-cozido", 200)));
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
  assert.equal(kcal("Comi uma banana e depois mais uma banana"), kcalFor("banana-prata", 180));
});
test("NC-05: 'uma banana e depois mais duas bananas' = 3 bananas (270 g)", () => {
  assert.equal(kcal("Comi uma banana e depois mais duas bananas"), kcalFor("banana-prata", 270));
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

test("NC-10: 'não comi arroz' não registra arroz", () => {
  const estimate = estimateMealFromText("não comi arroz, comi batata cozida");
  assert.deepEqual(ids(estimate), ["batata-cozida"]);
  assert.deepEqual(estimate.negated_items, ["Arroz branco cozido"]);
});
test("NC-10: negação cobre a lista até a próxima afirmação", () => {
  assert.deepEqual(ids(estimateMealFromText("não comi arroz nem feijão, só frango")), ["peito-de-frango-grelhado"]);
  assert.equal(estimateMealFromText("não comi arroz, feijão e carne"), null);
});
test("NC-10: 'sem X' não conta X e não quebra itens compostos", () => {
  assert.deepEqual(ids(estimateMealFromText("comi arroz sem feijão")), ["arroz-branco-cozido"]);
  assert.deepEqual(ids(estimateMealFromText("tomei café sem açúcar")), ["cafe-sem-acucar"]);
});
test("NC-10: 'batata' sem preparo não vira batata frita e pede esclarecimento", () => {
  const estimate = estimateMealFromText("comi batata");
  assert.ok(!ids(estimate).includes("batata-frita"));
  assert.deepEqual(estimate.needs_clarification.map(({ term }) => term), ["batata"]);
  assert.deepEqual(ids(estimateMealFromText("comi batata frita")), ["batata-frita"]);
  assert.deepEqual(ids(estimateMealFromText("comi 2 batatas cozidas")), ["batata-cozida"]);
});

// ---------- NC-11: cobertura de plurais / itens comuns ----------

test("NC-11: '2 pães franceses' é reconhecido", () => {
  assert.ok(ids(estimateMealFromText("comi 2 pães franceses")).includes("pao-frances"));
});
test("NC-11: 'bife' é reconhecido em prato feito e pede o corte", () => {
  const estimate = estimateMealFromText("comi um prato de arroz com feijão e bife");
  assert.deepEqual(ids(estimate), ["arroz-branco-cozido", "feijao-carioca-cozido"]);
  assert.deepEqual(estimate.needs_clarification[0].options.map(({ id }) => id),
    ["patinho-grelhado", "alcatra-grelhada", "bife-acebolado"]);
  assert.deepEqual(ids(estimateMealFromText("comi bife de patinho")), ["patinho-grelhado"]);
});

// ---------- NC-04: confiança ----------

test("NC-04: confiança só é 'high' com fonte verificada", () => {
  const estimate = estimateMealFromText("comi farinha de mandioca");
  assert.notEqual(estimate.confidence, "high");
});

// ---------- CAT-03 / NUT-08 / CAT-06: cortes, preparos e fontes (TBCA, 23/10/2026) ----------

const item = (id) => FOOD_CATALOG.find((food) => food.id === id);
const firstId = (message) => ids(estimateMealFromText(message))[0];

test("CAT-06: itens com referência apontam para um código TBCA e data de consulta", () => {
  const referenced = FOOD_CATALOG.filter((food) => food.reference);
  assert.ok(referenced.length >= 60, String(referenced.length));
  for (const food of referenced) {
    assert.match(food.reference, /^TBCA BRC\d{4}[A-Z]\b.*consulta 23\/10\/2026/, food.id);
    assert.equal(food.source, "tbca_verified", food.id);
  }
});

test("CAT-03: cortes bovinos com valores da TBCA", () => {
  const expected = {
    "patinho-grelhado": [211, 36.0, 7.5], "patinho-cru": [114, 21.1, 3.33], "alcatra-grelhada": [236, 32.6, 11.7],
    "contrafile-grelhado": [187, 35.9, 4.49], "picanha-grelhada": [281, 26.3, 19.5], "cupim-assado": [321, 28.2, 23.1],
    "musculo-cozido": [183, 30.8, 6.6], "maminha-grelhada": [141, 30.7, 2.04], "carne-seca-cozida": [259, 37.4, 12.2]
  };
  for (const [id, [kcal, protein, fat]] of Object.entries(expected)) {
    assert.deepEqual([item(id).kcal, item(id).protein, item(id).fat], [kcal, protein, fat], id);
  }
});

test("CAT-03: cortes reconhecidos pelo nome", () => {
  for (const [message, id] of [
    ["comi 150 g de patinho", "patinho-grelhado"], ["comi 150 g de cupim", "cupim-assado"],
    ["comi 150 g de picanha sem gordura", "picanha-sem-gordura-grelhada"], ["comi 100 g de carne seca", "carne-seca-cozida"],
    ["comi 150 g de coxão duro", "coxao-duro-cozido"], ["comi 150 g de miolo de alcatra", "alcatra-grelhada"]
  ]) assert.equal(firstId(message), id, message);
});

test("NUT-08: o preparo citado escolhe o item certo", () => {
  for (const [message, id] of [
    ["comi 150 g de patinho frito", "patinho-frito"], ["comi 150 g de patinho cru", "patinho-cru"],
    ["comi 150 g de bife de patinho frito", "patinho-frito"], ["comi 150 g de alcatra frita", "alcatra-frita"],
    ["comi 150 g de frango cozido", "peito-de-frango-cozido"], ["comi 150 g de frango frito", "peito-de-frango-frito"],
    ["comi 150 g de peito de frango assado", "peito-de-frango-assado"], ["comi 150 g de tilápia cozida", "tilapia-cozida"],
    ["comi 2 ovos fritos", "ovo-frito"], ["comi 2 ovos mexidos", "ovo-mexido"], ["comi 150 g de mandioca frita", "mandioca-frita"],
    ["comi 150 g de batata cozida", "batata-cozida"], ["comi 100 g de fígado frito", "figado-bovino-frito"]
  ]) assert.equal(firstId(message), id, message);
});

test("NUT-08: sem preparo citado, vale o preparo padrão do item (DEC-13)", () => {
  assert.equal(firstId("comi 150 g de frango"), "peito-de-frango-grelhado");
  assert.equal(firstId("comi 2 ovos"), "ovo-inteiro");
  assert.equal(item("ovo-inteiro").name, "Ovo cozido");
});

test("NUT-08: preparo muda as calorias (fritura > grelhado > cru)", () => {
  const kcal = (message) => estimateMealFromText(message).calories;
  assert.ok(kcal("comi 100 g de patinho frito") > kcal("comi 100 g de patinho grelhado"));
  assert.ok(kcal("comi 100 g de patinho grelhado") > kcal("comi 100 g de patinho cru"));
  assert.equal(kcal("comi 100 g de batata cozida"), 52);
});

test("itens comuns: açúcar e mel com valores da TBCA", () => {
  assert.equal(firstId("coloquei 10 g de açúcar"), "acucar-refinado");
  assert.equal(firstId("comi 15 g de mel"), "mel");
  assert.equal(estimateMealFromText("comi 10 g de açúcar mascavo").calories, Math.round(382 * 0.1));
  assert.equal(estimateMealFromText("comi 15 g de mel").calories, Math.round(324 * 0.15));
});

test("CAT-06: docs/fontes-tbca.md está em sincronia com o catálogo", async () => {
  const { readFileSync } = await import("node:fs");
  const doc = readFileSync(new URL("../docs/fontes-tbca.md", import.meta.url), "utf8");
  for (const food of FOOD_CATALOG.filter((entry) => entry.reference)) {
    assert.match(doc, new RegExp(`\| ${food.id} \| [^|]+\| ${food.reference.match(/BRC\d{4}[A-Z]/)[0]} \| ${food.kcal} \|`), food.id);
  }
});

// ---------- CAT-11 / CAT-12: modelos de refeição ----------

test("CAT-12: nenhum componente de modelo foi descartado (id inexistente ou gramagem inválida)", async () => {
  const { TEMPLATE_ISSUES } = await import("../src/nutritionCatalog.js");
  assert.deepEqual(TEMPLATE_ISSUES, []);
});

test("CAT-11: nenhum período tem dois modelos com a mesma composição", () => {
  for (const [period, templates] of Object.entries(EXPANDED_TEMPLATES)) {
    const seen = new Map();
    for (const template of templates) {
      const key = template.foods.map((food, index) => `${food}@${template.portions[index]}`).sort().join("+");
      assert.ok(!seen.has(key), `${period}: "${template.name}" repete "${seen.get(key)}"`);
      seen.set(key, template.name);
    }
  }
});

test("CAT-11: nome do modelo bate com o preparo usado", () => {
  const scrambled = EXPANDED_TEMPLATES["lanche da tarde"].find((template) => template.name === "Ovos mexidos com pão");
  assert.ok(scrambled.foods.includes("Ovo mexido"));
});
