// SUP/REC: "tenho whey de morango" → pergunta o que falta (marca e/ou sabor), guarda o whey
// da pessoa (perfil + despensa) com a tabela da marca e, se ela pediu receita, já sugere
// receitas que combinam com o sabor. Sem o modelo.
import { WHEY_PRODUCTS, wheyItemId } from "./supplements.js";
import { addPantryItem, getUser, setWheyState } from "./db.js";

const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

// Sabores conhecidos (mais longos primeiro) e o grupo que decide as receitas que combinam.
const FLAVORS = [
  ["cookies and cream", "chocolate"], ["cookies e cream", "chocolate"], ["chocolate branco", "chocolate"], ["chocolate com morango", "chocolate"],
  ["chocolate com amendoim", "chocolate"], ["doce de leite", "chocolate"], ["frutas vermelhas", "fruta"], ["leite em po", "neutro"],
  ["torta de limao", "fruta"], ["caramelo salgado", "chocolate"], ["butter cookies", "chocolate"], ["pao de mel", "chocolate"],
  ["mousse de maracuja", "fruta"], ["iogurte com morango", "fruta"], ["sorvete de creme", "neutro"], ["gelato di latte", "neutro"],
  ["chocolate", "chocolate"], ["morango", "fruta"], ["baunilha", "neutro"], ["cookies", "chocolate"], ["natural", "neutro"], ["neutro", "neutro"],
  ["sem sabor", "neutro"], ["banana", "fruta"], ["coco", "fruta"], ["acai", "fruta"], ["maracuja", "fruta"], ["brigadeiro", "chocolate"],
  ["cappuccino", "chocolate"], ["capuccino", "chocolate"], ["caramelo", "chocolate"], ["beijinho", "fruta"], ["banoffee", "chocolate"]
];
const BRANDS = [...new Map(WHEY_PRODUCTS.map((product) => [product.brand, product])).values()];

export function flavorGroup(flavor) {
  return FLAVORS.find(([name]) => name === normalize(flavor))?.[1] || "neutro";
}

function findFlavor(text) {
  const found = FLAVORS.find(([name]) => new RegExp(`\\b${name}\\b`).test(text))?.[0] || null;
  return found === "sem sabor" ? "natural" : found;
}

function findProduct(text) {
  const iso = /\biso(?:lado|late)?\b/.test(text);
  const matches = WHEY_PRODUCTS.filter((product) => product.brandTerms.some((term) => new RegExp(`\\b${normalize(term)}\\b`).test(text)));
  return matches.find((product) => (product.type === "isolado") === iso) || matches[0] || null;
}

function flavorTitle(flavor) {
  return flavor ? flavor.replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("pt-BR")) : "";
}

// Catálogo: sabor da marca com tabela própria ou o de referência; sem marca, whey genérico.
function wheyFoodId(product, flavor) {
  if (!product) return "whey";
  const flavors = [...Object.keys(product.flavors), ...(product.other_flavors || [])];
  const match = flavor && flavors.find((name) => normalize(name) === normalize(flavor) || normalize(name).includes(normalize(flavor)));
  return wheyItemId(product, match || product.reference_flavor);
}

export function getWheyProfile(userId) {
  const user = getUser(userId);
  return user?.whey_profile ? JSON.parse(user.whey_profile) : null;
}

function saveProfile(userId, { product, flavor, unknownBrand }) {
  const profile = {
    brand: product?.brand || null,
    product: product?.product || null,
    flavor: flavor || null,
    group: flavorGroup(flavor || "neutro"),
    food_id: wheyFoodId(product, flavor),
    unknown_brand: Boolean(unknownBrand)
  };
  setWheyState(userId, { profile: JSON.stringify(profile), pending: null });
  const label = ["Whey", profile.brand, flavorTitle(profile.flavor)].filter(Boolean).join(" ");
  addPantryItem(userId, { name: label, foodId: profile.food_id, location: "armário" });
  return { ...profile, label };
}

const askText = (need) => [
  need.includes("brand") ? "💪 Qual é a *marca* do seu whey? Assim uso a tabela nutricional certa.\n_Ex.: Dux, Growth, Integralmédica, Max Titanium, Probiótica, Optimum — ou *não sei*._" : null,
  need.includes("flavor") ? `${need.includes("brand") ? "E qual o *sabor*?" : "🍓 Qual o *sabor* do seu whey?"} _(ex.: morango, chocolate, baunilha, cookies, natural)_` : null,
  "_Pode responder tudo junto, ex.: *growth morango*._"
].filter(Boolean).join("\n");

// onSaved(profile, wantsRecipe) devolve o texto extra (ex.: receitas). Retorna a resposta ou null.
export function handleWheyMessage(userId, message, { onSaved = () => null } = {}) {
  const text = normalize(message).replace(/[?!.]+$/, "");
  const user = getUser(userId) || {};
  const pending = user.whey_pending ? JSON.parse(user.whey_pending) : null;
  const fresh = pending && Date.now() - pending.at <= 30 * 60 * 1000;
  const confirm = (profile, wantsRecipe) => {
    const intro = `✅ Anotei seu *${profile.label}*${profile.brand ? " (tabela do rótulo da marca)" : " (valores médios de whey)"} e coloquei na despensa.`;
    const extra = onSaved(profile, wantsRecipe);
    return extra ? `${intro}\n\n${extra}` : `${intro}\nQuando quiser, peça *receitas com whey* que eu sugiro as que combinam com ${profile.flavor ? `o sabor ${profile.flavor}` : "ele"}.`;
  };

  if (fresh && text.split(/\s+/).length <= 6 && !/\bwhey\b.*\b(?:tenho|comprei)\b/.test(text)) {
    const product = pending.product_key ? WHEY_PRODUCTS.find((item) => item.key === pending.product_key) : findProduct(text);
    const flavor = pending.flavor || findFlavor(text);
    const unknownBrand = !product && /\b(?:nao sei|nao lembro|outra|outro|qualquer|generico)\b/.test(text);
    if (!product && !unknownBrand && !findFlavor(text)) return null;
    const need = [!product && !unknownBrand ? "brand" : null, !flavor ? "flavor" : null].filter(Boolean);
    if (need.length) {
      setWheyState(userId, { pending: JSON.stringify({ ...pending, product_key: product?.key || null, flavor, unknown_brand: unknownBrand, at: Date.now() }) });
      return askText(need);
    }
    return confirm(saveProfile(userId, { product, flavor, unknownBrand: unknownBrand || pending.unknown_brand }), pending.wants_recipe);
  }

  const owns = /\b(?:tenho|comprei|tem|chegou|estou com|to com|uso|tomo)\b[^.?!]*\bwhey\b|\bmeu whey\b/.test(text) && !/\b(?:tomei|bebi|comi)\b/.test(text);
  const recipeAsk = /\b(?:receitas?|opcoes|opcao|ideias?|sugest\w*|sugir\w*)\b[^.?!]*\bwhey\b|\bwhey\b[^.?!]*\b(?:receitas?|opcoes|ideias?|sugest\w*)\b/.test(text);
  if (!owns && !(recipeAsk && !getWheyProfile(userId))) return null;
  const product = findProduct(text);
  const flavor = findFlavor(text);
  const wantsRecipe = /\breceitas?\b|\bsugest|\bo que (?:posso|da pra) fazer\b/.test(text);
  if (!owns && recipeAsk) {
    // Pediu receita com whey sem ter contado qual é: pergunta antes de sugerir.
    const need = ["brand", "flavor"].filter((key) => (key === "brand" ? !product : !flavor));
    if (!need.length) return confirm(saveProfile(userId, { product, flavor }), true);
    setWheyState(userId, { pending: JSON.stringify({ product_key: product?.key || null, flavor, wants_recipe: true, at: Date.now() }) });
    return `Para sugerir receitas que combinem com o seu whey:\n${askText(need)}`;
  }
  const need = [!product ? "brand" : null, !flavor ? "flavor" : null].filter(Boolean);
  if (need.length) {
    setWheyState(userId, { pending: JSON.stringify({ product_key: product?.key || null, flavor, wants_recipe: wantsRecipe, at: Date.now() }) });
    return askText(need);
  }
  return confirm(saveProfile(userId, { product, flavor }), wantsRecipe);
}

export { BRANDS };
