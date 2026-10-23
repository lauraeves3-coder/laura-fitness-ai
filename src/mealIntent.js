// Interpretação determinística de mensagens sobre alimentação: alimento desejado,
// porções, restrições, combinações rejeitadas e disponibilidade. Funções puras (sem
// banco, sem API), extraídas de ai.js para serem testadas diretamente.
import {
  detectDesiredFoodCategory,
  findFoodNames,
  GLUTEN_FOODS,
  parseQuantity,
  QUANTITY_PATTERN,
  detectJapaneseSubtype,
  findTermOccurrences,
  normalizeFoodText
} from "./foodMatching.js";

// CONV-09: resposta curta a "qual batata/bife?". pending = { original_message,
// clarifications: [{ term, options: [{ id, name }] }] }. Retorna a frase original com
// cada termo genérico respondido trocado pela opção escolhida, ou null.
export function resolveGenericFoodAnswer(pending, reply) {
  if (!pending?.original_message || !Array.isArray(pending.clarifications)) return null;
  let rewritten = String(pending.original_message).normalize("NFC");
  let resolved = 0;
  for (const { term, options } of pending.clarifications) {
    const choice = chooseClarificationOption(term, options || [], reply);
    if (!choice) continue;
    const [occurrence] = findTermOccurrences(normalizeFoodText(rewritten), term);
    if (!occurrence) continue;
    rewritten = rewritten.slice(0, occurrence.index)
      + choice.name.toLocaleLowerCase("pt-BR")
      + rewritten.slice(occurrence.end);
    resolved++;
  }
  return resolved ? rewritten : null;
}

// Escolhe a opção cuja palavra exclusiva aparece na resposta ("patinho", "cozida").
// Compara radicais sem a vogal final para aceitar "cozido"/"cozida", "fritas"/"frita";
// palavras comuns a duas opções ("grelhado"/"grelhada") não decidem nada.
function chooseClarificationOption(term, options, reply) {
  const stem = (word) => word.replace(/[ao]s?$/, "");
  const termStems = normalizeFoodText(term).split(/\s+/).map(stem);
  const stemsOf = (text) => normalizeFoodText(text).split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2).map(stem).filter((word) => !termStems.includes(word));
  const replyStems = new Set(stemsOf(reply));
  const matches = options.filter((option) => {
    const others = new Set(options.filter((other) => other !== option).flatMap((other) => stemsOf(other.name)));
    return stemsOf(option.name).some((word) => !others.has(word) && replyStems.has(word));
  });
  return matches.length === 1 ? matches[0] : null;
}

// NUT-13: o usuário diz explicitamente que comeu de novo, então uma refeição igual à
// recém-registrada não é duplicata.
export function isExplicitRepeatMeal(message) {
  const text = normalizeRequestText(message);
  return /\b(?:de\s+novo|novamente|outra\s+vez|mais\s+uma\s+vez|repeti|repetindo|registr(?:a|e|ar)\s+(?:de\s+novo|novamente))\b/.test(text);
}

// NUT-11: pedido de exclusão de refeição ("apague a refeição #12", "exclua o último
// registro"). Retorna { mealId, last } ou null.
export function detectMealDeletionRequest(message) {
  const text = normalizeRequestText(message);
  const verb = /\b(?:apag(?:a|ue|ar)|exclu(?:a|i|ir)|remov(?:a|e|er)|delet(?:a|e|ar))\b/.test(text);
  const target = /\b(?:refeic(?:ao|oes)|registros?|lancamentos?|comida)\b/.test(text);
  if (!verb || !target) return null;
  const idMatch = text.match(/#\s*(\d+)|\b(?:refeicao|registro|lancamento)\s+(?:n(?:umero|o)?\.?\s*)?(\d+)\b/);
  const mealId = idMatch ? Number(idMatch[1] || idMatch[2]) : null;
  const last = /\bultim[oa]\b/.test(text);
  return { mealId, last: !mealId && last };
}

// Confirmação explícita: precisa nomear a ação ("sim, excluir", "confirmo a exclusão");
// um "sim" solto não basta porque também responde a outras perguntas.
export function isMealDeletionConfirmation(message) {
  const text = normalizeRequestText(message).trim();
  return /^(?:sim[\s,!.]*)?(?:pode\s+)?(?:excluir|exclui|apagar|apaga|confirmo(?:\s+a\s+exclusao)?|confirmar\s+exclusao)\b/.test(text);
}

export function isMealDeletionCancellation(message) {
  const text = normalizeRequestText(message).trim();
  return /^(?:nao|cancela|cancelar|deixa|esquece|mantem|manter)[\s,.!]*$/.test(text)
    || /^nao\s+(?:exclu|apag|remov)/.test(text);
}

export function normalizeDesiredFood(value) {
  return detectDesiredFoodCategory(value);
}

export function detectDesiredFood(message, modelValue = "") {
  const normalized = String(message || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/^(?:o\s+que|oq|que)\s+posso comer\b/.test(normalized)) {
    return "";
  }

  if (/\bnao\s+(?:quero|queria|estou com vontade|tenho vontade)\b/.test(normalized)) {
    return "";
  }

  const expressesDesire =
    /\b(quero|queria|vontade de|com vontade de|posso comer|vou comer|hoje quero|estou querendo)\b/
      .test(normalized);

  if (!expressesDesire) {
    return "";
  }

  /*
   * desired_food representa somente categorias que possuem
   * referência própria no catálogo de alimentos desejados.
   *
   * Exemplos:
   *   "quero pizza"     -> pizza
   *   "quero chocolate" -> chocolate
   *   "quero whey"     -> ""
   *
   * Whey é tratado pelo gerador normal, não como craving.
   */
  return normalizeDesiredFood(message)
    || normalizeDesiredFood(modelValue)
    || "";
}

// Porções contadas ("3 temakis", "três fatias", "meia porção"). Gramas são lidos por
// detectRequestedGrams e convertidos pelo gerador conforme o peso de cada preparação.
export function detectRequestedServings(message, desiredFood, modelValue = null) {
  const text = normalizeRequestText(message);
  const units = "fatias?|pedacos?|bolas?|porcoes|porcao|unidades?|pratos?|pecas?|temakis?|niguiris?|nigiris?|sashimis?|hossomakis?|uramakis?|hot\\s+rolls?|hotrolls?|guiozas?|gyozas?";
  const match = text.match(new RegExp(`(${QUANTITY_PATTERN})\\s*(?:${units})(?![a-z])`));
  const count = match ? parseQuantity(match[1]) : null;
  const quantity = count ?? Number(modelValue);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

export function detectRequestedGrams(message) {
  const match = normalizeRequestText(message)
    .match(/(?<![a-z0-9.,])(\d+(?:[.,]\d+)?)\s*(kg|quilos?|gramas?|gr|g)(?![a-z])/);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  if (!(amount > 0)) return null;
  return /^(?:kg|quilos?)$/.test(match[2]) ? amount * 1000 : amount;
}

// Subtipo japonês pedido. "8 peças" sem tipo = peças de sushi, nunca temaki ou pratos.
export function detectRequestedJapaneseSubtype(message) {
  return detectJapaneseSubtype(message)
    || (/\bpecas?\b/.test(normalizeRequestText(message)) ? "sushi" : null);
}

export function detectDesiredComposition(message, desiredFood) {
  const text = String(message || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const variants = {
    pizza: [
      [/\bpizza\s+de\s+frango\s+(?:com|c\/|c)\s+catupiry\b/, "pizza-frango-catupiry"],
      [/\bpizza\s+de\s+lombo\s+(?:com|c\/|c)\s+catupiry\b/, "pizza-lombo-catupiry"],
      [/\bpizza\s+de\s+calabresa\s+(?:com|c\/|c)\s+catupiry\b/, "pizza-calabresa-catupiry"],
      [/\bpizza\s+de\s+milho\s+(?:com|c\/|c)\s+catupiry\b/, "pizza-milho-catupiry"],
      [/\bpizza\s+de\s+frango\s+(?:com|c\/|c)\s+milho\b/, "pizza-frango-milho"],
      [/\bpizza\s+de\s+frango\s+(?:com|c\/|c)\s+bacon\b/, "pizza-frango-bacon"],
      [/\bpizza\s+de\s+frango\s+(?:com|c\/|c)\s+cheddar\b/, "pizza-frango-cheddar"],
      [/\bpizza\s+de\s+lombo\s+(?:com|c\/|c)\s+cheddar\b/, "pizza-lombo-cheddar"],
      [/\bpizza\s+de\s+frango\s+(?:com|c\/|c)\s+catupiry\b/, "pizza-frango-catupiry"],
      [/\bpizza\s+(?:de\s+)?quatro\s+queijos\b/, "pizza-quatro-queijos"],
      [/\bpizza\s+(?:de\s+)?marguerita\b/, "pizza-marguerita"],
      [/\bpizza\s+(?:de\s+)?napolitana\b/, "pizza-napolitana"],
      [/\bpizza\s+(?:de\s+)?portuguesa\b/, "pizza-portuguesa"],
      [/\bpizza\s+de\s+presunto\s+(?:e|com)\s+queijo\b/, "pizza-presunto-queijo"],
      [/\bpizza\s+de\s+pepperoni\b/, "pizza-pepperoni"],
      [/\bpizza\s+de\s+bacon\b/, "pizza-bacon"],
      [/\bpizza\s+(?:de\s+)?milho\s+(?:com|c\/|c)\s+catupiry\b/, "pizza-milho-catupiry"],
      [/\bpizza\s+(?:de\s+)?milho\b/, "pizza-milho-catupiry"],
      [/\bpizza\s+de\s+palmito\s+(?:com|c\/|c)\s+bacon\b/, "pizza-palmito"],
      [/\bpizza\s+de\s+palmito\b/, "pizza-palmito"],
      [/\bpizza\s+(?:de\s+)?calabresa\b/, "pizza-calabresa"],
      [/\bpizza\s+(?:de\s+)?atum\b/, "pizza-atum"],
      [/\bpizza\s+(?:de\s+)?carne\s+seca\s+(?:com|c\/|c)\s+catupiry\b/, "pizza-strogonoff-carne"],
      [/\bpizza\s+de\s+strogonoff\s+de\s+carne\b/, "pizza-strogonoff-carne"],
      [/\bpizza\s+de\s+strogonoff\s+de\s+frango\b/, "pizza-strogonoff-frango"],
      [/\bpizza\s+parmegiana\b/, "pizza-parmegiana"],
      [/\bpizza\s+de\s+escarola\s+(?:com|c\/|c)\s+bacon\b/, "pizza-escarola-bacon"],
      [/\bpizza\s+baiana\b/, "pizza-baiana"],
      [/\bpizza\s+americana\b/, "pizza-americana"],
      [/\bpizza\s+de\s+brocolis\s+(?:com|c\/|c)\s+bacon\s+(?:e|com)\s+catupiry\b/, "pizza-brocolis-bacon-catupiry"],
      [/\bpizza\s+(?:de\s+)?alho\s+(?:e|&)\s+oleo\b/, "pizza-alho"],
      [/\bpizza\s+vegetariana\b/, "pizza-vegetariana"],
      [/\bpizza\s+mexicana\b/, "pizza-mexicana"],
      [/\bpizza\s+paulista\b/, "pizza-paulista"],
      [/\bpizza\s+moda\s+da\s+casa\b/, "pizza-moda-da-casa"],
      [/\bpizza\s+de\s+catupiry\b/, "pizza-catupiry"],
      [/\bpizza\s+de\s+mu(?:c|ss)arela\b/, "pizza-mucarela"],
      [/\bpizza\s+de\s+queijo\b/, "pizza-mucarela"],
      [/\bpizza\s+de\s+frango\b/, "pizza-frango"],
      [/\bpizza\s+de\s+atum\b/, "pizza-atum"],

      // Pizzas doces
      [/\bpizza\s+doce\s+de\s+banana\s+(?:com|c\/|c)\s+canela\b/, "pizza-doce-banana-canela"],
      [/\bpizza\s+doce\s+romeu\s+e\s+julieta\b/, "pizza-doce-romeu-julieta"],
      [/\bpizza\s+doce\s+de\s+chocolate\s+(?:com|c\/|c)\s+morango\b/, "pizza-doce-chocolate-morango"],
      [/\bpizza\s+doce\s+de\s+chocolate\b/, "pizza-doce-chocolate"],
      [/\bpizza\s+doce\s+de\s+prestigio\b/, "pizza-doce-prestigio"]
    ],
    hamburger: [
      [/\bhamburguer\s+de\s+frango\b/, "hamburguer-frango"],
      [/\bhamburguer\s+com\s+queijo\b/, "hamburguer-queijo"]
    ],
    japonesa: [
      [/\btemaki\s+de\s+salmao\s+com\s+cream\s+cheese\b/, "japonesa-temaki-salmao"],
      [/\btemaki\s+de\s+salmao\b/, "japonesa-temaki-salmao"],
      [/\btemaki\s+de\s+atum\b/, "japonesa-temaki-atum"],
      [/\btemaki\s+de\s+camarao\b/, "japonesa-temaki-camarao"],
      [/\btemaki\s+de\s+kani\b/, "japonesa-temaki-kani"],
      [/\btemaki\s+de\s+shimeji\b/, "japonesa-temaki-shimeji"],
      [/\buramaki\s+de\s+salmao\b/, "japonesa-uramaki-salmao"],
      [/\buramaki\s+california\b/, "japonesa-uramaki-california"],
      [/\buramaki\s+skin\b/, "japonesa-uramaki-skin"],
      [/\buramaki\s+de\s+atum\b/, "japonesa-uramaki-atum"],
      [/\bhossomaki\s+de\s+salmao\b/, "japonesa-hossomaki-salmao"],
      [/\bhot\s+(?:philadelphia|roll)\b/, "japonesa-hot-roll"],
      [/\bniguir?i\s+de\s+salmao\b/, "japonesa-nigiri"],
      [/\bsashimi\s+de\s+salmao\b/, "japonesa-sashimi"],
      [/\byakisoba\b/, "japonesa-yakisoba"],
      [/\bguioza\b|\bgyoza\b/, "japonesa-guioza"]
    ],
    chocolate: [
      [/\bchocolate\s+amargo\b/, "chocolate-amargo"],
      [/\bchocolate\s+ao\s+leite\b/, "chocolate-leite"],
      [/\bchocolate\s+meio\s+amargo\b/, "chocolate-meio-amargo"]
    ]
  };  return variants[desiredFood]?.find(([pattern]) => pattern.test(text))?.[1] || null;
}

export function normalizeRequestText(message) {
  return String(message || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function normalizeToolFoodList(value) {
  if (!Array.isArray(value)) return [];
  const aliases = new Map([
    ["whey protein", "whey"], ["proteína em pó", "whey"], ["proteina em po", "whey"],
    ["ovo", "ovos"], ["arroz integral", "arroz"], ["peito de frango", "frango"],
    ["tilápia", "peixe"], ["tilapia", "peixe"], ["salmão", "peixe"], ["salmao", "peixe"]
  ]);
  return [...new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, 100))
    .filter(Boolean)
    .map((item) => aliases.get(item.toLocaleLowerCase("pt-BR")) || item))];
}

// Alimentos reconhecidos em combinações rejeitadas, como alternância de regex
// sobre texto já sem acentos.
export function compositionFoodPattern() {
  const foods = [
    "whey protein", "proteina em po", "whey",
    "leite", "agua", "banana", "aveia", "iogurte", "queijo",
    "pao integral", "pao", "arroz", "feijao", "frango", "ovo", "ovos",
    "carne", "batata", "atum", "tomate", "pasta de amendoim", "amendoim", "salada"
  ];
  return `(?:${foods.slice().sort((a, b) => b.length - a.length).join("|")})`;
}

/*
 * Forma contextual: "Tenho whey em casa, mas não quero tomar com água."
 * O primeiro alimento vem antes da negativa, na mesma frase. Retorna, para cada
 * negativa, o alimento citado depois dela e os candidatos citados antes.
 */
export function findContextualCompositionExclusions(message) {
  const text = normalizeRequestText(message);
  const foodPattern = compositionFoodPattern();
  const negation = new RegExp(
    `\\bnao\\s+(?:quero|queria)\\s+(?:tomar|usar|beber|comer)\\s+(?:com|e\\s+com)\\s+(?:o|a|um|uma)?\\s*(${foodPattern})\\b`,
    "g"
  );
  return [...text.matchAll(negation)].map((match) => {
    const sentenceStart = Math.max(...[".", "!", "?", "\n"].map((mark) => text.lastIndexOf(mark, match.index))) + 1;
    const window = text.slice(Math.max(sentenceStart, match.index - 100), match.index);
    const [other] = normalizeToolFoodList([match[1]]);
    const mentioned = [...window.matchAll(new RegExp(`\\b(${foodPattern})\\b`, "g"))].map((found) => found[1]);
    const candidates = normalizeToolFoodList(mentioned).filter((food) => food !== other);
    return { other, candidates };
  });
}

// Negativa contextual com mais de um alimento possível ("tenho banana e leite, mas não
// quero tomar com água"): não registra nada e devolve o que perguntar.
export function detectAmbiguousCompositionExclusion(message) {
  return findContextualCompositionExclusions(message)
    .find(({ candidates }) => candidates.length > 1) || null;
}

// NC-10: termo genérico ("batata", "bife") sem preparo ou corte. Nada é registrado
// até o usuário especificar.
export function buildMealClarificationQuestion(estimate) {
  const lines = estimate.needs_clarification.map(({ term, options }) =>
    `• ${term}: ${joinWithOu(options.map(({ name }) => name.toLocaleLowerCase("pt-BR")))}?`);
  return [
    "Antes de registrar, preciso saber o preparo ou o corte:",
    ...lines,
    "Reenvie a refeição com esse detalhe (ex.: \"comi arroz, feijão e bife de patinho\"). Ainda não registrei nada."
  ].join("\n");
}

export function joinWithOu(items) {
  return items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} ou ${items[items.length - 1]}`;
}

export function displayFoodName(food) {
  const accented = {
    agua: "água", feijao: "feijão", pao: "pão", "pao integral": "pão integral",
    "proteina em po": "proteína em pó"
  };
  return accented[food] || food;
}

export function joinWithE(items) {
  return items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

// AI-06: a confirmação cita exatamente as combinações detectadas na mensagem.
export function buildCompositionExclusionReply(compositions, wheyAvailability = null) {
  const combinations = compositions.map((composition) =>
    composition.ingredients.map(displayFoodName).join(" com "));
  const ingredients = [...new Set(compositions.flatMap((composition) => composition.ingredients))]
    .map(displayFoodName);
  const prefix = wheyAvailability === true ? "Entendi. Vou considerar o whey disponível, mas" : "Entendi.";
  const action = wheyAvailability === true ? "não vou sugerir" : "Não vou sugerir";
  const released = joinWithE(ingredients);
  return `${prefix} ${action} ${joinWithE(combinations)}. ${released.charAt(0).toLocaleUpperCase("pt-BR")}${released.slice(1)} continuam liberados em outras combinações.`;
}

export function buildAmbiguousCompositionQuestion({ other, candidates }) {
  const options = candidates.map(displayFoodName);
  return `Com qual alimento você não quer ${displayFoodName(other)}: ${options.slice(0, -1).join(", ")} ou ${options[options.length - 1]}? Assim registro só essa combinação.`;
}

export function detectExplicitExcludedCompositions(message) {
  const text = normalizeRequestText(message);
  const foodPattern = compositionFoodPattern();
  const pattern = new RegExp(
    `\\b(?:nao|não)\\s+(?:quero|queria|gosto\\s+de|vou\\s+usar|vou\\s+tomar|vou\\s+comer)\\s+(?:o|a|um|uma)?\\s*(${foodPattern})\\s+(?:com|e\\s+com)\\s+(?:o|a|um|uma)?\\s*(${foodPattern})\\b`,
    "gi"
  );

  const compositions = [];
  for (const match of text.matchAll(pattern)) {
    const ingredients = normalizeToolFoodList([match[1], match[2]]);
    if (ingredients.length < 2) continue;
    compositions.push({
      ingredients,
      description: ingredients.join(" + ")
    });
  }

  // Forma contextual: só quando há exatamente um alimento possível antes da negativa.
  for (const { other, candidates } of findContextualCompositionExclusions(message)) {
    if (candidates.length !== 1) continue;
    const ingredients = [candidates[0], other];

    const description = ingredients.join(" + ");

    if (!compositions.some((composition) =>
      composition.description === description
    )) {
      compositions.push({
        ingredients,
        description
      });
    }
  }

  return compositions;
}

export function extractExcludedFoods(message) {
  const foods = [
    "frango", "arroz", "feijão", "ovos", "ovo", "pão integral", "banana",
    "iogurte", "aveia", "tapioca", "queijo", "carne", "batata", "legumes",
    "peixe", "atum", "tomate", "leite", "maçã", "salada", "pasta de amendoim",
    "tofu", "lentilha", "grão-de-bico", "homus", "bebida de soja", "iogurte de soja", "edamame", "cenoura", "amendoim",
    "salmão", "tilápia", "peito de frango", "arroz integral", "batata-doce", "batata doce", "carne moída",
    "whey protein", "whey", "proteína em pó", "proteina em po", "pão"
  ];
  const text = normalizeRequestText(message);
  const rejected = [];

  // "não quero/tenho/gosto de ...": todos os alimentos até o fim da frase ou até uma
  // virada positiva ("..., quero arroz", "mas tenho ovo"), em no máximo 60 caracteres.
  const listNegation = /\bnao\s+(?:tenho|tem|quero|queria|gosto\s+de|como|posso\s+comer|uso|vou\s+usar|vou\s+comer)\b/g;
  const clauseEnd = /[.;!?\n]|(?<!\b(?:nem|nao)\s)\b(?:mas|porem|so\s+que|quero|queria|prefiro|gostaria|pode\s+ser|tenho|tem)\b/;
  for (const match of text.matchAll(listNegation)) {
    const following = text.slice(match.index + match[0].length, match.index + match[0].length + 60);
    const end = following.search(clauseEnd);
    rejected.push(...findFoodNames(end >= 0 ? following.slice(0, end) : following, foods));
  }

  // "sem X", "troca o X", "substitui a X": só o alimento logo em seguida.
  for (const match of text.matchAll(/\b(?:sem|troca(?:r)?|substitui(?:r)?)\s+(?:o\s+|a\s+)?/g)) {
    const [first] = findFoodNames(text.slice(match.index + match[0].length, match.index + match[0].length + 30), foods);
    const startsRightAfter = first && text.slice(match.index + match[0].length).startsWith(normalizeRequestText(first).split(/[\s-]/)[0]);
    if (startsRightAfter) rejected.push(first);
  }

  if (/\bnao\s+(?:tenho|quero|uso|vou usar)\s+(?:whey|suplemento|suplementos)\b/.test(text)) {
    rejected.push("whey");
  }
  return [...new Set(rejected)];
}

export function getFoodRestrictions(user) {
  const rawDislikes = String(user?.food_dislikes || "");
  const rejected = rawDislikes
    .split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
  const knownFoods = [
    "frango", "arroz", "feijão", "ovos", "ovo", "pão integral", "banana",
    "iogurte", "aveia", "tapioca", "queijo", "carne", "batata", "legumes",
    "peixe", "atum", "tomate", "leite", "maçã", "salada", "tofu", "lentilha",
    "grão-de-bico", "homus", "edamame", "amendoim"
  ];
  rejected.push(...findFoodNames(rawDislikes, knownFoods));
  const preferences = String(user?.dietary_preferences || "").toLocaleLowerCase("pt-BR");
  if (/vegano|vegan/.test(preferences)) rejected.push("frango", "carne", "peixe", "atum", "ovo", "queijo", "iogurte", "leite", "whey");
  else if (/vegetarian|vegetar/.test(preferences)) rejected.push("frango", "carne", "peixe", "atum");
  if (/sem lactose|lactose free|intoler.ncia . lactose/.test(preferences)) rejected.push("leite", "iogurte", "queijo", "whey");
  if (/sem gl[uú]ten|cel[ií]ac/.test(preferences)) rejected.push(...GLUTEN_FOODS);
  return [...new Set(rejected)];
}

export function hasDesiredFoodAvailable(message, desiredFood) {
  const text = String(message || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  const match = text.match(
    /\b(?:tenho|so tenho|somente tenho|tem em casa|disponivel|aqui tem)\b/
  );

  if (!match) {
    return false;
  }

  /*
   * Considera somente o trecho da declaração de disponibilidade.
   *
   * Ex.:
   *   "Tenho pizza" -> pizza disponível
   *
   *   "Tenho whey, mas quero pizza"
   *      -> pizza NÃO é considerada disponível
   */
  const availabilityText = text
    .slice(match.index + match[0].length)
    .split(
      /\b(?:mas|porem|quero|queria|vou|gostaria|prefiro)\b/
    )[0]
    .trim();

  return normalizeDesiredFood(availabilityText) === desiredFood;
}

export function extractAvailableFoods(message) {
  const explicitAvailability = /\b(tenho|tem em casa|dispon[ií]vel|s[oó] tenho|aqui tem)\b/i.test(message);
  const foods = [
    "frango", "arroz", "feijão", "ovos", "ovo", "pão integral", "banana",
    "iogurte", "aveia", "tapioca", "queijo", "carne", "batata", "legumes",
    "peixe", "atum", "tomate", "leite", "maçã", "salada", "pasta de amendoim",
    "tofu", "lentilha", "grão-de-bico", "homus", "bebida de soja", "iogurte de soja", "edamame", "cenoura", "amendoim",
    "salmão", "tilápia", "peito de frango", "arroz integral", "batata-doce", "batata doce", "carne moída",
    "whey protein", "whey", "proteína em pó", "proteina em po", "macarrão", "macarrao", "massa",
    "batata inglesa", "pão", "mamão", "mamao", "laranja", "carne bovina", "carne moida", "ovo cozido"
  ];
  const normalized = message.toLocaleLowerCase("pt-BR");
  const mentioned = new Set(findFoodNames(message, foods));
  const excluded = new Set(extractExcludedFoods(message));
  const aliases = {
    "salmão": "peixe", "tilápia": "peixe", "peito de frango": "frango",
    "arroz integral": "arroz", "batata-doce": "batata", "batata doce": "batata",
    "whey protein": "whey", "proteína em pó": "whey", "proteina em po": "whey",
    "carne moída": "carne moída", "carne moida": "carne moida",
    "macarrao": "macarrão", "mamao": "mamão"
  };
  const commonAvailable = explicitAvailability
    ? foods.filter((food) => mentioned.has(food) && !excluded.has(food))
    : [];
  const contextualCandidates = ["tofu", "tempeh", "edamame", "homus", "bebida de soja", "iogurte de soja"];
  const contextualMentioned = new Set(findFoodNames(message, contextualCandidates));
  const contextualFoods = contextualCandidates
    .filter((food) => contextualMentioned.has(food)
      && !excluded.has(food)
      && /\b(?:consumo|como|costumo comer|quero|gosto de|tenho|possuo|uso|prefiro)\b/i.test(normalized));
  return [...new Set([...commonAvailable, ...contextualFoods]
    .map((food) => aliases[food] || food))];
}

export function detectWheyAvailability(message) {
  const text = String(message || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  if (/\b(?:nao tenho|nao tem|nao possuo|sem|acabou)\b.{0,35}\bwhey\b|\bwhey\b.{0,20}\b(?:acabou|nao tenho|nao tem)\b/.test(text)) {
    return false;
  }

  if (/\b(?:tenho|tem em casa|possuo|disponivel|aqui tem)\b.{0,35}\bwhey\b|\bwhey\b.{0,20}\b(?:disponivel|em casa)\b/.test(text)) {
    return true;
  }

  return null;
}
