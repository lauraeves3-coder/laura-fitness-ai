// MUS-01: validação e confirmação de treino (funções puras).
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateWorkoutRecord, workoutVolume, buildWorkoutReply } from "../src/workouts.js";

test("MUS-01: treino válido", () => {
  assert.deepEqual(validateWorkoutRecord({ workout_type: "musculação", duration_min: 45, exercises: [{ name: "supino", sets: 3, reps: 10, weight_kg: 40 }] }), { valid: true, errors: [] });
  assert.equal(validateWorkoutRecord({ workout_type: "corrida", duration_min: 30 }).valid, true);
  assert.equal(validateWorkoutRecord({ workout_type: "calistenia", exercises: [{ name: "barra", sets: 3, reps: 8, weight_kg: 0 }] }).valid, true);
});

test("MUS-01: valores inválidos", () => {
  const cases = [
    [{ workout_type: "" }, /tipo de treino vazio/],
    [{ workout_type: "x", duration_min: -5 }, /duração/],
    [{ workout_type: "x", duration_min: 5000 }, /duração/],
    [{ workout_type: "x", exercises: "supino" }, /lista de exercícios inválida/],
    [{ workout_type: "x", exercises: [{ name: "", sets: 3 }] }, /nome vazio/],
    [{ workout_type: "x", exercises: [{ name: "supino", sets: 2.5 }] }, /séries deve ser um número inteiro/],
    [{ workout_type: "x", exercises: [{ name: "supino", reps: -1 }] }, /repetições deve ficar entre/],
    [{ workout_type: "x", exercises: [{ name: "supino", weight_kg: 2000 }] }, /carga deve ficar entre/]
  ];
  for (const [workout, error] of cases) {
    const result = validateWorkoutRecord(workout);
    assert.equal(result.valid, false, JSON.stringify(workout));
    assert.match(result.errors.join("; "), error);
  }
});

test("MUS-01: volume e texto de confirmação", () => {
  const exercises = [{ name: "supino", sets: 3, reps: 10, weight_kg: 40 }, { name: "prancha", sets: 3, reps: 0, weight_kg: 0 }];
  assert.equal(workoutVolume(exercises), 1200);
  const reply = buildWorkoutReply({ workout_type: "musculação", duration_min: 40, exercises, notes: "senti o ombro" });
  assert.match(reply, /• supino: 3 × 10 com 40 kg/);
  assert.match(reply, /• prancha: 3 séries/);
  assert.match(reply, /Volume total: 1\.200 kg/);
  assert.match(reply, /Obs\.: senti o ombro/);
});
