// VIS-01 / VIS-02: foto de refeição. O modelo só identifica os alimentos e estima as
// porções; calorias e macros vêm do catálogo (mesmo cálculo do registro por texto).
// Nada é registrado sem a confirmação da usuária.

const VISION_INSTRUCTIONS = `
Você analisa fotos de refeições para um app brasileiro de nutrição. Liste só os alimentos
que aparecem, com nomes simples em português do Brasil (ex.: "arroz branco", "feijão
carioca", "peito de frango grelhado", "batata frita", "salada de folhas") e uma
estimativa de gramas por item. Não finja precisão: as gramas são estimativas visuais.
Se a imagem não mostrar comida, estiver ruim ou sem referência de tamanho, devolva
items vazio ou confidence "low" e explique em notes.
Responda APENAS com JSON: {"items":[{"name":"...","grams":0}],"confidence":"low|medium|high","notes":"..."}
`.trim();

// catalogNames: nomes do catálogo; o modelo usa um deles quando o alimento corresponder,
// o que evita itens "fora do catálogo" só por diferença de nome.
export async function describeMealPhoto({ apiClient, imageBase64, mimeType = "image/jpeg", caption = "", model, catalogNames = [] }) {
  const response = await apiClient.responses.create({
    model,
    instructions: catalogNames.length
      ? `${VISION_INSTRUCTIONS}\nQuando o alimento corresponder, use exatamente um destes nomes (com o preparo que aparece na foto): ${catalogNames.join("; ")}.`
      : VISION_INSTRUCTIONS,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: caption ? `Legenda da usuária: ${caption}` : "Foto da refeição." },
        { type: "input_image", image_url: `data:${mimeType};base64,${imageBase64}` }
      ]
    }]
  });
  return parseVisionResult(response.output_text);
}

export function parseVisionResult(text) {
  const json = String(text || "").match(/\{[\s\S]*\}/)?.[0];
  let data = {};
  try {
    data = json ? JSON.parse(json) : {};
  } catch {
    data = {};
  }
  const items = (Array.isArray(data.items) ? data.items : [])
    .map((item) => ({ name: String(item?.name || "").trim(), grams: Math.round(Number(item?.grams)) }))
    .filter(({ name, grams }) => name && grams > 0 && grams <= 2000);
  return {
    items,
    confidence: ["low", "medium", "high"].includes(data.confidence) ? data.confidence : "low",
    notes: String(data.notes || "").trim()
  };
}

// Confere cada item da foto no catálogo. Termo genérico ("bife grelhado", "batata frita",
// "peixe") vira a opção cujo preparo aparece no nome, ou a primeira opção; a escolha é
// informada. estimate = estimateMealFromText. Retorna { items, assumptions, unknown }.
const PREPARATION_STEMS = ["grelhad", "frit", "assad", "cozid", "cru", "refogad", "empanad"];
export function resolvePhotoItems(items, estimate) {
  const resolved = [];
  const assumptions = [];
  const unknown = [];
  for (const item of items) {
    const result = estimate(`comi 100 g de ${item.name.toLocaleLowerCase("pt-BR")}`);
    if (result?.matched_items?.length && !(result.needs_clarification || []).length) {
      resolved.push(item);
      continue;
    }
    const clarification = result?.needs_clarification?.[0];
    if (clarification?.options?.length) {
      const name = normalizeText(item.name);
      const stem = PREPARATION_STEMS.find((candidate) => name.includes(candidate));
      const choice = (stem && clarification.options.find((option) => normalizeText(option.name).includes(stem)))
        || clarification.options[0];
      resolved.push({ ...item, name: choice.name });
      assumptions.push(`${item.name} → ${choice.name}`);
      continue;
    }
    unknown.push(item.name);
  }
  return { items: resolved, assumptions, unknown };
}

const normalizeText = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

// "comi 150 g de arroz branco, 100 g de feijão carioca e 120 g de peito de frango grelhado"
export function buildPhotoMealText(items) {
  const parts = items.map(({ name, grams }) => `${grams} g de ${name.toLocaleLowerCase("pt-BR")}`);
  if (!parts.length) return "";
  return `comi ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : parts[0]}`;
}
