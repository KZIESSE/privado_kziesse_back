// src/controllers/resultados.controller.js
const { pool } = require("../db");

/**
 * GET /api/resultados
 * GET /api/resultados/competencias
 * GET /api/resultados/competencias/:competenciaId  (alias: en la ruta pasas req.params a query)
 *
 * Query opcional:
 *   ?competenciaId=123
 *
 * Respuesta:
 * [
 *   {
 *     id,
 *     titulo,
 *     ganadores: [
 *       {
 *         userId,
 *         user: { id, nombre },
 *         puesto,
 *         proyectoTitulo,
 *         proyectoDesc,
 *         fotoUrl
 *       },
 *       ...
 *     ]
 *   },
 *   ...
 * ]
 */
exports.publicIndex = async (req, res) => {
  try {
    const competenciaId =
      req.query.competenciaId != null ? Number(req.query.competenciaId) : null;

    // 1) Competencias (filtradas opcionalmente)
    const [competencias] = await pool.query(
      `SELECT id, titulo
         FROM \`Competencia\`
        WHERE (? IS NULL OR id = ?)
        ORDER BY createdAt DESC`,
      [competenciaId, competenciaId]
    );

    if (!competencias.length) return res.json([]);

    // 2) Ganadores por competencia (puesto NOT NULL), ordenados
    const compIds = competencias.map(c => c.id);
    const [ganadores] = await pool.query(
      `SELECT
         ic.competenciaId,
         ic.userId,
         ic.puesto,
         ic.proyectoTitulo,
         ic.proyectoDesc,
         ic.fotoUrl,
         u.id   AS uId,
         u.nombre AS uNombre
       FROM \`InscripcionCompetencia\` ic
       LEFT JOIN \`User\` u ON u.id = ic.userId
      WHERE ic.puesto IS NOT NULL
        AND ic.competenciaId IN (?)
      ORDER BY ic.puesto ASC, ic.fechaIns ASC`,
      [compIds]
    );

    // 3) Agrupar por competenciaId
    const byComp = new Map();
    for (const g of ganadores) {
      if (!byComp.has(g.competenciaId)) byComp.set(g.competenciaId, []);
      byComp.get(g.competenciaId).push({
        userId: g.userId,
        user: g.uId ? { id: g.uId, nombre: g.uNombre } : null,
        puesto: g.puesto,
        proyectoTitulo: g.proyectoTitulo || "",
        proyectoDesc: g.proyectoDesc || "",
        fotoUrl: g.fotoUrl || null,
      });
    }

    const out = competencias.map(c => ({
      id: c.id,
      titulo: c.titulo,
      ganadores: byComp.get(c.id) || [],
    }));

    return res.json(out);
  } catch (err) {
    console.error("resultados.publicIndex:", err);
    return res.status(500).json({ message: "Error al obtener resultados" });
  }
};

/**
 * POST /api/resultados/competencias/:competenciaId/ganador
 * Body: { userId, puesto?, proyectoTitulo?, proyectoDesc? }
 * File (opcional): field "foto"
 */
exports.upsertGanador = async (req, res) => {
  try {
    const competenciaId = Number(req.params.competenciaId);
    const userId = Number(req.body.userId);

    if (!Number.isFinite(competenciaId) || !Number.isFinite(userId)) {
      return res.status(400).json({ message: "Parámetros inválidos" });
    }

    // ¿Existe inscripción?
    const [rows] = await pool.query(
      "SELECT id, fotoUrl FROM `InscripcionCompetencia` WHERE competenciaId = ? AND userId = ? LIMIT 1",
      [competenciaId, userId]
    );
    if (!rows.length) return res.status(404).json({ message: "No inscrito" });

    const ins = rows[0];

    // Build SET dinámico
    const sets = [];
    const vals = [];

    if (req.body.puesto !== undefined && req.body.puesto !== "") {
      const p = Number(req.body.puesto);
      if (!Number.isFinite(p)) {
        return res.status(400).json({ message: "Puesto inválido" });
      }
      sets.push("puesto = ?");
      vals.push(p);
    }

    if (req.body.proyectoTitulo !== undefined) {
      sets.push("proyectoTitulo = ?");
      vals.push(String(req.body.proyectoTitulo || "").trim());
    }

    if (req.body.proyectoDesc !== undefined) {
      sets.push("proyectoDesc = ?");
      vals.push(String(req.body.proyectoDesc || "").trim());
    }

    if (req.file) {
      sets.push("fotoUrl = ?");
      vals.push(`/uploads/${req.file.filename}`);
    }

    if (!sets.length) {
      // Nada que actualizar
      return res.json({
        ok: true,
        id: ins.id,
        fotoUrl: ins.fotoUrl || null,
      });
    }

    const sql = `UPDATE \`InscripcionCompetencia\` SET ${sets.join(", ")} WHERE id = ?`;
    vals.push(ins.id);

    await pool.query(sql, vals);

    // leer fotoUrl actualizada
    const [after] = await pool.query(
      "SELECT fotoUrl FROM `InscripcionCompetencia` WHERE id = ?",
      [ins.id]
    );

    return res.json({
      ok: true,
      id: ins.id,
      fotoUrl: after[0]?.fotoUrl || null,
    });
  } catch (err) {
    console.error("resultados.upsertGanador:", err);
    return res.status(500).json({ message: "Error al actualizar ganador" });
  }
};
