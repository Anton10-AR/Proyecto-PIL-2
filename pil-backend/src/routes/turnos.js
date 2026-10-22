// Rutas de Turnos: catálogo de turnos (RRHH los administra) y asignación de turnos a trabajadores
const express = require("express");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");
const { filtroVisibilidad, puedeVerTrabajador } = require("../utils/visibilidad");
const { esHora, esFecha, hoyLocal, sumarDias } = require("../utils/fechas");
const { notificarTrabajador } = require("../utils/notificar");

const router = express.Router();

const NOMBRES_DIA = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

// Valida y normaliza los datos de un turno. Devuelve { error } o { datos }
function validarTurno({ nombre, hora_inicio, hora_fin, dias_laborables }) {
  if (!nombre || !String(nombre).trim()) return { error: "nombre es obligatorio" };
  if (!esHora(hora_inicio) || !esHora(hora_fin)) return { error: "hora_inicio y hora_fin deben tener formato HH:MM" };
  if (hora_fin <= hora_inicio) return { error: "La hora de fin debe ser posterior a la de inicio (no hay turnos nocturnos)" };

  const dias = Array.isArray(dias_laborables) ? dias_laborables.map(Number) : [];
  if (dias.length === 0 || dias.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
    return { error: "dias_laborables debe ser una lista de días del 1 (lunes) al 7 (domingo)" };
  }
  const diasOrdenados = [...new Set(dias)].sort((a, b) => a - b).join(",");
  return { datos: { nombre: String(nombre).trim(), hora_inicio, hora_fin, dias_laborables: diasOrdenados } };
}

function describirDias(diasLaborables) {
  return diasLaborables.split(",").map((d) => NOMBRES_DIA[Number(d)]).join(", ");
}

function conDescripcion(turno) {
  return { ...turno, dias_texto: describirDias(turno.dias_laborables) };
}

// Catálogo de turnos con la cantidad de trabajadores que lo tienen vigente
// GET /api/turnos
router.get("/", (req, res) => {
  const turnos = db.prepare(`
    SELECT t.*, (
      SELECT COUNT(*) FROM asignaciones_turno a
      JOIN trabajadores tr ON tr.id = a.id_trabajador
      WHERE a.id_turno = t.id AND a.fecha_hasta IS NULL AND tr.estado = 'activo'
    ) AS asignados
    FROM turnos t ORDER BY t.activo DESC, t.hora_inicio, t.nombre
  `).all();
  res.json(turnos.map(conDescripcion));
});

// POST /api/turnos  body: { nombre, hora_inicio, hora_fin, dias_laborables: [1..7] }
router.post("/", permitirRoles("rrhh"), (req, res) => {
  const { error, datos } = validarTurno(req.body || {});
  if (error) return res.status(400).json({ error });

  try {
    const resultado = db.prepare(`
      INSERT INTO turnos (nombre, hora_inicio, hora_fin, dias_laborables) VALUES (?, ?, ?, ?)
    `).run(datos.nombre, datos.hora_inicio, datos.hora_fin, datos.dias_laborables);
    res.status(201).json(conDescripcion(db.prepare("SELECT * FROM turnos WHERE id = ?").get(resultado.lastInsertRowid)));
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe un turno con ese nombre" });
    res.status(500).json({ error: "Error al crear el turno" });
  }
});

// Modificar un turno o activarlo/desactivarlo. Un turno con trabajadores asignados no se desactiva.
// PUT /api/turnos/:id  body: { nombre, hora_inicio, hora_fin, dias_laborables, activo }
router.put("/:id", permitirRoles("rrhh"), (req, res) => {
  const existente = db.prepare("SELECT * FROM turnos WHERE id = ?").get(req.params.id);
  if (!existente) return res.status(404).json({ error: "Turno no encontrado" });

  const cuerpo = req.body || {};
  const { error, datos } = validarTurno({
    nombre: cuerpo.nombre ?? existente.nombre,
    hora_inicio: cuerpo.hora_inicio ?? existente.hora_inicio,
    hora_fin: cuerpo.hora_fin ?? existente.hora_fin,
    dias_laborables: cuerpo.dias_laborables ?? existente.dias_laborables.split(",")
  });
  if (error) return res.status(400).json({ error });

  const activo = cuerpo.activo === undefined ? existente.activo : (cuerpo.activo ? 1 : 0);
  if (!activo && existente.activo) {
    const enUso = db.prepare(
      "SELECT COUNT(*) AS total FROM asignaciones_turno WHERE id_turno = ? AND fecha_hasta IS NULL"
    ).get(existente.id).total;
    if (enUso > 0) {
      return res.status(409).json({ error: `No se puede desactivar: ${enUso} trabajador(es) tienen este turno vigente` });
    }
  }

  try {
    db.prepare(`
      UPDATE turnos SET nombre = ?, hora_inicio = ?, hora_fin = ?, dias_laborables = ?, activo = ? WHERE id = ?
    `).run(datos.nombre, datos.hora_inicio, datos.hora_fin, datos.dias_laborables, activo, existente.id);
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe un turno con ese nombre" });
    return res.status(500).json({ error: "Error al modificar el turno" });
  }
  res.json(conDescripcion(db.prepare("SELECT * FROM turnos WHERE id = ?").get(existente.id)));
});

// Turno vigente hoy de cada trabajador activo visible para el usuario
// GET /api/turnos/vigentes
router.get("/vigentes", (req, res) => {
  const hoy = hoyLocal();
  const visibilidad = filtroVisibilidad(req.usuario, "tr.id");
  const filas = db.prepare(`
    SELECT tr.id AS id_trabajador, tr.nombre, tr.apellido, tr.area, tr.cargo,
           t.id AS id_turno, t.nombre AS turno, t.hora_inicio, t.hora_fin, t.dias_laborables,
           a.fecha_desde
    FROM trabajadores tr
    LEFT JOIN asignaciones_turno a ON a.id_trabajador = tr.id
      AND a.fecha_desde <= ? AND (a.fecha_hasta IS NULL OR a.fecha_hasta >= ?)
    LEFT JOIN turnos t ON t.id = a.id_turno
    WHERE tr.estado = 'activo'${visibilidad.sql}
    ORDER BY tr.apellido, tr.nombre
  `).all(hoy, hoy, ...visibilidad.params);

  // Asignaciones programadas a futuro (aún no vigentes)
  const programadas = db.prepare(`
    SELECT a.id_trabajador, t.nombre AS turno, a.fecha_desde FROM asignaciones_turno a
    JOIN turnos t ON t.id = a.id_turno WHERE a.fecha_desde > ?
  `).all(hoy);

  res.json(filas.map((f) => ({
    ...f,
    dias_texto: f.dias_laborables ? describirDias(f.dias_laborables) : null,
    programada: programadas.find((p) => p.id_trabajador === f.id_trabajador) || null
  })));
});

// Historial de asignaciones de un trabajador
// GET /api/turnos/asignaciones?trabajador=ID
router.get("/asignaciones", (req, res) => {
  const { trabajador } = req.query;
  if (!trabajador) return res.status(400).json({ error: "trabajador es obligatorio" });
  if (!puedeVerTrabajador(req.usuario, trabajador)) {
    return res.status(403).json({ error: "No tiene permiso para ver a este trabajador" });
  }
  const asignaciones = db.prepare(`
    SELECT a.*, t.nombre AS turno, t.hora_inicio, t.hora_fin, t.dias_laborables
    FROM asignaciones_turno a JOIN turnos t ON t.id = a.id_turno
    WHERE a.id_trabajador = ? ORDER BY a.fecha_desde DESC
  `).all(trabajador);
  res.json(asignaciones.map((a) => ({ ...a, dias_texto: describirDias(a.dias_laborables) })));
});

// Asignar un turno desde una fecha. Cierra la asignación abierta el día anterior.
// Si ya hay una asignación programada a futuro, la reemplaza.
// POST /api/turnos/asignaciones  body: { id_trabajador, id_turno, fecha_desde }
router.post("/asignaciones", permitirRoles("rrhh"), (req, res) => {
  const { id_trabajador, id_turno, fecha_desde } = req.body || {};
  if (!id_trabajador || !id_turno || !esFecha(fecha_desde)) {
    return res.status(400).json({ error: "id_trabajador, id_turno y fecha_desde (YYYY-MM-DD) son obligatorios" });
  }
  const trabajador = db.prepare("SELECT * FROM trabajadores WHERE id = ?").get(id_trabajador);
  if (!trabajador || trabajador.estado !== "activo") {
    return res.status(400).json({ error: "El trabajador no existe o está inactivo" });
  }
  const turno = db.prepare("SELECT * FROM turnos WHERE id = ?").get(id_turno);
  if (!turno || !turno.activo) return res.status(400).json({ error: "El turno no existe o está inactivo" });

  const abierta = db.prepare(
    "SELECT * FROM asignaciones_turno WHERE id_trabajador = ? AND fecha_hasta IS NULL"
  ).get(id_trabajador);

  try {
    db.exec("BEGIN");
    if (abierta && abierta.fecha_desde >= fecha_desde) {
      // La asignación abierta empieza el mismo día o después: solo se permite reemplazarla
      // si aún no entró en vigencia (programada a futuro); el pasado no se reescribe.
      if (abierta.fecha_desde <= hoyLocal()) {
        throw Object.assign(new Error(
          `La fecha debe ser posterior al ${abierta.fecha_desde}, inicio del turno vigente`
        ), { esValidacion: true });
      }
      db.prepare("DELETE FROM asignaciones_turno WHERE id = ?").run(abierta.id);
      const anterior = db.prepare(`
        SELECT * FROM asignaciones_turno WHERE id_trabajador = ? ORDER BY fecha_desde DESC LIMIT 1
      `).get(id_trabajador);
      if (anterior && anterior.fecha_desde >= fecha_desde) {
        throw Object.assign(new Error(
          `La fecha debe ser posterior al ${anterior.fecha_desde}, inicio del turno vigente`
        ), { esValidacion: true });
      }
      if (anterior) {
        db.prepare("UPDATE asignaciones_turno SET fecha_hasta = ? WHERE id = ?").run(sumarDias(fecha_desde, -1), anterior.id);
      }
    } else if (abierta) {
      db.prepare("UPDATE asignaciones_turno SET fecha_hasta = ? WHERE id = ?").run(sumarDias(fecha_desde, -1), abierta.id);
    }

    db.prepare(`
      INSERT INTO asignaciones_turno (id_trabajador, id_turno, fecha_desde, id_asignado_por) VALUES (?, ?, ?, ?)
    `).run(id_trabajador, id_turno, fecha_desde, req.usuario.id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    if (err.esValidacion) return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "Error al asignar el turno" });
  }

  notificarTrabajador(
    id_trabajador, "turno",
    `Se le asignó el turno ${turno.nombre} (${turno.hora_inicio}–${turno.hora_fin}, ${describirDias(turno.dias_laborables)}) desde el ${fecha_desde}`,
    "/asistencia"
  );
  res.status(201).json({ mensaje: "Turno asignado" });
});

module.exports = router;
