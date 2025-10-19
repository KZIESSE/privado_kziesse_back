// src/routes/user_qr.routes.js
const { Router } = require("express");
const { meQR, rotateQR, emailQR } = require("../controllers/user_qr.controller");
const { authRequired } = require("../middlewares/auth");

const router = Router();

// === Leer/generar QR actual ===
router.get(["/user/qr", "/me/qr", "/qr/me"], authRequired, meQR);

// === Rotar secreto (opcional: ?send=1 para enviarlo por correo) ===
router.post(["/user/qr/rotate", "/me/qr/rotate", "/qr/rotate"], authRequired, rotateQR);

// === Enviar el QR actual por correo (sin rotar) ===
router.post(["/user/qr/email", "/me/qr/email", "/qr/email"], authRequired, emailQR);

module.exports = router;
