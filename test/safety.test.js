// SEG-01 / SEG-04: proteções do repositório verificadas automaticamente.
// Lê apenas arquivos versionados e o .gitignore; nunca abre o .env nem o banco.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
const read = (file) => readFileSync(file, "utf8");

// ---------- SEG-01: segredos e dados fora do Git ----------

test("SEG-01: .env, bancos e WAL/SHM não estão versionados", () => {
  const forbidden = tracked.filter((file) => /(^|\/)\.env$|\.db$|\.db-(wal|shm)$/.test(file));
  assert.deepEqual(forbidden, []);
});

test("SEG-01: .gitignore cobre .env e bancos", () => {
  const ignore = read(".gitignore").split(/\r?\n/).map((line) => line.trim());
  for (const pattern of [".env", "*.db", "*.db-shm", "*.db-wal"]) {
    assert.ok(ignore.includes(pattern), pattern);
  }
});

test("SEG-01: .env.example só tem valores de exemplo", () => {
  for (const line of read(".env.example").split(/\r?\n/)) {
    const value = line.split("=").slice(1).join("=").trim();
    assert.doesNotMatch(value, /^sk-[A-Za-z0-9_-]{20,}|^EAA[A-Za-z0-9]{20,}/, line.split("=")[0]);
  }
});

test("SEG-01: nenhum arquivo versionado contém chave ou token real", () => {
  const secretPattern = /\bsk-[A-Za-z0-9_-]{20,}|\bEAA[A-Za-z0-9]{40,}|\bghp_[A-Za-z0-9]{30,}/;
  const textFiles = tracked.filter((file) => /\.(js|mjs|json|md|html|txt|example)$/.test(file) || file === ".env.example");
  const leaks = textFiles.filter((file) => secretPattern.test(read(file)));
  assert.deepEqual(leaks, []);
});

test("SEG-01: só server.js carrega o .env", () => {
  const loaders = tracked
    .filter((file) => file.startsWith("src/") && file.endsWith(".js"))
    .filter((file) => /dotenv|["'`]\.env["'`]/.test(read(file)));
  assert.deepEqual(loaders, ["src/server.js"]);
});

// ---------- SEG-04: testes não gastam créditos nem tocam no banco real ----------

const testFiles = tracked.filter((file) => /^test\/.*\.test\.js$/.test(file));
// Só importações contam (comentários que citam o arquivo, não).
const imports = (source, module) =>
  new RegExp(`(?:from\\s+|import\\s*\\(\\s*|import\\s+)["'][^"']*src/${module}["']`).test(source);

test("SEG-04: nenhum teste importa server.js (que lê o .env)", () => {
  const offenders = testFiles.filter((file) => imports(read(file), "server\\.js"));
  assert.deepEqual(offenders, []);
});

test("SEG-04: testes que carregam ai.js ou app.js removem a chave da API e usam banco temporário", () => {
  for (const file of testFiles) {
    const source = read(file);
    if (!imports(source, "(?:ai|app)\\.js")) continue;
    assert.match(source, /delete process\.env\.OPENAI_API_KEY/, file);
    assert.match(source, /process\.env\.FITPULSE_DB_PATH\s*=/, file);
  }
});

test("SEG-04: testes que carregam db.js usam banco temporário", () => {
  for (const file of testFiles) {
    const source = read(file);
    if (!imports(source, "db\\.js")) continue;
    assert.match(source, /process\.env\.FITPULSE_DB_PATH\s*=/, file);
  }
});

test("SEG-04: o cliente da OpenAI só é criado sob demanda", () => {
  const agent = read("src/agent/agent.js");
  assert.doesNotMatch(agent, /^const client = new OpenAI/m);
  assert.match(agent, /client \?\?= new OpenAI/);
});
