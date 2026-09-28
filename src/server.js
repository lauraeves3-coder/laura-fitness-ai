import "dotenv/config";

import express from "express";

import {
  ensureUser,
  updateUserProfile,
  getUser,
  getDailySummary,
  getRecentHistory
} from "./db.js";

import { processMessage } from "./ai.js";

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT || 3000);

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
    const { userId, message } = req.body;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "userId é obrigatório."
      });
    }

    if (!message || !message.trim()) {
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
    console.error("Erro no chat:", error);

    res.status(500).json({
      ok: false,
      error: error.message || "Erro ao processar mensagem."
    });
  }
});

/* =========================================================
   WHATSAPP - VERIFICAÇÃO DO WEBHOOK
========================================================= */

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

async function sendWhatsAppMessage(to, message) {
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
          body: message
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(
      "Erro retornado pela API do WhatsApp:",
      JSON.stringify(data, null, 2)
    );

    throw new Error(
      data?.error?.message || "Erro ao enviar mensagem pelo WhatsApp."
    );
  }

  console.log(
    "Mensagem enviada pelo WhatsApp:",
    JSON.stringify(data, null, 2)
  );

  return data;
}

/* =========================================================
   WHATSAPP - RECEBIMENTO DE MENSAGENS
========================================================= */

app.post("/webhook/whatsapp", async (req, res) => {
  try {
    // Respondemos imediatamente ao Meta.
    res.sendStatus(200);

    const body = req.body;

    console.log(
      "Webhook WhatsApp recebido:",
      JSON.stringify(body, null, 2)
    );

    const message =
      body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      console.log("Evento recebido sem mensagem para processar.");
      return;
    }

    // Por enquanto processamos mensagens de texto.
    if (message.type !== "text") {
      console.log(
        `Tipo de mensagem ainda não processado: ${message.type}`
      );
      return;
    }

    const from = message.from;
    const text = message.text?.body?.trim();

    if (!from || !text) {
      console.log("Mensagem sem remetente ou texto.");
      return;
    }

    console.log(`Mensagem recebida de ${from}: ${text}`);

    // O número do WhatsApp será o identificador do usuário.
    const reply = await processMessage(from, text);

    console.log(`Resposta da IA para ${from}: ${reply}`);

    await sendWhatsAppMessage(from, reply);

  } catch (error) {
    console.error("Erro no webhook do WhatsApp:", error);
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

/* =========================================================
   INICIAR SERVIDOR
========================================================= */

app.listen(PORT, () => {
  console.log("");
  console.log("==========================================");
  console.log("   LAURA FITNESS AI");
  console.log("==========================================");
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`http://localhost:${PORT}`);
  console.log("");
  console.log("Health:");
  console.log(`http://localhost:${PORT}/health`);
  console.log("");
  console.log("API:");
  console.log(`POST http://localhost:${PORT}/api/chat`);
  console.log("");
});