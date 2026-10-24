// Formatação das mensagens para o WhatsApp.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toWhatsAppText } from "../src/whatsappFormat.js";

test("WhatsApp: Markdown do modelo vira formatação do WhatsApp", () => {
  const input = "### Sugestão de jantar\n\n\n**Frango grelhado** com __salada__\n- arroz\n* feijão\n---\nVeja [a TBCA](https://www.tbca.net.br)";
  assert.equal(toWhatsAppText(input),
    "*Sugestão de jantar*\n\n*Frango grelhado* com _salada_\n• arroz\n• feijão\n\nVeja a TBCA (https://www.tbca.net.br)");
});

test("WhatsApp: texto já no formato do WhatsApp não muda", () => {
  const ready = "✅ *Refeição registrada* · #3\n🍽️ 2 ovos\n\n🔥 125 kcal · 🥩 P 10,4 g";
  assert.equal(toWhatsAppText(ready), ready);
});
