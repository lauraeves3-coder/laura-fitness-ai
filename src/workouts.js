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
  const type = String(workout.workout_type || "");
  const icon = /corr/i.test(type) ? "🏃" : /caminh/i.test(type) ? "🚶" : /cicl|bike|pedal/i.test(type) ? "🚴" : /nata/i.test(type) ? "🏊" : "🏋️";
  const header = [`${icon} Registrei o treino: ${workout.workout_type}`];
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

// MUS-03: grupo muscular pelo nome do exercício (texto livre do registro).
const MUSCLE_GROUPS = [
  ["Peito", /supino|crucifixo|peck|flexao de braco|flexao|crossover|voador/],
  ["Costas", /remada|puxada|pulldown|barra fixa|serrote|pullover|levantamento terra|terra/],
  ["Ombros", /desenvolvimento|elevacao lateral|elevacao frontal|face pull|arnold|crucifixo invertido/],
  ["Quadríceps", /agachamento|leg press|extensora|afundo|passada|hack|bulgaro|sissy/],
  ["Posteriores", /stiff|flexora|mesa flexora|good morning|nordic/],
  ["Glúteos", /elevacao pelvica|hip thrust|gluteo|abdutora|coice|ponte/],
  ["Bíceps", /rosca|biceps/],
  ["Tríceps", /triceps|testa|frances|mergulho|paralela|coice de triceps/],
  ["Panturrilha", /panturrilha|gemeos/],
  ["Core", /prancha|abdominal|crunch|dead bug|elevacao de pernas/]
];
const plain = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

export function muscleOf(exerciseName) {
  const name = plain(exerciseName);
  return MUSCLE_GROUPS.find(([, pattern]) => pattern.test(name))?.[0] || null;
}

// Séries por grupo muscular no período, com a faixa usual para hipertrofia (10–20/semana).
export function buildMuscleVolumeReply(exercises, { days = 7 } = {}) {
  if (!exercises.length) {
    return "💪 Ainda não tenho treinos de musculação com séries nos últimos 7 dias. Registre, por exemplo: *treinei supino 4x10 com 40 kg e remada 3x12 com 30 kg*.";
  }
  const sets = new Map();
  let unknown = 0;
  for (const exercise of exercises) {
    const group = muscleOf(exercise.name);
    const count = Number(exercise.sets) || 0;
    if (!group) { unknown += count; continue; }
    sets.set(group, (sets.get(group) || 0) + count);
  }
  const scale = 7 / days;
  const lines = ["💪 *Volume por músculo — últimos 7 dias*", "_Séries por semana; para hipertrofia, 10 a 20 costuma ser a faixa que funciona._", ""];
  for (const [group] of MUSCLE_GROUPS) {
    if (!sets.has(group)) continue;
    const weekly = Math.round(sets.get(group) * scale);
    const filled = Math.min(10, Math.round(weekly / 2));
    const status = weekly < 10 ? "⬇️ abaixo" : weekly > 20 ? "⚠️ acima (recuperação)" : "✅ na faixa";
    lines.push(`• *${group}:* ${weekly} ${weekly === 1 ? "série" : "séries"} ${"▓".repeat(filled)}${"░".repeat(10 - filled)} ${status}`);
  }
  const trained = new Set(sets.keys());
  const missing = ["Peito", "Costas", "Ombros", "Quadríceps", "Posteriores", "Glúteos"].filter((group) => !trained.has(group));
  if (missing.length) lines.push("", `📌 Sem séries na semana: ${missing.join(", ").toLocaleLowerCase("pt-BR")}.`);
  if (unknown) lines.push(`_${unknown} séries de exercícios que não reconheci o grupo._`);
  return lines.join("\n");
}

// 1RM estimado (Epley) da melhor série.
const oneRepMax = (weight, reps) => weight * (1 + reps / 30);

// Progressão de um exercício: melhor série por sessão e tendência do 1RM estimado.
export function buildExerciseProgressReply(exercises, query) {
  const target = plain(query).replace(/^(?:o|a)\s+/, "").trim();
  const matching = exercises.filter((exercise) => plain(exercise.name).includes(target) && Number(exercise.weight_kg) > 0);
  if (!matching.length) return `Ainda não tenho registros de *${query}* com carga. Mande, por exemplo: *treinei ${query} 3x10 com 40 kg*.`;
  const sessions = new Map();
  for (const exercise of matching) {
    const day = String(exercise.trained_at).slice(0, 10);
    const estimate = oneRepMax(Number(exercise.weight_kg), Number(exercise.reps) || 1);
    const best = sessions.get(day);
    if (!best || estimate > best.estimate) sessions.set(day, { day, weight: Number(exercise.weight_kg), reps: Number(exercise.reps), estimate });
  }
  const list = [...sessions.values()];
  const first = list[0];
  const last = list.at(-1);
  const change = (last.estimate - first.estimate) / first.estimate;
  const name = matching.at(-1).name;
  const [, month1, day1] = first.day.split("-");
  return [
    `📈 *Evolução — ${name}*`,
    "",
    ...list.slice(-6).map((session) => {
      const [, month, day] = session.day.split("-");
      return `• ${day}/${month}: ${formatNumber(session.weight)} kg × ${session.reps} (1RM est. ${formatNumber(Math.round(session.estimate))} kg)`;
    }),
    "",
    list.length > 1
      ? `${change > 0.005 ? "⬆️" : change < -0.005 ? "⬇️" : "➡️"} Desde ${day1}/${month1}: ${change >= 0 ? "+" : "−"}${formatNumber(Math.abs(Math.round(change * 1000) / 10))}% na força estimada.`
      : "Registre mais sessões para eu mostrar a tendência.",
    list.length > 2 && Math.abs(change) <= 0.005 ? "💡 Estagnou? Tente a progressão dupla: chegue ao topo das repetições em todas as séries e só então suba 2–5% da carga." : null
  ].filter((line) => line !== null).join("\n");
}

export function detectStrengthQuery(message) {
  const text = plain(message).replace(/[?!.]+$/, "").trim();
  if (/\bvolume\b.*\b(?:musculo|semana|musculacao|treino)\b|\bseries por musculo\b|\bcomo (?:esta|anda|ta) (?:minha |a )?musculacao\b/.test(text)) return { type: "volume" };
  const progress = text.match(/\b(?:evolucao|progresso|progressao|minha carga)\s+(?:no|na|do|da|de|em)\s+([a-z ]{3,40})$/);
  if (progress && !/\b(?:corrida|correr|peso|treinos?|semana|dieta)\b/.test(progress[1])) return { type: "progress", exercise: progress[1].trim() };
  return null;
}
