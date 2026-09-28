import Database from "better-sqlite3";

const db = new Database("fitness.db");

db.pragma("journal_mode = WAL");

/* =========================================================
   DATA / HORA — BRASIL
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
    age_years INTEGER,
    sex TEXT,
    height_cm REAL,
    weight_kg REAL,
    goal TEXT,
    activity_level TEXT,
    training_days_per_week INTEGER,
    dietary_preferences TEXT,
    food_dislikes TEXT,

    daily_calorie_target REAL,
    daily_protein_target REAL,
    daily_carbs_target REAL,
    daily_fat_target REAL,

    maintenance_calories REAL,
    calorie_deficit_percent REAL,

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
   MIGRAÇÃO
   Adiciona campos novos sem apagar dados existentes
========================================================= */

function ensureColumn(table, column, definition) {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all();

  const exists = columns.some(
    (item) => item.name === column
  );

  if (!exists) {
    db.exec(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
    );
  }
}

ensureColumn("users", "age_years", "INTEGER");
ensureColumn("users", "sex", "TEXT");
ensureColumn("users", "activity_level", "TEXT");
ensureColumn("users", "training_days_per_week", "INTEGER");
ensureColumn("users", "dietary_preferences", "TEXT");
ensureColumn("users", "food_dislikes", "TEXT");

ensureColumn(
  "users",
  "daily_calorie_target",
  "REAL"
);

ensureColumn(
  "users",
  "daily_protein_target",
  "REAL"
);

ensureColumn(
  "users",
  "daily_carbs_target",
  "REAL"
);

ensureColumn(
  "users",
  "daily_fat_target",
  "REAL"
);

ensureColumn(
  "users",
  "maintenance_calories",
  "REAL"
);

ensureColumn(
  "users",
  "calorie_deficit_percent",
  "REAL"
);

/* =========================================================
   USUÁRIO
========================================================= */

export function ensureUser(userId) {
  const existing = db
    .prepare(
      "SELECT * FROM users WHERE id = ?"
    )
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
    .prepare(
      "SELECT * FROM users WHERE id = ?"
    )
    .get(userId);
}

/* =========================================================
   PERFIL
========================================================= */

export function updateUserProfile(
  userId,
  data
) {
  ensureUser(userId);

  const current =
    getUser(userId);

  const updated = {
    name:
      data.name ??
      current.name,

    age_years:
      data.age_years ??
      current.age_years,

    sex:
      data.sex ??
      current.sex,

    height_cm:
      data.height_cm ??
      current.height_cm,

    weight_kg:
      data.weight_kg ??
      current.weight_kg,

    goal:
      data.goal ??
      current.goal,

    activity_level:
      data.activity_level ??
      current.activity_level,

    training_days_per_week:
      data.training_days_per_week ??
      current.training_days_per_week,

    dietary_preferences:
      data.dietary_preferences ??
      current.dietary_preferences,

    food_dislikes:
      data.food_dislikes ??
      current.food_dislikes,

    daily_calorie_target:
      data.daily_calorie_target ??
      current.daily_calorie_target,

    daily_protein_target:
      data.daily_protein_target ??
      current.daily_protein_target,

    daily_carbs_target:
      data.daily_carbs_target ??
      current.daily_carbs_target,

    daily_fat_target:
      data.daily_fat_target ??
      current.daily_fat_target
  };

  db.prepare(`
    UPDATE users
    SET
      name = ?,
      age_years = ?,
      sex = ?,
      height_cm = ?,
      weight_kg = ?,
      goal = ?,
      activity_level = ?,
      training_days_per_week = ?,
      dietary_preferences = ?,
      food_dislikes = ?,
      daily_calorie_target = ?,
      daily_protein_target = ?,
      daily_carbs_target = ?,
      daily_fat_target = ?
    WHERE id = ?
  `).run(
    updated.name,
    updated.age_years,
    updated.sex,
    updated.height_cm,
    updated.weight_kg,
    updated.goal,
    updated.activity_level,
    updated.training_days_per_week,
    updated.dietary_preferences,
    updated.food_dislikes,
    updated.daily_calorie_target,
    updated.daily_protein_target,
    updated.daily_carbs_target,
    updated.daily_fat_target,
    userId
  );

  return getUser(userId);
}

/* =========================================================
   NORMALIZAÇÃO DE SEXO
========================================================= */

function normalizeSex(value) {
  const sex =
    String(value || "")
      .toLowerCase()
      .trim();

  if (
    [
      "male",
      "masculino",
      "homem",
      "m"
    ].includes(sex)
  ) {
    return "male";
  }

  if (
    [
      "female",
      "feminino",
      "mulher",
      "f"
    ].includes(sex)
  ) {
    return "female";
  }

  return null;
}

/* =========================================================
   NORMALIZAÇÃO DE ATIVIDADE
========================================================= */

function normalizeActivity(value) {
  const activity =
    String(value || "")
      .toLowerCase()
      .trim();

  const activityMap = {
    sedentary: "sedentary",
    sedentario: "sedentary",
    sedentária: "sedentary",

    light: "light",
    leve: "light",

    moderate: "moderate",
    moderado: "moderate",
    moderada: "moderate",

    high: "high",
    alto: "high",
    alta: "high",

    very_high: "very_high",
    "muito alto": "very_high",
    "muito alta": "very_high",
    muito_alto: "very_high",
    muito_alta: "very_high"
  };

  return (
    activityMap[activity] ||
    "sedentary"
  );
}

/* =========================================================
   NORMALIZAÇÃO DO OBJETIVO
========================================================= */

function normalizeGoal(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

/* =========================================================
   CÁLCULO NUTRICIONAL
========================================================= */

export function calculateNutritionTargets(
  profile
) {
  const weight =
    Number(profile.weight_kg);

  const height =
    Number(profile.height_cm);

  const age =
    Number(profile.age_years);

  if (
    !Number.isFinite(weight) ||
    !Number.isFinite(height) ||
    !Number.isFinite(age) ||
    weight <= 0 ||
    height <= 0 ||
    age <= 0
  ) {
    return null;
  }

  const sex =
    normalizeSex(profile.sex);

  if (!sex) {
    return null;
  }

  /* =====================================================
     Mifflin-St Jeor
  ===================================================== */

  let bmr;

  if (sex === "male") {
    bmr =
      (10 * weight) +
      (6.25 * height) -
      (5 * age) +
      5;
  } else {
    bmr =
      (10 * weight) +
      (6.25 * height) -
      (5 * age) -
      161;
  }

  /* =====================================================
     FATOR DE ATIVIDADE
  ===================================================== */

  const activity =
    normalizeActivity(
      profile.activity_level
    );

  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    high: 1.725,
    very_high: 1.9
  };

  const multiplier =
    activityMultipliers[activity];

  const maintenanceCalories =
    bmr * multiplier;

  /* =====================================================
     OBJETIVO
  ===================================================== */

  const goal =
    normalizeGoal(profile.goal);

  let calorieAdjustment = 0;

  let proteinPerKg = 1.6;

  let deficitPercent = 0;

  /* =====================================================
     EMAGRECIMENTO
     
     Utilizamos déficit inicial moderado.
     Isso é uma ESTIMATIVA, não uma prescrição.
  ===================================================== */

  if (
    goal.includes("emagrec") ||
    goal.includes("perder") ||
    goal.includes("defini")
  ) {
    deficitPercent = 15;

    calorieAdjustment =
      -(deficitPercent / 100);

    proteinPerKg = 1.8;
  }

  /* =====================================================
     HIPERTROFIA / GANHO DE MASSA
  ===================================================== */

  else if (
    goal.includes("hipertrof") ||
    goal.includes("massa") ||
    goal.includes("ganho")
  ) {
    calorieAdjustment = 0.08;

    proteinPerKg = 1.8;
  }

  /* =====================================================
     FORTALECIMENTO
  ===================================================== */

  else if (
    goal.includes("fortalec")
  ) {
    calorieAdjustment = 0;

    proteinPerKg = 1.6;
  }

  /* =====================================================
     CORRIDA / RESISTÊNCIA / PERFORMANCE
  ===================================================== */

  else if (
    goal.includes("corrida") ||
    goal.includes("resist") ||
    goal.includes("performance")
  ) {
    calorieAdjustment = 0.05;

    proteinPerKg = 1.6;
  }

  /* =====================================================
     CALORIAS
  ===================================================== */

  let calories =
    maintenanceCalories *
    (1 + calorieAdjustment);

  calories =
    Math.round(calories / 50) * 50;

  /* =====================================================
     PROTEÍNAS
  ===================================================== */

  let protein =
    weight * proteinPerKg;

  protein =
    Math.round(protein / 5) * 5;

  /* =====================================================
     GORDURAS
  ===================================================== */

  let fat =
    (calories * 0.25) / 9;

  const minimumFat =
    weight * 0.6;

  fat =
    Math.max(
      fat,
      minimumFat
    );

  fat =
    Math.round(fat / 5) * 5;

  /* =====================================================
     CARBOIDRATOS
  ===================================================== */

  const caloriesFromProtein =
    protein * 4;

  const caloriesFromFat =
    fat * 9;

  let carbs =
    (
      calories -
      caloriesFromProtein -
      caloriesFromFat
    ) / 4;

  carbs =
    Math.max(
      carbs,
      0
    );

  carbs =
    Math.round(carbs / 5) * 5;

  /* =====================================================
     RETORNO
  ===================================================== */

  return {
    bmr:
      Math.round(bmr),

    maintenance_calories:
      Math.round(
        maintenanceCalories
      ),

    daily_calorie_target:
      calories,

    daily_protein_target:
      protein,

    daily_carbs_target:
      carbs,

    daily_fat_target:
      fat,

    calorie_deficit_percent:
      deficitPercent
  };
}

/* =========================================================
   CALCULAR E SALVAR METAS
========================================================= */

export function calculateAndSaveNutritionTargets(
  userId
) {
  ensureUser(userId);

  const user =
    getUser(userId);

  const targets =
    calculateNutritionTargets(
      user
    );

  if (!targets) {
    return null;
  }

  db.prepare(`
    UPDATE users
    SET
      daily_calorie_target = ?,
      daily_protein_target = ?,
      daily_carbs_target = ?,
      daily_fat_target = ?,
      maintenance_calories = ?,
      calorie_deficit_percent = ?
    WHERE id = ?
  `).run(
    targets.daily_calorie_target,
    targets.daily_protein_target,
    targets.daily_carbs_target,
    targets.daily_fat_target,
    targets.maintenance_calories,
    targets.calorie_deficit_percent,
    userId
  );

  return {
    user:
      getUser(userId),

    targets
  };
}

/* =========================================================
   REFEIÇÕES
========================================================= */

export function saveMeal(
  userId,
  meal
) {
  ensureUser(userId);

  const result =
    db.prepare(`
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
    .prepare(
      "SELECT * FROM meals WHERE id = ?"
    )
    .get(
      result.lastInsertRowid
    );
}

/* =========================================================
   TREINOS
========================================================= */

export function saveWorkout(
  userId,
  workout
) {
  ensureUser(userId);

  const workoutResult =
    db.prepare(`
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

  const workoutId =
    workoutResult.lastInsertRowid;

  if (
    Array.isArray(
      workout.exercises
    )
  ) {
    const insertExercise =
      db.prepare(`
        INSERT INTO exercises (
          workout_id,
          name,
          sets,
          reps,
          weight_kg
        )
        VALUES (?, ?, ?, ?, ?)
      `);

    const insertMany =
      db.transaction(
        (exercises) => {
          for (
            const exercise
            of exercises
          ) {
            insertExercise.run(
              workoutId,
              exercise.name,
              exercise.sets ?? 0,
              exercise.reps ?? 0,
              exercise.weight_kg ?? 0
            );
          }
        }
      );

    insertMany(
      workout.exercises
    );
  }

  return db
    .prepare(
      "SELECT * FROM workouts WHERE id = ?"
    )
    .get(workoutId);
}

/* =========================================================
   PESO
========================================================= */

export function saveWeight(
  userId,
  weightKg
) {
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

  return db.prepare(`
    SELECT *
    FROM weights
    WHERE user_id = ?
    ORDER BY measured_at DESC
    LIMIT 1
  `).get(userId);
}

/* =========================================================
   BUSCAR USUÁRIO
========================================================= */

export function getUser(
  userId
) {
  return db
    .prepare(
      "SELECT * FROM users WHERE id = ?"
    )
    .get(userId);
}

/* =========================================================
   RESUMO DO DIA
========================================================= */

export function getDailySummary(
  userId,
  date = new Date()
) {
  ensureUser(userId);

  const day =
    getBrazilDate(date);

  const meals =
    db.prepare(`
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

  const workouts =
    db.prepare(`
      SELECT
        COUNT(*) AS workout_count,
        COALESCE(
          SUM(duration_min),
          0
        ) AS total_duration_min
      FROM workouts
      WHERE user_id = ?
        AND date(trained_at) = ?
    `).get(
      userId,
      day
    );

  const user =
    getUser(userId);

  return {
    date: day,

    calories:
      meals.calories,

    protein_g:
      meals.protein_g,

    carbs_g:
      meals.carbs_g,

    fat_g:
      meals.fat_g,

    workout_count:
      workouts.workout_count,

    total_duration_min:
      workouts.total_duration_min,

    calorie_target:
      user?.daily_calorie_target ??
      null,

    protein_target:
      user?.daily_protein_target ??
      null,

    carbs_target:
      user?.daily_carbs_target ??
      null,

    fat_target:
      user?.daily_fat_target ??
      null,

    maintenance_calories:
      user?.maintenance_calories ??
      null,

    calorie_deficit_percent:
      user?.calorie_deficit_percent ??
      null
  };
}

/* =========================================================
   HISTÓRICO
========================================================= */

export function getRecentHistory(
  userId,
  limit = 20
) {
  ensureUser(userId);

  const meals =
    db.prepare(`
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

  const workouts =
    db.prepare(`
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

  const weights =
    db.prepare(`
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