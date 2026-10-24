import { validateExtraFood } from "./catalogExtra.js";

// CAT-09: cadastro de alimento pela conversa. Ex.: "cadastrar alimento: bolo de fubá da vó,
// 100 g tem 330 kcal, 5 g de proteína, 50 g de carboidrato e 12 g de gordura".
// Retorna null (não é cadastro), { missing } (faltam dados), { errors } ou { food }.
const TRIGGER = /^\s*(?:cadastr\w*|adicion\w*|salv\w*)\s+(?:(?:o|um|meu|novo)\s+)*alimento\b\s*:?\s*/i;
const NUMBER = "(\\d+(?:[.,]\\d+)?)";
const MACROS = {
  protein: "prote[ií]nas?|prot",
  carbs: "carboidratos?|carbos?|carb",
  fat: "gorduras?|lip[ií]dios?"
};
const LABELS = { kcal: "calorias (kcal)", protein: "proteína", carbs: "carboidrato", fat: "gordura" };

const toNumber = (value) => Number(String(value).replace(",", "."));
const slug = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function parseFoodRegistration(message) {
  const text = String(message || "").normalize("NFC");
  const trigger = text.match(TRIGGER);
  if (!trigger) return null;
  const rest = text.slice(trigger[0].length);
  const name = rest.split(/[:,;=]|\s+-\s+|\s+(?=\d|porç|porc)/i)[0].trim();

  const base = rest.match(new RegExp(`${NUMBER}\\s*(?:g|gramas?|ml)\\s*(?:tem|t[eê]m|=|:|possui|cont[eé]m|com|->|dá|da)`, "i"));
  const baseGrams = base ? toNumber(base[1]) : 100;
  const kcal = rest.match(new RegExp(`${NUMBER}\\s*(?:kcal|calorias?)`, "i"));
  const values = { kcal: kcal ? toNumber(kcal[1]) : null };
  for (const [field, names] of Object.entries(MACROS)) {
    const match = rest.match(new RegExp(`${NUMBER}\\s*g?\\s*(?:de\\s+)?(?:${names})\\b`, "i"))
      || rest.match(new RegExp(`(?:${names})\\b\\s*(?:de\\s+)?:?\\s*${NUMBER}`, "i"));
    values[field] = match ? toNumber(match[1]) : null;
  }

  const missing = [...(name ? [] : ["nome"]), ...Object.keys(values).filter((field) => values[field] == null).map((field) => LABELS[field])];
  if (missing.length) return { missing };
  if (!(baseGrams > 0)) return { errors: ["a porção de referência deve ser maior que zero"] };

  const per100 = (value) => Math.round(value * 100 / baseGrams * 100) / 100;
  const food = {
    id: `minha-${slug(name)}`,
    name: name.charAt(0).toLocaleUpperCase("pt-BR") + name.slice(1),
    aliases: [name.toLocaleLowerCase("pt-BR")],
    kcal: per100(values.kcal),
    protein: per100(values.protein),
    carbs: per100(values.carbs),
    fat: per100(values.fat),
    default_g: baseGrams,
    unit: `${baseGrams} g`,
    source: "user_label"
  };
  const errors = validateExtraFood(food);
  return errors.length ? { errors } : { food };
}

export function buildFoodRegistrationReply(result) {
  const example = "cadastrar alimento: bolo de fubá da vó, 100 g tem 330 kcal, 5 g de proteína, 50 g de carboidrato e 12 g de gordura";
  if (result.missing) return `Para cadastrar o alimento, faltou: ${result.missing.join(", ")}. Exemplo: "${example}". Nada foi cadastrado.`;
  if (result.errors) return `Não cadastrei o alimento: ${result.errors.join("; ")}. Confira os valores e envie de novo.`;
  const { name, kcal, protein, carbs, fat, default_g, aliases } = result.food;
  const format = (value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `✅ Cadastrei ${name}: por 100 g, ${format(kcal)} kcal · P ${format(protein)} g · C ${format(carbs)} g · G ${format(fat)} g (porção padrão ${format(default_g)} g). Já pode registrar, ex.: "comi 150 g de ${aliases[0]}".`;
}
