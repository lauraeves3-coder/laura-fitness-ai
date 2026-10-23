// Gera docs/fontes-tbca.md a partir dos itens do catálogo que têm `reference`.
// Uso: node scripts/gerar-fontes-tbca.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { FOOD_CATALOG } from "../src/nutritionCatalog.js";

const rows = FOOD_CATALOG
  .filter((item) => item.reference)
  .map((item) => {
    const code = item.reference.match(/BRC\d{4}[A-Z]/)?.[0] || "";
    const note = item.reference.replace(/^TBCA BRC\d{4}[A-Z],?\s*/, "").replace(/\s*\(consulta [^)]*\)/, "");
    return `| ${item.id} | ${item.name} | ${code} | ${item.kcal} | ${item.protein} | ${item.carbs} | ${item.fat} | ${note || "—"} |`;
  });

const content = `# Fontes nutricionais — TBCA

Valores por 100 g copiados da Tabela Brasileira de Composição de Alimentos (TBCA/USP, https://www.tbca.net.br),
consultada em 23/10/2026. Campos usados: Energia (kcal), Proteína, Carboidrato total e Lipídios.
Arquivo gerado por \`scripts/gerar-fontes-tbca.mjs\` a partir de \`src/nutritionCatalog.js\` — não editar à mão.

Critérios de escolha: versão "s/ sal" quando existe (sal não altera energia nem macros); senão a versão "c/ sal".
Preparos "grelhada/assada s/ óleo" para grelhado e assado; "frita (c/ óleo de soja)" para frito.

| id | Nome no catálogo | Código TBCA | kcal | Proteína (g) | Carboidrato (g) | Lipídios (g) | Observação |
|---|---|---|---|---|---|---|---|
${rows.join("\n")}

Total: ${rows.length} itens.
`;

mkdirSync(new URL("../docs/", import.meta.url), { recursive: true });
writeFileSync(new URL("../docs/fontes-tbca.md", import.meta.url), content, "utf8");
console.log(`docs/fontes-tbca.md: ${rows.length} itens`);
