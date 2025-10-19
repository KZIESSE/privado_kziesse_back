// src/middlewares/auth.js
const jwt = require("jsonwebtoken");

// Middleware base: exige token válido
function authRequired(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const [, token] = hdr.split(" ");
    if (!token) return res.status(401).json({ message: "No autenticado" });

    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    req.user = payload; // { id, email, role, ... }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}

// Alias retro-compatible (algunas rutas importan requireAuth)
const requireAuth = authRequired;

// Requiere rol admin
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "No autenticado" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Requiere rol admin" });
  }
  next();
}

// Validador de rol genérico
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "No autenticado" });
    if (req.user.role !== role) {
      return res.status(403).json({ message: `Requiere rol ${role}` });
    }
    next();
  };
}

module.exports = {
  authRequired,   // para rutas nuevas
  requireAuth,    // alias para rutas antiguas
  requireAdmin,
  requireRole,
};
