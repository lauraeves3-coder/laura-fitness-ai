// CONV-03: datas relativas. Hoje fixo = sexta-feira 23/10/2026.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDateReference, parsePastMealDate, addDays, weekdayOf, formatDay } from "../src/dates.js";

const TODAY = "2026-10-23";
const range = (message) => {
  const reference = parseDateReference(message, TODAY);
  return reference && [reference.start, reference.end];
};

test("CONV-03: base de datas", () => {
  assert.equal(weekdayOf(TODAY), 5);
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  assert.equal(formatDay(TODAY), "sex 23/10");
});

test("CONV-03: hoje, ontem, anteontem", () => {
  assert.deepEqual(range("o que comi hoje?"), [TODAY, TODAY]);
  assert.deepEqual(range("o que comi ontem?"), ["2026-10-22", "2026-10-22"]);
  assert.deepEqual(range("e anteontem?"), ["2026-10-21", "2026-10-21"]);
});

test("CONV-03: dias da semana", () => {
  assert.deepEqual(range("o que comi na segunda?"), ["2026-10-19", "2026-10-19"]);
  assert.deepEqual(range("segunda-feira"), ["2026-10-19", "2026-10-19"]);
  assert.deepEqual(range("sábado"), ["2026-10-17", "2026-10-17"]);
  assert.deepEqual(range("sexta"), [TODAY, TODAY]);
  assert.deepEqual(range("sexta passada"), ["2026-10-16", "2026-10-16"]);
});

test("CONV-03: datas explícitas, sem futuro e sem datas inválidas", () => {
  assert.deepEqual(range("dia 15/10"), ["2026-10-15", "2026-10-15"]);
  assert.deepEqual(range("15/10/2025"), ["2025-10-15", "2025-10-15"]);
  assert.deepEqual(range("25/12"), ["2025-12-25", "2025-12-25"]);
  assert.equal(parseDateReference("31/02", TODAY), null);
});

test("CONV-03: períodos", () => {
  assert.deepEqual(range("resumo desta semana"), ["2026-10-19", TODAY]);
  assert.deepEqual(range("resumo da semana"), ["2026-10-19", TODAY]);
  assert.deepEqual(range("semana passada"), ["2026-10-12", "2026-10-18"]);
  assert.deepEqual(range("últimos 7 dias"), ["2026-10-17", TODAY]);
  assert.deepEqual(range("últimos sete dias"), ["2026-10-17", TODAY]);
  assert.deepEqual(range("este mês"), ["2026-10-01", TODAY]);
  assert.deepEqual(range("mês passado"), ["2026-09-01", "2026-09-30"]);
});

test("CONV-03: mensagem sem data", () => {
  assert.equal(parseDateReference("comi arroz e feijão", TODAY), null);
});

test("CONV-03: data passada em relato de refeição", () => {
  assert.equal(parsePastMealDate("ontem no jantar comi pizza", TODAY), "2026-10-22");
  assert.equal(parsePastMealDate("hoje comi pizza", TODAY), null);
  assert.equal(parsePastMealDate("esta semana comi pizza", TODAY), null);
  assert.equal(parsePastMealDate("comi pizza", TODAY), null);
});
