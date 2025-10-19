// src/controllers/auth.controller.js
const { pool } = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

// ---------- LOGIN ----------
async function login(req, res) {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query(
      "SELECT id, nombre, email, password, role FROM `User` WHERE email = ? LIMIT 1",
      [email]
    );
    if (!rows.length) return res.status(401).json({ message: "Credenciales inválidas" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Credenciales inválidas" });

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET || "secret123",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, role: user.role },
    });
  } catch (e) {
    console.error("login error:", e);
    res.status(500).json({ message: "Error en login" });
  }
}

// ---------- REGISTER (tolerante al esquema) ----------
async function register(req, res) {
  try {
    const { nombre, email, password, telefono, tipo, carnet, colegio } = req.body;

    if (!nombre || !email || !password || !tipo)
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    if (!["interno", "externo"].includes(tipo))
      return res.status(400).json({ message: "Tipo inválido" });

    // correo único
    const [dup] = await pool.query("SELECT id FROM `User` WHERE email = ? LIMIT 1", [email]);
    if (dup.length) return res.status(409).json({ message: "El correo ya está registrado" });

    // columnas realmente existentes en tu tabla
    const [colsRows] = await pool.query("SHOW COLUMNS FROM `User`");
    const cols = new Set(colsRows.map(r => r.Field));

    const fields = [];
    const values = [];

    // siempre
    fields.push("nombre");          values.push(nombre.trim());
    fields.push("email");           values.push(email.trim());
    fields.push("password");        values.push(await bcrypt.hash(password, 10));

    // opcionales según existan en la tabla
    if (cols.has("role"))       { fields.push("role");       values.push("visit"); }
    if (cols.has("qrSecret"))   { fields.push("qrSecret");   values.push(randomUUID()); }
    if (cols.has("telefono"))   { fields.push("telefono");   values.push(telefono || null); }
    if (cols.has("tipoRegistro")) { fields.push("tipoRegistro"); values.push(tipo); }
    else if (cols.has("tipo"))    { fields.push("tipo");     values.push(tipo); }
    if (cols.has("carnet"))     { fields.push("carnet");     values.push(tipo === "interno" ? (carnet || null) : null); }
    if (cols.has("colegio"))    { fields.push("colegio");    values.push(tipo === "externo" ? (colegio || null) : null); }
    if (cols.has("createdAt"))  { fields.push("createdAt");  values.push(new Date()); } // si existiera

    const placeholders = fields.map(() => "?").join(",");
    const sql = `INSERT INTO \`User\` (${fields.map(f => `\`${f}\``).join(",")}) VALUES (${placeholders})`;

    const [result] = await pool.query(sql, values);
    const createdId = result.insertId;

    const token = jwt.sign(
      { id: createdId, role: "visit", email },
      process.env.JWT_SECRET || "secret123",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: { id: createdId, nombre, email, role: "visit" },
    });
  } catch (e) {
    console.error("register error:", e);
    res.status(500).json({ message: "Error al registrar usuario" });
  }
}

module.exports = { login, register };
