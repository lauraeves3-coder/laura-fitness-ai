// Testes do catálogo nutricional. Sem API, sem banco.
// Testes com `todo` documentam defeitos confirmados na auditoria (ver AUDITORIA-NUTRICAO.md);
// ao corrigir um defeito, remova o `todo` correspondente.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOOD_CATALOG, EXPANDED_TEMPLATES, estimateMealFromText,
  findFoodCandidates, getMissingMealQuantities, getQuantityQuestions
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
  assert.equal(grams("comi uma colher de sopa de azeite"), 8); // TBCA: colher de sopa rasa
});
test("NC-06: colher de sopa, sobremesa, chá e 'c. sopa'", () => {
  assert.equal(grams("comi 2 colheres de sopa de aveia"), 30);
  assert.equal(grams("comi 2 c. sopa de aveia"), 30);
  assert.equal(grams("comi 1 colher de chá de aveia"), 4);
});
test("NUT-06: medida caseira do próprio alimento (TBCA) vence a genérica", () => {
  assert.equal(grams("comi 3 colheres de sopa de arroz"), 60);
  assert.equal(grams("comi 2 conchas de feijão"), 280);
  assert.equal(grams("comi 1 concha rasa de feijão"), 80);
  assert.equal(grams("comi 1 colher de sopa rasa de açúcar"), 15);
  assert.equal(grams("comi 2 colheres de servir de arroz"), 110);
  assert.equal(grams("comi 2 escumadeiras de macarrão"), 220);
  assert.equal(grams("comi 2 fatias de muçarela"), 40);
  assert.equal(grams("comi 3 biscoitos cream cracker"), 21);
  assert.equal(grams("comi 1 lata de atum em óleo"), 185);
  const estimate = estimateMealFromText("comi 3 colheres de sopa de arroz");
  assert.equal(estimate.matched_items[0].approximate_quantity, undefined);
  // Sem medida do alimento na TBCA, segue a genérica, marcada como aproximação.
  assert.equal(estimateMealFromText("comi 1 colher de sopa de granola").matched_items[0].approximate_quantity, true);
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
  // farofa temperada continua estimativa curada (sem equivalente na TBCA).
  assert.notEqual(estimateMealFromText("comi 40 g de farofa").confidence, "high");
  assert.equal(estimateMealFromText("comi 30 g de farinha de mandioca").confidence, "high");
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

test("CAT-01: 'queijo' sem tipo pede esclarecimento; nomes específicos vencem", () => {
  const terms = (text) => (estimateMealFromText(text).needs_clarification || []).map(({ term }) => term);
  assert.deepEqual(terms("comi tapioca com queijo"), ["queijo"]);
  assert.deepEqual(terms("comi pão com 30 g de queijo"), ["queijo"]);
  assert.deepEqual(ids(estimateMealFromText("comi tapioca com queijo minas")), ["tapioca-pronta", "queijo-minas-frescal"]);
  assert.deepEqual(ids(estimateMealFromText("comi pão de queijo")), ["pao-de-queijo"]);
  assert.deepEqual(ids(estimateMealFromText("comi uma fatia de pizza quatro queijos")), ["pizza-quatro-queijos-direta"]);
  assert.deepEqual(ids(estimateMealFromText("comi um espeto de queijo coalho")), ["queijo-coalho"]);
});

test("CAT-02: harumaki, kappa maki, joe e molhos da comida japonesa", () => {
  assert.deepEqual(ids(estimateMealFromText("comi 2 harumakis")), ["harumaki"]);
  assert.deepEqual(ids(estimateMealFromText("comi 2 harumaki de camarão")), ["harumaki-camarao"]);
  assert.deepEqual(ids(estimateMealFromText("comi 6 kappa maki")), ["hossomaki-pepino"]);
  assert.deepEqual(ids(estimateMealFromText("comi 4 joes e 4 hot rolls")), ["joe-salmao", "hot-roll-philadelphia"]);
  assert.deepEqual(ids(estimateMealFromText("comi 8 hot rolls com shoyu")), ["hot-roll-philadelphia", "shoyu"]);
  assert.deepEqual(ids(estimateMealFromText("comi 8 hot rolls sem shoyu")), ["hot-roll-philadelphia"]);
  assert.equal(getQuantityQuestions("comi 8 hot rolls com shoyu").length, 0);
});

test("CAT-02: peso por peça segue a medida caseira da TBCA", () => {
  const grams = (id) => FOOD_CATALOG.find((food) => food.id === id).default_g;
  assert.equal(grams("uramaki-salmao-pepino"), 60);
  assert.equal(grams("hossomaki-salmao"), 30);
  assert.equal(grams("uramaki-california"), 30);
  assert.equal(grams("hot-roll-philadelphia"), 30);
  assert.equal(grams("temaki-philadelphia"), 90);
  assert.equal(grams("tempura-camarao"), 70);
  assert.equal(grams("harumaki"), 60);
});

test("NUT-25: contagem multiplica o peso de UMA unidade (pão de queijo)", () => {
  const one = estimateMealFromText("comi 1 pão de queijo").matched_items[0].grams;
  assert.equal(one, 30);
  assert.equal(estimateMealFromText("comi 3 pães de queijo").matched_items[0].grams, 3 * one);
  // Fora as caixas de marca ("6 unidades" de nuggets), a porção contável é de 1 item.
  const multi = FOOD_CATALOG.filter((food) => !/^official/.test(food.source)
    && /^\s*[2-9]\d*\s+(?!g$|ml$)/.test(food.unit));
  assert.deepEqual(multi.map((food) => food.id), []);
});

test("DEC-01: peso por unidade segue a medida caseira da TBCA", () => {
  const grams = (id) => FOOD_CATALOG.find((food) => food.id === id).default_g;
  assert.equal(grams("coxinha-frango"), 50);
  assert.equal(grams("pao-de-hamburguer"), 70);
  assert.equal(grams("iogurte-natural-integral"), 100);
  assert.equal(grams("kiwi"), 90);
  assert.ok(FOOD_CATALOG.filter((food) => food.id.startsWith("pizza-")).every((food) => food.default_g === 90));
  assert.match(FOOD_CATALOG.find((food) => food.id === "coxinha-frango").reference, /unidade média de 50 g/);
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

test("CAT-10: gorduras, oleaginosas, embutidos e peixes com valores da TBCA", () => {
  const values = (id) => { const food = FOOD_CATALOG.find((entry) => entry.id === id); return [food.kcal, food.protein, food.fat]; };
  assert.deepEqual(values("azeite"), [900, 0, 100]);
  assert.deepEqual(values("manteiga"), [673, 0.39, 74.4]);
  assert.deepEqual(values("castanha-do-para"), [674, 14.5, 63.5]);
  assert.deepEqual(values("presunto-cozido"), [121, 15.1, 5.7]);
  assert.deepEqual(values("camarao-cozido"), [82, 17.7, 1.28]);
  assert.deepEqual(values("sashimi-salmao"), values("salmao-cru"));
});

test("CAT-10: atum em óleo e atum em água são itens distintos", () => {
  assert.equal(firstId("comi 120 g de atum em óleo"), "atum-enlatado-oleo");
  assert.equal(firstId("comi 120 g de atum em água"), "atum-enlatado-agua");
});

test("CAT-10: pratos, doces e bebidas com preparações da TBCA", () => {
  const values = (id) => { const food = FOOD_CATALOG.find((entry) => entry.id === id); return [food.kcal, food.reference.match(/BRC\d{4}[A-Z]/)[0]]; };
  assert.deepEqual(values("feijoada"), [131, "BRC0064T"]);
  assert.deepEqual(values("strogonoff-frango"), [152, "BRC0225F"]);
  assert.deepEqual(values("lasanha-carne"), [178, "BRC0395A"]);
  assert.deepEqual(values("coxinha-frango"), [273, "BRC0100F"]);
  assert.deepEqual(values("brigadeiro"), [387, "BRC0190K"]);
  assert.deepEqual(values("suco-de-laranja"), [36, "BRC0042C"]);
});

test("CAT-10: suínos, aves assadas, soja, japonesa e pizzas com valores da TBCA", () => {
  const values = (id) => { const food = FOOD_CATALOG.find((entry) => entry.id === id); return [food.kcal, food.reference.match(/BRC\d{4}[A-Z]/)[0]]; };
  assert.deepEqual(values("lombo-suino-assado"), [200, "BRC0163F"]);
  assert.deepEqual(values("coxa-de-frango-assada"), [207, "BRC0108F"]);
  assert.deepEqual(values("tofu"), [69, "BRC0056T"]);
  assert.deepEqual(values("uramaki-california"), [140, "BRC0306E"]);
  assert.deepEqual(values("arroz-japones-cozido"), [131, "BRC0711A"]);
  assert.deepEqual(values("pizza-mucarela-direta"), [286, "BRC0225A"]);
  assert.deepEqual(values("pizza-calabresa-direta"), [297, "BRC0425A"]);
});

test("CAT-06: todo item 'tbca_verified' tem código TBCA", () => {
  const missing = FOOD_CATALOG.filter((food) => food.source === "tbca_verified" && !/BRC\d{4}[A-Z]/.test(food.reference || ""));
  assert.deepEqual(missing.map((food) => food.id), []);
});

test("CAT-10: sem equivalente na TBCA, segue estimativa sem referência", () => {
  for (const id of ["pao-de-queijo", "doce-de-leite", "cafe-sem-acucar", "farofa-pronta", "polenta-frita", "cuscuz-de-milho-cozido", "sorvete-chocolate", "homus", "nigiri-salmao", "missoshiru", "pizza-generica", "pizza-bacon-direta"]) {
    const food = FOOD_CATALOG.find((entry) => entry.id === id);
    assert.equal(food.reference, undefined, id);
    assert.notEqual(food.source, "tbca_verified", id);
  }
});
