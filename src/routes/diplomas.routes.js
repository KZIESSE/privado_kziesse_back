const { Router } = require("express");
const { authRequired, requireRole } = require("../middlewares/auth");
const d = require("../controllers/diplomas.controller");
const r = Router();

// Participante descarga su propio diploma
r.get("/diplomas/talleres/:id/mine.pdf", authRequired, d.tallerMinePdf);
r.get("/diplomas/competencias/:id/mine.pdf", authRequired, d.competenciaMinePdf);

// Verificación pública por código
r.get("/diplomas/verify/:code", d.verify);

module.exports = r;
