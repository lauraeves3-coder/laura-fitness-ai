import { test } from "node:test";
import assert from "node:assert/strict";
import { repairMojibake } from "../scripts/fix-mojibake.mjs";

test("repara UTF-8 lido como cp1252", () => {
  assert.deepEqual(
    repairMojibake("nÃ£o, porÃ§Ã£o, â€œsimâ€\u009d"),
    { text: "não, porção, “sim”", changes: 5 }
  );
});
test("repara codificação em duas camadas", () => {
  assert.equal(repairMojibake("NÃƒÂ£o").text, "Não");
});
test("não altera português correto", () => {
  for (const text of ["NÃO", "AÇÃO", "não", "ação", "pão de queijo", "À vontade", "⚠️"]) {
    assert.deepEqual(repairMojibake(text), { text, changes: 0 });
  }
});
