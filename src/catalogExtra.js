import fs from "node:fs";

// CAT-08: alimentos extras em JSON (data/catalogo-extra.json ou FITPULSE_CATALOG_EXTRA),
// somados ao catálogo sem editar código. Cada entrada é validada; as inválidas ficam de
// fora e são listadas em `issues` (nunca descartadas em silêncio).
export const EXTRA_SOURCES = ["tbca_verified", "official_nutrition_table", "official_brand", "curated_estimate", "user_label"];

export function validateExtraFood(food, existingIds = new Set()) {
  const errors = [];
  const isNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (!food || typeof food !== "object") return ["entrada não é um objeto"];
  if (typeof food.id !== "string" || !/^[a-z0-9-]+$/.test(food.id)) errors.push("id deve ser minúsculo com hífens");
  else if (existingIds.has(food.id)) errors.push(`id "${food.id}" já existe no catálogo`);
  if (typeof food.name !== "string" || !food.name.trim()) errors.push("name obrigatório");
  if (food.aliases !== undefined && !(Array.isArray(food.aliases) && food.aliases.every((alias) => typeof alias === "string" && alias.trim()))) {
    errors.push("aliases deve ser lista de textos");
  }
  for (const field of ["kcal", "protein", "carbs", "fat"]) {
    if (!isNumber(food[field])) errors.push(`${field} deve ser número >= 0 (por 100 g)`);
  }
  if (!(isNumber(food.default_g) && food.default_g > 0)) errors.push("default_g deve ser número > 0");
  if (typeof food.unit !== "string" || !food.unit.trim()) errors.push("unit obrigatório (ex.: \"100 g\", \"1 unidade\")");
  if (!EXTRA_SOURCES.includes(food.source)) errors.push(`source deve ser um de: ${EXTRA_SOURCES.join(", ")}`);
  if (food.source === "tbca_verified" && !/BRC\d{4}[A-Z]/.test(food.reference || "")) errors.push("tbca_verified exige reference com código TBCA");
  if (errors.length) return errors;

  if (food.protein + food.carbs + food.fat > 100) errors.push("macros somam mais de 100 g por 100 g");
  const fromMacros = food.protein * 4 + food.carbs * 4 + food.fat * 9;
  if (food.kcal > 20 && Math.abs(fromMacros - food.kcal) / food.kcal > 0.3) {
    errors.push(`kcal (${food.kcal}) não bate com os macros (~${Math.round(fromMacros)})`);
  }
  return errors;
}

export function loadExtraFoods(filePath, existingIds = new Set()) {
  if (!filePath || !fs.existsSync(filePath)) return { foods: [], issues: [] };
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return { foods: [], issues: [{ id: null, errors: [`JSON inválido: ${error.message}`] }] };
  }
  if (!Array.isArray(entries)) return { foods: [], issues: [{ id: null, errors: ["o arquivo deve conter uma lista"] }] };

  const ids = new Set(existingIds);
  const foods = [];
  const issues = [];
  for (const entry of entries) {
    const errors = validateExtraFood(entry, ids);
    if (errors.length) {
      issues.push({ id: entry?.id ?? null, errors });
      continue;
    }
    ids.add(entry.id);
    const { id, name, aliases = [], kcal, protein, carbs, fat, default_g, unit, source, reference } = entry;
    foods.push({ id, name, aliases, kcal, protein, carbs, fat, default_g, unit, source, ...(reference ? { reference } : {}) });
  }
  return { foods, issues };
}
