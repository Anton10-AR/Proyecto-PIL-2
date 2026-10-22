// Rutas del módulo Personal: registrar, modificar, consultar y buscar trabajadores,
// y administrar su cuenta de acceso. Visibilidad según el rol (ver utils/visibilidad.js).
const express = require("express");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");
const { filtroVisibilidad, puedeVerTrabajador } = require("../utils/visibilidad");
const { hashearClave } = require("../utils/claves");
const { turnoVigente } = require("../utils/jornada");
const { saldoVacaciones } = require("../utils/solicitudes");
const { categoriaPuntaje } = require("../utils/evaluacion");
const { hoyLocal } = require("../utils/fechas");

const router = express.Router();

const ROLES = ["trabajador", "supervisor", "rrhh", "gerencia"];
const CAMPOS = [
  "nombre", "apellido", "ci", "fecha_nacimiento", "telefono", "direccion",
  "correo", "cargo", "area", "fecha_ingreso", "tipo_contrato", "id_supervisor", "id_puesto"
];

// Datos del trabajador + nombre del supervisor + datos de su cuenta (sin hash ni sal)
const SELECT_TRABAJADOR = `
  SELECT t.*,
         s.nombre || ' ' || s.apellido AS nombre_supervisor,
         u.id AS id_usuario, u.usuario, u.rol, u.activo AS cuenta_activa,
         p.codigo AS codigo_puesto, p.nombre AS puesto, p.critico AS puesto_critico, p.id_etapa, e.nombre AS etapa
  FROM trabajadores t
  LEFT JOIN trabajadores s ON s.id = t.id_supervisor
  LEFT JOIN usuarios u ON u.id_trabajador = t.id
  LEFT JOIN puestos_proceso p ON p.id = t.id_puesto
  LEFT JOIN etapas_proceso e ON e.id = p.id_etapa
`;

// El puesto en el proceso es opcional (personal administrativo no ocupa uno)
function validarPuesto(idPuesto) {
  if (!idPuesto) return null;
  return db.prepare("SELECT id FROM puestos_proceso WHERE id = ?").get(idPuesto) ? null : "El puesto indicado no existe";
}

function obtenerTrabajador(id) {
  return db.prepare(`${SELECT_TRABAJADOR} WHERE t.id = ?`).get(id);
}

// Valida que el supervisor exista, esté activo y no genere un ciclo (A supervisa a B y B a A)
function validarSupervisor(idSupervisor, idTrabajador = null) {
  if (!idSupervisor) return null;
  const supervisor = db.prepare("SELECT id, estado FROM trabajadores WHERE id = ?").get(idSupervisor);
  if (!supervisor) return "El supervisor indicado no existe";
  if (supervisor.estado !== "activo") return "El supervisor indicado está inactivo";
  if (idTrabajador === null) return null;

  let actual = Number(idSupervisor);
  const visitados = new Set();
  while (actual && !visitados.has(actual)) {
    if (actual === Number(idTrabajador)) return "Un trabajador no puede quedar bajo su propia supervisión";
    visitados.add(actual);
    actual = db.prepare("SELECT id_supervisor FROM trabajadores WHERE id = ?").get(actual)?.id_supervisor;
  }
  return null;
}

function crearCuenta(idTrabajador, usuario, rol, ci) {
  const { hash, sal } = hashearClave(ci);
  db.prepare(`
    INSERT INTO usuarios (id_trabajador, usuario, hash_clave, sal, rol, debe_cambiar_clave)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(idTrabajador, usuario, hash, sal, rol);
}

function validarDatosCuenta(usuario, rol) {
  if (!usuario || !/^[a-z0-9._]{3,30}$/.test(usuario)) {
    return "usuario debe tener entre 3 y 30 caracteres: minúsculas, números, punto o guion bajo";
  }
  if (!ROLES.includes(rol)) return `rol debe ser uno de: ${ROLES.join(", ")}`;
  return null;
}

function esErrorUnico(err, columna) {
  return err.message && err.message.includes("UNIQUE constraint failed") && err.message.includes(columna);
}

// Listar trabajadores visibles para el usuario, con búsqueda y filtros
// GET /api/trabajadores?buscar=texto&area=X&cargo=Y&estado=activo&etapa=N (etapa=0: sin puesto en el proceso)
router.get("/", (req, res) => {
  const { buscar, area, cargo, estado, etapa } = req.query;
  const visibilidad = filtroVisibilidad(req.usuario, "t.id");

  let sql = `${SELECT_TRABAJADOR} WHERE 1=1${visibilidad.sql}`;
  const params = [...visibilidad.params];

  if (buscar) {
    const texto = `%${buscar}%`;
    sql += " AND (t.nombre LIKE ? OR t.apellido LIKE ? OR t.ci LIKE ? OR t.area LIKE ? OR t.cargo LIKE ?)";
    params.push(texto, texto, texto, texto, texto);
  }
  if (area) { sql += " AND t.area = ?"; params.push(area); }
  if (cargo) { sql += " AND t.cargo = ?"; params.push(cargo); }
  if (estado) { sql += " AND t.estado = ?"; params.push(estado); }
  if (etapa === "0") sql += " AND t.id_puesto IS NULL";
  else if (etapa === "transversal") sql += " AND t.id_puesto IS NOT NULL AND p.id_etapa IS NULL";
  else if (etapa) { sql += " AND p.id_etapa = ?"; params.push(etapa); }
  sql += " ORDER BY t.apellido, t.nombre";

  res.json(db.prepare(sql).all(...params));
});

// Valores para los filtros y formularios: áreas, cargos y posibles supervisores
// GET /api/trabajadores/opciones
router.get("/opciones", (req, res) => {
  const visibilidad = filtroVisibilidad(req.usuario, "id");
  const distintos = (columna) => db.prepare(`
    SELECT DISTINCT ${columna} AS valor FROM trabajadores
    WHERE ${columna} IS NOT NULL AND ${columna} <> ''${visibilidad.sql}
    ORDER BY ${columna}
  `).all(...visibilidad.params).map((fila) => fila.valor);

  const supervisores = req.usuario.rol === "rrhh"
    ? db.prepare(`
        SELECT t.id, t.nombre, t.apellido, t.cargo FROM trabajadores t
        WHERE t.estado = 'activo' ORDER BY t.apellido, t.nombre
      `).all()
    : [];

  const puestos = db.prepare(`
    SELECT p.id, p.nombre, p.critico, p.id_etapa, e.nombre AS etapa FROM puestos_proceso p
    LEFT JOIN etapas_proceso e ON e.id = p.id_etapa ORDER BY COALESCE(p.id_etapa, 99), p.id
  `).all();
  const etapas = db.prepare("SELECT id, nombre FROM etapas_proceso ORDER BY id").all();

  res.json({ areas: distintos("area"), cargos: distintos("cargo"), supervisores, roles: ROLES, puestos, etapas });
});

// Ficha del trabajador con su historial de actividad
// GET /api/trabajadores/:id
router.get("/:id", (req, res) => {
  if (!puedeVerTrabajador(req.usuario, req.params.id)) {
    return res.status(403).json({ error: "No tiene permiso para ver a este trabajador" });
  }
  const trabajador = obtenerTrabajador(req.params.id);
  if (!trabajador) {
    return res.status(404).json({ error: "Trabajador no encontrado" });
  }

  const equipo = db.prepare(`
    SELECT id, nombre, apellido, cargo, estado FROM trabajadores
    WHERE id_supervisor = ? ORDER BY apellido, nombre
  `).all(trabajador.id);

  const historial = {
    asistencia: db.prepare(`
      SELECT a.*, t.nombre AS turno FROM asistencia a LEFT JOIN turnos t ON t.id = a.id_turno
      WHERE a.id_trabajador = ? ORDER BY a.fecha DESC LIMIT 30
    `).all(trabajador.id),
    ausencias: db.prepare(`
      SELECT * FROM ausencias WHERE id_trabajador = ? ORDER BY fecha DESC
    `).all(trabajador.id),
    solicitudes: db.prepare(`
      SELECT s.*, tp.nombre AS tipo_permiso FROM solicitudes s
      LEFT JOIN tipos_permiso tp ON tp.id = s.id_tipo_permiso
      WHERE s.id_trabajador = ? ORDER BY s.fecha_solicitud DESC
    `).all(trabajador.id),
    capacitaciones: db.prepare(`
      SELECT p.id, p.id_capacitacion, p.estado_inscripcion, p.asistencia_pct, p.nota, p.resultado, p.id_archivo_certificado,
             c.titulo, c.fecha_inicio, c.fecha_fin, c.horas, c.estado
      FROM participantes_capacitacion p JOIN capacitaciones c ON c.id = p.id_capacitacion
      WHERE p.id_trabajador = ? AND p.estado_inscripcion <> 'rechazado'
      ORDER BY c.fecha_inicio DESC
    `).all(trabajador.id),
    // Solo evaluaciones completadas (las pendientes no se muestran ni al propio trabajador)
    evaluaciones: db.prepare(`
      SELECT e.id, e.puntaje_final, e.fecha_completada, e.fecha_lectura, pe.nombre AS periodo,
             ev.nombre || ' ' || ev.apellido AS evaluador,
             (SELECT COUNT(*) FROM acciones_mejora a WHERE a.id_evaluacion = e.id AND a.estado <> 'completada') AS acciones_abiertas
      FROM evaluaciones e
      JOIN periodos_evaluacion pe ON pe.id = e.id_periodo
      LEFT JOIN usuarios u ON u.id = e.id_evaluador
      LEFT JOIN trabajadores ev ON ev.id = u.id_trabajador
      WHERE e.id_trabajador = ? AND e.estado = 'completada'
      ORDER BY pe.fecha_inicio DESC
    `).all(trabajador.id).map((e) => ({ ...e, categoria: categoriaPuntaje(e.puntaje_final) })),
    // Participación en la recepción de leche de los últimos 30 días, según su puesto en el proceso
    recepcion: db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM ingresos_leche WHERE id_operador = ? AND fecha_hora_llegada >= date('now', 'localtime', '-30 days')) AS ingresos_registrados,
        (SELECT COUNT(*) FROM analisis_leche WHERE id_analista = ? AND fecha_hora >= date('now', 'localtime', '-30 days')) AS analisis_realizados,
        (SELECT COUNT(*) FROM decisiones_leche WHERE id_supervisor = ? AND fecha_hora >= date('now', 'localtime', '-30 days')) AS decisiones_tomadas
    `).get(trabajador.id, trabajador.id, trabajador.id)
  };

  res.json({
    ...trabajador,
    turno_vigente: turnoVigente(trabajador.id, hoyLocal()),
    saldo_vacaciones: saldoVacaciones(trabajador.id),
    equipo,
    historial
  });
});

// Registrar un nuevo trabajador junto con su cuenta de acceso (solo RRHH)
// POST /api/trabajadores  body: { ...datos, usuario, rol }
// La contraseña inicial es el CI y se exige cambiarla en el primer ingreso.
router.post("/", permitirRoles("rrhh"), (req, res) => {
  const datos = req.body || {};
  const { usuario, rol } = datos;

  if (!datos.nombre || !datos.apellido || !datos.ci) {
    return res.status(400).json({ error: "nombre, apellido y ci son obligatorios" });
  }
  const errorCuenta = validarDatosCuenta(usuario, rol);
  if (errorCuenta) return res.status(400).json({ error: errorCuenta });
  const errorSupervisor = validarSupervisor(datos.id_supervisor);
  if (errorSupervisor) return res.status(400).json({ error: errorSupervisor });
  const errorPuesto = validarPuesto(datos.id_puesto);
  if (errorPuesto) return res.status(400).json({ error: errorPuesto });

  try {
    db.exec("BEGIN");
    const resultado = db.prepare(`
      INSERT INTO trabajadores (${CAMPOS.join(", ")}, estado)
      VALUES (${CAMPOS.map(() => "?").join(", ")}, 'activo')
    `).run(...CAMPOS.map((campo) => datos[campo] || null));
    crearCuenta(resultado.lastInsertRowid, usuario, rol, datos.ci);
    db.exec("COMMIT");

    res.status(201).json(obtenerTrabajador(resultado.lastInsertRowid));
  } catch (err) {
    db.exec("ROLLBACK");
    if (esErrorUnico(err, "trabajadores.ci")) {
      return res.status(409).json({ error: "Ya existe un trabajador con ese CI" });
    }
    if (esErrorUnico(err, "usuarios.usuario")) {
      return res.status(409).json({ error: "Ese nombre de usuario ya está en uso" });
    }
    res.status(500).json({ error: "Error al registrar el trabajador" });
  }
});

// Modificar información de un trabajador existente (solo RRHH)
// PUT /api/trabajadores/:id
router.put("/:id", permitirRoles("rrhh"), (req, res) => {
  const existente = db.prepare("SELECT * FROM trabajadores WHERE id = ?").get(req.params.id);
  if (!existente) {
    return res.status(404).json({ error: "Trabajador no encontrado" });
  }

  const datos = { ...existente, ...req.body };
  if (!datos.nombre || !datos.apellido || !datos.ci) {
    return res.status(400).json({ error: "nombre, apellido y ci son obligatorios" });
  }
  if (!["activo", "inactivo"].includes(datos.estado)) {
    return res.status(400).json({ error: "estado debe ser 'activo' o 'inactivo'" });
  }
  if (datos.estado === "inactivo" && Number(req.params.id) === req.usuario.id_trabajador) {
    return res.status(400).json({ error: "No puede darse de baja a sí mismo" });
  }
  const errorSupervisor = validarSupervisor(datos.id_supervisor, req.params.id);
  if (errorSupervisor) return res.status(400).json({ error: errorSupervisor });
  const errorPuesto = validarPuesto(datos.id_puesto);
  if (errorPuesto) return res.status(400).json({ error: errorPuesto });

  try {
    db.prepare(`
      UPDATE trabajadores SET ${CAMPOS.map((campo) => `${campo} = ?`).join(", ")}, estado = ?
      WHERE id = ?
    `).run(...CAMPOS.map((campo) => datos[campo] || null), datos.estado, req.params.id);
  } catch (err) {
    if (esErrorUnico(err, "trabajadores.ci")) {
      return res.status(409).json({ error: "Ya existe un trabajador con ese CI" });
    }
    return res.status(500).json({ error: "Error al modificar el trabajador" });
  }

  res.json(obtenerTrabajador(req.params.id));
});

// Dar de baja a un trabajador (baja lógica, no se borra el registro). Sus sesiones dejan
// de ser válidas porque autenticar() exige que el trabajador esté activo.
// DELETE /api/trabajadores/:id
router.delete("/:id", permitirRoles("rrhh"), (req, res) => {
  const existente = db.prepare("SELECT * FROM trabajadores WHERE id = ?").get(req.params.id);
  if (!existente) {
    return res.status(404).json({ error: "Trabajador no encontrado" });
  }
  if (Number(req.params.id) === req.usuario.id_trabajador) {
    return res.status(400).json({ error: "No puede darse de baja a sí mismo" });
  }

  db.prepare("UPDATE trabajadores SET estado = 'inactivo' WHERE id = ?").run(req.params.id);
  res.json({ mensaje: "Trabajador dado de baja (baja lógica)" });
});

// --- Cuenta de acceso del trabajador (solo RRHH) ---

// Crear la cuenta de un trabajador que aún no tiene una
// POST /api/trabajadores/:id/cuenta  body: { usuario, rol }
router.post("/:id/cuenta", permitirRoles("rrhh"), (req, res) => {
  const trabajador = db.prepare("SELECT * FROM trabajadores WHERE id = ?").get(req.params.id);
  if (!trabajador) return res.status(404).json({ error: "Trabajador no encontrado" });
  if (db.prepare("SELECT id FROM usuarios WHERE id_trabajador = ?").get(trabajador.id)) {
    return res.status(409).json({ error: "El trabajador ya tiene una cuenta" });
  }
  const { usuario, rol } = req.body || {};
  const errorCuenta = validarDatosCuenta(usuario, rol);
  if (errorCuenta) return res.status(400).json({ error: errorCuenta });

  try {
    crearCuenta(trabajador.id, usuario, rol, trabajador.ci);
  } catch (err) {
    if (esErrorUnico(err, "usuarios.usuario")) {
      return res.status(409).json({ error: "Ese nombre de usuario ya está en uso" });
    }
    return res.status(500).json({ error: "Error al crear la cuenta" });
  }
  res.status(201).json(obtenerTrabajador(trabajador.id));
});

// Cambiar rol o habilitar/deshabilitar la cuenta
// PUT /api/trabajadores/:id/cuenta  body: { rol?, activo? }
router.put("/:id/cuenta", permitirRoles("rrhh"), (req, res) => {
  const cuenta = db.prepare("SELECT * FROM usuarios WHERE id_trabajador = ?").get(req.params.id);
  if (!cuenta) return res.status(404).json({ error: "El trabajador no tiene cuenta" });

  const rol = req.body?.rol ?? cuenta.rol;
  const activo = req.body?.activo === undefined ? cuenta.activo : (req.body.activo ? 1 : 0);
  if (!ROLES.includes(rol)) {
    return res.status(400).json({ error: `rol debe ser uno de: ${ROLES.join(", ")}` });
  }
  if (cuenta.id === req.usuario.id && (rol !== cuenta.rol || !activo)) {
    return res.status(400).json({ error: "No puede cambiar el rol ni deshabilitar su propia cuenta" });
  }

  db.prepare("UPDATE usuarios SET rol = ?, activo = ? WHERE id = ?").run(rol, activo, cuenta.id);
  if (!activo) db.prepare("DELETE FROM sesiones WHERE id_usuario = ?").run(cuenta.id);

  res.json(obtenerTrabajador(req.params.id));
});

// Restablecer la contraseña al CI del trabajador (deberá cambiarla al ingresar)
// POST /api/trabajadores/:id/cuenta/restablecer-clave
router.post("/:id/cuenta/restablecer-clave", permitirRoles("rrhh"), (req, res) => {
  const cuenta = db.prepare(`
    SELECT u.id, t.ci FROM usuarios u JOIN trabajadores t ON t.id = u.id_trabajador
    WHERE u.id_trabajador = ?
  `).get(req.params.id);
  if (!cuenta) return res.status(404).json({ error: "El trabajador no tiene cuenta" });

  const { hash, sal } = hashearClave(cuenta.ci);
  db.prepare(`
    UPDATE usuarios SET hash_clave = ?, sal = ?, debe_cambiar_clave = 1 WHERE id = ?
  `).run(hash, sal, cuenta.id);
  db.prepare("DELETE FROM sesiones WHERE id_usuario = ?").run(cuenta.id);

  res.json({ mensaje: "Contraseña restablecida al CI del trabajador" });
});

module.exports = router;
