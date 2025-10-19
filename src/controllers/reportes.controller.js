// src/controllers/reportes.controller.js
const { pool } = require("../db");
const PDFDocument = require("pdfkit-table"); // clase extendida

function fmt(d) {
  if (!d) return "";
  const x = new Date(d);
  try { return x.toLocaleString(); } catch { return x.toISOString(); }
}

exports.participantesPdf = async (_req, res) => {
  // 1) Trae datos ANTES de tocar la respuesta
  let insT = [], insC = [];
  try {
    // Talleres
    const [tRows] = await pool.query(
      `SELECT
         it.fechaIns,
         u.id       AS userId,
         u.nombre   AS userNombre,
         u.email    AS userEmail,
         u.telefono AS userTelefono,
         u.tipo_registro AS userTipoRegistro,
         u.carnet   AS userCarnet,
         u.colegio  AS userColegio,
         t.id       AS tallerId,
         t.titulo   AS tallerTitulo,
         t.startAt  AS tallerStartAt,
         t.endAt    AS tallerEndAt
       FROM \`InscripcionTaller\` it
       JOIN \`User\`  u ON u.id = it.userId
       JOIN \`Taller\` t ON t.id = it.tallerId
       ORDER BY it.fechaIns ASC`
    );

    // Competencias
    const [cRows] = await pool.query(
      `SELECT
         ic.fechaIns,
         u.id       AS userId,
         u.nombre   AS userNombre,
         u.email    AS userEmail,
         u.telefono AS userTelefono,
         u.tipo_Registro AS userTipoRegistro,
         u.carnet   AS userCarnet,
         u.colegio  AS userColegio,
         c.id       AS compId,
         c.titulo   AS compTitulo,
         c.startAt  AS compStartAt,
         c.endAt    AS compEndAt
       FROM \`InscripcionCompetencia\` ic
       JOIN \`User\`        u ON u.id = ic.userId
       JOIN \`Competencia\` c ON c.id = ic.competenciaId
       ORDER BY ic.fechaIns ASC`
    );

    insT = tRows;
    insC = cRows;
  } catch (e) {
    console.error("DB error participantesPdf:", e);
    return res.status(500).json({ message: "Error obteniendo datos" });
  }

  // 2) Prepara filas
  const rows = [];
  for (const r of insT) {
    rows.push([
      "Taller",
      r.tallerTitulo ?? "",
      fmt(r.tallerStartAt),
      fmt(r.tallerEndAt),
      r.userNombre ?? "",
      r.userEmail ?? "",
      r.userTelefono ?? "",
      r.userTipoRegistro ?? "",
      r.userCarnet ?? "",
      r.userColegio ?? "",
      fmt(r.fechaIns),
    ]);
  }
  for (const r of insC) {
    rows.push([
      "Competencia",
      r.compTitulo ?? "",
      fmt(r.compStartAt),
      fmt(r.compEndAt),
      r.userNombre ?? "",
      r.userEmail ?? "",
      r.userTelefono ?? "",
      r.userTipoRegistro ?? "",
      r.userCarnet ?? "",
      r.userColegio ?? "",
      fmt(r.fechaIns),
    ]);
  }

  // 3) Configura headers y stream del PDF
  const fname = `participantes_${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 60, bottom: 40, left: 30, right: 30 },
  });

  // Manejo robusto del stream
  doc.on("error", (err) => { console.error("PDF stream error:", err); try { res.end(); } catch {} });
  res.on("close", () => { try { doc.destroy(); } catch {} });

  doc.pipe(res);

  // 4) Título + totales (sin pageAdded)
  const totalT = insT.length;
  const totalC = insC.length;
  const total  = totalT + totalC;

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#000")
     .text("Reporte de participantes (Talleres y Competencias)");
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10).fillColor("#555")
     .text(`Emitido: ${fmt(new Date())}`);
  doc.moveDown(0.6);
  doc.font("Helvetica").fontSize(11).fillColor("#000")
     .text(`Totales: Talleres ${totalT} · Competencias ${totalC} · Participaciones ${total}`);
  doc.moveDown(0.6);

  if (total === 0) {
    doc.fontSize(12).fillColor("#444").text("No hay participaciones registradas.");
    doc.end();
    return;
  }

  // 5) Tabla – columnas que CABEN en A4 landscape (≈782 pt de ancho útil)
  const table = {
    headers: [
      "Tipo","Actividad","Inicio","Fin","Participante","Email",
      "Tel.","Reg.","Carné","Colegio","Inscripción"
    ],
    rows,
  };

  // Suma = 782 para A4 landscape con márgenes 30-30
  const columnsSize = [40, 110, 60, 60, 110, 110, 55, 45, 45, 92, 55];

  try {
    await doc.table(table, {
      columnsSize,
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10).fillColor("#000"),
      prepareRow: () => doc.font("Helvetica").fontSize(9).fillColor("#000"),
      padding: 4,
    });
  } catch (err) {
    console.error("Error generando tabla PDF:", err);
    try { doc.moveDown().fontSize(12).fillColor("#c00").text("Error al generar la tabla."); } catch {}
  }

  doc.end(); // ¡No escribir nada más en res después de esto!
};
