// Carrega funções puras de src/ai.js sem importar o módulo.
// ai.js importa db.js, que abre fitness.db; os testes não podem tocar no banco real
// nem na API da OpenAI. Quando essas funções forem movidas para um módulo próprio,
// este helper deve ser substituído por um import direto.
import { readFileSync } from "node:fs";
import * as foodMatching from "../../src/foodMatching.js";

const source = readFileSync(new URL("../../src/ai.js", import.meta.url), "utf8");

function extractFunction(name) {
  const start = source.search(new RegExp(`(?:^|\\n)function ${name}\\(`));
  if (start < 0) throw new Error(`Função não encontrada em src/ai.js: ${name}`);
  let depth = 0;
  let index = source.indexOf("{", source.indexOf(")", start));
  for (; index < source.length; index++) {
    if (source[index] === "{") depth++;
    else if (source[index] === "}" && --depth === 0) break;
  }
  return source.slice(start, index + 1);
}

const NAMES = [
  "normalizeDesiredFood", "detectDesiredFood", "detectRequestedServings", "detectRequestedGrams", "detectRequestedJapaneseSubtype",
  "detectDesiredComposition", "normalizeRequestText", "normalizeToolFoodList",
  "detectExplicitExcludedCompositions", "extractExcludedFoods", "getFoodRestrictions",
  "hasDesiredFoodAvailable", "extractAvailableFoods", "detectWheyAvailability"
];

// Dependências importadas por ai.js que as funções extraídas usam.
const dependencies = { ...foodMatching };

export const ai = new Function(
  ...Object.keys(dependencies),
  `${NAMES.map(extractFunction).join("\n")}\nreturn { ${NAMES.join(", ")} };`
)(...Object.values(dependencies));

export const aiSource = source;
