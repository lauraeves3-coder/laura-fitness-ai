// SUP-01/03/05: whey por marca, produto e sabor, com valores do rótulo oficial (site da
// marca, consulta 24/10/2026). Valores por PORÇÃO do rótulo: [kcal, proteína, carboidrato,
// gordura, porção em g]. Sabor sem tabela própria no site usa a tabela do sabor de
// referência do produto (indicado em `reference_flavor`).

const CONSULTA = "consulta 24/10/2026";

export const WHEY_PRODUCTS = [
  {
    key: "dux-concentrado", brand: "Dux", product: "Whey Protein Concentrado", type: "concentrado",
    brandTerms: ["dux", "dux nutrition", "dux human health"],
    source: `rótulo oficial por sabor (duxhumanhealth.com, ${CONSULTA})`,
    flavors: {
      "banoffee": [128, 20, 6.7, 2.3, 30], "baunilha": [122, 20, 5.7, 2.1, 30], "butter cookies": [127, 20, 6.5, 2.3, 30],
      "cappuccino": [115, 20, 4.3, 2, 30], "caramelo salgado": [121, 20, 5.4, 2.1, 30], "chocolate": [122, 20, 5.4, 2.3, 30],
      "chocolate branco": [122, 20, 5.4, 2.3, 30], "coco": [122, 20, 5.7, 2.1, 30], "cookies": [126, 20, 6.4, 2.3, 30],
      "doce de leite": [123, 20, 5.9, 2.1, 30], "morango": [121, 20, 5.6, 2.1, 30], "pao de mel": [121, 20, 5.1, 2.3, 30],
      "neutro": [113, 20, 3.5, 2.1, 30], "torta de limao": [118, 20, 5, 2, 30]
    },
    reference_flavor: "baunilha"
  },
  {
    key: "dux-isolado", brand: "Dux", product: "Whey Protein Isolado", type: "isolado",
    brandTerms: ["dux", "dux nutrition", "dux human health"],
    source: `rótulo oficial por sabor (duxhumanhealth.com, ${CONSULTA})`,
    flavors: {
      "baunilha": [108, 24, 1.6, 0.6, 29], "butter cookies": [113, 24, 3.4, 0.4, 30], "cappuccino": [112, 24, 3.1, 0.4, 30],
      // Caramelo salgado: a tabela não traz gorduras (quantidade não significativa).
      "caramelo salgado": [111, 24, 3.4, 0, 30], "chocolate": [112, 24, 2, 0.9, 30], "chocolate branco": [108, 24, 1.5, 0.7, 30],
      "coco": [107, 24, 1.5, 0.6, 29], "cookies": [115, 24, 2.8, 0.9, 30], "doce de leite": [108, 24, 1.6, 0.6, 30],
      "morango": [107, 24, 1.3, 0.6, 29], "neutro": [107, 24, 1.3, 0.6, 29]
    },
    reference_flavor: "baunilha"
  },
  {
    key: "growth-concentrado", brand: "Growth", product: "Whey Protein Concentrado", type: "concentrado",
    brandTerms: ["growth", "growth supplements", "gsuplementos"],
    source: `rótulo oficial do sabor Natural (gsuplementos.com.br, ${CONSULTA}); a marca informa 23 g de proteína nos demais sabores`,
    flavors: { "natural": [124, 24, 2.3, 2.1, 30] },
    other_flavors: ["leite em po", "baunilha", "morango", "chocolate", "chocolate com amendoim", "banana", "cookies and cream", "cappuccino",
      "sorvete de creme", "torta de limao", "mousse de maracuja", "doce de leite", "chocolate milk shake", "caramelo", "chocolate branco",
      "beijinho", "brigadeiro", "chocolate com morango"],
    reference_flavor: "natural"
  },
  {
    key: "integralmedica-100-pure", brand: "Integralmédica", product: "Whey 100% Pure (concentrado)", type: "concentrado",
    brandTerms: ["integralmedica", "integral medica", "integralmédica"],
    source: `rótulo oficial (integralmedica.com.br, ${CONSULTA})`,
    flavors: { "gelato di latte": [119, 21, 4.8, 1.8, 30], "baunilha": [122, 21, 5.1, 1.9, 30] },
    other_flavors: ["chocolate", "morango", "cookies", "cookies and cream"],
    reference_flavor: "baunilha"
  },
  {
    key: "max-top-whey-3w", brand: "Max Titanium", product: "Top Whey 3W + Performance", type: "blend",
    brandTerms: ["max titanium", "top whey", "3w", "top whey 3w"],
    source: `rótulo oficial do sabor Baunilha (maxtitanium.com.br, ${CONSULTA})`,
    flavors: { "baunilha": [170, 32, 4.3, 2.7, 40] },
    other_flavors: ["chocolate", "fresh lemon", "morango", "vitamina de frutas"],
    reference_flavor: "baunilha"
  },
  {
    key: "probiotica-100-pure", brand: "Probiótica", product: "100% Pure Whey", type: "concentrado",
    brandTerms: ["probiotica", "probiótica", "pure whey"],
    source: `rótulo oficial do sabor Baunilha (probiotica.com.br, ${CONSULTA})`,
    flavors: { "baunilha": [124, 20, 6.3, 2.1, 30] },
    other_flavors: ["cappuccino", "caramelo salgado", "chocolate", "chocolate branco", "chocolate com avela", "cookies e cream",
      "doce de leite", "iogurte com coco", "iogurte com limao", "iogurte com morango", "leite", "morango"],
    reference_flavor: "baunilha"
  },
  {
    key: "on-gold-standard", brand: "Optimum Nutrition", product: "Gold Standard 100% Whey", type: "blend",
    brandTerms: ["optimum nutrition", "optimum", "gold standard", "on gold"],
    source: `rótulo europeu (loja Decathlon DE, ${CONSULTA}); a versão vendida no Brasil pode variar levemente`,
    flavors: { "chocolate": [113, 23.7, 1.7, 1.3, 30] },
    other_flavors: ["baunilha", "morango", "cookies and cream", "double rich chocolate"],
    reference_flavor: "chocolate"
  }
];

const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
const slug = (text) => normalize(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const round = (value) => Math.round(value * 100) / 100;
const titleCase = (text) => text.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"));

export function wheyItemId(product, flavor) {
  return `whey-${product.key}-${slug(flavor)}`;
}

// Itens do catálogo (valores por 100 g), um por produto e sabor.
export function wheyCatalogItems() {
  return WHEY_PRODUCTS.flatMap((product) => {
    const flavors = [...Object.keys(product.flavors), ...(product.other_flavors || [])];
    return flavors.map((flavor) => {
      const own = product.flavors[flavor];
      const [kcal, protein, carbs, fat, portion] = own || product.flavors[product.reference_flavor];
      const per100 = (value) => round(value * 100 / portion);
      return {
        id: wheyItemId(product, flavor),
        name: `Whey ${product.brand} ${product.product.replace(/^Whey (Protein )?/, "")} — ${titleCase(flavor)}`,
        aliases: [],
        kcal: per100(kcal), protein: per100(protein), carbs: per100(carbs), fat: per100(fat),
        default_g: portion,
        unit: `1 dose (${portion} g)`,
        source: "official_nutrition_table",
        reference: own ? product.source : `${product.source}; sabor ${flavor} sem tabela própria: usa a do sabor ${product.reference_flavor}`
      };
    });
  });
}

// Menção de whey com marca/sabor no texto normalizado ("2 scoops de whey da dux sabor
// cookies", "whey isolado dux morango", "growth chocolate whey"). Retorna
// { id, index, end } com o trecho reconhecido, ou [] sem marca conhecida.
export function findWheyMentions(text) {
  const mentions = [];
  for (const match of text.matchAll(/\bwhey\b/g)) {
    const start = Math.max(0, match.index - 30);
    const end = Math.min(text.length, match.index + 70);
    const window = text.slice(start, end);
    const windowStop = window.search(/[,.;!?]|\b(?:e|com|mais|depois)\s+(?:um|uma|\d)/);
    const scope = windowStop > 0 && start + windowStop > match.index ? window.slice(0, windowStop) : window;
    const candidates = WHEY_PRODUCTS.map((product) => {
      const brand = product.brandTerms.map(normalize).sort((a, b) => b.length - a.length)
        .find((term) => new RegExp(`\\b${term.replace(/[%]/g, "\\$&")}\\b`).test(scope));
      if (!brand) return null;
      const wantsIsolate = /\biso(?:lado|late)?\b/.test(scope);
      const typeScore = wantsIsolate ? (product.type === "isolado" ? 2 : -2) : (product.type === "isolado" ? -1 : 0);
      const flavors = [...Object.keys(product.flavors), ...(product.other_flavors || [])].sort((a, b) => b.length - a.length);
      const flavor = flavors.find((name) => new RegExp(`\\b${normalize(name)}\\b`).test(scope));
      return { product, flavor, score: brand.length + typeScore + (flavor ? 1 : 0) };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    if (!candidates.length) continue;
    const { product, flavor } = candidates[0];
    // Trecho: de "whey" (ou da marca antes dele) até a última palavra reconhecida.
    const tokens = [...product.brandTerms, flavor || "", "isolado", "concentrado", "protein", "sabor"].filter(Boolean).map(normalize);
    let spanEnd = match.index + 4;
    for (const token of tokens) {
      const found = scope.lastIndexOf(token);
      if (found >= 0 && start + found + token.length > spanEnd && start + found >= match.index) spanEnd = start + found + token.length;
    }
    const brandBefore = product.brandTerms.map(normalize).map((term) => text.lastIndexOf(term, match.index)).filter((index) => index >= start && index < match.index);
    mentions.push({ id: wheyItemId(product, flavor || product.reference_flavor), index: brandBefore.length ? Math.min(...brandBefore) : match.index, end: spanEnd, flavorKnown: Boolean(flavor) });
  }
  return mentions;
}
