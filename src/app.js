// src/app.js
require("dotenv").config();
const path = require("path");
const express = require("express");

// Rutas
const authRoutes = require("./routes/auth.routes");
const userQrRoutes = require("./routes/user_qr.routes");
const talleresRoutes = require("./routes/talleres.routes");
const competenciasRoutes = require("./routes/competencias.routes");
const reportesRoutes = require("./routes/reportes.routes");
const diplomasRoutes = require("./routes/diplomas.routes");
const asistenciaRoutes = require("./routes/asistencia.routes");
const resultadosRoutes = require("./routes/resultados.routes");
const siteRoutes = require("./routes/site.routes");

const app = express();
app.set("trust proxy", 1);

/* =========================
   CORS ABIERTO (sin cookies)
   - Echo del Origin
   - Preflight robusto (eco de Access-Control-Request-*)
   ========================= */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Permitimos cualquier origen (sin credenciales)
  res.setHeader("Access-Control-Allow-Origin", origin || "*");

  // Muy importante para que los proxies/navegador no cacheen variaciones
  res.setHeader(
    "Vary",
    "Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
  );

  // Métodos permitidos (también en respuesta normal)
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );

  // Cabeceras permitidas: si el navegador pide específicas, las reflejamos
  const reqHeaders = req.headers["access-control-request-headers"];
  res.setHeader(
    "Access-Control-Allow-Headers",
    reqHeaders || "Content-Type, Authorization"
  );

  // NO habilitamos credenciales para poder usar "*"
  // res.setHeader("Access-Control-Allow-Credentials", "true"); // <- NO usar

  // Responder preflight inmediatamente
  if (req.method === "OPTIONS") return res.status(204).end();

  next();
});

/* =========================
   Parsers y estáticos
   ========================= */
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =========================
   Rutas
   ========================= */
app.use("/api/auth", authRoutes);
app.use("/api", userQrRoutes);
app.use("/api", talleresRoutes);
app.use("/api", competenciasRoutes);
app.use("/api", reportesRoutes);
app.use("/api", diplomasRoutes);
app.use("/api", asistenciaRoutes);
app.use("/api", resultadosRoutes);
app.use("/api", siteRoutes);

/* =========================
   Healthcheck y 404
   ========================= */
app.get("/", (_req, res) => res.json({ ok: true }));
app.use((_req, res) => res.status(404).json({ message: "Not found" }));

module.exports = app;
