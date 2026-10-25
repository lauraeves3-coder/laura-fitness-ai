// MUS-01: validação e texto de confirmação de treinos (séries, repetições e carga).
// Funções puras, sem banco e sem API.

const LIMITS = { duration_min: 1440, sets: 100, reps: 1000, weight_kg: 1000, distance_km: 500, rpe: 10, rir: 10 };

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
    for (const [key, name] of [["sets", "séries"], ["reps", "repetições"], ["weight_kg", "carga"], ["rpe", "RPE"], ["rir", "RIR"]]) {
      const value = exercise?.[key];
      if (value === undefined || value === null) continue;
      if (!isNonNegativeNumber(value, LIMITS[key])) errors.push(`${label}: ${name} deve ficar entre 0 e ${LIMITS[key]}`);
      else if (["sets", "reps"].includes(key) && !Number.isInteger(Number(value))) errors.push(`${label}: ${name} deve ser um número inteiro`);
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
    const effort = [exercise.rpe != null ? `RPE ${formatNumber(exercise.rpe)}` : null, exercise.rir != null ? `RIR ${formatNumber(exercise.rir)}` : null].filter(Boolean);
    lines.push(`• ${exercise.name}${parts.length ? `: ${parts.join(" com ")}` : ""}${effort.length ? ` (${effort.join(", ")})` : ""}`);
  }
  const volume = workoutVolume(exercises);
  if (volume > 0) lines.push(`Volume total: ${formatNumber(volume)} kg (séries × repetições × carga).`);
  if (workout.effort != null) lines.push(`💢 Esforço da sessão: ${formatNumber(workout.effort)}/10`);
  const advice = progressionAdvice(exercises);
  if (advice.length) lines.push("", "📈 *Próximo treino*", ...advice);
  if (workout.notes) lines.push(`Obs.: ${workout.notes}`);
  return lines.join("\n");
}

// MUS-02: RIR = repetições que ainda sobravam; RPE ≈ 10 − RIR. Faixa ideal para
// hipertrofia/força: RIR 1–2. Sobrando 3+ → subir a carga; no limite → manter.
const rirOf = (exercise) => exercise.rir != null ? Number(exercise.rir) : exercise.rpe != null ? 10 - Number(exercise.rpe) : null;

export function progressionAdvice(exercises = []) {
  return exercises.flatMap((exercise) => {
    const rir = rirOf(exercise);
    if (rir === null) return [];
    const weight = Number(exercise.weight_kg) || 0;
    if (rir >= 3) {
      const step = weight ? Math.max(1, Math.round(weight * 0.05 * 2) / 2) : null;
      return [`⬆️ ${exercise.name}: sobrou fôlego (RIR ${formatNumber(rir)}). Suba a carga${step ? ` ~${formatNumber(step)} kg (para ${formatNumber(weight + step)} kg)` : ""} ou faça mais repetições.`];
    }
    if (rir <= 0) return [`⏸️ ${exercise.name}: foi até a falha. Mantenha a carga até completar as repetições com 1–2 de reserva.`];
    return [];
  });
}

// Esforço (RPE 1–10) e cansaço citados no texto quando o modelo não os separou:
// "supino 3x10 40 kg rpe 8", "rir 2", "esforço 9/10". Vale para os exercícios sem valor.
export function applyEffortFromText(workout, message) {
  if (!workout || typeof message !== "string") return workout;
  const text = message.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
  const number = (pattern) => {
    const match = text.match(pattern);
    return match ? Number(match[1].replace(",", ".")) : null;
  };
  const rpe = number(/\brpe\s*(?:de|foi|:)?\s*(\d{1,2}(?:[.,]5)?)\b/);
  const rir = number(/\brir\s*(?:de|foi|:)?\s*(\d)\b/);
  const effort = number(/\b(?:esforco|cansaco|intensidade|pse)\s*(?:da sessao|do treino)?\s*(?:de|foi|:|=)?\s*(\d{1,2})(?:\s*(?:\/|de)\s*10)?\b/);
  const valid = (value) => value !== null && value >= 0 && value <= 10;
  const exercises = (workout.exercises || []).map((exercise) => ({
    ...exercise,
    rpe: exercise.rpe ?? (valid(rpe) ? rpe : null),
    rir: exercise.rir ?? (valid(rir) ? rir : null)
  }));
  const sessionEffort = workout.effort ?? (valid(effort) ? effort : valid(rpe) ? rpe : null);
  return { ...workout, exercises, effort: sessionEffort };
}

// Três sessões de musculação seguidas com esforço 9+ → sugerir semana mais leve.
export function fatigueAdvice(recentEfforts = []) {
  const last = recentEfforts.slice(-3);
  return last.length === 3 && last.every((effort) => Number(effort) >= 9)
    ? "😮‍💨 Suas últimas 3 sessões foram muito pesadas (esforço 9+). Vale uma semana mais leve: mesmas cargas com 1 série a menos, ou 10–15% menos carga, para recuperar."
    : null;
}
