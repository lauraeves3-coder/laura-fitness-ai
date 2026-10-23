// Reconhecimento de nomes de alimentos em texto livre.
//
// Regras compartilhadas por catálogo, sugestões e restrições:
// - acentos, caixa e hífens são ignorados ("Feijão" = "feijao", "grão-de-bico" = "grao de bico");
// - um termo só casa com palavras inteiras ("ovo" não está em "novo", "sal" não está em "salmão");
// - plurais regulares do português são aceitos ("bananas", "pães franceses", "atuns");
// - quando termos se sobrepõem, vence o mais longo ("farofa temperada" antes de "farofa",
//   "pão de queijo" antes de "queijo").

const CONNECTORS = new Set(["a", "o", "e", "de", "do", "da", "dos", "das", "com", "ao", "na", "no", "em"]);

// Alimentos compostos que contêm o nome de outro alimento mas são itens diferentes.
// Servem para que "carne de soja" não seja lida como "carne" e "pão de queijo" como "queijo".
export const DISTINCT_COMPOUND_FOODS = [
  "carne de soja", "proteína de soja", "pão de queijo", "leite de coco", "leite de amêndoas",
  "leite de aveia", "leite de soja", "leite condensado", "doce de leite", "creme de leite",
  "queijo vegano", "bebida de soja", "iogurte de soja", "batata frita", "água de coco",
  "farinha de mandioca", "farofa temperada", "pizza doce", "bolo de chocolate", "sorvete de chocolate",
  "pasta de amendoim", "manteiga de amendoim", "feijão tropeiro"
];

// Alimentos com glúten (trigo, cevada, centeio) usados quando o perfil indica doença celíaca
// ou dieta sem glúten. Aveia entra por risco de contaminação cruzada, salvo se certificada.
export const GLUTEN_FOODS = [
  "pão", "pão integral", "pão francês", "torrada", "macarrão", "massa", "pizza", "bolo",
  "biscoito", "bolacha", "farinha de trigo", "trigo", "cevada", "centeio", "aveia",
  "granola", "esfiha", "pastel", "coxinha", "empada", "sanduíche", "hambúrguer", "wrap", "lasanha"
];

// Categorias de alimentos desejados ("quero pizza"). A ordem não importa: vence o primeiro
// alimento mencionado na frase ("pizza doce de chocolate" -> pizza).
export const DESIRED_FOOD_ALIASES = [
  ["batata frita", "batata frita"], ["french fries", "batata frita"],
  ["hamburguer", "hamburger"], ["hamburger", "hamburger"], ["burger", "hamburger"],
  ["sorvete", "sorvete"], ["gelato", "sorvete"],
  ["chocolate", "chocolate"], ["pizza", "pizza"],
  ["comida japonesa", "japonesa"], ["comida japonesa brasileira", "japonesa"],
  ["rodizio japones", "japonesa"], ["japones", "japonesa"], ["japonesa", "japonesa"],
  ["sushi", "japonesa"], ["temaki", "japonesa"],
  ["sashimi", "japonesa"], ["nigiri", "japonesa"],
  ["niguiri", "japonesa"], ["hossomaki", "japonesa"],
  ["uramaki", "japonesa"], ["hot roll", "japonesa"],
  ["hotroll", "japonesa"], ["hot philadelphia", "japonesa"],
  ["guioza", "japonesa"], ["gyoza", "japonesa"],
  ["yakisoba", "japonesa"], ["sunomono", "japonesa"],
  ["missoshiru", "japonesa"], ["tempura", "japonesa"],
  ["tempura de camarao", "japonesa"], ["salada de kani", "japonesa"],
  ["bolo", "bolo"], ["massa", "massa"], ["macarrao", "massa"]
];

export function normalizeFoodText(value) {
  // Hífen vira espaço sem mudar o comprimento do texto já sem acentos.
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/-/g, " ");
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function wordPattern(word) {
  if (CONNECTORS.has(word)) return escapeRegex(word);
  if (word.length <= 2) return escapeRegex(word);
  if (word.endsWith("ao")) return `${escapeRegex(word.slice(0, -2))}(?:ao|aes|oes)`;
  if (word.endsWith("l")) return `${escapeRegex(word.slice(0, -1))}(?:l|is)`;
  if (word.endsWith("m")) return `${escapeRegex(word.slice(0, -1))}(?:m|ns)`;
  if (/[rsz]$/.test(word)) return `${escapeRegex(word)}(?:es)?`;
  return `${escapeRegex(word)}s?`;
}

const regexCache = new Map();

function termRegex(term) {
  const normalized = normalizeFoodText(term).trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (!regexCache.has(normalized)) {
    const body = normalized.split(" ").map(wordPattern).join("\\s+");
    regexCache.set(normalized, new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, "g"));
  }
  return regexCache.get(normalized);
}

// Todas as ocorrências de um termo em um texto JÁ normalizado por normalizeFoodText
// (ou por outra normalização que preserve índices, como normalizeText do catálogo).
export function findTermOccurrences(normalizedText, term) {
  const pattern = termRegex(term);
  if (!pattern) return [];
  const text = String(normalizedText || "").replace(/-/g, " ");
  return [...text.matchAll(pattern)].map((match) => ({
    index: match.index,
    end: match.index + match[0].length,
    term
  }));
}

export function containsFoodTerm(text, term) {
  return findTermOccurrences(normalizeFoodText(text), term).length > 0;
}

// Casa vários termos ao mesmo tempo sem sobreposição; termos mais longos vencem.
// entries: [{ key, terms: [...] }]. Retorna [{ key, term, index, end }] em ordem de posição.
export function matchFoodTerms(text, entries, { normalized = false } = {}) {
  const source = normalized ? String(text || "") : normalizeFoodText(text);
  const occurrences = entries.flatMap(({ key, terms }) =>
    terms.flatMap((term) => findTermOccurrences(source, term).map((occurrence) => ({ ...occurrence, key })))
  );
  occurrences.sort((left, right) =>
    (right.end - right.index) - (left.end - left.index) || left.index - right.index
  );
  const accepted = [];
  for (const occurrence of occurrences) {
    if (!accepted.some((other) => occurrence.index < other.end && occurrence.end > other.index)) {
      accepted.push(occurrence);
    }
  }
  return accepted.sort((left, right) => left.index - right.index);
}

// Lista de nomes -> nomes encontrados, ignorando os que só aparecem dentro de um
// alimento composto diferente (ex.: "carne" em "carne de soja").
export function findFoodNames(text, names, { compounds = DISTINCT_COMPOUND_FOODS } = {}) {
  const entries = [
    ...names.map((name) => ({ key: name, terms: [name], known: true })),
    ...compounds
      .filter((compound) => !names.some((name) => normalizeFoodText(name) === normalizeFoodText(compound)))
      .map((compound) => ({ key: compound, terms: [compound], known: false }))
  ];
  const known = new Set(names);
  return [...new Set(matchFoodTerms(text, entries).map(({ key }) => key).filter((key) => known.has(key)))];
}

const DESIRED_FOOD_ENTRIES = DESIRED_FOOD_ALIASES.map(([alias, category]) => ({
  key: category,
  terms: [alias]
}));

// Categoria do primeiro alimento desejado mencionado, ou "".
export function detectDesiredFoodCategory(value) {
  return matchFoodTerms(value, DESIRED_FOOD_ENTRIES)[0]?.key || "";
}

// Uma restrição bloqueia a categoria inteira somente quando é o próprio nome da categoria
// ("pizza", "hambúrguer"). Restrições mais específicas ("pizza doce") são tratadas pelo
// gerador de opções, que remove apenas as variantes correspondentes.
export function restrictionBlocksDesiredFood(restriction, desiredFood) {
  const text = normalizeFoodText(restriction).trim().replace(/\s+/g, " ");
  if (!text || !desiredFood) return false;
  return DESIRED_FOOD_ALIASES.some(([alias, category]) =>
    category === desiredFood
    && findTermOccurrences(text, alias).some(({ index, end }) => index === 0 && end === text.length)
  );
}
