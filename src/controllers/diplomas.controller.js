// src/controllers/diplomas.controller.js
const { pool } = require("../db");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");

function fmtFecha(d) {
  const x = new Date(d);
  try {
    return x.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return x.toISOString().slice(0, 10);
  }
}

// Dibuja un diploma simple y elegante
async function renderDiploma(
  res,
  {
    nombre,
    actividad,
    tipo,
    inicio,
    fin,
    evento = "Congreso UMG",
    bgPath, // opcional: ruta a imagen de fondo (ej: /public/cert_bg.png)
    firma1,
    firma2, // opcional
    color = "#0ea5e9", // celeste
    qrText, // opcional: texto/URL para QR
  }
) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
  });
  doc.pipe(res);

  // fondo opcional
  if (bgPath && fs.existsSync(bgPath)) {
    const { width, height } = doc.page;
    doc.image(bgPath, 0, 0, { width, height });
  }

  // marco
  const { width, height } = doc.page;
  doc.rect(20, 20, width - 40, height - 40).lineWidth(2).strokeColor(color).stroke();

  // encabezado
  doc.fillColor(color).font("Helvetica-Bold").fontSize(22).text(evento, { align: "center" }).moveDown(0.5);

  doc.fillColor("#000").font("Helvetica-Bold").fontSize(36).text("DIPLOMA", { align: "center" }).moveDown(0.8);

  // otorga a:
  doc.font("Helvetica").fontSize(14).text("Se otorga a", { align: "center" }).moveDown(0.3);

  // nombre grande
  doc.font("Helvetica-Bold").fontSize(34).text(nombre.toUpperCase(), { align: "center" }).moveDown(0.6);

  // por su participación...
  const rango = `${fmtFecha(inicio)} – ${fmtFecha(fin)}`;
  doc
    .font("Helvetica")
    .fontSize(16)
    .text(`por su participación en el ${tipo.toLowerCase()} “${actividad}”`, { align: "center" })
    .moveDown(0.2)
    .fontSize(12)
    .fillColor("#555")
    .text(rango, { align: "center" })
    .fillColor("#000");

  // firmas opcionales
  const baseY = height - 140;
  if (firma1 && fs.existsSync(firma1)) doc.image(firma1, width / 4 - 60, baseY - 40, { width: 120 });
  if (firma2 && fs.existsSync(firma2)) doc.image(firma2, (3 * width) / 4 - 60, baseY - 40, { width: 120 });

  doc
    .font("Helvetica")
    .fontSize(12)
    .text("__________________________", width / 4 - 110, baseY, { width: 220, align: "center" })
    .text("__________________________", (3 * width) / 4 - 110, baseY, { width: 220, align: "center" })
    .fontSize(10)
    .fillColor("#555")
    .text("Coordinación", width / 4 - 110, baseY + 16, { width: 220, align: "center" })
    .text("Organización", (3 * width) / 4 - 110, baseY + 16, { width: 220, align: "center" })
    .fillColor("#000");

  // QR (opcional) — esquina superior izquierda
  if (qrText) {
    const QR_SIZE = 80;
    const QX = 30;
    const QY = 80;

    const qr = await QRCode.toBuffer(qrText, { width: QR_SIZE, margin: 1 });
    doc.image(qr, QX, QY, { width: QR_SIZE, height: QR_SIZE });

    doc.fontSize(9).fillColor("#555").text("Verificación", QX, QY + QR_SIZE + 6, { width: QR_SIZE, align: "center" }).fillColor("#000");
  }

  doc.end();
}

/* --------- helpers SQL (certCode) --------- */

async function ensureCertCodeInsT(insId) {
  const [rows] = await pool.query(
    "SELECT certCode FROM `InscripcionTaller` WHERE id = ? LIMIT 1",
    [insId]
  );
  if (!rows.length) throw new Error("Inscripción (taller) no encontrada");

  let code = rows[0].certCode;
  if (!code) {
    code = randomUUID();
    await pool.query(
      "UPDATE `InscripcionTaller` SET certCode = ?, certIssuedAt = NOW() WHERE id = ?",
      [code, insId]
    );
  }
  return code;
}

async function ensureCertCodeInsC(insId) {
  const [rows] = await pool.query(
    "SELECT certCode FROM `InscripcionCompetencia` WHERE id = ? LIMIT 1",
    [insId]
  );
  if (!rows.length) throw new Error("Inscripción (competencia) no encontrada");

  let code = rows[0].certCode;
  if (!code) {
    code = randomUUID();
    await pool.query(
      "UPDATE `InscripcionCompetencia` SET certCode = ?, certIssuedAt = NOW() WHERE id = ?",
      [code, insId]
    );
  }
  return code;
}

/* --------- endpoints --------- */

// Participante descarga su DIPLOMA de TALLER
exports.tallerMinePdf = async (req, res) => {
  try {
    const userId = req.user.id;
    const tallerId = Number(req.params.id);

    // Buscar inscripción + joins a User y Taller
    const [rows] = await pool.query(
      `SELECT
         it.id, it.asistio, it.certCode, it.certIssuedAt,
         u.nombre AS userNombre,
         t.id AS tallerId, t.titulo AS tallerTitulo, t.startAt AS tallerStartAt, t.endAt AS tallerEndAt
       FROM \`InscripcionTaller\` it
       JOIN \`User\` u   ON u.id = it.userId
       JOIN \`Taller\` t ON t.id = it.tallerId
      WHERE it.userId = ? AND it.tallerId = ?
      LIMIT 1`,
      [userId, tallerId]
    );

    if (!rows.length) return res.status(404).json({ message: "No estás inscrito en este taller" });
    const ins = rows[0];
    if (!ins.asistio) return res.status(403).json({ message: "Diploma no disponible (pendiente de asistencia)" });

    const code = await ensureCertCodeInsT(ins.id);
    const verifyUrl = `${process.env.PUBLIC_BASE_URL || "https://example.com"}/api/diplomas/verify/${code}`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="diploma_taller_${ins.tallerId}.pdf"`);

    const bg = path.resolve(__dirname, "../public/cert_bg.png"); // opcional
    const firma1 = path.resolve(__dirname, "../public/firma1.png"); // opcional
    const firma2 = path.resolve(__dirname, "../public/firma2.png"); // opcional

    await renderDiploma(res, {
      nombre: ins.userNombre,
      actividad: ins.tallerTitulo,
      tipo: "Taller",
      inicio: ins.tallerStartAt || new Date(),
      fin: ins.tallerEndAt || new Date(),
      evento: "Congreso UMG",
      bgPath: fs.existsSync(bg) ? bg : undefined,
      firma1: fs.existsSync(firma1) ? firma1 : undefined,
      firma2: fs.existsSync(firma2) ? firma2 : undefined,
      color: "#0ea5e9",
      qrText: verifyUrl,
    });
  } catch (e) {
    console.error("tallerMinePdf error:", e);
    res.status(500).json({ message: "Error al generar diploma" });
  }
};

// Participante descarga su DIPLOMA de COMPETENCIA
exports.competenciaMinePdf = async (req, res) => {
  try {
    const userId = req.user.id;
    const competenciaId = Number(req.params.id);

    const [rows] = await pool.query(
      `SELECT
         ic.id, ic.asistio, ic.certCode, ic.certIssuedAt,
         u.nombre AS userNombre,
         c.id AS compId, c.titulo AS compTitulo, c.startAt AS compStartAt, c.endAt AS compEndAt
       FROM \`InscripcionCompetencia\` ic
       JOIN \`User\` u        ON u.id = ic.userId
       JOIN \`Competencia\` c ON c.id = ic.competenciaId
      WHERE ic.userId = ? AND ic.competenciaId = ?
      LIMIT 1`,
      [userId, competenciaId]
    );

    if (!rows.length) return res.status(404).json({ message: "No estás inscrito en esta competencia" });
    const ins = rows[0];
    if (!ins.asistio) return res.status(403).json({ message: "Diploma no disponible (pendiente de asistencia)" });

    const code = await ensureCertCodeInsC(ins.id);
    const verifyUrl = `${process.env.PUBLIC_BASE_URL || "https://example.com"}/api/diplomas/verify/${code}`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="diploma_comp_${ins.compId}.pdf"`);

    const bg = path.resolve(__dirname, "../public/cert_bg.png");
    await renderDiploma(res, {
      nombre: ins.userNombre,
      actividad: ins.compTitulo,
      tipo: "Competencia",
      inicio: ins.compStartAt || new Date(),
      fin: ins.compEndAt || new Date(),
      evento: "Congreso UMG",
      bgPath: fs.existsSync(bg) ? bg : undefined,
      color: "#0ea5e9",
      qrText: verifyUrl,
    });
  } catch (e) {
    console.error("competenciaMinePdf error:", e);
    res.status(500).json({ message: "Error al generar diploma" });
  }
};

// Verificación por código (simple)
exports.verify = async (req, res) => {
  try {
    const code = req.params.code;

    // 1) Buscar en Taller
    const [trows] = await pool.query(
      `SELECT it.certIssuedAt AS emitido, u.nombre AS participante, t.titulo AS actividad
         FROM \`InscripcionTaller\` it
         JOIN \`User\` u   ON u.id = it.userId
         JOIN \`Taller\` t ON t.id = it.tallerId
        WHERE it.certCode = ?
        LIMIT 1`,
      [code]
    );

    if (trows.length) {
      const r = trows[0];
      return res.json({
        valid: true,
        tipo: "Taller",
        participante: r.participante,
        actividad: r.actividad,
        emitido: r.emitido,
      });
    }

    // 2) Buscar en Competencia
    const [crows] = await pool.query(
      `SELECT ic.certIssuedAt AS emitido, u.nombre AS participante, c.titulo AS actividad
         FROM \`InscripcionCompetencia\` ic
         JOIN \`User\` u        ON u.id = ic.userId
         JOIN \`Competencia\` c ON c.id = ic.competenciaId
        WHERE ic.certCode = ?
        LIMIT 1`,
      [code]
    );

    if (crows.length) {
      const r = crows[0];
      return res.json({
        valid: true,
        tipo: "Competencia",
        participante: r.participante,
        actividad: r.actividad,
        emitido: r.emitido,
      });
    }

    return res.status(404).json({ valid: false });
  } catch (e) {
    console.error("verify error:", e);
    res.status(500).json({ message: "Error al verificar diploma" });
  }
};
