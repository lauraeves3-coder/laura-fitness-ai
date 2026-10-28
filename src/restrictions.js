// CONV-08: restrições alimentares → termos de ingrediente a evitar. Função pura, usada nas
// opções de refeição e nas receitas. A restrição mais específica vence ("carne de porco"
// exclui porco, não toda carne).
const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

export const RESTRICTION_TERMS = {
  "frutos do mar": ["camarao", "polvo", "lula", "marisco", "kani"],
  camarao: ["camarao"],
  porco: ["porco", "suino", "lombo", "pernil", "bacon", "calabresa", "linguica", "presunto", "bisteca", "mortadela", "salame"],
  peixe: ["peixe", "tilapia", "salmao", "atum", "sardinha", "bacalhau", "merluza", "pescada"],
  frango: ["frango", "peru"],
  ovo: ["ovo", "clara", "omelete"],
  lactose: ["leite", "iogurte", "queijo", "mucarela", "requeijao", "cottage", "parmesao", "creme de leite", "whey", "manteiga"],
  leite: ["leite", "iogurte", "queijo", "mucarela", "requeijao", "cottage", "parmesao", "creme de leite", "whey", "manteiga"],
  gluten: ["pao", "macarrao", "torrada", "biscoito", "bolo", "aveia", "granola", "pizza", "esfiha", "pastel", "coxinha"],
  amendoim: ["amendoim", "pasta de amendoim"],
  carne: ["carne", "patinho", "bife", "musculo", "acem", "alcatra", "hamburguer", "picanha", "contrafile", "coxao", "lagarto", "fraldinha", "maminha", "cupim", "costela"]
};

const listOf = (value) => String(value || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean);

export function excludedTerms(user) {
  const diets = normalize(user?.dietary_preferences);
  const terms = [];
  const add = (key) => terms.push(...RESTRICTION_TERMS[key]);
  if (/vegan/.test(diets)) { ["carne", "porco", "peixe", "frutos do mar", "frango", "ovo", "leite"].forEach(add); terms.push("mel"); }
  else if (/vegetarian/.test(diets)) ["carne", "porco", "peixe", "frutos do mar", "frango"].forEach(add);
  if (/lactose/.test(diets)) add("lactose");
  if (/gluten/.test(diets)) add("gluten");
  for (const item of listOf(user?.food_dislikes).map(normalize)) {
    // "carne" sozinha (ou vermelha/bovina) = carne bovina; "carne de porco" = porco;
    // "carne de soja" não é carne e fica como está.
    const key = Object.keys(RESTRICTION_TERMS).find((name) => name !== "carne" && item.includes(name))
      || (/^(?:carnes?|carnes? vermelhas?|carnes? bovinas?|carne de boi)$/.test(item) ? "carne" : null);
    if (key) add(key); else terms.push(item);
  }
  return [...new Set(terms)];
}

// Algum dos termos aparece no texto do alimento/opção?
export function violatesRestrictions(text, terms) {
  const plain = normalize(text);
  return terms.some((term) => new RegExp(`\\b${term}`).test(plain));
}
