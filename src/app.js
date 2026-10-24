// App Express do FitPulse (rotas, webhook e API). Não carrega .env nem abre porta:
// isso fica em server.js, para que os testes importem o app sem ler segredos.
import { createHmac, timingSafeEqual } from "node:crypto";
import express from "express";

import {
  ensureUser,
  updateUserProfile,
  getUser,
  getDailySummary,
  getRecentHistory,
  claimWhatsAppMessage,
  completeWhatsAppMessage,
  markWhatsAppMessageSent,
  releaseWhatsAppMessage
} from "./db.js";

import { processMessage, processMealPhoto, processVoiceMessage } from "./ai.js";
import { toWhatsAppText } from "./whatsappFormat.js";
import { verifyState, connectWithCode } from "./integrations/strava.js";

const app = express();

app.use(express.json({
  verify(req, res, buffer) {
    req.rawBody = Buffer.from(buffer);
  }
}));


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "laura-fitness-ai",
    time: new Date().toISOString()
  });
});

/* =========================================================
   TESTE BÁSICO
========================================================= */

app.get("/", (req, res) => {
  res.json({
    message: "Laura Fitness AI está funcionando. 💪"
  });
});

/* =========================================================
   PERFIL DO USUÁRIO
========================================================= */

function requireApiAccess(req, res, next) {
  const expected = process.env.API_ACCESS_TOKEN;

  if (!expected || expected.length < 32) {
    return res.status(503).json({
      ok: false,
      error: "API não configurada para acesso seguro."
    });
  }

  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer (.+)$/i);

  if (!match) {
    return res.status(401).json({
      ok: false,
      error: "Não autorizado."
    });
  }

  const received = Buffer.from(match[1]);
  const configured = Buffer.from(expected);

  if (
    received.length !== configured.length ||
    !timingSafeEqual(received, configured)
  ) {
    return res.status(401).json({
      ok: false,
      error: "Não autorizado."
    });
  }

  next();
}

app.use("/api", requireApiAccess);

app.get("/api/user/:userId", (req, res) => {
  try {
    const { userId } = req.params;

    ensureUser(userId);

    const user = getUser(userId);

    res.json({
      ok: true,
      user
    });
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);

    res.status(500).json({
      ok: false,
      error: "Não foi possível buscar o usuário."
    });
  }
});

app.put("/api/user/:userId", (req, res) => {
  try {
    const { userId } = req.params;

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        ok: false,
        error: "Corpo da requisição inválido."
      });
    }

    const user = updateUserProfile(userId, req.body);

    res.json({
      ok: true,
      user
    });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);

    res.status(500).json({
      ok: false,
      error: "Não foi possível atualizar o usuário."
    });
  }
});

/* =========================================================
   RESUMO DO DIA
========================================================= */

app.get("/api/summary/:userId", (req, res) => {
  try {
    const { userId } = req.params;

    const summary = getDailySummary(userId);

    res.json({
      ok: true,
      summary
    });
  } catch (error) {
    console.error("Erro ao buscar resumo:", error);

    res.status(500).json({
      ok: false,
      error: "Não foi possível buscar o resumo."
    });
  }
});

/* =========================================================
   HISTÓRICO
========================================================= */

app.get("/api/history/:userId", (req, res) => {
  try {
    const { userId } = req.params;

    const history = getRecentHistory(userId, 50);

    res.json({
      ok: true,
      history
    });
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);

    res.status(500).json({
      ok: false,
      error: "Não foi possível buscar o histórico."
    });
  }
});

/* =========================================================
   CHAT COM A IA
========================================================= */

app.post("/api/chat", async (req, res) => {
  try {
    const { userId, message } = req.body || {};

    if (typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({
        ok: false,
        error: "userId é obrigatório."
      });
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        ok: false,
        error: "message é obrigatório."
      });
    }

    const reply = await processMessage(userId, message);

    res.json({
      ok: true,
      userId,
      message,
      reply
    });
  } catch (error) {
    console.error("Erro no chat:", error?.name || "Error");

    res.status(500).json({
      ok: false,
      error: "Não foi possível processar a mensagem."
    });
  }
});

/* =========================================================
   WHATSAPP - VERIFICAÇÃO DO WEBHOOK
========================================================= */

// INT-01: retorno da autorização do Strava. O "state" assinado diz de qual WhatsApp é a
// conta; sem ele válido, nada é gravado.
app.get("/strava/callback", async (req, res) => {
  const page = (title, text) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem"><h1>${title}</h1><p>${text}</p></body>`;
  const userId = verifyState(req.query.state);
  if (!userId || !req.query.code) {
    return res.status(400).send(page("Não foi possível conectar", "O link de conexão é inválido ou expirou. Peça um novo no WhatsApp: <b>conectar strava</b>."));
  }
  if (!String(req.query.scope || "").includes("activity:read")) {
    return res.status(400).send(page("Permissão necessária", "Para importar seus treinos, autorize o acesso às atividades. Peça um novo link: <b>conectar strava</b>."));
  }
  try {
    const athlete = await connectWithCode(userId, String(req.query.code));
    const name = athlete.firstname ? `, ${athlete.firstname}` : "";
    sendWhatsAppMessage(userId, `🔗 *Strava conectado${name}!* Vou importar suas atividades a cada 20 minutos. Para buscar agora, mande *sincronizar strava*.`)
      .catch((error) => console.error("Aviso do Strava não enviado:", error.message));
    return res.send(page("Strava conectado ✅", "Pode voltar ao WhatsApp. Suas atividades serão importadas automaticamente."));
  } catch (error) {
    console.error("Falha ao conectar o Strava:", error.message);
    return res.status(502).send(page("Não foi possível conectar", "O Strava não confirmou a conexão. Tente de novo pelo WhatsApp: <b>conectar strava</b>."));
  }
});

app.get("/webhook/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    token &&
    verifyToken &&
    token === verifyToken
  ) {
    console.log("Webhook do WhatsApp verificado.");

    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

/* =========================================================
   WHATSAPP - ENVIO DE MENSAGEM
========================================================= */

// VIS-01 / CONV-10: baixa a mídia do WhatsApp (Graph API: id → URL temporária → bytes).
export async function downloadWhatsAppMedia(mediaId, fetchImpl = fetch) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN não configurado.");
  }
  const headers = { Authorization: `Bearer ${accessToken}` };
  const meta = await fetchImpl(`https://graph.facebook.com/v26.0/${encodeURIComponent(mediaId)}`, { headers });
  if (!meta.ok) {
    throw new Error(`Falha ao consultar a mídia (${meta.status}).`);
  }
  const { url, mime_type: mimeType } = await meta.json();
  const file = await fetchImpl(url, { headers });
  if (!file.ok) {
    throw new Error(`Falha ao baixar a mídia (${file.status}).`);
  }
  return {
    base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    mimeType: mimeType || "image/jpeg"
  };
}

export async function sendWhatsAppMessage(to, message) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN não configurado.");
  }

  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID não configurado.");
  }

  const response = await fetch(
    `https://graph.facebook.com/v26.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: false,
          body: toWhatsAppText(message)
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Erro retornado pela API do WhatsApp:", response.status);

    throw new Error(
      "Erro ao enviar mensagem pelo WhatsApp."
    );
  }

  console.log("Mensagem enviada pelo WhatsApp.");

  return data;
}

/* =========================================================
   WHATSAPP - RECEBIMENTO DE MENSAGENS
========================================================= */

app.post("/webhook/whatsapp", async (req, res) => {
  let messageId;
  let messageReady = false;

  try {
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (!appSecret) {
      return res.status(503).json({
        ok: false,
        error: "Webhook não configurado para validar a origem."
      });
    }

    const signature = req.get("x-hub-signature-256") || "";
    const signatureMatch = signature.match(/^sha256=([a-f0-9]{64})$/i);

    if (!signatureMatch || !req.rawBody) {
      return res.sendStatus(401);
    }

    const expectedSignature = createHmac("sha256", appSecret)
      .update(req.rawBody)
      .digest();
    const receivedSignature = Buffer.from(signatureMatch[1], "hex");

    if (!timingSafeEqual(receivedSignature, expectedSignature)) {
      return res.sendStatus(401);
    }

    const body = req.body;

    const message =
      body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    // Texto e foto de refeição (VIS-01); outros tipos são ignorados por enquanto.
    if (message.type !== "text" && !(message.type === "image" && message.image?.id) && !(message.type === "audio" && message.audio?.id)) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.type === "text" ? message.text?.body?.trim() : null;
    const imageId = message.type === "image" ? message.image?.id : null;
    const audioId = message.type === "audio" ? message.audio?.id : null;
    messageId = message.id;

    if (!from || !(text || imageId || audioId) || !messageId) {
      return res.status(400).json({
        ok: false,
        error: "Mensagem inválida."
      });
    }

    const receipt = claimWhatsAppMessage(messageId);

    if (!receipt.claimed) {
      if (receipt.status === "ready") {
        await sendWhatsAppMessage(from, receipt.reply);
        markWhatsAppMessageSent(messageId);
      } else if (receipt.status === "processing") {
        return res.status(503).json({
          ok: false,
          error: "Mensagem ainda está sendo processada."
        });
      }

      return res.sendStatus(200);
    }

    let reply;
    if (imageId) {
      const media = await downloadWhatsAppMedia(imageId);
      reply = await processMealPhoto(from, { imageBase64: media.base64, mimeType: media.mimeType, caption: message.image?.caption || "" });
    } else if (audioId) {
      reply = await processVoiceMessage(from, await downloadWhatsAppMedia(audioId));
    } else {
      reply = await processMessage(from, text);
    }

    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("A resposta do processamento está vazia.");
    }

    completeWhatsAppMessage(messageId, reply);
    messageReady = true;
    await sendWhatsAppMessage(from, reply);
    markWhatsAppMessageSent(messageId);

    return res.sendStatus(200);

  } catch (error) {
    if (messageId && !messageReady) {
      releaseWhatsAppMessage(messageId);
    }

    console.error("Erro no webhook do WhatsApp:", error?.name || "Error");

    if (!res.headersSent) {
      return res.status(500).json({
        ok: false,
        error: "Não foi possível processar a mensagem."
      });
    }
  }
});

/* =========================================================
   TRATAMENTO DE ROTAS INEXISTENTES
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Rota não encontrada."
  });
});

/* =========================================================
   TRATAMENTO GLOBAL DE ERROS
========================================================= */

app.use((error, req, res, next) => {
  console.error("Erro global:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    ok: false,
    error: "Erro interno do servidor."
  });
});

export default app;
