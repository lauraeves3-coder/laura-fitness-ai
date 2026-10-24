// CAT-08: alimentos extras em JSON entram no catálogo sem editar código.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadExtraFoods, validateExtraFood } from "../src/catalogExtra.js";
import { CATALOG_EXTRA_ISSUES } from "../src/nutritionCatalog.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const valid = {
  id: "bolo-de-fuba-teste", name: "Bolo de fubá (teste)", aliases: ["bolo de fubá teste"],
  kcal: 330, protein: 5, carbs: 50, fat: 12, default_g: 60, unit: "1 fatia", source: "curated_estimate"
};
const writeTemp = (content) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fp-extra-")), "extra.json");
  fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
  return file;
};

test("CAT-08: o arquivo versionado de extras carrega sem problemas", () => {
  assert.deepEqual(CATALOG_EXTRA_ISSUES, []);
});

test("CAT-08: entrada válida passa; inválidas são listadas com o motivo", () => {
  assert.deepEqual(validateExtraFood(valid), []);
  assert.match(validateExtraFood({ ...valid, id: "Bolo Fubá" }).join(), /id deve ser/);
  assert.match(validateExtraFood({ ...valid, kcal: -1 }).join(), /kcal deve ser/);
  assert.match(validateExtraFood({ ...valid, kcal: 900 }).join(), /não bate com os macros/);
  assert.match(validateExtraFood({ ...valid, source: "tbca_verified" }).join(), /exige reference/);
  assert.match(validateExtraFood(valid, new Set(["bolo-de-fuba-teste"])).join(), /já existe/);

  const { foods, issues } = loadExtraFoods(writeTemp([valid, { ...valid, id: "outro", fat: 90, carbs: 50 }]));
  assert.deepEqual(foods.map((food) => food.id), ["bolo-de-fuba-teste"]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].id, "outro");
  assert.match(loadExtraFoods(writeTemp("{ruim")).issues[0].errors[0], /JSON inválido/);
  assert.deepEqual(loadExtraFoods(path.join(os.tmpdir(), "nao-existe.json")), { foods: [], issues: [] });
});

test("CAT-08: alimento do JSON é reconhecido no registro", () => {
  const output = execFileSync(process.execPath, ["-e", `
    const m = await import(${JSON.stringify(new URL("../src/nutritionCatalog.js", import.meta.url).href)});
    const estimate = m.estimateMealFromText("comi 2 fatias de bolo de fubá teste");
    console.log(JSON.stringify(estimate.matched_items.map((item) => [item.id, item.grams])));
  `], { cwd: repo, env: { ...process.env, FITPULSE_CATALOG_EXTRA: writeTemp([valid]) }, encoding: "utf8" });
  assert.deepEqual(JSON.parse(output.trim()), [["bolo-de-fuba-teste", 120]]);
});
