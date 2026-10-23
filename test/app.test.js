// SEG-03: validação da assinatura do webhook do WhatsApp e proteção da API, testadas no
// app Express real (src/app.js) em porta aleatória. src/server.js não é importado: ele
// carrega o .env. Os payloads usados não chegam ao modelo nem à API do WhatsApp.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.FITPULSE_DB_PATH = join(mkdtempSync(join(tmpdir(), "fitpulse-app-")), "app.db");
assert.notEqual(resolve(process.env.FITPULSE_DB_PATH), resolve("fitness.db"));
delete process.env.OPENAI_API_KEY;
delete process.env.WHATSAPP_ACCESS_TOKEN;
delete process.env.API_ACCESS_TOKEN;
const SECRET = "segredo-de-teste-do-webhook";
process.env.WHATSAPP_APP_SECRET = SECRET;

const { default: app } = await import("../src/app.js");
const server = app.listen(0);
await new Promise((ready) => server.once("listening", ready));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

const sign = (body, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const post = (body, headers = {}) => fetch(`${base}/webhook/whatsapp`, {
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body
});
const statusPayload = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ status: "delivered" }] } }] }] });
const imagePayload = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: "wamid.1", from: "5500000000000", type: "image" }] } }] }] });

test("SEG-03: sem assinatura → 401", async () => {
  assert.equal((await post(statusPayload)).status, 401);
});

test("SEG-03: assinatura com segredo errado → 401", async () => {
  assert.equal((await post(statusPayload, { "x-hub-signature-256": sign(statusPayload, "outro-segredo") })).status, 401);
});

test("SEG-03: assinatura malformada → 401", async () => {
  for (const header of ["sha256=abc", "md5=" + "a".repeat(64), "a".repeat(64)]) {
    assert.equal((await post(statusPayload, { "x-hub-signature-256": header })).status, 401, header);
  }
});

test("SEG-03: corpo alterado depois de assinado → 401", async () => {
  const tampered = statusPayload.replace("delivered", "read");
  assert.equal((await post(tampered, { "x-hub-signature-256": sign(statusPayload) })).status, 401);
});

test("SEG-03: assinatura válida é aceita (status e mídia não processados)", async () => {
  assert.equal((await post(statusPayload, { "x-hub-signature-256": sign(statusPayload) })).status, 200);
  assert.equal((await post(imagePayload, { "x-hub-signature-256": sign(imagePayload) })).status, 200);
});

test("SEG-03: sem WHATSAPP_APP_SECRET configurado → 503", async () => {
  delete process.env.WHATSAPP_APP_SECRET;
  try {
    assert.equal((await post(statusPayload, { "x-hub-signature-256": sign(statusPayload) })).status, 503);
  } finally {
    process.env.WHATSAPP_APP_SECRET = SECRET;
  }
});

test("WEB-02: rotas /api recusam acesso sem token configurado ou com token errado", async () => {
  assert.equal((await fetch(`${base}/api/summary/qualquer`)).status, 503);
  process.env.API_ACCESS_TOKEN = "t".repeat(40);
  try {
    assert.equal((await fetch(`${base}/api/summary/qualquer`)).status, 401);
    assert.equal((await fetch(`${base}/api/summary/qualquer`, { headers: { authorization: "Bearer errado" } })).status, 401);
  } finally {
    delete process.env.API_ACCESS_TOKEN;
  }
});

test("health responde sem autenticação", async () => {
  assert.equal((await fetch(`${base}/health`)).status, 200);
});
