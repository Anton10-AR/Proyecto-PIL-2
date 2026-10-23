// Rutas de autenticación: iniciar/cerrar sesión, datos del usuario actual y cambio de contraseña
const express = require("express");
const db = require("../db/database");
const { autenticar } = require("../middleware/auth");
const { permisosRecepcion, permisosAlmacen, puedeVerCobertura } = require("../utils/puestos");
const { verificarClave, hashearClave, generarToken, hashToken, validarNuevaClave } = require("../utils/claves");

const router = express.Router();

const HORAS_SESION = 8;

// POST /api/auth/login  body: { usuario, clave }
router.post("/login", (req, res) => {
  const { usuario, clave } = req.body || {};
  if (!usuario || !clave) {
    return res.status(400).json({ error: "usuario y clave son obligatorios" });
  }

  const cuenta = db.prepare(`
    SELECT u.*, t.estado AS estado_trabajador
    FROM usuarios u JOIN trabajadores t ON t.id = u.id_trabajador
    WHERE u.usuario = ?
  `).get(usuario);

  // Mismo mensaje para usuario inexistente o clave incorrecta (no revela qué cuentas existen)
  if (!cuenta || !verificarClave(clave, cuenta.hash_clave, cuenta.sal)) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }
  if (!cuenta.activo || cuenta.estado_trabajador !== "activo") {
    return res.status(403).json({ error: "La cuenta está deshabilitada" });
  }

  db.prepare("DELETE FROM sesiones WHERE expira <= datetime('now')").run();

  const token = generarToken();
  db.prepare(`
    INSERT INTO sesiones (hash_token, id_usuario, expira)
    VALUES (?, ?, datetime('now', ?))
  `).run(hashToken(token), cuenta.id, `+${HORAS_SESION} hours`);

  res.json({ token, debe_cambiar_clave: !!cuenta.debe_cambiar_clave });
});

// POST /api/auth/logout
router.post("/logout", autenticar, (req, res) => {
  db.prepare("DELETE FROM sesiones WHERE hash_token = ?").run(req.hashToken);
  res.json({ mensaje: "Sesión cerrada" });
});

// GET /api/auth/yo — datos del usuario de la sesión actual
router.get("/yo", autenticar, (req, res) => {
  const u = req.usuario;
  res.json({
    id: u.id,
    id_trabajador: u.id_trabajador,
    usuario: u.usuario,
    rol: u.rol,
    nombre: u.nombre,
    apellido: u.apellido,
    area: u.area,
    cargo: u.cargo,
    // Puesto en el proceso productivo: define los permisos en Recepción y en Almacén y despacho
    puesto: u.puesto,
    nombre_puesto: u.nombre_puesto,
    id_etapa: u.id_etapa,
    permisos_recepcion: permisosRecepcion(u),
    permisos_almacen: permisosAlmacen(u),
    ve_proceso: puedeVerCobertura(u),
    debe_cambiar_clave: !!u.debe_cambiar_clave
  });
});

// PUT /api/auth/clave  body: { clave_actual, clave_nueva }
router.put("/clave", autenticar, (req, res) => {
  const { clave_actual, clave_nueva } = req.body || {};
  if (!clave_actual || !clave_nueva) {
    return res.status(400).json({ error: "clave_actual y clave_nueva son obligatorias" });
  }

  const cuenta = db.prepare("SELECT hash_clave, sal FROM usuarios WHERE id = ?").get(req.usuario.id);
  if (!verificarClave(clave_actual, cuenta.hash_clave, cuenta.sal)) {
    return res.status(400).json({ error: "La contraseña actual no es correcta" });
  }
  if (clave_actual === clave_nueva) {
    return res.status(400).json({ error: "La nueva contraseña debe ser distinta de la actual" });
  }
  const errorClave = validarNuevaClave(clave_nueva);
  if (errorClave) {
    return res.status(400).json({ error: errorClave });
  }

  const { hash, sal } = hashearClave(clave_nueva);
  db.prepare(`
    UPDATE usuarios SET hash_clave = ?, sal = ?, debe_cambiar_clave = 0 WHERE id = ?
  `).run(hash, sal, req.usuario.id);

  // Cierra las demás sesiones abiertas de esta cuenta
  db.prepare("DELETE FROM sesiones WHERE id_usuario = ? AND hash_token <> ?").run(req.usuario.id, req.hashToken);

  res.json({ mensaje: "Contraseña actualizada" });
});

module.exports = router;
