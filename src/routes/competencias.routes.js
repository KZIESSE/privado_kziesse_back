// src/routes/competencias.routes.js
const { Router } = require("express");
const path = require("path");
const multer = require("multer");
const { authRequired, requireRole } = require("../middlewares/auth");
const ctrl = require("../controllers/competencias.controller");

const r = Router();

/* Helper para evitar 'undefined' en handlers */
const use = (name) => {
  const fn = ctrl && ctrl[name];
  return typeof fn === "function"
    ? fn
    : (_req, res) =>
        res
          .status(500)
          .json({ message: `Controller '${name}' no implementado en competencias.controller.js` });
};

/* Upload para foto (campo: 'foto') */
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "../uploads"),
    filename: (_req, file, cb) => {
      const id = Date.now() + "_" + Math.round(Math.random() * 1e9);
      const ext = (path.extname(file.originalname) || "").toLowerCase();
      cb(null, `competencia_${id}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ---------------- PÚBLICAS ---------------- */
r.get("/competencias", ctrl.publicIndex);
r.get("/competencias/:id(\\d+)", ctrl.publicShow);

/* --------------- VISITANTE ---------------- */
r.post("/competencias/:id(\\d+)/inscribirme", authRequired, use("inscribirse"));
r.delete("/competencias/:id(\\d+)/inscribirme", authRequired, use("desinscribirse"));
r.get("/competencias/:id(\\d+)/estado-inscripcion", authRequired, use("estadoInscripcion"));

/* ----------------- ADMIN ------------------ */
r.post("/competencias", authRequired, requireRole("admin"), use("create"));
r.put("/competencias/:id(\\d+)", authRequired, requireRole("admin"), use("update"));
r.delete("/competencias/:id(\\d+)", authRequired, requireRole("admin"), use("remove"));
r.get("/competencias/:id(\\d+)/inscritos", authRequired, requireRole("admin"), use("listInscritos"));

/* --- Actualizar inscripción (asistencia/puesto/proyecto/foto) --- */
/* Variante oficial: /competencias/:competenciaId/inscritos/:userId  (PATCH) */
r.patch(
  "/competencias/:competenciaId(\\d+)/inscritos/:userId(\\d+)",
  authRequired,
  requireRole("admin"),
  upload.single("foto"),
  use("updateInscripcion")
);

/* Alias PUT por si el UI usa PUT */
r.put(
  "/competencias/:competenciaId(\\d+)/inscritos/:userId(\\d+)",
  authRequired,
  requireRole("admin"),
  upload.single("foto"),
  use("updateInscripcion")
);

/* Alias con :id → normaliza a :competenciaId */
const normalizeCompetenciaId = (req, _res, next) => {
  if (!req.params.competenciaId && req.params.id) {
    req.params.competenciaId = req.params.id;
  }
  next();
};

r.patch(
  "/competencias/:id(\\d+)/inscritos/:userId(\\d+)",
  authRequired,
  requireRole("admin"),
  upload.single("foto"),
  normalizeCompetenciaId,
  use("updateInscripcion")
);

r.put(
  "/competencias/:id(\\d+)/inscritos/:userId(\\d+)",
  authRequired,
  requireRole("admin"),
  upload.single("foto"),
  normalizeCompetenciaId,
  use("updateInscripcion")
);

/* -------- Alias específicos para el toggle de asistencia -------- */
/* Soporta PATCH/PUT/POST y :competenciaId o :id. No requiere multer */
for (const method of ["patch", "put", "post"]) {
  // /competencias/:competenciaId/asistencia/:userId
  r[method](
    "/competencias/:competenciaId(\\d+)/asistencia/:userId(\\d+)",
    authRequired,
    requireRole("admin"),
    use("updateInscripcion")
  );

  // /competencias/:id/asistencia/:userId  (normaliza a :competenciaId)
  r[method](
    "/competencias/:id(\\d+)/asistencia/:userId(\\d+)",
    authRequired,
    requireRole("admin"),
    normalizeCompetenciaId,
    use("updateInscripcion")
  );
}

module.exports = r;
