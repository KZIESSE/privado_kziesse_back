// src/controllers/user_qr.controller.js
const { pool } = require("../db");
const QRCode = require("qrcode");
const { randomUUID } = require("crypto");
const nodemailer = require("nodemailer");

function payload({ id, email, qrSecret }) {
  const p = new URLSearchParams({ id: String(id), e: email, k: qrSecret });
  return `appfs://u?${p.toString()}`;
}

/* ========= Mailer (singleton) ========= */
let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    // Sin configuración: devolvemos null para que el caller responda claro.
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return _transporter;
}

/**
 * Envía correo con el QR incrustado como adjunto (CID) -> compatible con Gmail.
 * @param {{to:string, name?:string, dataURL:string}} arg
 */
async function sendQRMail({ to, name, dataURL }) {
  const SITE_NAME = process.env.SITE_NAME || "Congreso UMG";
  const MAIL_FROM = process.env.MAIL_FROM || "no-reply@example.com";

  const transporter = getTransporter();
  if (!transporter) {
    const e = new Error(
      "SMTP no configurado en el servidor. Define SMTP_HOST/PORT/SECURE/USER/PASS y MAIL_FROM."
    );
    e.code = "SMTP_MISSING";
    throw e;
  }

  // Tomar el base64 del dataURL
  const base64 = (dataURL || "").includes(",")
    ? dataURL.split(",")[1]
    : dataURL;

  const html = `
    <div style="font-family:sans-serif">
      <p>Hola ${name || ""},</p>
      <p>Adjuntamos tu QR de identificación para ${SITE_NAME}.</p>
      <p><img src="cid:qr-img" alt="QR" style="max-width:300px"/></p>
      <p>Si no solicitaste este correo, puedes ignorarlo.</p>
    </div>
  `;

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject: `${SITE_NAME} — Tu código QR`,
    html,
    attachments: [
      {
        filename: "qr.png",
        content: Buffer.from(base64, "base64"),
        contentType: "image/png",
        cid: "qr-img", // coincide con el src="cid:qr-img"
      },
    ],
  });
}

/* ========= Endpoints ========= */

// GET /api/user/qr
exports.meQR = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const [rows] = await pool.query(
      "SELECT id, nombre, email, role, qrSecret FROM `User` WHERE id = ? LIMIT 1",
      [userId]
    );
    if (!rows.length) return res.status(404).json({ message: "Usuario no encontrado" });

    const u = rows[0];
    let qrSecret = u.qrSecret;

    if (!qrSecret) {
      qrSecret = randomUUID();
      await pool.query("UPDATE `User` SET qrSecret = ? WHERE id = ?", [qrSecret, u.id]);
    }

    const text = payload({ id: u.id, email: u.email, qrSecret });
    const dataURL = await QRCode.toDataURL(text, { width: 512, margin: 1 });
    const svg = await QRCode.toString(text, { type: "svg", width: 256, margin: 1 });

    res.json({
      user: { id: u.id, nombre: u.nombre, email: u.email, role: u.role },
      payload: text,
      dataURL,
      svg,
    });
  } catch (e) {
    console.error("user_qr.meQR:", e);
    res.status(500).json({ message: e.message || "Error generando QR" });
  }
};

// POST /api/user/qr/rotate  (soporta ?send=1 para enviar email)
exports.rotateQR = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const newSecret = randomUUID();

    await pool.query("UPDATE `User` SET qrSecret = ? WHERE id = ?", [newSecret, userId]);

    const [[u]] = await pool.query(
      "SELECT id, nombre, email FROM `User` WHERE id = ? LIMIT 1",
      [userId]
    );

    const text = payload({ id: u.id, email: u.email, qrSecret: newSecret });
    const dataURL = await QRCode.toDataURL(text, { width: 512, margin: 1 });

    const wantsEmail =
      ["1", "true"].includes(String(req.query.send || "").toLowerCase());

    if (wantsEmail) {
      await sendQRMail({ to: u.email, name: u.nombre, dataURL });
    }

    res.json({ message: "QR regenerado", payload: text, dataURL, emailed: wantsEmail });
  } catch (e) {
    console.error("user_qr.rotateQR:", e);
    if (e.code === "SMTP_MISSING") {
      return res.status(501).json({ message: e.message });
    }
    res.status(500).json({ message: e.message || "Error al regenerar QR" });
  }
};

// POST /api/user/qr/email  (envía el QR actual por correo sin rotarlo)
exports.emailQR = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const [[u]] = await pool.query(
      "SELECT id, nombre, email, qrSecret FROM `User` WHERE id = ? LIMIT 1",
      [userId]
    );
    if (!u) return res.status(404).json({ message: "Usuario no encontrado" });

    let qrSecret = u.qrSecret || randomUUID();
    if (!u.qrSecret) {
      await pool.query("UPDATE `User` SET qrSecret = ? WHERE id = ?", [qrSecret, userId]);
    }

    const text = payload({ id: u.id, email: u.email, qrSecret });
    const dataURL = await QRCode.toDataURL(text, { width: 512, margin: 1 });

    await sendQRMail({ to: u.email, name: u.nombre, dataURL });
    res.json({ message: "QR enviado a tu correo", emailed: true });
  } catch (e) {
    console.error("user_qr.emailQR:", e);
    if (e.code === "SMTP_MISSING") {
      return res.status(501).json({ message: e.message });
    }
    res.status(500).json({ message: e.message || "No se pudo enviar el correo" });
  }
};
