// Funções de interpretação usadas pelos testes. Vivem em src/mealIntent.js, que não
// importa db.js nem a API da OpenAI; src/ai.js (que abre fitness.db) não é importado.
import { readFileSync } from "node:fs";
import * as mealIntent from "../../src/mealIntent.js";

export const ai = mealIntent;

// Fonte de ai.js para verificações estáticas (encoding, textos fixos).
export const aiSource = readFileSync(new URL("../../src/ai.js", import.meta.url), "utf8");
