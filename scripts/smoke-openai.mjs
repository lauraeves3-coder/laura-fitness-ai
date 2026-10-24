// Fase 5 (ARQ-05): teste real com a OpenAI, sem WhatsApp e sem tocar no banco real.
// Usa um banco SQLite temporário e mostra só as respostas (nunca as chaves).
// Uso: npm run smoke   (gasta alguns centavos de crédito da OpenAI)
import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitpulse-smoke-"));
process.env.FITPULSE_DB_PATH = path.join(tempDir, "smoke.db");

const required = ["OPENAI_API_KEY"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Faltam no .env: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`Modelo: ${process.env.OPENAI_MODEL || "gpt-5.6 (padrão)"}`);
console.log(`Banco temporário: ${process.env.FITPULSE_DB_PATH}\n`);

const { processMessage } = await import("../src/ai.js");
const userId = "smoke-test-user";
const messages = [
  "oi, quem é você?",
  "minha meta de proteína é 140 g",
  "comi 2 ovos e um pão francês",
  "quanto de proteína ainda falta hoje?",
  "treinei peito: supino reto 3x10 com 40 kg e crucifixo 3x12 com 12 kg, 50 minutos",
  "me sugere um jantar leve com frango"
];

let failures = 0;
for (const message of messages) {
  const started = Date.now();
  let reply;
  try {
    reply = await processMessage(userId, message);
  } catch (error) {
    reply = `ERRO: ${error.message}`;
  }
  if (/^ERRO|Não consegui processar/.test(reply)) failures += 1;
  console.log(`> ${message}\n${reply}\n(${Date.now() - started} ms)\n`);
}

fs.rmSync(tempDir, { recursive: true, force: true });
console.log(failures ? `${failures} mensagem(ns) falharam.` : "Todas as mensagens tiveram resposta.");
process.exit(failures ? 1 : 0);
