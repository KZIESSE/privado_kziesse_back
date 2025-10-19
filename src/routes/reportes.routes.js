const { Router } = require("express");
const { authRequired, requireRole } = require("../middlewares/auth");
const reportes = require("../controllers/reportes.controller");

const r = Router();

r.get("/reportes/participantes.pdf", authRequired, requireRole("admin"), reportes.participantesPdf);
// si quieres, deja también la CSV:
// r.get("/reportes/participantes", authRequired, requireRole("admin"), reportes.participantes);

module.exports = r;
