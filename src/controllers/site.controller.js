// src/controllers/site.controller.js
const { pool } = require("../db");

// Valores por defecto (ajústalos a tu gusto)
const DEFAULTS = {
  homeTitle: "Bienvenido al Congreso UMG",
  homeBody: "",
  faq: "",
  phone: "",
  university: "Universidad Mariano Gálvez",
  footerNote: ""
};

// Helper: fusiona defaults con lo que venga de DB (DB > defaults)
function withDefaults(row) {
  return { ...DEFAULTS, ...(row || {}) };
}

// GET /api/site/info
exports.getInfo = async (_req, res) => {
  try {
    // Tomar el último registro si existiera más de uno
    const [rows] = await pool.query("SELECT * FROM `SiteInfo` ORDER BY id DESC LIMIT 1");
    let info = rows[0];

    // si no existe, crea con defaults
    if (!info) {
      const [result] = await pool.query(
        "INSERT INTO `SiteInfo` (homeTitle, homeBody, faq, phone, university, footerNote) VALUES (?, ?, ?, ?, ?, ?)",
        [
          DEFAULTS.homeTitle,
          DEFAULTS.homeBody,
          DEFAULTS.faq,
          DEFAULTS.phone,
          DEFAULTS.university,
          DEFAULTS.footerNote
        ]
      );
      const [rows2] = await pool.query("SELECT * FROM `SiteInfo` WHERE id = ? LIMIT 1", [
        result.insertId
      ]);
      info = rows2[0];
    }

    // Evitar cache
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    res.json(withDefaults(info));
  } catch (e) {
    console.error("site.getInfo error:", e);
    res.status(500).json({ message: "Error al obtener información del sitio" });
  }
};

// PUT /api/site/info  (solo admin)
exports.updateInfo = async (req, res) => {
  try {
    const allow = ["homeTitle", "homeBody", "faq", "phone", "university", "footerNote"];

    // asegurar que exista un row para actualizar
    const [rows] = await pool.query("SELECT * FROM `SiteInfo` ORDER BY id DESC LIMIT 1");
    let row = rows[0];
    if (!row) {
      const [result] = await pool.query(
        "INSERT INTO `SiteInfo` (homeTitle, homeBody, faq, phone, university, footerNote) VALUES (?, ?, ?, ?, ?, ?)",
        [
          DEFAULTS.homeTitle,
          DEFAULTS.homeBody,
          DEFAULTS.faq,
          DEFAULTS.phone,
          DEFAULTS.university,
          DEFAULTS.footerNote
        ]
      );
      const [rows2] = await pool.query("SELECT * FROM `SiteInfo` WHERE id = ? LIMIT 1", [
        result.insertId
      ]);
      row = rows2[0];
    }

    // construir SET dinámico con solo los campos permitidos presentes en body
    const sets = [];
    const vals = [];
    for (const k of allow) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        sets.push(`${k} = ?`);
        vals.push(req.body[k]);
      }
    }

    if (!sets.length) {
      // nada para actualizar → devolver lo actual con defaults aplicados
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      return res.json(withDefaults(row));
    }

    const sql = `UPDATE \`SiteInfo\` SET ${sets.join(", ")} WHERE id = ?`;
    vals.push(row.id);
    await pool.query(sql, vals);

    const [updatedRows] = await pool.query("SELECT * FROM `SiteInfo` WHERE id = ? LIMIT 1", [
      row.id
    ]);

    // Evitar caché también aquí
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    res.json(withDefaults(updatedRows[0]));
  } catch (e) {
    console.error("site.updateInfo error:", e);
    res.status(500).json({ message: "Error al actualizar información del sitio" });
  }
};
