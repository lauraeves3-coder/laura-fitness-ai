// Testes das funções de interpretação de src/ai.js (carregadas sem importar o módulo).
// Testes com `todo` documentam defeitos confirmados (ver AUDITORIA-NUTRICAO.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ai, aiSource } from "./helpers/aiPure.js";

// ---------- ENC-01: corrupção real de UTF-8 ----------

test("ENC-01: src/ai.js e src/agent/agent.js sem texto duplamente codificado", () => {
  const agentSource = readFileSync(new URL("../src/agent/agent.js", import.meta.url), "utf8");
  for (const source of [aiSource, agentSource]) {
    assert.ok(!/Ã[£§¡©³ºª­µ]|00e220ac|FFFD/.test(source));
  }
});

// ---------- EX-01: alimentos rejeitados ----------

test("regressão: 'nao tenho ovo' rejeita ovo", () => {
  assert.deepEqual(ai.extractExcludedFoods("nao tenho ovo"), ["ovo"]);
});
test("EX-01: 'não quero frango' (com acento) rejeita frango", () => {
  assert.deepEqual(ai.extractExcludedFoods("não quero frango"), ["frango"]);
});
test("EX-01: 'nao quero feijao' rejeita feijão", () => {
  assert.deepEqual(ai.extractExcludedFoods("nao quero feijao"), ["feijão"]);
  assert.deepEqual(ai.extractExcludedFoods("não quero feijão"), ["feijão"]);
});
test("EX-01: 'Não gosto de banana' rejeita banana", () => {
  assert.deepEqual(ai.extractExcludedFoods("Não gosto de banana"), ["banana"]);
});
test("EX-01: 'sem pão' rejeita pão", () => {
  assert.deepEqual(ai.extractExcludedFoods("sem pão"), ["pão"]);
  assert.deepEqual(ai.extractExcludedFoods("arroz sem feijão"), ["feijão"]);
});
test("EX-01: negativa não contamina o alimento seguinte", () => {
  assert.deepEqual(ai.extractExcludedFoods("nao quero frango hoje, quero arroz"), ["frango"]);
  assert.deepEqual(ai.extractExcludedFoods("não tenho tempo, mas tenho frango"), []);
});
test("EX-01: listas negadas com 'nem' e 'e'", () => {
  assert.deepEqual(ai.extractExcludedFoods("não quero frango nem arroz"), ["frango", "arroz"]);
  assert.deepEqual(ai.extractExcludedFoods("não quero frango e arroz"), ["frango", "arroz"]);
});
test("EX-01: 'sem' só afeta alimento logo em seguida e respeita compostos", () => {
  assert.deepEqual(ai.extractExcludedFoods("frango sem pele"), []);
  assert.deepEqual(ai.extractExcludedFoods("sem pão de queijo"), []);
});

// ---------- EX-04 / restrições de perfil ----------

test("EX-04: celíaco restringe glúten com string legível", () => {
  const restrictions = ai.getFoodRestrictions({ dietary_preferences: "celíaco" });
  assert.ok(restrictions.includes("pão integral"));
  assert.ok(restrictions.includes("pizza") && restrictions.includes("massa"));
});
test("EX-04: 'carne de soja' não rejeita carne", () => {
  assert.ok(!ai.getFoodRestrictions({ food_dislikes: "carne de soja" }).includes("carne"));
});

// ---------- EX-02 / AI-06: combinações ----------

test("regressão: 'não quero whey com água' = whey + água", () => {
  const [composition] = ai.detectExplicitExcludedCompositions("não quero whey com água");
  assert.deepEqual(composition.ingredients, ["whey", "agua"]);
});
test("regressão: 'nao quero arroz com feijao' = arroz + feijão", () => {
  assert.deepEqual(ai.detectExplicitExcludedCompositions("nao quero arroz com feijao")[0].ingredients, ["arroz", "feijao"]);
});
test("EX-02: forma contextual com um só alimento possível", () => {
  const [composition] = ai.detectExplicitExcludedCompositions("tenho whey em casa, mas nao quero tomar com agua");
  assert.deepEqual(composition.ingredients, ["whey", "agua"]);
});
test("EX-02: forma contextual ambígua não registra combinação e pergunta", () => {
  const message = "tenho banana, aveia e leite, mas nao quero tomar com agua";
  assert.deepEqual(ai.detectExplicitExcludedCompositions(message), []);
  const ambiguous = ai.detectAmbiguousCompositionExclusion(message);
  assert.deepEqual(ambiguous, { other: "agua", candidates: ["banana", "aveia", "leite"] });
  assert.equal(ai.buildAmbiguousCompositionQuestion(ambiguous),
    "Com qual alimento você não quer água: banana, aveia ou leite? Assim registro só essa combinação.");
});
test("EX-02: frase anterior não entra no contexto", () => {
  const [composition] = ai.detectExplicitExcludedCompositions("Comprei banana. Tenho whey, mas nao quero tomar com agua");
  assert.deepEqual(composition.ingredients, ["whey", "agua"]);
});
const compositionReply = (message) => ai.buildCompositionExclusionReply(
  ai.detectExplicitExcludedCompositions(message),
  ai.detectWheyAvailability(message)
);

test("AI-06: resposta de composição não é fixa em whey + água", () => {
  assert.ok(!aiSource.includes("nao vou sugerir whey com agua."));
  assert.equal(compositionReply("tenho whey em casa, mas nao quero tomar com agua"),
    "Entendi. Vou considerar o whey disponível, mas não vou sugerir whey com água. Whey e água continuam liberados em outras combinações.");
});
test("AI-06: arroz com feijão e banana com leite", () => {
  assert.equal(compositionReply("nao quero arroz com feijao"),
    "Entendi. Não vou sugerir arroz com feijão. Arroz e feijão continuam liberados em outras combinações.");
  assert.doesNotMatch(compositionReply("nao quero banana com leite"), /whey|água/);
});
test("AI-06: combinação não reconhecida não gera confirmação inventada", () => {
  assert.deepEqual(ai.detectExplicitExcludedCompositions("nao quero tofu com shoyu"), []);
  assert.equal(ai.detectAmbiguousCompositionExclusion("nao quero tofu com shoyu"), null);
});

// ---------- EX-03: normalização de listas ----------

test("EX-03: equivalências de whey e salmão", () => {
  assert.deepEqual(ai.normalizeToolFoodList(["Whey Protein", "whey", "Salmão", "salmao"]), ["whey", "peixe"]);
});

// ---------- AI-04: disponibilidade ----------

test("regressão: 'tenho whey' declara whey disponível", () => {
  assert.equal(ai.detectWheyAvailability("tenho whey em casa"), true);
});
test("AI-04: 'novo' não declara ovo disponível", () => {
  assert.deepEqual(ai.extractAvailableFoods("tenho um novo whey em casa"), ["whey"]);
});
test("AI-04: 'pão de queijo' não declara queijo disponível", () => {
  assert.ok(!ai.extractAvailableFoods("tenho pão de queijo").includes("queijo"));
});
test("AI-04: 'carne de soja' não declara carne", () => {
  assert.ok(!ai.extractAvailableFoods("tenho carne de soja").includes("carne"));
});
