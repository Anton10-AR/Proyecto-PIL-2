// Middleware de autenticación (token Bearer) y autorización por rol
const db = require("../db/database");
const { hashToken } = require("../utils/claves");

// Rutas que se pueden usar aunque el usuario aún deba cambiar su contraseña inicial
const RUTAS_PERMITIDAS_SIN_CAMBIO_CLAVE = ["/api/auth/yo", "/api/auth/clave", "/api/auth/logout"];

function autenticar(req, res, next) {
  const cabecera = req.headers.authorization || "";
  const [esquema, token] = cabecera.split(" ");
  if (esquema !== "Bearer" || !token) {
    return res.status(401).json({ error: "Debe iniciar sesión" });
  }

  const usuario = db.prepare(`
    SELECT u.id, u.id_trabajador, u.usuario, u.rol, u.debe_cambiar_clave,
           t.nombre, t.apellido, t.area, t.cargo,
           p.codigo AS puesto, p.nombre AS nombre_puesto, p.id_etapa
    FROM sesiones s
    JOIN usuarios u ON u.id = s.id_usuario
    JOIN trabajadores t ON t.id = u.id_trabajador
    LEFT JOIN puestos_proceso p ON p.id = t.id_puesto
    WHERE s.hash_token = ? AND s.expira > datetime('now')
      AND u.activo = 1 AND t.estado = 'activo'
  `).get(hashToken(token));

  if (!usuario) {
    return res.status(401).json({ error: "La sesión expiró o no es válida" });
  }

  if (usuario.debe_cambiar_clave && !RUTAS_PERMITIDAS_SIN_CAMBIO_CLAVE.includes(req.originalUrl.split("?")[0])) {
    return res.status(403).json({ error: "Debe cambiar su contraseña inicial antes de continuar", codigo: "CAMBIAR_CLAVE" });
  }

  req.usuario = usuario;
  req.hashToken = hashToken(token);
  next();
}

// Uso: router.post("/", permitirRoles("rrhh"), ...)
function permitirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tiene permiso para realizar esta acción" });
    }
    next();
  };
}

module.exports = { autenticar, permitirRoles };
