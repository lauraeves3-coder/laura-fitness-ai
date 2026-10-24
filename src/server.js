import "dotenv/config";

import app, { sendWhatsAppMessage } from "./app.js";
import { runReminders } from "./ai.js";
import { syncAllStrava } from "./integrations/strava.js";

const PORT = Number(process.env.PORT || 3000);

// ARQ-04: lembretes proativos a cada minuto e importação do Strava a cada 20 minutos,
// só com o WhatsApp configurado.
if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
  setInterval(() => {
    runReminders({ send: sendWhatsAppMessage })
      .catch((error) => console.error("Falha nos lembretes:", error.message));
  }, 60_000);
  setInterval(() => {
    syncAllStrava({ send: sendWhatsAppMessage })
      .catch((error) => console.error("Falha na sincronização do Strava:", error.message));
  }, 20 * 60_000);
}

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
