import "dotenv/config";

import app from "./app.js";

const PORT = Number(process.env.PORT || 3000);

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
