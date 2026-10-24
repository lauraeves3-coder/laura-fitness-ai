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

export async function describeMealPhoto({ apiClient, imageBase64, mimeType = "image/jpeg", caption = "", model }) {
  const response = await apiClient.responses.create({
    model,
    instructions: VISION_INSTRUCTIONS,
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

// "comi 150 g de arroz branco, 100 g de feijão carioca e 120 g de peito de frango grelhado"
export function buildPhotoMealText(items) {
  const parts = items.map(({ name, grams }) => `${grams} g de ${name.toLocaleLowerCase("pt-BR")}`);
  if (!parts.length) return "";
  return `comi ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : parts[0]}`;
}
