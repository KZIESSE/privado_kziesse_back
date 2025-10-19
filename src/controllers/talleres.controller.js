// src/controllers/taller.controller.js
const { pool } = require("../db");

// Utilidad: calcula inscritos/restantes para la tarjeta
async function withCounts(rows) {
  if (!rows.length) {
    return rows.map((r) => ({
      ...r,
      inscritos: 0,
      restantes: r.cupo > 0 ? r.cupo : null,
    }));
  }

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const sql = `
    SELECT tallerId, COUNT(*) AS c
    FROM \`InscripcionTaller\`
    WHERE tallerId IN (${placeholders})
    GROUP BY tallerId
  `;
  const [countRows] = await pool.query(sql, ids);
  const map = new Map(countRows.map((c) => [Number(c.tallerId), Number(c.c)]));

  return rows.map((r) => {
    const inscritos = map.get(r.id) || 0;
    const restantes =
      r.cupo > 0 ? Math.max(Number(r.cupo) - inscritos, 0) : null; // null => "∞"
    return { ...r, inscritos, restantes };
  });
}

// GET /api/talleres
exports.list = async (_req, res) => {
  try {
    // Evitamos createdAt por compatibilidad
    const [rows] = await pool.query(
      "SELECT * FROM `Taller` ORDER BY startAt DESC, id DESC"
    );
    res.json(await withCounts(rows));
  } catch (e) {
    console.error("taller.list:", e);
    res.status(500).json({ message: "Error al listar talleres" });
  }
};

// POST /api/talleres
exports.create = async (req, res) => {
  try {
    const { titulo, descripcion, cupo, tipo, startAt, endAt } = req.body;
    if (!titulo) return res.status(400).json({ message: "Título requerido" });
    if (!startAt || !endAt)
      return res
        .status(400)
        .json({ message: "Horario (inicio y fin) requerido" });

    const data = {
      titulo,
      descripcion: descripcion || null,
      cupo: Number.isFinite(+cupo) ? +cupo : 0,
      tipo: tipo || "Taller",
      startAt: new Date(startAt),
      endAt: new Date(endAt),
    };

    // INSERT sin createdAt/updatedAt (compat)
    const [result] = await pool.query(
      `INSERT INTO \`Taller\` (titulo, descripcion, cupo, tipo, startAt, endAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.titulo, data.descripcion, data.cupo, data.tipo, data.startAt, data.endAt]
    );

    const [rows] = await pool.query("SELECT * FROM `Taller` WHERE id = ?", [
      result.insertId,
    ]);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("taller.create:", e);
    res.status(500).json({ message: e.message || "Error al crear taller" });
  }
};

// PUT /api/talleres/:id
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { titulo, descripcion, cupo, tipo, startAt, endAt } = req.body;

    const sets = [];
    const vals = [];

    if (titulo !== undefined) {
      sets.push("titulo = ?");
      vals.push(titulo);
    }
    if (descripcion !== undefined) {
      sets.push("descripcion = ?");
      vals.push(descripcion);
    }
    if (cupo !== undefined) {
      sets.push("cupo = ?");
      vals.push(Number(cupo));
    }
    if (tipo !== undefined) {
      sets.push("tipo = ?");
      vals.push(tipo);
    }
    if (startAt !== undefined) {
      sets.push("startAt = ?");
      vals.push(startAt ? new Date(startAt) : null);
    }
    if (endAt !== undefined) {
      sets.push("endAt = ?");
      vals.push(endAt ? new Date(endAt) : null);
    }

    if (!sets.length)
      return res.status(400).json({ message: "Nada para actualizar" });

    // Intentamos poner updatedAt = NOW(); si no existe la columna, reintentamos.
    const setsConUpdated = sets.concat("updatedAt = NOW()");
    let sql = `UPDATE \`Taller\` SET ${setsConUpdated.join(", ")} WHERE id = ?`;
    vals.push(id);

    try {
      const [result] = await pool.query(sql, vals);
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Taller no encontrado" });
    } catch (err) {
      // 1054 = ER_BAD_FIELD_ERROR (columna desconocida)
      if (err && (err.errno === 1054 || err.code === "ER_BAD_FIELD_ERROR")) {
        const onlySets = `UPDATE \`Taller\` SET ${sets.join(", ")} WHERE id = ?`;
        const [result2] = await pool.query(onlySets, vals);
        if (result2.affectedRows === 0)
          return res.status(404).json({ message: "Taller no encontrado" });
      } else {
        throw err;
      }
    }

    const [rows] = await pool.query("SELECT * FROM `Taller` WHERE id = ?", [id]);
    res.json(rows[0]);
  } catch (e) {
    console.error("taller.update:", e);
    res.status(500).json({ message: e.message || "Error al actualizar taller" });
  }
};

// DELETE /api/talleres/:id
exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query("DELETE FROM `InscripcionTaller` WHERE tallerId = ?", [id]);
    const [r2] = await pool.query("DELETE FROM `Taller` WHERE id = ?", [id]);
    if (r2.affectedRows === 0)
      return res.status(404).json({ message: "Taller no encontrado" });
    res.json({ message: "Taller eliminado" });
  } catch (e) {
    console.error("taller.remove:", e);
    res.status(500).json({ message: e.message || "Error al eliminar taller" });
  }
};

// POST /api/talleres/:id/inscribirme
exports.enroll = async (req, res) => {
  try {
    const tallerId = Number(req.params.id);
    const userId = Number(req.user.id);

    const [tRows] = await pool.query(
      "SELECT * FROM `Taller` WHERE id = ? LIMIT 1",
      [tallerId]
    );
    if (!tRows.length)
      return res.status(404).json({ message: "Taller no existe" });
    const t = tRows[0];

    if (t.cupo > 0) {
      const [[cRow]] = await pool.query(
        "SELECT COUNT(*) AS c FROM `InscripcionTaller` WHERE tallerId = ?",
        [tallerId]
      );
      const count = Number(cRow.c || 0);
      if (count >= Number(t.cupo))
        return res.status(409).json({ message: "Cupo lleno" });
    }

    const [dup] = await pool.query(
      "SELECT 1 FROM `InscripcionTaller` WHERE tallerId = ? AND userId = ? LIMIT 1",
      [tallerId, userId]
    );
    if (dup.length) return res.status(409).json({ message: "Ya estás inscrito" });

    await pool.query(
      "INSERT INTO `InscripcionTaller` (tallerId, userId, fechaIns) VALUES (?, ?, NOW())",
      [tallerId, userId]
    );
    res.status(201).json({ message: "Inscripción exitosa" });
  } catch (e) {
    console.error("taller.enroll:", e);
    res.status(500).json({ message: e.message || "Error al inscribirse" });
  }
};

// GET /api/talleres/mis-talleres
exports.mine = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const [rows] = await pool.query(
      `SELECT t.*
         FROM \`InscripcionTaller\` it
         JOIN \`Taller\` t ON t.id = it.tallerId
        WHERE it.userId = ?
        ORDER BY it.fechaIns DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) {
    console.error("taller.mine:", e);
    res.status(500).json({ message: e.message || "Error al listar mis talleres" });
  }
};

// GET /api/talleres/:id/inscritos
exports.inscritos = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT u.id, u.nombre, u.email
         FROM \`InscripcionTaller\` it
         JOIN \`User\` u ON u.id = it.userId
        WHERE it.tallerId = ?
        ORDER BY it.fechaIns DESC`,
      [id]
    );
    res.json(rows.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email })));
  } catch (e) {
    console.error("taller.inscritos:", e);
    res.status(500).json({ message: e.message || "Error al listar inscritos" });
  }
};
