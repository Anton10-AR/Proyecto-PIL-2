// Hash de contraseñas y tokens de sesión con node:crypto (sin dependencias externas)
const crypto = require("node:crypto");

const LONGITUD_HASH = 64;

function hashearClave(clave) {
  const sal = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(clave, sal, LONGITUD_HASH).toString("hex");
  return { hash, sal };
}

function verificarClave(clave, hashGuardado, sal) {
  const hash = crypto.scryptSync(clave, sal, LONGITUD_HASH);
  const guardado = Buffer.from(hashGuardado, "hex");
  return guardado.length === hash.length && crypto.timingSafeEqual(guardado, hash);
}

function generarToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Reglas mínimas de contraseña para el prototipo
function validarNuevaClave(clave) {
  if (typeof clave !== "string" || clave.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres";
  }
  if (!/[A-Za-z]/.test(clave) || !/[0-9]/.test(clave)) {
    return "La contraseña debe contener letras y números";
  }
  return null;
}

module.exports = { hashearClave, verificarClave, generarToken, hashToken, validarNuevaClave };
