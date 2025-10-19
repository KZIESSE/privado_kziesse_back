require("dotenv/config");
const fs = require("fs");
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 5,

  // TLS/SSL
  ssl: {
    ca: fs.readFileSync(process.env.DB_SSL_CA_PATH),
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
  },
});

module.exports = { pool };