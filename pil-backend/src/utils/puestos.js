// Permisos por puesto en el proceso. Los 4 roles del sistema (trabajador, supervisor, rrhh, gerencia)
// definen qué puede hacer cada uno en los módulos de RRHH; en Recepción y calidad manda el puesto que la
// persona ocupa en el proceso (diseño organizacional, documento sección 7.4 - matriz RACI).
const db = require("../db/database");
const { notificarTrabajador } = require("./notificar");

// Acciones del módulo de Recepción y los puestos que pueden realizarlas
const PUESTOS_POR_ACCION = {
  registrar: ["operador_recepcion", "supervisor_calidad"],          // registrar ingresos y descargar a tanque
  analizar: ["analista_laboratorio"],                               // registrar y corregir análisis (quien analiza no decide)
  decidir: ["supervisor_calidad"],                                  // aceptar, derivar o rechazar
  administrar: ["supervisor_calidad"],                              // parámetros, proveedores y cisternas
  consultar: [
    "operador_recepcion", "analista_laboratorio", "supervisor_calidad", "coordinador_acopio",
    "supervisor_produccion", "jefatura_planta"
  ]
};

// Roles que consultan todo el proceso aunque no ocupen un puesto (lectura)
const ROLES_CONSULTA_PROCESO = ["gerencia"];

function puede(usuario, accion) {
  if (accion === "consultar" && ROLES_CONSULTA_PROCESO.includes(usuario.rol)) return true;
  return Boolean(usuario.puesto) && PUESTOS_POR_ACCION[accion].includes(usuario.puesto);
}

// { registrar, analizar, decidir, administrar, consultar } para el usuario (lo usa el frontend)
function permisosRecepcion(usuario) {
  return Object.fromEntries(Object.keys(PUESTOS_POR_ACCION).map((accion) => [accion, puede(usuario, accion)]));
}

// Uso: router.post("/ingresos", permitirAccion("registrar"), ...)
function permitirAccion(accion) {
  return (req, res, next) => {
    if (!req.usuario || !puede(req.usuario, accion)) {
      return res.status(403).json({ error: "Su puesto en el proceso no le permite realizar esta acción" });
    }
    next();
  };
}

// Panel del proceso y cobertura de puestos críticos: jefaturas y supervisores, RRHH (dotación) y Gerencia
function puedeVerCobertura(usuario) {
  return ["supervisor", "rrhh", "gerencia"].includes(usuario.rol) || puede(usuario, "consultar");
}

// Avisa a todos los trabajadores activos que ocupan alguno de esos puestos
function notificarPuestos(codigos, tipo, mensaje, enlace = null, excluirIdTrabajador = null) {
  db.prepare(`
    SELECT t.id FROM trabajadores t JOIN puestos_proceso p ON p.id = t.id_puesto
    WHERE t.estado = 'activo' AND p.codigo IN (${codigos.map(() => "?").join(",")})
  `).all(...codigos)
    .filter((t) => t.id !== excluirIdTrabajador)
    .forEach((t) => notificarTrabajador(t.id, tipo, mensaje, enlace));
}

module.exports = { PUESTOS_POR_ACCION, puede, permisosRecepcion, permitirAccion, puedeVerCobertura, notificarPuestos };
