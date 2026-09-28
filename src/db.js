import Database from "better-sqlite3";

const db = new Database("fitness.db");

db.pragma("journal_mode = WAL");

/* =========================================================
   DATA E HORA — BRASIL
========================================================= */

function getBrazilDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function getBrazilDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

/* =========================================================
   BANCO DE DADOS
========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    height_cm REAL,
    weight_kg REAL,
    goal TEXT,
    daily_calorie_target REAL,
    daily_protein_target REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    description TEXT NOT NULL,
    calories REAL DEFAULT 0,
    protein_g REAL DEFAULT 0,
    carbs_g REAL DEFAULT 0,
    fat_g REAL DEFAULT 0,
    consumed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    workout_type TEXT NOT NULL,
    duration_min REAL DEFAULT 0,
    notes TEXT,
    trained_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sets INTEGER DEFAULT 0,
    reps INTEGER DEFAULT 0,
    weight_kg REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    measured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

/* =========================================================
   USUÁRIO
========================================================= */

export function ensureUser(userId) {
  const existing = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId);

  if (!existing) {
    db.prepare(`
      INSERT INTO users (
        id,
        name,
        created_at
      )
      VALUES (?, ?, ?)
    `).run(
      userId,
      userId,
      getBrazilDateTime()
    );
  }

  return db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId);
}

export function updateUserProfile(userId, data) {
  ensureUser(userId);

  const current = getUser(userId);

  const updated = {
    name: data.name ?? current.name,
    height_cm: data.height_cm ?? current.height_cm,
    weight_kg: data.weight_kg ?? current.weight_kg,
    goal: data.goal ?? current.goal,
    daily_calorie_target:
      data.daily_calorie_target ?? current.daily_calorie_target,
    daily_protein_target:
      data.daily_protein_target ?? current.daily_protein_target
  };

  db.prepare(`
    UPDATE users
    SET
      name = ?,
      height_cm = ?,
      weight_kg = ?,
      goal = ?,
      daily_calorie_target = ?,
      daily_protein_target = ?
    WHERE id = ?
  `).run(
    updated.name,
    updated.height_cm,
    updated.weight_kg,
    updated.goal,
    updated.daily_calorie_target,
    updated.daily_protein_target,
    userId
  );

  return getUser(userId);
}

/* =========================================================
   REFEIÇÕES
========================================================= */

export function saveMeal(userId, meal) {
  ensureUser(userId);

  const result = db.prepare(`
    INSERT INTO meals (
      user_id,
      description,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      consumed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    meal.description,
    meal.calories ?? 0,
    meal.protein_g ?? 0,
    meal.carbs_g ?? 0,
    meal.fat_g ?? 0,
    getBrazilDateTime()
  );

  return db
    .prepare("SELECT * FROM meals WHERE id = ?")
    .get(result.lastInsertRowid);
}

/* =========================================================
   TREINOS
========================================================= */

export function saveWorkout(userId, workout) {
  ensureUser(userId);

  const workoutResult = db.prepare(`
    INSERT INTO workouts (
      user_id,
      workout_type,
      duration_min,
      notes,
      trained_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    userId,
    workout.workout_type,
    workout.duration_min ?? 0,
    workout.notes ?? null,
    getBrazilDateTime()
  );

  const workoutId = workoutResult.lastInsertRowid;

  if (Array.isArray(workout.exercises)) {
    const insertExercise = db.prepare(`
      INSERT INTO exercises (
        workout_id,
        name,
        sets,
        reps,
        weight_kg
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((exercises) => {
      for (const exercise of exercises) {
        insertExercise.run(
          workoutId,
          exercise.name,
          exercise.sets ?? 0,
          exercise.reps ?? 0,
          exercise.weight_kg ?? 0
        );
      }
    });

    insertMany(workout.exercises);
  }

  return db
    .prepare("SELECT * FROM workouts WHERE id = ?")
    .get(workoutId);
}

/* =========================================================
   PESO
========================================================= */

export function saveWeight(userId, weightKg) {
  ensureUser(userId);

  db.prepare(`
    INSERT INTO weights (
      user_id,
      weight_kg,
      measured_at
    )
    VALUES (?, ?, ?)
  `).run(
    userId,
    weightKg,
    getBrazilDateTime()
  );

  db.prepare(`
    UPDATE users
    SET weight_kg = ?
    WHERE id = ?
  `).run(
    weightKg,
    userId
  );

  return db
    .prepare(`
      SELECT *
      FROM weights
      WHERE user_id = ?
      ORDER BY measured_at DESC
      LIMIT 1
    `)
    .get(userId);
}

/* =========================================================
   BUSCAR USUÁRIO
========================================================= */

export function getUser(userId) {
  return db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId);
}

/* =========================================================
   RESUMO DO DIA
========================================================= */

export function getDailySummary(userId, date = new Date()) {
  ensureUser(userId);

  const day = getBrazilDate(date);

  const meals = db.prepare(`
    SELECT
      COALESCE(SUM(calories), 0) AS calories,
      COALESCE(SUM(protein_g), 0) AS protein_g,
      COALESCE(SUM(carbs_g), 0) AS carbs_g,
      COALESCE(SUM(fat_g), 0) AS fat_g
    FROM meals
    WHERE user_id = ?
      AND date(consumed_at) = ?
  `).get(
    userId,
    day
  );

  const workouts = db.prepare(`
    SELECT
      COUNT(*) AS workout_count,
      COALESCE(SUM(duration_min), 0) AS total_duration_min
    FROM workouts
    WHERE user_id = ?
      AND date(trained_at) = ?
  `).get(
    userId,
    day
  );

  const user = getUser(userId);

  return {
    date: day,
    calories: meals.calories,
    protein_g: meals.protein_g,
    carbs_g: meals.carbs_g,
    fat_g: meals.fat_g,
    workout_count: workouts.workout_count,
    total_duration_min: workouts.total_duration_min,
    calorie_target: user?.daily_calorie_target ?? null,
    protein_target: user?.daily_protein_target ?? null
  };
}

/* =========================================================
   HISTÓRICO
========================================================= */

export function getRecentHistory(userId, limit = 20) {
  ensureUser(userId);

  const meals = db.prepare(`
    SELECT
      'meal' AS type,
      description,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      consumed_at AS date
    FROM meals
    WHERE user_id = ?
    ORDER BY consumed_at DESC
    LIMIT ?
  `).all(
    userId,
    limit
  );

  const workouts = db.prepare(`
    SELECT
      'workout' AS type,
      workout_type AS description,
      duration_min,
      notes,
      trained_at AS date
    FROM workouts
    WHERE user_id = ?
    ORDER BY trained_at DESC
    LIMIT ?
  `).all(
    userId,
    limit
  );

  const weights = db.prepare(`
    SELECT
      'weight' AS type,
      weight_kg,
      measured_at AS date
    FROM weights
    WHERE user_id = ?
    ORDER BY measured_at DESC
    LIMIT ?
  `).all(
    userId,
    limit
  );

  return {
    meals,
    workouts,
    weights
  };
}