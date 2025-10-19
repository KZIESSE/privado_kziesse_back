// src/seed.js
const { pool } = require("./db");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");

async function ensureUser(nombre, email, pass, role) {
  const [rows] = await pool.query("SELECT id FROM `User` WHERE email = ? LIMIT 1", [email]);
  if (rows.length) return rows[0];
  const hash = await bcrypt.hash(pass, 10);
  const [r] = await pool.query(
    `INSERT INTO \`User\` (nombre, email, password, role, qrSecret, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [nombre, email, hash, role, randomUUID()]
  );
  return { id: r.insertId };
}

async function ensureSiteInfo() {
  const [rows] = await pool.query("SELECT id FROM `SiteInfo` LIMIT 1");
  if (rows.length) return rows[0];
  const [r] = await pool.query(
    `INSERT INTO \`SiteInfo\`
     (homeTitle, homeBody, faq, phone, university, footerNote)
     VALUES ('Bienvenido al Congreso UMG', 
             'Aquí encontrarás anuncios, ganadores y toda la información relevante del evento.',
             '• ¿Cómo me inscribo?\nDesde tu panel de usuario.\n\n• ¿Cómo descargo mi diploma?\nDesde Mis talleres/Mis competencias, cuando el admin lo habilite.',
             '5555-0000',
             'Universidad Mariano Gálvez',
             '© Congreso UMG — Todos los derechos reservados.')`
  );
  return { id: r.insertId };
}

exports.runSeed = async () => {
  await ensureUser("Administrador", "admin@umg.edu", "admin123", "admin");
  await ensureUser("Visitante", "visit@umg.edu", "visit123", "visit");
  await ensureSiteInfo();
  console.log("[seed] admin, visit y site info listos");
};
