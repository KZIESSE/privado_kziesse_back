// src/controllers/competencias.controller.js
const { pool } = require("../db");

/* ===============================
   PÚBLICO
================================ */

// GET /api/competencias
async function publicIndex(_req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM \`InscripcionCompetencia\` ic WHERE ic.competenciaId = c.id) AS inscritos
      FROM \`Competencia\` c
      ORDER BY c.startAt DESC, c.id DESC
    `);

    const out = rows.map((c) => {
      const inscritos = Number(c.inscritos || 0);
      const restantes =
        c.cupo > 0 ? Math.max(Number(c.cupo) - inscritos, 0) : null; // null => "∞"
      const { inscritos: _ins, ...rest } = c;
      return { ...rest, inscritos, restantes };
    });

    return res.status(200).json(out);
  } catch (error) {
    console.error("competencias.publicIndex:", error);
    return res.status(500).json({ message: "Error al listar competencias" });
  }
}

// GET /api/competencias/:id
async function publicShow(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Parámetro id inválido" });
    }

    const [rows] = await pool.query(
      "SELECT * FROM `Competencia` WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows.length)
      return res.status(404).json({ message: "Competencia no encontrada" });

    return res.json(rows[0]);
  } catch (error) {
    console.error("competencias.publicShow:", error);
    return res.status(500).json({ message: "Error al obtener competencia" });
  }
}

/* ===============================
   INSCRIPCIÓN (USUARIOS AUTENTICADOS)
================================ */

// POST /api/competencias/:id/inscribirme
async function inscribirse(req, res) {
  try {
    const competenciaId = Number(req.params.id);
    const userId = Number(req.user?.id ?? req.body?.userId);
    if (!userId)
      return res.status(400).json({ message: "Falta userId (o sesión no válida)" });

    const [existC] = await pool.query(
      "SELECT id FROM `Competencia` WHERE id = ? LIMIT 1",
      [competenciaId]
    );
    if (!existC.length)
      return res.status(404).json({ message: "Competencia no encontrada" });

    const [dup] = await pool.query(
      "SELECT 1 FROM `InscripcionCompetencia` WHERE userId = ? AND competenciaId = ? LIMIT 1",
      [userId, competenciaId]
    );
    if (dup.length) {
      return res
        .status(409)
        .json({ message: "Ya estás inscrito en esta competencia" });
    }

    const [result] = await pool.query(
      "INSERT INTO `InscripcionCompetencia` (userId, competenciaId, fechaIns) VALUES (?, ?, NOW())",
      [userId, competenciaId]
    );

    return res.status(201).json({
      message: "Inscripción creada",
      inscripcion: { id: result.insertId, userId, competenciaId },
    });
  } catch (error) {
    console.error("competencias.inscribirse:", error);
    return res.status(500).json({ message: "Error al inscribirse" });
  }
}

// DELETE /api/competencias/:id/inscribirme
async function desinscribirse(req, res) {
  try {
    const competenciaId = Number(req.params.id);
    const userId = Number(req.user?.id ?? req.body?.userId);
    if (!userId)
      return res.status(400).json({ message: "Falta userId (o sesión no válida)" });

    await pool.query(
      "DELETE FROM `InscripcionCompetencia` WHERE userId = ? AND competenciaId = ?",
      [userId, competenciaId]
    ); // idempotente

    return res.json({ message: "Inscripción cancelada" });
  } catch (error) {
    console.error("competencias.desinscribirse:", error);
    return res.status(500).json({ message: "Error al cancelar inscripción" });
  }
}

// GET /api/competencias/:id/estado-inscripcion
async function estadoInscripcion(req, res) {
  try {
    const competenciaId = Number(req.params.id);
    const userId = Number(req.user?.id ?? req.query?.userId);
    if (!userId)
      return res.status(400).json({ message: "Falta userId (o sesión no válida)" });

    const [rows] = await pool.query(
      `SELECT id, fechaIns, asistio, puesto, proyectoTitulo, proyectoDesc, fotoUrl
         FROM \`InscripcionCompetencia\`
        WHERE userId = ? AND competenciaId = ?
        LIMIT 1`,
      [userId, competenciaId]
    );

    const registro = rows[0] || null;
    return res.json({ inscrito: Boolean(registro), registro });
  } catch (error) {
    console.error("competencias.estadoInscripcion:", error);
    return res
      .status(500)
      .json({ message: "Error al consultar estado de inscripción" });
  }
}

/* ===============================
   ADMIN (CRUD + INSCRITOS)
================================ */

// POST /api/competencias
async function create(req, res) {
  try {
    const { titulo, descripcion, startAt, endAt, tipo, cupo } = req.body;

    const payload = {
      titulo,
      descripcion: descripcion ?? null,
      startAt: startAt ? new Date(startAt) : null,
      endAt: endAt ? new Date(endAt) : null,
      tipo: tipo || "General",
      cupo: Number.isFinite(Number(cupo)) ? Number(cupo) : 0,
    };

    // INSERT sin createdAt/updatedAt (compat)
    const [result] = await pool.query(
      `INSERT INTO \`Competencia\` (titulo, descripcion, startAt, endAt, tipo, cupo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.titulo,
        payload.descripcion,
        payload.startAt,
        payload.endAt,
        payload.tipo,
        payload.cupo,
      ]
    );

    const [rows] = await pool.query(
      "SELECT * FROM `Competencia` WHERE id = ?",
      [result.insertId]
    );

    return res
      .status(201)
      .json({ message: "Competencia creada", competencia: rows[0] });
  } catch (error) {
    console.error("competencias.create:", error);
    return res.status(500).json({ message: "Error al crear competencia" });
  }
}

// PUT /api/competencias/:id
async function update(req, res) {
  try {
    const id = Number(req.params.id);
    const { titulo, descripcion, startAt, endAt, tipo, cupo } = req.body;

    const sets = [];
    const vals = [];

    if (typeof titulo !== "undefined") {
      sets.push("titulo = ?");
      vals.push(titulo);
    }
    if (typeof descripcion !== "undefined") {
      sets.push("descripcion = ?");
      vals.push(descripcion ?? null);
    }
    if (typeof startAt !== "undefined") {
      sets.push("startAt = ?");
      vals.push(startAt ? new Date(startAt) : null);
    }
    if (typeof endAt !== "undefined") {
      sets.push("endAt = ?");
      vals.push(endAt ? new Date(endAt) : null);
    }
    if (typeof tipo !== "undefined") {
      sets.push("tipo = ?");
      vals.push(tipo);
    }
    if (typeof cupo !== "undefined") {
      sets.push("cupo = ?");
      vals.push(Number(cupo) || 0);
    }

    if (!sets.length) {
      return res.status(400).json({ message: "Nada para actualizar" });
    }

    // Intento con updatedAt; si no existe, reintento sin ese campo
    const setsConUpdated = sets.concat("updatedAt = NOW()");
    let sql = `UPDATE \`Competencia\` SET ${setsConUpdated.join(", ")} WHERE id = ?`;
    vals.push(id);

    try {
      const [result] = await pool.query(sql, vals);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Competencia no encontrada" });
      }
    } catch (err) {
      // 1054 = ER_BAD_FIELD_ERROR (columna desconocida)
      if (err && (err.errno === 1054 || err.code === "ER_BAD_FIELD_ERROR")) {
        const onlySets = `UPDATE \`Competencia\` SET ${sets.join(", ")} WHERE id = ?`;
        const [res2] = await pool.query(onlySets, vals);
        if (res2.affectedRows === 0) {
          return res.status(404).json({ message: "Competencia no encontrada" });
        }
      } else {
        throw err;
      }
    }

    const [rows] = await pool.query("SELECT * FROM `Competencia` WHERE id = ?", [
      id,
    ]);
    return res.json({ message: "Competencia actualizada", competencia: rows[0] });
  } catch (error) {
    console.error("competencias.update:", error);
    return res.status(500).json({ message: "Error al actualizar competencia" });
  }
}

// DELETE /api/competencias/:id
async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.query("DELETE FROM `Competencia` WHERE id = ?", [
      id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Competencia no encontrada" });
    }
    return res.json({ message: "Competencia eliminada" });
  } catch (error) {
    console.error("competencias.remove:", error);
    return res.status(500).json({ message: "Error al eliminar competencia" });
  }
}

// PATCH/PUT/POST /api/competencias/:competenciaId/inscritos/:userId
async function updateInscripcion(req, res) {
  try {
    const competenciaId = Number(req.params.competenciaId ?? req.params.id);
    const userId = Number(req.params.userId);
    if (!Number.isInteger(competenciaId) || !Number.isInteger(userId)) {
      return res.status(400).json({ message: "Parámetros inválidos" });
    }

    const sets = [];
    const vals = [];

    const asistioRaw = req.body?.asistio ?? req.query?.asistio;
    if (typeof asistioRaw !== "undefined") {
      const v = String(asistioRaw).toLowerCase();
      const bool = v === "true" || v === "1" || v === "on";
      sets.push("asistio = ?");
      vals.push(bool ? 1 : 0);
    }

    if (typeof req.body?.puesto !== "undefined") {
      const p = Number(req.body.puesto);
      sets.push("puesto = ?");
      vals.push(Number.isFinite(p) ? p : null);
    }

    if (typeof req.body?.proyectoTitulo !== "undefined") {
      sets.push("proyectoTitulo = ?");
      vals.push(req.body.proyectoTitulo || null);
    }

    if (typeof req.body?.proyectoDesc !== "undefined") {
      sets.push("proyectoDesc = ?");
      vals.push(req.body.proyectoDesc || null);
    }

    if (req.file) {
      sets.push("fotoUrl = ?");
      vals.push(`/uploads/${req.file.filename}`);
    }

    if (!sets.length) {
      return res.status(400).json({ message: "Nada para actualizar" });
    }

    const sql = `
      UPDATE \`InscripcionCompetencia\`
         SET ${sets.join(", ")}
       WHERE userId = ? AND competenciaId = ?
      LIMIT 1
    `;
    vals.push(userId, competenciaId);

    const [result] = await pool.query(sql, vals);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Inscripción no encontrada" });
    }

    const [rows] = await pool.query(
      `SELECT
         ic.userId, ic.competenciaId, ic.asistio, ic.puesto, ic.proyectoTitulo, ic.proyectoDesc,
         ic.fotoUrl, ic.fechaIns,
         u.nombre, u.email, u.carnet, u.colegio
       FROM \`InscripcionCompetencia\` ic
       JOIN \`User\` u ON u.id = ic.userId
      WHERE ic.userId = ? AND ic.competenciaId = ?
      LIMIT 1`,
      [userId, competenciaId]
    );

    const r = rows[0];
    return res.json({
      message: "Inscripción actualizada",
      inscrito: {
        userId: r.userId,
        competenciaId: r.competenciaId,
        nombre: r.nombre || "",
        email: r.email || "",
        carnet: r.carnet || "",
        colegio: r.colegio || "",
        asistio: !!r.asistio,
        puesto: r.puesto,
        proyectoTitulo: r.proyectoTitulo,
        proyectoDesc: r.proyectoDesc,
        fotoUrl: r.fotoUrl,
        fechaIns: r.fechaIns,
      },
    });
  } catch (error) {
    console.error("competencias.updateInscripcion:", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar inscripción" });
  }
}

// GET /api/competencias/:id/inscritos
async function listInscritos(req, res) {
  try {
    const competenciaId = Number(req.params.id);

    const [rows] = await pool.query(
      `SELECT
         ic.userId, ic.competenciaId, ic.asistio, ic.puesto, ic.proyectoTitulo, ic.proyectoDesc,
         ic.fotoUrl, ic.fechaIns,
         u.nombre, u.email, u.carnet, u.colegio
       FROM \`InscripcionCompetencia\` ic
       JOIN \`User\` u ON u.id = ic.userId
      WHERE ic.competenciaId = ?
      ORDER BY ic.fechaIns DESC`,
      [competenciaId]
    );

    const out = rows.map((i) => ({
      userId: i.userId,
      competenciaId: i.competenciaId,
      nombre: i.nombre || "",
      email: i.email || "",
      carnet: i.carnet || "",
      colegio: i.colegio || "",
      asistio: !!i.asistio,
      puesto: i.puesto,
      proyectoTitulo: i.proyectoTitulo,
      proyectoDesc: i.proyectoDesc,
      fotoUrl: i.fotoUrl,
      fechaIns: i.fechaIns,
    }));

    return res.json(out);
  } catch (error) {
    console.error("competencias.listInscritos:", error);
    return res.status(500).json({ message: "Error al listar inscritos" });
  }
}

module.exports = {
  publicIndex,
  publicShow,
  inscribirse,
  desinscribirse,
  estadoInscripcion,
  create,
  update,
  remove,
  listInscritos,
  updateInscripcion,
};
