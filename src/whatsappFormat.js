// Converte Markdown comum (como o modelo escreve) para a formatação do WhatsApp:
// **negrito** → *negrito*, __itálico__ → _itálico_, ~~riscado~~ → ~riscado~,
// títulos "### X" → *X*, listas "- x" / "* x" → "• x", [texto](url) → "texto (url)",
// e no máximo uma linha em branco seguida.
export function toWhatsAppText(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, (_, title) => `*${title.replace(/\*+/g, "")}*`)
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "_$1_")
    .replace(/~~(.+?)~~/g, "~$1~")
    .replace(/^(\s*)[-*]\s+/gm, "$1• ")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)")
    .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
