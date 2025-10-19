// src/server.js
require("dotenv").config();
const app = require("./app");

const PORT = Number(process.env.PORT || 4000);
let server;

async function bootstrap() {
  // Ejecuta el seed SOLO si lo pides o si no estás en prod
  try {
    if (process.env.RUN_SEED_ON_BOOT === "true" || process.env.NODE_ENV !== "production") {
      const { runSeed } = require("./seed");
      await runSeed();
      console.log("Seed ejecutado correctamente");
    } else {
      console.log("Seed omitido (RUN_SEED_ON_BOOT != true)");
    }
  } catch (e) {
    console.error("Seed error:", e?.message || e);
  }

  server = app.listen(PORT, () =>
    console.log(`API lista en http://localhost:${PORT}/api`)
  );
}

// Solo arranca si ejecutas este archivo directamente (node src/server.js)
if (require.main === module) {
  bootstrap();
}

// Manejo básico de errores y cierre limpio
process.on("unhandledRejection", (err) => {
  console.error("UnhandledRejection:", err);
});
process.on("SIGINT", () => {
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
});
