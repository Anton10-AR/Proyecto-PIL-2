// Rutas del módulo Evaluación del desempeño.
// - RRHH: plantillas con criterios ponderados, períodos, asignación de evaluadores y cierre.
// - Evaluador asignado (por defecto el supervisor directo): califica 1 a 5 cada criterio, escribe la
//   retroalimentación y propone acciones de mejora mientras el período esté abierto.
// - Trabajador: ve sus evaluaciones completadas, confirma la lectura y da seguimiento a sus acciones.
// - Gerencia consulta todo; el supervisor, las de su equipo.
const express = require("express");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");
const { filtroVisibilidad, puedeVerTrabajador, veTodos } = require("../utils/visibilidad");
const { esFecha } = require("../utils/fechas");
const { notificarTrabajador, notificarUsuario } = require("../utils/notificar");
const { errorCriterios, esPuntajeValido, calcularPuntaje, categoriaPuntaje } = require("../utils/evaluacion");

const router = express.Router();

const ROLES_EVALUADORES = ["supervisor", "rrhh", "gerencia"];
const ESTADOS_ACCION = ["pendiente", "en_progreso", "completada"];

class ErrorValidacion extends Error {
  constructor(mensaje, estado = 400) { super(mensaje); this.estado = estado; }
}

function responderError(res, err) {
  if (err instanceof ErrorValidacion) return res.status(err.estado).json({ error: err.message });
  throw err;
}

// Ejecuta fn dentro de una transacción
function enTransaccion(fn) {
  db.exec("BEGIN");
  try {
    const resultado = fn();
    db.exec("COMMIT");
    return resultado;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------- Plantillas

function criteriosDe(idPlantilla) {
  return db.prepare("SELECT * FROM criterios_evaluacion WHERE id_plantilla = ? ORDER BY orden, id").all(idPlantilla);
}

function plantillaEnUso(idPlantilla) {
  return Boolean(db.prepare("SELECT 1 FROM evaluaciones WHERE id_plantilla = ? LIMIT 1").get(idPlantilla));
}

function obtenerPlantilla(id) {
  const plantilla = db.prepare("SELECT * FROM plantillas_evaluacion WHERE id = ?").get(id);
  return plantilla && { ...plantilla, criterios: criteriosDe(plantilla.id), en_uso: plantillaEnUso(plantilla.id) };
}

function guardarCriterios(idPlantilla, criterios) {
  db.prepare("DELETE FROM criterios_evaluacion WHERE id_plantilla = ?").run(idPlantilla);
  const insertar = db.prepare(
    "INSERT INTO criterios_evaluacion (id_plantilla, nombre, descripcion, peso, orden) VALUES (?, ?, ?, ?, ?)"
  );
  criterios.forEach((c, i) => insertar.run(idPlantilla, String(c.nombre).trim(), c.descripcion ? String(c.descripcion).trim() : null, Number(c.peso), i));
}

// GET /api/evaluaciones/plantillas
router.get("/plantillas", (req, res) => {
  const plantillas = db.prepare("SELECT id FROM plantillas_evaluacion ORDER BY activa DESC, nombre").all();
  res.json(plantillas.map((p) => obtenerPlantilla(p.id)));
});

// POST /api/evaluaciones/plantillas  body: { nombre, descripcion, criterios: [{ nombre, descripcion, peso }] }
router.post("/plantillas", permitirRoles("rrhh"), (req, res) => {
  try {
    const { nombre, descripcion, criterios } = req.body || {};
    if (!String(nombre || "").trim()) throw new ErrorValidacion("nombre es obligatorio");
    const error = errorCriterios(criterios);
    if (error) throw new ErrorValidacion(error);
    const id = enTransaccion(() => {
      const nueva = db.prepare("INSERT INTO plantillas_evaluacion (nombre, descripcion) VALUES (?, ?)")
        .run(String(nombre).trim(), descripcion ? String(descripcion).trim() : null).lastInsertRowid;
      guardarCriterios(nueva, criterios);
      return nueva;
    });
    res.status(201).json(obtenerPlantilla(id));
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe una plantilla con ese nombre" });
    responderError(res, err);
  }
});

// Modificar nombre, descripción, activa y (si nunca se usó) los criterios
// PUT /api/evaluaciones/plantillas/:id
router.put("/plantillas/:id", permitirRoles("rrhh"), (req, res) => {
  try {
    const actual = obtenerPlantilla(req.params.id);
    if (!actual) throw new ErrorValidacion("Plantilla no encontrada", 404);
    const cuerpo = req.body || {};
    const nombre = String(cuerpo.nombre ?? actual.nombre).trim();
    if (!nombre) throw new ErrorValidacion("nombre es obligatorio");
    const activa = cuerpo.activa === undefined ? actual.activa : (cuerpo.activa ? 1 : 0);
    if (cuerpo.criterios) {
      if (actual.en_uso) throw new ErrorValidacion("La plantilla ya se usó en evaluaciones: sus criterios no pueden cambiarse. Cree una plantilla nueva.", 409);
      const error = errorCriterios(cuerpo.criterios);
      if (error) throw new ErrorValidacion(error);
    }
    enTransaccion(() => {
      db.prepare("UPDATE plantillas_evaluacion SET nombre = ?, descripcion = ?, activa = ? WHERE id = ?")
        .run(nombre, cuerpo.descripcion === undefined ? actual.descripcion : (cuerpo.descripcion || null), activa, actual.id);
      if (cuerpo.criterios) guardarCriterios(actual.id, cuerpo.criterios);
    });
    res.json(obtenerPlantilla(actual.id));
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe una plantilla con ese nombre" });
    responderError(res, err);
  }
});

// ---------------------------------------------------------------- Períodos

const SELECT_PERIODO = `
  SELECT pe.*, pl.nombre AS plantilla,
    COUNT(e.id) AS total,
    COALESCE(SUM(e.estado = 'completada'), 0) AS completadas,
    COALESCE(SUM(e.fecha_lectura IS NOT NULL), 0) AS leidas,
    COALESCE(SUM(e.id_evaluador IS NULL), 0) AS sin_evaluador,
    ROUND(AVG(e.puntaje_final), 2) AS promedio
  FROM periodos_evaluacion pe
  JOIN plantillas_evaluacion pl ON pl.id = pe.id_plantilla
  LEFT JOIN evaluaciones e ON e.id_periodo = pe.id
`;

function obtenerPeriodo(id) {
  return db.prepare(`${SELECT_PERIODO} WHERE pe.id = ? GROUP BY pe.id`).get(id);
}

// GET /api/evaluaciones/periodos
router.get("/periodos", permitirRoles("rrhh", "gerencia"), (req, res) => {
  res.json(db.prepare(`${SELECT_PERIODO} GROUP BY pe.id ORDER BY pe.fecha_inicio DESC`).all());
});

// POST /api/evaluaciones/periodos  body: { nombre, id_plantilla, fecha_inicio, fecha_fin }
router.post("/periodos", permitirRoles("rrhh"), (req, res) => {
  try {
    const { nombre, id_plantilla, fecha_inicio, fecha_fin } = req.body || {};
    if (!String(nombre || "").trim()) throw new ErrorValidacion("nombre es obligatorio");
    if (!esFecha(fecha_inicio) || !esFecha(fecha_fin)) throw new ErrorValidacion("fecha_inicio y fecha_fin deben tener formato YYYY-MM-DD");
    if (fecha_fin < fecha_inicio) throw new ErrorValidacion("La fecha de fin no puede ser anterior a la de inicio");
    const plantilla = db.prepare("SELECT * FROM plantillas_evaluacion WHERE id = ? AND activa = 1").get(id_plantilla);
    if (!plantilla) throw new ErrorValidacion("Seleccione una plantilla activa");
    const id = db.prepare(`
      INSERT INTO periodos_evaluacion (nombre, id_plantilla, fecha_inicio, fecha_fin, id_creado_por) VALUES (?, ?, ?, ?, ?)
    `).run(String(nombre).trim(), plantilla.id, fecha_inicio, fecha_fin, req.usuario.id).lastInsertRowid;
    res.status(201).json(obtenerPeriodo(id));
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe un período con ese nombre" });
    responderError(res, err);
  }
});

const SELECT_EVALUACION = `
  SELECT e.*, t.nombre, t.apellido, t.area, t.cargo,
         pe.nombre AS periodo, pe.estado AS estado_periodo, pe.fecha_inicio AS periodo_inicio, pe.fecha_fin AS periodo_fin,
         pl.nombre AS plantilla,
         ev.nombre || ' ' || ev.apellido AS evaluador, ue.rol AS rol_evaluador
  FROM evaluaciones e
  JOIN trabajadores t ON t.id = e.id_trabajador
  JOIN periodos_evaluacion pe ON pe.id = e.id_periodo
  JOIN plantillas_evaluacion pl ON pl.id = e.id_plantilla
  LEFT JOIN usuarios ue ON ue.id = e.id_evaluador
  LEFT JOIN trabajadores ev ON ev.id = ue.id_trabajador
`;

function conCategoria(evaluacion) {
  return evaluacion && { ...evaluacion, categoria: categoriaPuntaje(evaluacion.puntaje_final) };
}

// Detalle del período con todas sus evaluaciones
// GET /api/evaluaciones/periodos/:id
router.get("/periodos/:id", permitirRoles("rrhh", "gerencia"), (req, res) => {
  const periodo = obtenerPeriodo(req.params.id);
  if (!periodo) return res.status(404).json({ error: "Período no encontrado" });
  const evaluaciones = db.prepare(`${SELECT_EVALUACION} WHERE e.id_periodo = ? ORDER BY t.apellido, t.nombre`).all(periodo.id);
  res.json({ ...periodo, evaluaciones: evaluaciones.map(conCategoria) });
});

// Evaluador por defecto: el supervisor directo, si está activo y tiene cuenta habilitada
function evaluadorPorDefecto(idTrabajador) {
  return db.prepare(`
    SELECT u.id FROM trabajadores t
    JOIN trabajadores s ON s.id = t.id_supervisor AND s.estado = 'activo'
    JOIN usuarios u ON u.id_trabajador = s.id AND u.activo = 1
    WHERE t.id = ?
  `).get(idTrabajador)?.id ?? null;
}

// Asignar evaluaciones del período a trabajadores (evaluador por defecto: su supervisor directo)
// POST /api/evaluaciones/periodos/:id/asignar  body: { ids_trabajadores: [..], id_plantilla? }
router.post("/periodos/:id/asignar", permitirRoles("rrhh"), (req, res) => {
  try {
    const periodo = obtenerPeriodo(req.params.id);
    if (!periodo) throw new ErrorValidacion("Período no encontrado", 404);
    if (periodo.estado !== "abierto") throw new ErrorValidacion("El período está cerrado", 409);
    const ids = [...new Set((req.body?.ids_trabajadores || []).map(Number))];
    if (ids.length === 0) throw new ErrorValidacion("Seleccione al menos un trabajador");
    const idPlantilla = Number(req.body?.id_plantilla || periodo.id_plantilla);
    if (!db.prepare("SELECT 1 FROM plantillas_evaluacion WHERE id = ? AND activa = 1").get(idPlantilla)) {
      throw new ErrorValidacion("Seleccione una plantilla activa");
    }

    const asignaciones = ids.map((id) => {
      const trabajador = db.prepare("SELECT * FROM trabajadores WHERE id = ?").get(id);
      if (!trabajador || trabajador.estado !== "activo") throw new ErrorValidacion(`El trabajador ${id} no existe o está inactivo`);
      if (db.prepare("SELECT 1 FROM evaluaciones WHERE id_periodo = ? AND id_trabajador = ?").get(periodo.id, id)) {
        throw new ErrorValidacion(`${trabajador.nombre} ${trabajador.apellido} ya tiene una evaluación en este período`, 409);
      }
      return { id, evaluador: evaluadorPorDefecto(id) };
    });

    enTransaccion(() => {
      const insertar = db.prepare("INSERT INTO evaluaciones (id_periodo, id_trabajador, id_plantilla, id_evaluador) VALUES (?, ?, ?, ?)");
      asignaciones.forEach((a) => insertar.run(periodo.id, a.id, idPlantilla, a.evaluador));
    });

    // Un aviso por evaluador con la cantidad que se le asignó
    const porEvaluador = {};
    asignaciones.filter((a) => a.evaluador).forEach((a) => { porEvaluador[a.evaluador] = (porEvaluador[a.evaluador] || 0) + 1; });
    Object.entries(porEvaluador).forEach(([idUsuario, cantidad]) => notificarUsuario(Number(idUsuario), "evaluacion",
      `Tiene ${cantidad} evaluación(es) de desempeño asignada(s) en el período ${periodo.nombre}`, "/evaluaciones/asignadas"));

    const sinEvaluador = asignaciones.filter((a) => !a.evaluador).length;
    res.status(201).json({ ...obtenerPeriodo(periodo.id), asignadas: asignaciones.length, sin_evaluador_nuevas: sinEvaluador });
  } catch (err) { responderError(res, err); }
});

// Cerrar el período: desde ahí sus evaluaciones no se editan
// POST /api/evaluaciones/periodos/:id/cerrar
router.post("/periodos/:id/cerrar", permitirRoles("rrhh"), (req, res) => {
  const periodo = obtenerPeriodo(req.params.id);
  if (!periodo) return res.status(404).json({ error: "Período no encontrado" });
  if (periodo.estado !== "abierto") return res.status(409).json({ error: "El período ya está cerrado" });
  db.prepare("UPDATE periodos_evaluacion SET estado = 'cerrado', fecha_cierre = datetime('now', 'localtime') WHERE id = ?").run(periodo.id);
  res.json(obtenerPeriodo(periodo.id));
});

// ---------------------------------------------------------------- Acciones de mejora (rutas fijas antes de /:id)

const SELECT_ACCION = `
  SELECT a.*, r.nombre || ' ' || r.apellido AS responsable, c.titulo AS capacitacion,
         e.id_trabajador, e.id_evaluador, e.estado AS estado_evaluacion, pe.estado AS estado_periodo, pe.nombre AS periodo
  FROM acciones_mejora a
  JOIN trabajadores r ON r.id = a.id_responsable
  JOIN evaluaciones e ON e.id = a.id_evaluacion
  JOIN periodos_evaluacion pe ON pe.id = e.id_periodo
  LEFT JOIN capacitaciones c ON c.id = a.id_capacitacion
`;

// Acciones de mejora de las que el usuario es responsable (de evaluaciones ya completadas)
// GET /api/evaluaciones/acciones/mias
router.get("/acciones/mias", (req, res) => {
  res.json(db.prepare(`${SELECT_ACCION} WHERE a.id_responsable = ? AND e.estado = 'completada' ORDER BY a.estado = 'completada', a.fecha_limite`)
    .all(req.usuario.id_trabajador));
});

// ¿Puede crear, editar o borrar acciones de esta evaluación? (evaluador con período abierto, o RRHH)
function puedeGestionarAcciones(usuario, evaluacion) {
  return usuario.rol === "rrhh" || (evaluacion.id_evaluador === usuario.id && evaluacion.estado_periodo === "abierto");
}

function validarAccion(cuerpo, parcial = false) {
  const datos = {};
  if (!parcial || cuerpo.descripcion !== undefined) {
    datos.descripcion = String(cuerpo.descripcion || "").trim();
    if (!datos.descripcion) throw new ErrorValidacion("descripcion es obligatoria");
  }
  if (!parcial || cuerpo.fecha_limite !== undefined) {
    if (!esFecha(cuerpo.fecha_limite)) throw new ErrorValidacion("fecha_limite debe tener formato YYYY-MM-DD");
    datos.fecha_limite = cuerpo.fecha_limite;
  }
  if (cuerpo.id_capacitacion !== undefined) {
    datos.id_capacitacion = cuerpo.id_capacitacion ? Number(cuerpo.id_capacitacion) : null;
    if (datos.id_capacitacion && !db.prepare("SELECT 1 FROM capacitaciones WHERE id = ?").get(datos.id_capacitacion)) {
      throw new ErrorValidacion("La capacitación vinculada no existe");
    }
  }
  if (cuerpo.id_responsable !== undefined) {
    datos.id_responsable = Number(cuerpo.id_responsable);
    const responsable = db.prepare("SELECT estado FROM trabajadores WHERE id = ?").get(datos.id_responsable);
    if (!responsable || responsable.estado !== "activo") throw new ErrorValidacion("El responsable no existe o está inactivo");
  }
  return datos;
}

// Cambiar estado (responsable, evaluador o RRHH) o el resto de los datos (evaluador con período abierto, o RRHH)
// PUT /api/evaluaciones/acciones/:id  body: { estado?, descripcion?, fecha_limite?, id_capacitacion?, id_responsable? }
router.put("/acciones/:id", (req, res) => {
  try {
    const accion = db.prepare(`${SELECT_ACCION} WHERE a.id = ?`).get(req.params.id);
    if (!accion) throw new ErrorValidacion("Acción no encontrada", 404);
    const cuerpo = req.body || {};
    const esResponsable = accion.id_responsable === req.usuario.id_trabajador && accion.estado_evaluacion === "completada";
    const gestiona = puedeGestionarAcciones(req.usuario, accion);
    const cambiaDatos = ["descripcion", "fecha_limite", "id_capacitacion", "id_responsable"].some((c) => cuerpo[c] !== undefined);

    if (cambiaDatos && !gestiona) throw new ErrorValidacion("No puede modificar los datos de esta acción", 403);
    if (cuerpo.estado !== undefined) {
      if (!ESTADOS_ACCION.includes(cuerpo.estado)) throw new ErrorValidacion(`estado debe ser uno de: ${ESTADOS_ACCION.join(", ")}`);
      if (!gestiona && !esResponsable && accion.id_evaluador !== req.usuario.id) {
        throw new ErrorValidacion("Solo el responsable, el evaluador o RRHH actualizan el avance", 403);
      }
    }
    const datos = { ...validarAccion(cuerpo, true) };
    if (cuerpo.estado !== undefined) datos.estado = cuerpo.estado;
    const campos = Object.keys(datos);
    if (campos.length === 0) throw new ErrorValidacion("No hay cambios");

    db.prepare(`UPDATE acciones_mejora SET ${campos.map((c) => `${c} = ?`).join(", ")}, fecha_actualizacion = datetime('now', 'localtime') WHERE id = ?`)
      .run(...campos.map((c) => datos[c]), accion.id);
    res.json(db.prepare(`${SELECT_ACCION} WHERE a.id = ?`).get(accion.id));
  } catch (err) { responderError(res, err); }
});

// DELETE /api/evaluaciones/acciones/:id
router.delete("/acciones/:id", (req, res) => {
  const accion = db.prepare(`${SELECT_ACCION} WHERE a.id = ?`).get(req.params.id);
  if (!accion) return res.status(404).json({ error: "Acción no encontrada" });
  if (!puedeGestionarAcciones(req.usuario, accion)) return res.status(403).json({ error: "No puede eliminar esta acción" });
  db.prepare("DELETE FROM acciones_mejora WHERE id = ?").run(accion.id);
  res.json({ mensaje: "Acción eliminada" });
});

// ---------------------------------------------------------------- Evaluaciones

function obtenerEvaluacion(id) {
  return conCategoria(db.prepare(`${SELECT_EVALUACION} WHERE e.id = ?`).get(id));
}

// La propia evaluación solo se ve una vez completada; además la ven su evaluador, RRHH, Gerencia
// y el supervisor del evaluado.
function puedeVerEvaluacion(usuario, evaluacion) {
  if (evaluacion.id_trabajador === usuario.id_trabajador) return evaluacion.estado === "completada";
  if (evaluacion.id_evaluador === usuario.id) return true;
  return usuario.rol !== "trabajador" && puedeVerTrabajador(usuario, evaluacion.id_trabajador);
}

// Listado según el alcance:
//   mias      -> las propias ya completadas
//   asignadas -> las que el usuario debe evaluar (o ya evaluó)
//   todas     -> las de los trabajadores visibles (supervisor: su equipo; RRHH y Gerencia: todas)
// GET /api/evaluaciones?alcance=asignadas&periodo=2
router.get("/", (req, res) => {
  const { alcance = "mias", periodo } = req.query;
  let sql = `${SELECT_EVALUACION} WHERE 1=1`;
  let params = [];
  if (alcance === "mias") {
    sql += " AND e.id_trabajador = ? AND e.estado = 'completada'";
    params.push(req.usuario.id_trabajador);
  } else if (alcance === "asignadas") {
    sql += " AND e.id_evaluador = ?";
    params.push(req.usuario.id);
  } else if (alcance === "todas") {
    if (req.usuario.rol === "trabajador") return res.status(403).json({ error: "No tiene permiso para ver evaluaciones de otros" });
    const visibilidad = filtroVisibilidad(req.usuario, "e.id_trabajador");
    // La propia evaluación pendiente no se muestra ni siquiera a RRHH o Gerencia
    sql += `${visibilidad.sql} AND NOT (e.id_trabajador = ? AND e.estado = 'pendiente')`;
    params = params.concat(visibilidad.params, req.usuario.id_trabajador);
  } else {
    return res.status(400).json({ error: "alcance debe ser 'mias', 'asignadas' o 'todas'" });
  }
  if (periodo) { sql += " AND e.id_periodo = ?"; params.push(periodo); }
  sql += " ORDER BY pe.fecha_inicio DESC, e.estado = 'completada', t.apellido, t.nombre";
  res.json(db.prepare(sql).all(...params).map(conCategoria));
});

// Detalle: criterios, calificaciones, acciones de mejora y lo que el usuario puede hacer
// GET /api/evaluaciones/:id
router.get("/:id", (req, res) => {
  const evaluacion = obtenerEvaluacion(req.params.id);
  if (!evaluacion) return res.status(404).json({ error: "Evaluación no encontrada" });
  if (!puedeVerEvaluacion(req.usuario, evaluacion)) {
    return res.status(403).json({ error: "No tiene permiso para ver esta evaluación" });
  }
  const calificaciones = {};
  db.prepare("SELECT * FROM calificaciones WHERE id_evaluacion = ?").all(evaluacion.id)
    .forEach((c) => { calificaciones[c.id_criterio] = { puntaje: c.puntaje, observacion: c.observacion }; });
  const abierta = evaluacion.estado_periodo === "abierto";

  res.json({
    ...evaluacion,
    criterios: criteriosDe(evaluacion.id_plantilla),
    calificaciones,
    acciones: db.prepare(`${SELECT_ACCION} WHERE a.id_evaluacion = ? ORDER BY a.fecha_limite`).all(evaluacion.id),
    puede_editar: abierta && evaluacion.id_evaluador === req.usuario.id,
    puede_gestionar_acciones: puedeGestionarAcciones(req.usuario, evaluacion),
    puede_confirmar_lectura: evaluacion.id_trabajador === req.usuario.id_trabajador && evaluacion.estado === "completada" && !evaluacion.fecha_lectura,
    puede_reasignar: req.usuario.rol === "rrhh" && abierta && evaluacion.estado === "pendiente",
    ve_todos: veTodos(req.usuario)
  });
});

// Guardar calificaciones y retroalimentación (evaluador, período abierto).
// Con completar = true (o si ya estaba completada) exige todos los criterios y calcula el puntaje.
// PUT /api/evaluaciones/:id  body: { calificaciones: [{ id_criterio, puntaje, observacion }], retroalimentacion, completar }
router.put("/:id", (req, res) => {
  try {
    const evaluacion = obtenerEvaluacion(req.params.id);
    if (!evaluacion) throw new ErrorValidacion("Evaluación no encontrada", 404);
    if (evaluacion.id_evaluador !== req.usuario.id) throw new ErrorValidacion("Solo el evaluador asignado puede calificar", 403);
    if (evaluacion.estado_periodo !== "abierto") throw new ErrorValidacion("El período está cerrado; la evaluación ya no se puede modificar", 409);

    const criterios = criteriosDe(evaluacion.id_plantilla);
    const idsCriterios = new Set(criterios.map((c) => c.id));
    const cuerpo = req.body || {};
    const nuevas = Array.isArray(cuerpo.calificaciones) ? cuerpo.calificaciones : [];
    nuevas.forEach((c) => {
      if (!idsCriterios.has(Number(c.id_criterio))) throw new ErrorValidacion("Hay una calificación de un criterio que no pertenece a la plantilla");
      if (!esPuntajeValido(Number(c.puntaje))) throw new ErrorValidacion("Cada criterio se califica con un entero de 1 a 5");
    });

    const completar = Boolean(cuerpo.completar) || evaluacion.estado === "completada";
    const resultado = enTransaccion(() => {
      const guardar = db.prepare(`
        INSERT INTO calificaciones (id_evaluacion, id_criterio, puntaje, observacion) VALUES (?, ?, ?, ?)
        ON CONFLICT (id_evaluacion, id_criterio) DO UPDATE SET puntaje = excluded.puntaje, observacion = excluded.observacion
      `);
      nuevas.forEach((c) => guardar.run(evaluacion.id, Number(c.id_criterio), Number(c.puntaje), c.observacion ? String(c.observacion).trim() : null));
      const retro = cuerpo.retroalimentacion === undefined ? evaluacion.retroalimentacion : (String(cuerpo.retroalimentacion).trim() || null);

      if (!completar) {
        db.prepare("UPDATE evaluaciones SET retroalimentacion = ? WHERE id = ?").run(retro, evaluacion.id);
        return { completada: false };
      }
      const puntajes = {};
      db.prepare("SELECT id_criterio, puntaje FROM calificaciones WHERE id_evaluacion = ?").all(evaluacion.id)
        .forEach((c) => { puntajes[c.id_criterio] = c.puntaje; });
      const puntaje = calcularPuntaje(criterios, puntajes);
      if (puntaje === null) throw new ErrorValidacion("Para completar la evaluación debe calificar todos los criterios");
      if (!retro) throw new ErrorValidacion("Para completar la evaluación escriba la retroalimentación");
      db.prepare(`
        UPDATE evaluaciones SET retroalimentacion = ?, puntaje_final = ?, estado = 'completada',
          fecha_completada = COALESCE(fecha_completada, datetime('now', 'localtime'))
        WHERE id = ?
      `).run(retro, puntaje, evaluacion.id);
      return { completada: true, primeraVez: evaluacion.estado === "pendiente" };
    });

    if (resultado.primeraVez) {
      notificarTrabajador(evaluacion.id_trabajador, "evaluacion",
        `Su evaluación de desempeño del período ${evaluacion.periodo} está disponible`, `/evaluaciones/${evaluacion.id}`);
    }
    res.json(obtenerEvaluacion(evaluacion.id));
  } catch (err) { responderError(res, err); }
});

// Cambiar el evaluador de una evaluación pendiente (RRHH)
// PUT /api/evaluaciones/:id/evaluador  body: { id_evaluador }  (id de usuario)
router.put("/:id/evaluador", permitirRoles("rrhh"), (req, res) => {
  try {
    const evaluacion = obtenerEvaluacion(req.params.id);
    if (!evaluacion) throw new ErrorValidacion("Evaluación no encontrada", 404);
    if (evaluacion.estado_periodo !== "abierto" || evaluacion.estado !== "pendiente") {
      throw new ErrorValidacion("Solo se reasignan evaluaciones pendientes de períodos abiertos", 409);
    }
    const evaluador = db.prepare(`
      SELECT u.* FROM usuarios u JOIN trabajadores t ON t.id = u.id_trabajador
      WHERE u.id = ? AND u.activo = 1 AND t.estado = 'activo'
    `).get(req.body?.id_evaluador);
    if (!evaluador || !ROLES_EVALUADORES.includes(evaluador.rol)) {
      throw new ErrorValidacion("El evaluador debe ser un usuario activo con rol de supervisor, RRHH o Gerencia");
    }
    if (evaluador.id_trabajador === evaluacion.id_trabajador) throw new ErrorValidacion("Nadie puede evaluarse a sí mismo");

    // Las calificaciones parciales del evaluador anterior se descartan
    enTransaccion(() => {
      db.prepare("DELETE FROM calificaciones WHERE id_evaluacion = ?").run(evaluacion.id);
      db.prepare("UPDATE evaluaciones SET id_evaluador = ?, retroalimentacion = NULL WHERE id = ?").run(evaluador.id, evaluacion.id);
    });
    notificarUsuario(evaluador.id, "evaluacion",
      `Se le asignó evaluar a ${evaluacion.nombre} ${evaluacion.apellido} en el período ${evaluacion.periodo}`, `/evaluaciones/${evaluacion.id}`);
    res.json(obtenerEvaluacion(evaluacion.id));
  } catch (err) { responderError(res, err); }
});

// Quitar una evaluación pendiente del período (RRHH)
// DELETE /api/evaluaciones/:id
router.delete("/:id", permitirRoles("rrhh"), (req, res) => {
  const evaluacion = obtenerEvaluacion(req.params.id);
  if (!evaluacion) return res.status(404).json({ error: "Evaluación no encontrada" });
  if (evaluacion.estado_periodo !== "abierto" || evaluacion.estado !== "pendiente") {
    return res.status(409).json({ error: "Solo se quitan evaluaciones pendientes de períodos abiertos" });
  }
  enTransaccion(() => {
    db.prepare("DELETE FROM acciones_mejora WHERE id_evaluacion = ?").run(evaluacion.id);
    db.prepare("DELETE FROM calificaciones WHERE id_evaluacion = ?").run(evaluacion.id);
    db.prepare("DELETE FROM evaluaciones WHERE id = ?").run(evaluacion.id);
  });
  res.json({ mensaje: "Evaluación quitada del período" });
});

// El evaluado deja constancia de que leyó su evaluación
// POST /api/evaluaciones/:id/lectura
router.post("/:id/lectura", (req, res) => {
  const evaluacion = obtenerEvaluacion(req.params.id);
  if (!evaluacion) return res.status(404).json({ error: "Evaluación no encontrada" });
  if (evaluacion.id_trabajador !== req.usuario.id_trabajador) return res.status(403).json({ error: "Solo el evaluado confirma la lectura" });
  if (evaluacion.estado !== "completada") return res.status(409).json({ error: "La evaluación todavía no está completada" });
  if (evaluacion.fecha_lectura) return res.status(409).json({ error: "Ya confirmó la lectura" });
  db.prepare("UPDATE evaluaciones SET fecha_lectura = datetime('now', 'localtime') WHERE id = ?").run(evaluacion.id);
  if (evaluacion.id_evaluador) {
    notificarUsuario(evaluacion.id_evaluador, "evaluacion",
      `${evaluacion.nombre} ${evaluacion.apellido} confirmó la lectura de su evaluación del período ${evaluacion.periodo}`, `/evaluaciones/${evaluacion.id}`);
  }
  res.json(obtenerEvaluacion(evaluacion.id));
});

// Agregar una acción al plan de mejora (evaluador con período abierto, o RRHH).
// El responsable por defecto es el evaluado.
// POST /api/evaluaciones/:id/acciones  body: { descripcion, fecha_limite, id_responsable?, id_capacitacion? }
router.post("/:id/acciones", (req, res) => {
  try {
    const evaluacion = obtenerEvaluacion(req.params.id);
    if (!evaluacion) throw new ErrorValidacion("Evaluación no encontrada", 404);
    if (!puedeGestionarAcciones(req.usuario, evaluacion)) throw new ErrorValidacion("No puede agregar acciones a esta evaluación", 403);
    const datos = validarAccion({ id_responsable: evaluacion.id_trabajador, ...req.body });
    const id = db.prepare(`
      INSERT INTO acciones_mejora (id_evaluacion, descripcion, id_responsable, fecha_limite, id_capacitacion) VALUES (?, ?, ?, ?, ?)
    `).run(evaluacion.id, datos.descripcion, datos.id_responsable, datos.fecha_limite, datos.id_capacitacion ?? null).lastInsertRowid;
    // Si la evaluación ya es visible para el trabajador, se le avisa
    if (evaluacion.estado === "completada") {
      notificarTrabajador(datos.id_responsable, "evaluacion", `Tiene una nueva acción de mejora: ${datos.descripcion} (hasta el ${datos.fecha_limite})`, "/evaluaciones");
    }
    res.status(201).json(db.prepare(`${SELECT_ACCION} WHERE a.id = ?`).get(id));
  } catch (err) { responderError(res, err); }
});

module.exports = router;
