// MUS-01: validação e texto de confirmação de treinos (séries, repetições e carga).
// Funções puras, sem banco e sem API.

const LIMITS = { duration_min: 1440, sets: 100, reps: 1000, weight_kg: 1000, distance_km: 500 };

const isNonNegativeNumber = (value, max) =>
  value !== null && value !== undefined && value !== "" && typeof value !== "boolean"
  && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max;

export function validateWorkoutRecord(workout) {
  const errors = [];
  if (!workout || typeof workout !== "object") return { valid: false, errors: ["treino ausente"] };
  const type = typeof workout.workout_type === "string" ? workout.workout_type.trim() : "";
  if (!type) errors.push("tipo de treino vazio");
  if (workout.duration_min !== undefined && workout.duration_min !== null
    && !isNonNegativeNumber(workout.duration_min, LIMITS.duration_min)) {
    errors.push(`duração deve ficar entre 0 e ${LIMITS.duration_min} minutos`);
  }
  if (workout.distance_km !== undefined && workout.distance_km !== null
    && !isNonNegativeNumber(workout.distance_km, LIMITS.distance_km)) {
    errors.push(`distância deve ficar entre 0 e ${LIMITS.distance_km} km`);
  }
  if (workout.exercises !== undefined && !Array.isArray(workout.exercises)) {
    errors.push("lista de exercícios inválida");
  }
  for (const [index, exercise] of (Array.isArray(workout.exercises) ? workout.exercises : []).entries()) {
    const label = typeof exercise?.name === "string" && exercise.name.trim() ? exercise.name.trim() : `exercício ${index + 1}`;
    if (!(typeof exercise?.name === "string" && exercise.name.trim())) errors.push(`${label}: nome vazio`);
    for (const [key, name] of [["sets", "séries"], ["reps", "repetições"], ["weight_kg", "carga"]]) {
      const value = exercise?.[key];
      if (value === undefined || value === null) continue;
      if (!isNonNegativeNumber(value, LIMITS[key])) errors.push(`${label}: ${name} deve ficar entre 0 e ${LIMITS[key]}`);
      else if (key !== "weight_kg" && !Number.isInteger(Number(value))) errors.push(`${label}: ${name} deve ser um número inteiro`);
    }
  }
  return { valid: errors.length === 0, errors };
}

const formatNumber = (value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// Volume = séries × repetições × carga, só para exercícios com os três valores.
export function workoutVolume(exercises = []) {
  return exercises.reduce((total, exercise) => {
    const sets = Number(exercise.sets) || 0;
    const reps = Number(exercise.reps) || 0;
    const weight = Number(exercise.weight_kg) || 0;
    return total + sets * reps * weight;
  }, 0);
}

export function buildWorkoutReply(workout) {
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const header = [`🏋️ Registrei o treino: ${workout.workout_type}`];
  if (Number(workout.duration_min) > 0) header.push(`${formatNumber(workout.duration_min)} min`);
  const lines = [header.join(" — ")];
  for (const exercise of exercises) {
    const parts = [];
    if (Number(exercise.sets) > 0 && Number(exercise.reps) > 0) parts.push(`${exercise.sets} × ${exercise.reps}`);
    else if (Number(exercise.sets) > 0) parts.push(`${exercise.sets} séries`);
    else if (Number(exercise.reps) > 0) parts.push(`${exercise.reps} repetições`);
    if (Number(exercise.weight_kg) > 0) parts.push(`${formatNumber(exercise.weight_kg)} kg`);
    lines.push(`• ${exercise.name}${parts.length ? `: ${parts.join(" com ")}` : ""}`);
  }
  const volume = workoutVolume(exercises);
  if (volume > 0) lines.push(`Volume total: ${formatNumber(volume)} kg (séries × repetições × carga).`);
  if (workout.notes) lines.push(`Obs.: ${workout.notes}`);
  return lines.join("\n");
}
