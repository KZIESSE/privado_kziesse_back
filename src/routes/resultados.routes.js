const { Router } = require("express");
const { authRequired, requireRole } = require("../middlewares/auth");
const path = require("path");
const multer = require("multer");
const ctrl = require("../controllers/resultados.controller");

const r = Router();

// ------- storage para fotos (si lo usas) -------
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "../uploads"),
    filename: (_req, file, cb) => {
      const id = Date.now() + "_" + Math.round(Math.random() * 1e9);
      const ext = (path.extname(file.originalname) || "").toLowerCase();
      cb(null, `ganador_${id}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ------- público: listado de resultados -------
r.get("/resultados", ctrl.publicIndex);

// ALIAS para compatibilidad con el FE:
r.get("/resultados/competencias", ctrl.publicIndex);

// /resultados/competencias/:competenciaId → pasa el id como query para el mismo controlador
const pickCompetenciaId = (req, _res, next) => {
  if (req.params.competenciaId) req.query.competenciaId = req.params.competenciaId;
  next();
};
r.get("/resultados/competencias/:competenciaId(\\d+)", pickCompetenciaId, ctrl.publicIndex);

// ------- admin: crear/actualizar ganador -------
r.post(
  "/resultados/competencias/:competenciaId/ganador",
  authRequired,
  requireRole("admin"),
  upload.single("foto"),
  ctrl.upsertGanador
);

module.exports = r;
