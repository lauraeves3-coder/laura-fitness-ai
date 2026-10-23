// Testes de src/db.js num banco SQLite temporário (ARQ-06). O fitness.db real nunca
// é aberto: FITPULSE_DB_PATH é definido antes do import dinâmico.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const tempDir = mkdtempSync(join(tmpdir(), "fitpulse-db-test-"));
process.env.FITPULSE_DB_PATH = join(tempDir, "test.db");
assert.notEqual(resolve(process.env.FITPULSE_DB_PATH), resolve("fitness.db"));

const db = await import("../src/db.js");
const { validateMealRecord } = await import("../src/nutrition.js");
const { detectMealDeletionRequest, isMealDeletionConfirmation, isMealDeletionCancellation } = await import("../src/mealIntent.js");

let userCounter = 0;
const newUser = () => `test-user-${++userCounter}`;
const meal = (overrides = {}) => ({
  description: "Arroz e feijão", calories: 206, protein_g: 7.5, carbs_g: 41, fat_g: 0.8, ...overrides
});

// ---------- ARQ-06 ----------

test("ARQ-06: banco temporário isolado, criado vazio", () => {
  const userId = newUser();
  assert.deepEqual(db.getTodayMeals(userId), []);
});

// ---------- NUT-24: validação antes de gravar ----------

test("NUT-24: refeição válida é gravada", () => {
  const userId = newUser();
  const saved = db.saveMeal(userId, meal());
  assert.equal(saved.calories, 206);
  assert.equal(db.getTodayMeals(userId).length, 1);
});

test("NUT-24: macros ausentes valem 0, calorias são obrigatórias", () => {
  assert.equal(validateMealRecord({ description: "Lanche", calories: 300 }).valid, true);
  assert.deepEqual(validateMealRecord({ description: "Lanche", protein_g: 10 }).errors, ["calorias ausentes ou não numéricas"]);
});

test("NUT-24: dados inválidos não chegam ao banco", () => {
  const userId = newUser();
  for (const invalid of [
    meal({ description: "  " }),
    meal({ calories: -10 }),
    meal({ calories: "abc" }),
    meal({ calories: Infinity }),
    meal({ protein_g: -1 }),
    meal({ calories: 50000 }),
    meal({ calories: 100, protein_g: 40, carbs_g: 40, fat_g: 20 })
  ]) {
    assert.equal(db.saveMeal(userId, invalid), null, JSON.stringify(invalid));
  }
  assert.equal(db.getTodayMeals(userId).length, 0);
});

test("NUT-24: macros incoerentes com as calorias são recusados", () => {
  const { errors } = validateMealRecord(meal({ calories: 100, protein_g: 40, carbs_g: 40, fat_g: 20 }));
  assert.match(errors[0], /macros somam cerca de 500 kcal/);
});

test("NUT-24: correção inválida não altera o registro", () => {
  const userId = newUser();
  const saved = db.saveMeal(userId, meal());
  assert.equal(db.correctMeal(userId, saved.id, meal({ calories: -5 })), null);
  assert.equal(db.getMeal(userId, saved.id).calories, 206);
  assert.equal(db.correctMeal(userId, saved.id, meal({ calories: 250 })).calories, 250);
});

// ---------- NUT-11: exclusão ----------

test("NUT-11: exclusão remove a refeição e guarda cópia no histórico de eventos", () => {
  const userId = newUser();
  const saved = db.saveMeal(userId, meal());
  const deleted = db.deleteMeal(userId, saved.id, { requestEventId: 99 });
  assert.equal(deleted.id, saved.id);
  assert.equal(db.getMeal(userId, saved.id), null);
  assert.equal(db.getDailySummary(userId).calories, 0);
  const event = db.getLatestMealPlanEvent(userId, "meal_deleted");
  assert.equal(event.details.meal.description, "Arroz e feijão");
  assert.equal(event.details.request_event_id, 99);
});

test("NUT-11: não exclui refeição de outro usuário nem ID inexistente", () => {
  const owner = newUser();
  const other = newUser();
  const saved = db.saveMeal(owner, meal());
  assert.equal(db.deleteMeal(other, saved.id), null);
  assert.equal(db.deleteMeal(owner, 999999), null);
  assert.ok(db.getMeal(owner, saved.id));
});

test("NUT-11: pedido pendente expira e é encerrado por exclusão ou cancelamento", () => {
  const userId = newUser();
  const saved = db.saveMeal(userId, meal());
  assert.equal(db.getPendingMealDeletion(userId), null);
  const request = db.recordMealPlanEvent(userId, { event_type: "meal_deletion_requested", meal_id: saved.id, details: { meal_id: saved.id } });
  assert.equal(db.getPendingMealDeletion(userId).id, request.id);
  const later = new Date(Date.now() + 16 * 60000);
  assert.equal(db.getPendingMealDeletion(userId, { now: later }), null);
  db.recordMealPlanEvent(userId, { event_type: "meal_deletion_cancelled", details: { request_event_id: request.id } });
  assert.equal(db.getPendingMealDeletion(userId), null);
});

test("NUT-11: detecção do pedido, confirmação e cancelamento", () => {
  assert.deepEqual(detectMealDeletionRequest("apague a refeição #12"), { mealId: 12, last: false });
  assert.deepEqual(detectMealDeletionRequest("exclua o registro 7"), { mealId: 7, last: false });
  assert.deepEqual(detectMealDeletionRequest("remove a última refeição"), { mealId: null, last: true });
  assert.deepEqual(detectMealDeletionRequest("quero excluir uma refeição"), { mealId: null, last: false });
  assert.equal(detectMealDeletionRequest("comi arroz e feijão"), null);
  assert.equal(detectMealDeletionRequest("apaga a luz"), null);
  assert.equal(isMealDeletionConfirmation("sim, excluir"), true);
  assert.equal(isMealDeletionConfirmation("Confirmo a exclusão"), true);
  assert.equal(isMealDeletionConfirmation("sim"), false);
  assert.equal(isMealDeletionCancellation("não"), true);
  assert.equal(isMealDeletionCancellation("não quero frango"), false);
});
