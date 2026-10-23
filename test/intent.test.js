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
test("EX-01: 'nao quero feijao' rejeita feijão", { todo: "EX-01" }, () => {
  assert.equal(ai.extractExcludedFoods("nao quero feijao").length, 1);
});
test("EX-01: 'Não gosto de banana' rejeita banana", () => {
  assert.deepEqual(ai.extractExcludedFoods("Não gosto de banana"), ["banana"]);
});
test("EX-01: 'sem pão' rejeita pão", { todo: "EX-01" }, () => {
  assert.equal(ai.extractExcludedFoods("sem pão").length, 1);
});
test("EX-01: negativa não contamina o alimento seguinte", { todo: "EX-01" }, () => {
  assert.deepEqual(ai.extractExcludedFoods("nao quero frango hoje, quero arroz"), ["frango"]);
});

// ---------- EX-04 / restrições de perfil ----------

test("EX-04: celíaco restringe glúten com string legível", { todo: "EX-04 'pÃ£o integral' corrompido" }, () => {
  const restrictions = ai.getFoodRestrictions({ dietary_preferences: "celíaco" });
  assert.ok(restrictions.includes("pão integral"));
  assert.ok(restrictions.includes("pizza") && restrictions.includes("massa"));
});
test("EX-04: 'carne de soja' não rejeita carne", { todo: "EX-04" }, () => {
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
test("EX-02: forma contextual associa ao alimento mais próximo", { todo: "EX-02" }, () => {
  const [composition] = ai.detectExplicitExcludedCompositions("tenho banana, aveia e leite, mas nao quero tomar com agua");
  assert.deepEqual(composition.ingredients, ["leite", "agua"]);
});
test("AI-06: resposta de composição não é fixa em whey + água", { todo: "AI-06" }, () => {
  assert.ok(!aiSource.includes("nao vou sugerir whey com agua."));
});

// ---------- EX-03: normalização de listas ----------

test("EX-03: equivalências de whey e salmão", () => {
  assert.deepEqual(ai.normalizeToolFoodList(["Whey Protein", "whey", "Salmão", "salmao"]), ["whey", "peixe"]);
});

// ---------- AI-04: disponibilidade ----------

test("regressão: 'tenho whey' declara whey disponível", () => {
  assert.equal(ai.detectWheyAvailability("tenho whey em casa"), true);
});
test("AI-04: 'novo' não declara ovo disponível", { todo: "AI-04" }, () => {
  assert.deepEqual(ai.extractAvailableFoods("tenho um novo whey em casa"), ["whey"]);
});
test("AI-04: 'pão de queijo' não declara queijo disponível", { todo: "AI-04" }, () => {
  assert.ok(!ai.extractAvailableFoods("tenho pão de queijo").includes("queijo"));
});
test("AI-04: 'carne de soja' não declara carne", { todo: "AI-04" }, () => {
  assert.ok(!ai.extractAvailableFoods("tenho carne de soja").includes("carne"));
});
