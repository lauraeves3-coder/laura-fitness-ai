import Database from "better-sqlite3";
import { calculateNutritionBalance, validateMealRecord } from "./nutrition.js";
import { validateWorkoutRecord } from "./workouts.js";

// FITPULSE_DB_PATH permite que os testes usem um banco temporário; sem ela, o
// comportamento de produção (fitness.db na pasta do projeto) não muda.
const db = new Database(process.env.FITPULSE_DB_PATH || "fitness.db");

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
    macro_target_mode TEXT,
    free_meal_setup_status TEXT NOT NULL DEFAULT 'unknown',
    free_meal_enabled INTEGER NOT NULL DEFAULT 0,
    free_meals_per_week INTEGER NOT NULL DEFAULT 0,
    free_meal_days TEXT NOT NULL DEFAULT '[]',
    free_meal_period TEXT,
    free_meal_preferences TEXT NOT NULL DEFAULT '[]',
    pending_meal_clarification TEXT,

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
    consumed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meal_period TEXT,
    plan_id INTEGER,
    plan_option_index INTEGER
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

  CREATE TABLE IF NOT EXISTS user_foods (
    user_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '[]',
    kcal REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    default_g REAL NOT NULL,
    unit TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, id)
  );

  CREATE TABLE IF NOT EXISTS whatsapp_messages (
    message_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    reply TEXT,
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    plan_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed',
    plan_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, plan_date)
  );

  CREATE TABLE IF NOT EXISTS meal_plan_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    meal_period TEXT,
    option_index INTEGER,
    meal_id INTEGER,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS water_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount_ml REAL NOT NULL,
    logged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

ensureColumn(
  "users",
  "calorie_target_mode",
  "TEXT"
);
ensureColumn("users", "macro_target_mode", "TEXT");
ensureColumn("users", "free_meal_setup_status", "TEXT");
ensureColumn("users", "free_meal_enabled", "INTEGER");
ensureColumn("users", "free_meals_per_week", "INTEGER");
ensureColumn("users", "free_meal_days", "TEXT");
ensureColumn("users", "free_meal_period", "TEXT");
ensureColumn("users", "free_meal_preferences", "TEXT");
ensureColumn("users", "pending_meal_clarification", "TEXT");
ensureColumn("users", "water_goal_ml", "REAL");
ensureColumn("meals", "meal_period", "TEXT");
ensureColumn("users", "reminder_water", "INTEGER DEFAULT 0");
ensureColumn("users", "reminder_summary_time", "TEXT");
db.exec(`
  CREATE TABLE IF NOT EXISTS reminder_log (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, key)
  );
`);
ensureColumn("meals", "plan_id", "INTEGER");
ensureColumn("meals", "plan_option_index", "INTEGER");
db.prepare("UPDATE users SET calorie_target_mode = 'automatic' WHERE calorie_target_mode IS NULL").run();
db.prepare("UPDATE users SET macro_target_mode = 'automatic' WHERE macro_target_mode IS NULL").run();
db.prepare("UPDATE users SET free_meal_setup_status = 'unknown' WHERE free_meal_setup_status IS NULL").run();
db.prepare("UPDATE users SET free_meal_enabled = 0 WHERE free_meal_enabled IS NULL").run();
db.prepare("UPDATE users SET free_meals_per_week = 0 WHERE free_meals_per_week IS NULL").run();
db.prepare("UPDATE users SET free_meal_days = '[]' WHERE free_meal_days IS NULL").run();
db.prepare("UPDATE users SET free_meal_preferences = '[]' WHERE free_meal_preferences IS NULL").run();

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
      current.daily_fat_target,

    free_meal_setup_status:
      data.free_meal_setup_status ??
      current.free_meal_setup_status,

    free_meal_enabled:
      data.free_meal_enabled ??
      current.free_meal_enabled,

    free_meals_per_week:
      data.free_meals_per_week ??
      current.free_meals_per_week,

    free_meal_days:
      data.free_meal_days ??
      current.free_meal_days,

    free_meal_period:
      data.free_meal_period ??
      current.free_meal_period,

    free_meal_preferences:
      data.free_meal_preferences ??
      current.free_meal_preferences
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
      daily_fat_target = ?,
      free_meal_setup_status = ?,
      free_meal_enabled = ?,
      free_meals_per_week = ?,
      free_meal_days = ?,
      free_meal_period = ?,
      free_meal_preferences = ?
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
    updated.free_meal_setup_status,
    updated.free_meal_enabled,
    updated.free_meals_per_week,
    updated.free_meal_days,
    updated.free_meal_period,
    updated.free_meal_preferences,
    userId
  );

  if (Object.prototype.hasOwnProperty.call(data, "daily_calorie_target")) {
    db.prepare("UPDATE users SET calorie_target_mode = 'custom' WHERE id = ?").run(userId);
  }
  if (["daily_protein_target", "daily_carbs_target", "daily_fat_target"].some((key) =>
    Object.prototype.hasOwnProperty.call(data, key)
  )) {
    db.prepare("UPDATE users SET macro_target_mode = 'custom' WHERE id = ?").run(userId);
  }

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
   REFEIÇÃO LIVRE
========================================================= */

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeFreeMealDays(value) {
  const aliases = {
    "domingo": "domingo",
    "segunda": "segunda-feira",
    "segunda-feira": "segunda-feira",
    "terca": "terça-feira",
    "terca-feira": "terça-feira",
    "quarta": "quarta-feira",
    "quarta-feira": "quarta-feira",
    "quinta": "quinta-feira",
    "quinta-feira": "quinta-feira",
    "sexta": "sexta-feira",
    "sexta-feira": "sexta-feira",
    "sabado": "sábado",
    "sabado": "sábado"
  };

  const items = Array.isArray(value) ? value : String(value || "").split(/[,;|]/);
  return [...new Set(
    items
      .map((item) => String(item || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .trim())
      .map((item) => aliases[item] || null)
      .filter(Boolean)
  )];
}

export function getFreeMealSettings(userId) {
  ensureUser(userId);
  const user = getUser(userId);
  return {
    setup_status: user?.free_meal_setup_status || "unknown",
    enabled: Number(user?.free_meal_enabled || 0) === 1,
    meals_per_week: Math.max(0, Number(user?.free_meals_per_week || 0)),
    days: normalizeFreeMealDays(parseJsonArray(user?.free_meal_days)),
    period: user?.free_meal_period || null,
    preferences: parseJsonArray(user?.free_meal_preferences)
  };
}

export function setFreeMealSettings(userId, settings = {}) {
  ensureUser(userId);
  const current = getFreeMealSettings(userId);

  const setupStatus =
    typeof settings.setup_status === "string"
      ? settings.setup_status
      : current.setup_status;

  const enabled =
    settings.enabled === undefined
      ? current.enabled
      : Boolean(settings.enabled);

  const mealsPerWeek =
    settings.meals_per_week === undefined
      ? current.meals_per_week
      : Math.max(0, Math.min(7, Math.round(Number(settings.meals_per_week) || 0)));

  const days =
    settings.days === undefined
      ? current.days
      : normalizeFreeMealDays(settings.days);

  const period =
    settings.period === undefined
      ? current.period
      : (settings.period ? String(settings.period) : null);

  const preferences =
    settings.preferences === undefined
      ? current.preferences
      : [...new Set(
          (Array.isArray(settings.preferences) ? settings.preferences : [settings.preferences])
            .map((item) => String(item || "").trim())
            .filter(Boolean)
            .slice(0, 20)
        )];

  db.prepare(`
    UPDATE users
    SET
      free_meal_setup_status = ?,
      free_meal_enabled = ?,
      free_meals_per_week = ?,
      free_meal_days = ?,
      free_meal_period = ?,
      free_meal_preferences = ?
    WHERE id = ?
  `).run(
    setupStatus,
    enabled ? 1 : 0,
    mealsPerWeek,
    JSON.stringify(days),
    period,
    JSON.stringify(preferences),
    userId
  );

  return getFreeMealSettings(userId);
}

export function addFreeMealPreference(userId, preference) {
  const current = getFreeMealSettings(userId);
  const normalized = String(preference || "").trim();
  if (!normalized) return current;

  return setFreeMealSettings(userId, {
    setup_status: current.setup_status,
    preferences: [...current.preferences, normalized]
  });
}


export function getPendingMealClarification(userId) {
  ensureUser(userId);
  const user = getUser(userId);
  if (!user?.pending_meal_clarification) return null;

  try {
    const parsed = JSON.parse(user.pending_meal_clarification);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function setPendingMealClarification(userId, data) {
  ensureUser(userId);
  const value = data ? JSON.stringify(data) : null;
  db.prepare(
    "UPDATE users SET pending_meal_clarification = ? WHERE id = ?"
  ).run(value, userId);
  return getPendingMealClarification(userId);
}

export function clearPendingMealClarification(userId) {
  ensureUser(userId);
  db.prepare(
    "UPDATE users SET pending_meal_clarification = NULL WHERE id = ?"
  ).run(userId);
  return null;
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

  const calorieTarget = user.calorie_target_mode === "custom"
    ? user.daily_calorie_target
    : targets.daily_calorie_target;
  const macros = user.macro_target_mode === "custom"
    ? {
        protein: user.daily_protein_target,
        carbs: user.daily_carbs_target,
        fat: user.daily_fat_target
      }
    : {
        protein: targets.daily_protein_target,
        carbs: targets.daily_carbs_target,
        fat: targets.daily_fat_target
      };

  db.prepare(`
    UPDATE users
    SET
      daily_calorie_target = ?,
      daily_protein_target = ?,
      daily_carbs_target = ?,
      daily_fat_target = ?,
      maintenance_calories = ?,
      calorie_deficit_percent = ?,
      calorie_target_mode = CASE WHEN calorie_target_mode = 'custom' THEN 'custom' ELSE 'automatic' END,
      macro_target_mode = CASE WHEN macro_target_mode = 'custom' THEN 'custom' ELSE 'automatic' END
    WHERE id = ?
  `).run(
    calorieTarget,
    macros.protein,
    macros.carbs,
    macros.fat,
    targets.maintenance_calories,
    targets.calorie_deficit_percent,
    userId
  );

  const savedUser = getUser(userId);
  return {
    user: savedUser,
    targets: {
      ...targets,
      daily_calorie_target: savedUser.daily_calorie_target,
      daily_protein_target: savedUser.daily_protein_target,
      daily_carbs_target: savedUser.daily_carbs_target,
      daily_fat_target: savedUser.daily_fat_target,
      calorie_target_mode: savedUser.calorie_target_mode,
      macro_target_mode: savedUser.macro_target_mode
    }
  };
}

export function setCustomCalorieTarget(
  userId,
  calories
) {
  ensureUser(userId);

  const targetCalories =
    Math.round(Number(calories));

  // NUT-17: acima de 10.000 kcal só pode ser erro de digitação.
  if (
    !Number.isFinite(targetCalories) ||
    targetCalories <= 0 ||
    targetCalories > 10000
  ) {
    return null;
  }

  db.prepare(`
    UPDATE users
    SET daily_calorie_target = ?, calorie_target_mode = 'custom'
    WHERE id = ?
  `).run(
    targetCalories,
    userId
  );

  return getUser(userId);
}

export function setCustomMacroTargets(userId, macros) {
  ensureUser(userId);
  const current = getUser(userId);
  const values = {
    protein_g: Object.prototype.hasOwnProperty.call(macros, "protein_g")
      ? Number(macros.protein_g) : current.daily_protein_target,
    carbs_g: Object.prototype.hasOwnProperty.call(macros, "carbs_g")
      ? Number(macros.carbs_g) : current.daily_carbs_target,
    fat_g: Object.prototype.hasOwnProperty.call(macros, "fat_g")
      ? Number(macros.fat_g) : current.daily_fat_target
  };
  if (Object.values(values).some((value) => value !== null && value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1000))) {
    return null;
  }
  db.prepare(`
    UPDATE users SET daily_protein_target = ?, daily_carbs_target = ?,
      daily_fat_target = ?, macro_target_mode = 'custom'
    WHERE id = ?
  `).run(values.protein_g, values.carbs_g, values.fat_g, userId);
  return getUser(userId);
}

export function restoreAutomaticNutritionTargets(userId) {
  ensureUser(userId);
  if (!calculateNutritionTargets(getUser(userId))) return null;
  db.prepare(`
    UPDATE users SET calorie_target_mode = 'automatic', macro_target_mode = 'automatic'
    WHERE id = ?
  `).run(userId);
  return calculateAndSaveNutritionTargets(userId);
}

/* =========================================================
   REFEIÇÕES
========================================================= */

export function saveMeal(
  userId,
  meal
) {
  ensureUser(userId);

  // Última barreira: dados inválidos não chegam ao banco (NUT-24).
  if (!validateMealRecord(meal).valid) {
    return null;
  }

  // CONV-03: refeição de um dia anterior ("ontem no jantar comi…"). Nunca no futuro.
  const now = getBrazilDateTime();
  const consumedAt = meal.consumed_at ?? now;
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(consumedAt) || consumedAt > now) {
    return null;
  }

  const result =
    db.prepare(`
      INSERT INTO meals (
        user_id,
        description,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        consumed_at,
        meal_period,
        plan_id,
        plan_option_index
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      meal.description,
      meal.calories ?? 0,
      meal.protein_g ?? 0,
      meal.carbs_g ?? 0,
      meal.fat_g ?? 0,
      consumedAt,
      meal.meal_period ?? null,
      meal.plan_id ?? null,
      meal.plan_option_index ?? null
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

  // MUS-01: dados inválidos não chegam ao banco; treino e exercícios numa transação.
  if (!validateWorkoutRecord(workout).valid) {
    return null;
  }

  return db.transaction(() => {
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

    return getWorkoutWithExercises(workoutId);
  })();
}

function getWorkoutWithExercises(workoutId) {
  const workout = db.prepare("SELECT * FROM workouts WHERE id = ?").get(workoutId);
  if (!workout) return null;
  return {
    ...workout,
    exercises: db.prepare(
      "SELECT name, sets, reps, weight_kg FROM exercises WHERE workout_id = ? ORDER BY id"
    ).all(workoutId)
  };
}

// MUS-01: treinos com exercícios entre duas datas "YYYY-MM-DD" (inclusive).
export function getWorkoutsBetween(userId, startDate, endDate) {
  ensureUser(userId);
  return db.prepare(`
    SELECT id FROM workouts
    WHERE user_id = ? AND date(trained_at) BETWEEN ? AND ?
    ORDER BY trained_at, id
  `).all(userId, startDate, endDate).map(({ id }) => getWorkoutWithExercises(id));
}

/* =========================================================
   PESO
========================================================= */

export function saveWeight(
  userId,
  weightKg
) {
  ensureUser(userId);

  // CRP-01: peso implausível não entra no histórico nem no perfil (usado nas metas).
  const weight = Number(weightKg);
  if (!Number.isFinite(weight) || weight < 20 || weight > 400) {
    return null;
  }

  const inserted = db.prepare(`
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

  // Pela linha inserida: duas pesagens no mesmo segundo têm o mesmo measured_at.
  return db.prepare(`
    SELECT *
    FROM weights
    WHERE id = ?
  `).get(inserted.lastInsertRowid);
}

/* =========================================================
   LEMBRETES (CONV-11 / ARQ-04)
========================================================= */

export function setReminder(userId, { water, summaryTime }) {
  ensureUser(userId);
  if (water !== undefined) db.prepare(`UPDATE users SET reminder_water = ? WHERE id = ?`).run(water ? 1 : 0, userId);
  if (summaryTime !== undefined) db.prepare(`UPDATE users SET reminder_summary_time = ? WHERE id = ?`).run(summaryTime, userId);
  return getUser(userId);
}

export function getReminderUsers() {
  return db.prepare(`
    SELECT * FROM users
    WHERE reminder_water = 1 OR reminder_summary_time IS NOT NULL
  `).all();
}

export function wasReminderSent(userId, key) {
  return Boolean(db.prepare(`SELECT 1 FROM reminder_log WHERE user_id = ? AND key = ?`).get(userId, key));
}

export function markReminderSent(userId, key) {
  db.prepare(`INSERT OR IGNORE INTO reminder_log (user_id, key) VALUES (?, ?)`).run(userId, key);
}

/* =========================================================
   ALIMENTOS CADASTRADOS PELA USUÁRIA (CAT-09)
========================================================= */

// Valores por 100 g. Recadastrar o mesmo id substitui os valores.
export function saveUserFood(userId, food) {
  ensureUser(userId);
  db.prepare(`
    INSERT INTO user_foods (user_id, id, name, aliases, kcal, protein, carbs, fat, default_g, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, id) DO UPDATE SET
      name = excluded.name, aliases = excluded.aliases, kcal = excluded.kcal,
      protein = excluded.protein, carbs = excluded.carbs, fat = excluded.fat,
      default_g = excluded.default_g, unit = excluded.unit
  `).run(userId, food.id, food.name, JSON.stringify(food.aliases || []),
    food.kcal, food.protein, food.carbs, food.fat, food.default_g, food.unit);
  return getUserFoods(userId).find(({ id }) => id === food.id) || null;
}

export function getUserFoods(userId) {
  return db.prepare(`SELECT * FROM user_foods WHERE user_id = ? ORDER BY created_at, id`).all(userId)
    .map(({ user_id, created_at, aliases, ...food }) => ({ ...food, aliases: JSON.parse(aliases || "[]"), source: "user_label" }));
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

  const calorieTarget =
    user?.daily_calorie_target ??
    null;

  const proteinTarget =
    user?.daily_protein_target ??
    null;

  const carbsTarget =
    user?.daily_carbs_target ??
    null;

  const fatTarget =
    user?.daily_fat_target ??
    null;

  const balance = calculateNutritionBalance(
    {
      calorie_target: calorieTarget,
      protein_target: proteinTarget,
      carbs_target: carbsTarget,
      fat_target: fatTarget
    },
    meals
  );
  const calorieRemaining = balance.metrics.calories.remaining;
  const proteinRemaining = balance.metrics.protein_g.remaining;
  const carbsRemaining = balance.metrics.carbs_g.remaining;
  const fatRemaining = balance.metrics.fat_g.remaining;

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
      calorieTarget,

    protein_target:
      proteinTarget,

    carbs_target:
      carbsTarget,

    fat_target:
      fatTarget,

    calorie_remaining:
      calorieRemaining,

    protein_remaining:
      proteinRemaining,

    carbs_remaining:
      carbsRemaining,

    fat_remaining:
      fatRemaining,

    balance_status:
      Object.fromEntries(
        Object.entries(balance.metrics).map(([key, value]) => [key, value.status])
      ),

    macros_compatible:
      balance.macros_compatible,

    macro_calorie_total:
      balance.macro_calorie_total,

    macro_calorie_difference:
      balance.macro_calorie_difference,

    calorie_target_mode:
      user?.calorie_target_mode ?? "automatic",

    macro_target_mode:
      user?.macro_target_mode ?? "automatic",

    maintenance_calories:
      user?.maintenance_calories ??
      null,

    calorie_deficit_percent:
      user?.calorie_deficit_percent ??
      null
  };
}

/* =========================================================
   REFEIÇÕES, CORREÇÕES E PLANO ALIMENTAR
========================================================= */

export function getTodayMeals(userId, date = new Date()) {
  ensureUser(userId);
  return db.prepare(`
    SELECT id, description, calories, protein_g, carbs_g, fat_g,
           consumed_at, meal_period, plan_id, plan_option_index
    FROM meals
    WHERE user_id = ? AND date(consumed_at) = ?
    ORDER BY consumed_at
  `).all(userId, getBrazilDate(date));
}

// NUT-13: mesma refeição (descrição normalizada e calorias) do mesmo usuário gravada há
// no máximo windowMinutes. Usada para não gravar de novo um reenvio ou uma segunda
// chamada do agente na mesma conversa.
export function findRecentDuplicateMeal(userId, meal, { windowMinutes = 10, now = new Date() } = {}) {
  ensureUser(userId);
  const normalize = (value) => String(value || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
  const description = normalize(meal?.description);
  const calories = Number(meal?.calories);
  if (!description || !Number.isFinite(calories)) return null;
  const since = getBrazilDateTime(new Date(now.getTime() - windowMinutes * 60000));
  const until = getBrazilDateTime(now);
  return db.prepare(`
    SELECT * FROM meals
    WHERE user_id = ? AND consumed_at >= ? AND consumed_at <= ?
    ORDER BY id DESC
  `).all(userId, since, until)
    .find((row) => normalize(row.description) === description && Math.abs(Number(row.calories) - calories) < 1)
    || null;
}

// NUT-14: refeições entre duas datas "YYYY-MM-DD" (inclusive), em ordem cronológica.
export function getMealsBetween(userId, startDate, endDate) {
  ensureUser(userId);
  return db.prepare(`
    SELECT id, description, calories, protein_g, carbs_g, fat_g, consumed_at, meal_period
    FROM meals
    WHERE user_id = ? AND date(consumed_at) BETWEEN ? AND ?
    ORDER BY consumed_at, id
  `).all(userId, startDate, endDate);
}

export function getMeal(userId, mealId) {
  ensureUser(userId);
  const id = Number(mealId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return db.prepare("SELECT * FROM meals WHERE id = ? AND user_id = ?").get(id, userId) || null;
}

// NUT-11: exclusão rastreável. A cópia completa da refeição fica em meal_plan_events
// ("meal_deleted") antes de a linha sair de meals, na mesma transação.
export function deleteMeal(userId, mealId, { requestEventId = null } = {}) {
  ensureUser(userId);
  const id = Number(mealId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return db.transaction(() => {
    const meal = db.prepare("SELECT * FROM meals WHERE id = ? AND user_id = ?").get(id, userId);
    if (!meal) return null;
    recordMealPlanEvent(userId, {
      plan_id: meal.plan_id,
      event_type: "meal_deleted",
      meal_period: meal.meal_period,
      meal_id: meal.id,
      details: { meal, request_event_id: requestEventId }
    });
    db.prepare("DELETE FROM meals WHERE id = ? AND user_id = ?").run(id, userId);
    return meal;
  })();
}

// Pedido de exclusão aguardando confirmação: o evento mais recente de exclusão do
// usuário é um pedido feito há no máximo maxAgeMinutes.
export function getPendingMealDeletion(userId, { maxAgeMinutes = 15, now = new Date() } = {}) {
  ensureUser(userId);
  const latest = db.prepare(`
    SELECT * FROM meal_plan_events
    WHERE user_id = ?
      AND event_type IN ('meal_deletion_requested', 'meal_deleted', 'meal_deletion_cancelled')
    ORDER BY id DESC LIMIT 1
  `).get(userId);
  if (!latest || latest.event_type !== "meal_deletion_requested") return null;
  const ageMs = Date.parse(getBrazilDateTime(now).replace(" ", "T")) - Date.parse(latest.created_at.replace(" ", "T"));
  if (!(ageMs >= 0 && ageMs <= maxAgeMinutes * 60000)) return null;
  return { ...latest, details: latest.details_json ? JSON.parse(latest.details_json) : null };
}

export function correctMeal(userId, mealId, meal) {
  ensureUser(userId);
  const id = Number(mealId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!validateMealRecord(meal).valid) return null;
  const result = db.prepare(`
    UPDATE meals
    SET description = ?, calories = ?, protein_g = ?, carbs_g = ?, fat_g = ?
    WHERE id = ? AND user_id = ?
  `).run(
    meal.description,
    meal.calories ?? 0,
    meal.protein_g ?? 0,
    meal.carbs_g ?? 0,
    meal.fat_g ?? 0,
    id,
    userId
  );
  return result.changes
    ? db.prepare("SELECT * FROM meals WHERE id = ? AND user_id = ?").get(id, userId)
    : null;
}

export function saveMealPlan(userId, plan) {
  ensureUser(userId);
  const day = plan.date || getBrazilDate();
  db.prepare(`
    INSERT INTO meal_plans (user_id, plan_date, status, plan_json, updated_at)
    VALUES (?, ?, 'proposed', ?, ?)
    ON CONFLICT(user_id, plan_date) DO UPDATE SET
      status = 'proposed', plan_json = excluded.plan_json,
      updated_at = excluded.updated_at
  `).run(userId, day, JSON.stringify(plan), getBrazilDateTime());
  const row = db.prepare(
    "SELECT * FROM meal_plans WHERE user_id = ? AND plan_date = ?"
  ).get(userId, day);
  return { ...row, plan: JSON.parse(row.plan_json) };
}

export function getMealPlan(userId, date = new Date()) {
  ensureUser(userId);
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : getBrazilDate(date);
  const row = db.prepare(
    "SELECT * FROM meal_plans WHERE user_id = ? AND plan_date = ?"
  ).get(userId, day);
  return row ? { ...row, plan: JSON.parse(row.plan_json) } : null;
}

export function updateMealPlanStatus(userId, date, status) {
  const allowed = ["proposed", "intended", "declined", "in_progress", "completed", "adapted"];
  if (!allowed.includes(status)) throw new Error("Invalid meal plan status");
  const day = date || getBrazilDate();
  const result = db.prepare(`
    UPDATE meal_plans SET status = ?, updated_at = ?
    WHERE user_id = ? AND plan_date = ?
  `).run(status, getBrazilDateTime(), userId, day);
  return result.changes
    ? getMealPlan(userId, day)
    : null;
}

export function recordMealPlanEvent(userId, event) {
  ensureUser(userId);
  const result = db.prepare(`
    INSERT INTO meal_plan_events (
      plan_id, user_id, event_type, meal_period, option_index, meal_id, details_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.plan_id ?? null,
    userId,
    event.event_type,
    event.meal_period ?? null,
    event.option_index ?? null,
    event.meal_id ?? null,
    event.details ? JSON.stringify(event.details) : null,
    getBrazilDateTime()
  );
  return db.prepare("SELECT * FROM meal_plan_events WHERE id = ?").get(result.lastInsertRowid);
}

export function consumeMealSelection(userId, {
  selectionEventId,
  mealPeriod,
  date = new Date()
} = {}) {
  ensureUser(userId);
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : getBrazilDate(date);

  return db.transaction(() => {
    let selectionRow;
    const id = Number(selectionEventId);

    if (Number.isInteger(id) && id > 0) {
      selectionRow = db.prepare(`
        SELECT * FROM meal_plan_events
        WHERE id = ? AND user_id = ?
          AND event_type IN ('option_chosen', 'suggestion_offered')
          AND (? IS NULL OR meal_period = ?)
          AND date(created_at) = ?
      `).get(id, userId, mealPeriod ?? null, mealPeriod ?? null, day);
    } else {
      selectionRow = db.prepare(`
        SELECT * FROM meal_plan_events
        WHERE user_id = ?
          AND event_type IN ('option_chosen', 'suggestion_offered')
          AND (? IS NULL OR meal_period = ?)
          AND date(created_at) = ?
        ORDER BY id DESC LIMIT 1
      `).get(userId, mealPeriod ?? null, mealPeriod ?? null, day);
    }

    if (!selectionRow) return null;

    const selection = {
      ...selectionRow,
      details: selectionRow.details_json
        ? JSON.parse(selectionRow.details_json)
        : null
    };
    const option = selection.details?.option;

    if (!option || typeof option.name !== "string") return null;

    if (selection.meal_id !== null) {
      const meal = db.prepare(
        "SELECT * FROM meals WHERE id = ? AND user_id = ?"
      ).get(selection.meal_id, userId);
      return { alreadyConsumed: true, selection, meal: meal || null };
    }

    // Backfill the association for consumption events created by the old flow.
    const previousConsumption = db.prepare(`
      SELECT consumed.meal_id
      FROM meal_plan_events AS consumed
      WHERE consumed.user_id = ?
        AND consumed.event_type = 'meal_consumed'
        AND consumed.id > ?
        AND consumed.meal_period IS ?
        AND consumed.option_index IS ?
        AND consumed.plan_id IS ?
        AND date(consumed.created_at) = ?
        AND NOT EXISTS (
          SELECT 1 FROM meal_plan_events AS later_selection
          WHERE later_selection.user_id = consumed.user_id
            AND later_selection.event_type IN ('option_chosen', 'suggestion_offered')
            AND later_selection.meal_period IS consumed.meal_period
            AND later_selection.id > ?
            AND later_selection.id < consumed.id
        )
      ORDER BY consumed.id LIMIT 1
    `).get(
      userId,
      selection.id,
      selection.meal_period,
      selection.option_index,
      selection.plan_id,
      day,
      selection.id
    );

    if (previousConsumption) {
      db.prepare("UPDATE meal_plan_events SET meal_id = ? WHERE id = ? AND user_id = ?")
        .run(previousConsumption.meal_id, selection.id, userId);
      const meal = previousConsumption.meal_id
        ? db.prepare("SELECT * FROM meals WHERE id = ? AND user_id = ?")
            .get(previousConsumption.meal_id, userId) || null
        : null;
      return { alreadyConsumed: true, selection, meal };
    }

    const meal = saveMeal(userId, {
      description: option.name,
      calories: option.calories,
      protein_g: option.protein_g,
      carbs_g: option.carbs_g,
      fat_g: option.fat_g,
      meal_period: selection.meal_period,
      plan_id: selection.plan_id,
      plan_option_index: selection.option_index
    });

    db.prepare(`
      UPDATE meal_plan_events SET meal_id = ?
      WHERE id = ? AND user_id = ?
    `).run(meal.id, selection.id, userId);

    recordMealPlanEvent(userId, {
      plan_id: selection.plan_id,
      event_type: "meal_consumed",
      meal_period: selection.meal_period,
      option_index: selection.option_index,
      meal_id: meal.id,
      details: { selection_event_id: selection.id }
    });

    return { alreadyConsumed: false, selection, meal };
  })();
}

export function getMealPlanHistory(userId, limit = 30) {
  ensureUser(userId);
  return db.prepare(`
    SELECT * FROM meal_plan_events
    WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
  `).all(userId, limit).map((row) => ({
    ...row,
    details: row.details_json ? JSON.parse(row.details_json) : null
  }));
}

export function getLatestMealPlanEvent(userId, eventType, mealPeriod = null, date = new Date()) {
  ensureUser(userId);
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : getBrazilDate(date);
  const row = db.prepare(`
    SELECT * FROM meal_plan_events
    WHERE user_id = ? AND event_type = ?
      AND (? IS NULL OR meal_period = ?)
      AND date(created_at) = ?
    ORDER BY created_at DESC, id DESC LIMIT 1
  `).get(userId, eventType, mealPeriod, mealPeriod, day);
  return row
    ? { ...row, details: row.details_json ? JSON.parse(row.details_json) : null }
    : null;
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

/* =========================================================
   IDEMPOTÊNCIA DO WEBHOOK WHATSAPP
========================================================= */

export function claimWhatsAppMessage(messageId) {
  db.prepare(`
    DELETE FROM whatsapp_messages
    WHERE received_at < datetime('now', '-30 days')
  `).run();

  const inserted = db.prepare(`
    INSERT OR IGNORE INTO whatsapp_messages (
      message_id,
      status
    )
    VALUES (?, 'processing')
  `).run(messageId);

  if (inserted.changes === 1) {
    return {
      claimed: true,
      status: "processing",
      reply: null
    };
  }

  const reclaimed = db.prepare(`
    UPDATE whatsapp_messages
    SET updated_at = CURRENT_TIMESTAMP
    WHERE message_id = ?
      AND status = 'processing'
      AND updated_at < datetime('now', '-15 minutes')
  `).run(messageId);

  if (reclaimed.changes === 1) {
    return {
      claimed: true,
      status: "processing",
      reply: null
    };
  }

  const existing = db.prepare(`
    SELECT status, reply
    FROM whatsapp_messages
    WHERE message_id = ?
  `).get(messageId);

  return {
    claimed: false,
    status: existing?.status || "processing",
    reply: existing?.reply || null
  };
}

export function completeWhatsAppMessage(messageId, reply) {
  db.prepare(`
    UPDATE whatsapp_messages
    SET
      status = 'ready',
      reply = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE message_id = ?
      AND status = 'processing'
  `).run(reply, messageId);
}

export function markWhatsAppMessageSent(messageId) {
  db.prepare(`
    UPDATE whatsapp_messages
    SET
      status = 'sent',
      updated_at = CURRENT_TIMESTAMP
    WHERE message_id = ?
      AND status = 'ready'
  `).run(messageId);
}

export function releaseWhatsAppMessage(messageId) {
  db.prepare(`
    DELETE FROM whatsapp_messages
    WHERE message_id = ?
      AND status = 'processing'
  `).run(messageId);
}

/* =========================================================
   HIDRATAÇÃO (HID-01, HID-02)
========================================================= */

// HID-02: registra um consumo de água em ml
export function saveWaterLog(userId, amount_ml) {
  ensureUser(userId);
  const stmt = db.prepare(`
    INSERT INTO water_logs (user_id, amount_ml, logged_at)
    VALUES (?, ?, ?)
  `);
  const info = stmt.run(userId, Number(amount_ml), getBrazilDateTime());
  return { id: info.lastInsertRowid, user_id: userId, amount_ml: Number(amount_ml) };
}

// HID-02: total de água consumida hoje (em ml)
export function getTodayWaterTotal(userId, date = new Date()) {
  ensureUser(userId);
  const day = getBrazilDate(date);
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount_ml), 0) AS total_ml
    FROM water_logs
    WHERE user_id = ? AND date(logged_at) = ?
  `).get(userId, day);
  return Number(row?.total_ml || 0);
}

// HID-01: define meta diária de água (em ml)
export function setWaterGoal(userId, goal_ml) {
  ensureUser(userId);
  db.prepare(`UPDATE users SET water_goal_ml = ? WHERE id = ?`).run(Number(goal_ml), userId);
  return { user_id: userId, water_goal_ml: Number(goal_ml) };
}
