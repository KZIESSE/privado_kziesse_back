// src/routes/site.routes.js
const { Router } = require("express");
const { getInfo, updateInfo } = require("../controllers/site.controller");
// Si tienes middlewares de auth, descoméntalos e inclúyelos
// const { requireAuth, requireAdmin } = require("../middlewares/auth");

const router = Router();

// Público
router.get("/site/info", getInfo);

// Admin (aceptamos PUT y POST para evitar 404 por método)
router.put("/site/info", /* requireAuth, requireAdmin, */ updateInfo);
router.post("/site/info", /* requireAuth, requireAdmin, */ updateInfo);

module.exports = router;
