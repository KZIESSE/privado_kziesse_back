const { Router } = require("express");
const { authRequired, requireRole } = require("../middlewares/auth");
const a = require("../controllers/asistencia.controller");
const r = Router();

r.patch("/admin/competencias/:competenciaId/inscritos/:userId/asistencia",
  authRequired, requireRole("admin"), a.setAsistenciaCompetencia);

r.patch("/admin/talleres/:tallerId/inscritos/:userId/asistencia",
  authRequired, requireRole("admin"), a.setAsistenciaTaller);

module.exports = r;
