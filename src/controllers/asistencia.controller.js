// src/controllers/asistencia.controller.js
const { pool } = require("../db");

// PUT /api/competencias/:competenciaId/asistencia/:userId
exports.setAsistenciaCompetencia = async (req, res) => {
  try {
    const competenciaId = Number(req.params.competenciaId);
    const userId = Number(req.params.userId);
    const { asistio } = req.body;

    if (!Number.isFinite(competenciaId) || !Number.isFinite(userId)) {
      return res.status(400).json({ message: "Parámetros inválidos" });
    }

    // Buscar inscripción
    const [rows] = await pool.query(
      "SELECT id FROM `InscripcionCompetencia` WHERE competenciaId = ? AND userId = ? LIMIT 1",
      [competenciaId, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Inscripción no encontrada" });
    }

    // Actualizar asistencia (TINYINT 0/1)
    await pool.query(
      "UPDATE `InscripcionCompetencia` SET asistio = ? WHERE id = ?",
      [asistio ? 1 : 0, rows[0].id]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("setAsistenciaCompetencia error:", e);
    res.status(500).json({ message: "Error interno" });
  }
};

// PUT /api/talleres/:tallerId/asistencia/:userId
exports.setAsistenciaTaller = async (req, res) => {
  try {
    const tallerId = Number(req.params.tallerId);
    const userId = Number(req.params.userId);
    const { asistio } = req.body;

    if (!Number.isFinite(tallerId) || !Number.isFinite(userId)) {
      return res.status(400).json({ message: "Parámetros inválidos" });
    }

    // Buscar inscripción
    const [rows] = await pool.query(
      "SELECT id FROM `InscripcionTaller` WHERE tallerId = ? AND userId = ? LIMIT 1",
      [tallerId, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Inscripción no encontrada" });
    }

    // Actualizar asistencia (TINYINT 0/1)
    await pool.query(
      "UPDATE `InscripcionTaller` SET asistio = ? WHERE id = ?",
      [asistio ? 1 : 0, rows[0].id]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("setAsistenciaTaller error:", e);
    res.status(500).json({ message: "Error interno" });
  }
};
