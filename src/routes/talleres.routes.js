const { Router } = require("express");
const { authRequired, requireRole } = require("../middlewares/auth");
const c = require("../controllers/talleres.controller");
const r = Router();

// públicas
r.get("/talleres", c.list);

// admin
r.post("/talleres", authRequired, requireRole("admin"), c.create);
r.patch("/talleres/:id", authRequired, requireRole("admin"), c.update);
r.delete("/talleres/:id", authRequired, requireRole("admin"), c.remove);
r.get("/talleres/:id/inscritos", authRequired, requireRole("admin"), c.inscritos);

// visitante
r.get("/talleres/mios", authRequired, c.mine);
r.post("/talleres/:id/inscripciones", authRequired, c.enroll);

module.exports = r;
