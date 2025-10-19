const mysql = require("mysql2/promise");

function fromB64(b64) {
  return Buffer.from(b64, "base64").toString("utf8");
}

const sslCA =
  process.env.DB_SSL_CA_B64
    ? fromB64(process.env.DB_SSL_CA_B64)
    : process.env.DB_SSL_CA || undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  ssl: sslCA
    ? { ca: sslCA, minVersion: "TLSv1.2", rejectUnauthorized: true }
    : undefined,
});

module.exports = { pool }