// CONV-12: perfil de comunicação. A pessoa diz se prefere respostas curtas ou detalhadas
// (ou reclama de uma resposta longa) e a preferência vai para as instruções do agente.
// Tom natural e sem julgamento vale nos dois estilos.
const normalize = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

// "curta" | "detalhada" | "normal" | null.
export function detectReplyStyle(message) {
  const text = normalize(message);
  const aboutReplies = /\b(?:respostas?|responda|responde|mensagens?|fale|fala|explica\w*|seja|textos?|escreva)\b/.test(text);
  if (/\b(?:volt[ae]\w* (?:ao|a responder) normal|respostas? normais|jeito normal de responder)\b/.test(text)) return "normal";
  if (/\b(?:muito (?:longo|longa|grande|texto)|textao|resume mais|mais curt[ao]s?|menos texto)\b/.test(text)
    || (aboutReplies && /\b(?:curt[ao]s?|resumid[ao]s?|diret[ao]s?|menores|objetiv[ao]s?|enxut[ao]s?)\b/.test(text))) return "curta";
  if (aboutReplies && /\b(?:detalhad[ao]s?|complet[ao]s?|explicad[ao]s?|mais detalhes|maiores|com mais explicac)\b/.test(text)) return "detalhada";
  return null;
}

export const STYLE_INSTRUCTIONS = {
  curta: "Preferência de estilo da pessoa: respostas curtas e diretas, no máximo 3 a 4 linhas, sem explicações extras nem listas longas. Mantenha o tom natural, amigável e sem julgamento.",
  detalhada: "Preferência de estilo da pessoa: respostas mais detalhadas, explicando o porquê das recomendações e com exemplos práticos, sempre organizadas para o WhatsApp. Mantenha o tom natural, amigável e sem julgamento."
};

export function buildReplyStyleConfirmation(style) {
  if (style === "curta") return "👍 Combinado: vou responder de forma mais *curta e direta*. Se quiser detalhes em algum momento, é só pedir.";
  if (style === "detalhada") return "👍 Combinado: vou responder com *mais detalhes*, explicando o porquê das coisas.";
  return "👍 Voltei ao meu jeito normal de responder.";
}
