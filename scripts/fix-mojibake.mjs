// Repara texto UTF-8 que foi decodificado como Windows-1252 e salvo de novo em UTF-8
// ("nÃ£o" -> "não"). Só substitui sequências que, convertidas de volta para bytes
// cp1252, formam UTF-8 válido de um único caractere não-ASCII; texto legítimo
// ("NÃO", "ação") não forma UTF-8 válido e fica intacto. Repete até estabilizar
// para desfazer codificações em várias camadas.
//
// Uso: node scripts/fix-mojibake.mjs [--write] arquivo...
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CP1252_EXTRA = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f
};

function toCp1252Byte(char) {
  const code = char.codePointAt(0);
  if (code >= 0x80 && code <= 0xff) return code;
  return CP1252_EXTRA[code] ?? null;
}

function decodeUtf8(bytes) {
  const [b0] = bytes;
  const length = b0 >= 0xf0 && b0 <= 0xf4 ? 4 : b0 >= 0xe0 ? 3 : b0 >= 0xc2 && b0 <= 0xdf ? 2 : 0;
  if (length !== bytes.length) return null;
  if (!bytes.slice(1).every((byte) => byte >= 0x80 && byte <= 0xbf)) return null;
  const decoded = Buffer.from(bytes).toString("utf8");
  return decoded.includes("�") || [...decoded].length !== 1 ? null : decoded;
}

function repairOnce(text) {
  const chars = [...text];
  let output = "";
  let changes = 0;
  for (let index = 0; index < chars.length; index++) {
    let replaced = false;
    for (const length of [4, 3, 2]) {
      const slice = chars.slice(index, index + length);
      if (slice.length !== length) continue;
      const bytes = slice.map(toCp1252Byte);
      if (bytes.includes(null)) continue;
      const decoded = decodeUtf8(bytes);
      if (decoded) {
        output += decoded;
        index += length - 1;
        changes++;
        replaced = true;
        break;
      }
    }
    if (!replaced) output += chars[index];
  }
  return { output, changes };
}

export function repairMojibake(text) {
  let current = text;
  let total = 0;
  for (let pass = 0; pass < 5; pass++) {
    const { output, changes } = repairOnce(current);
    if (!changes) break;
    current = output;
    total += changes;
  }
  return { text: current, changes: total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const write = process.argv.includes("--write");
  for (const file of process.argv.slice(2).filter((arg) => arg !== "--write")) {
    const original = readFileSync(file, "utf8");
    const { text, changes } = repairMojibake(original);
    const replacementChars = (text.match(/�/g) || []).length;
    console.log(`${file}: ${changes} sequências reparadas, ${replacementChars} U+FFFD restantes`);
    if (write && changes) writeFileSync(file, text, "utf8");
  }
}
