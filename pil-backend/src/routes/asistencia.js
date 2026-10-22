// Rutas del módulo Asistencia: marcación propia de entrada/salida (hora del servidor),
// consulta según el rol y registro/corrección manual por RRHH.
const express = require("express");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");
const { filtroVisibilidad } = require("../utils/visibilidad");
const { hoyLocal, horaLocal, esFecha, esHora, esMes, rangoDelMes, calcularHoras, calcularRetraso } = require("../utils/fechas");
const { jornadaDelDia, toleranciaMinutos } = require("../utils/jornada");
const { solicitudAprobadaEn, textoSolicitudAprobada } = require("../utils/solicitudes");

const router = express.Router();

const SELECT_ASISTENCIA = `
  SELECT a.*, tr.nombre, tr.apellido, tr.area, t.nombre AS turno, t.hora_inicio AS turno_inicio, t.hora_fin AS turno_fin
  FROM asistencia a
  JOIN trabajadores tr ON tr.id = a.id_trabajador
  LEFT JOIN turnos t ON t.id = a.id_turno
`;

function obtenerRegistro(id) {
  return db.prepare(`${SELECT_ASISTENCIA} WHERE a.id = ?`).get(id);
}

// Calcula turno, retraso y horas de una marcación según la jornada del trabajador en esa fecha.
// Si el día no es laborable para su turno (o no tiene turno, o es feriado) queda "fuera de turno".
function calcularCampos(idTrabajador, fecha, horaEntrada, horaSalida) {
  const { turno, laborable } = jornadaDelDia(idTrabajador, fecha);
  const enTurno = laborable && turno;
  return {
    id_turno: enTurno ? turno.id : null,
    minutos_retraso: enTurno ? calcularRetraso(horaEntrada, turno.hora_inicio, toleranciaMinutos()) : null,
    horas_trabajadas: horaSalida ? calcularHoras(horaEntrada, horaSalida) : null
  };
}

function ausenciaDe(idTrabajador, fecha) {
  return db.prepare("SELECT * FROM ausencias WHERE id_trabajador = ? AND fecha = ?").get(idTrabajador, fecha);
}

// Consultar asistencia de los trabajadores visibles
// GET /api/asistencia?trabajador=1&mes=2026-10&area=X&solo_retrasos=1
// (también acepta desde/hasta en lugar de mes)
router.get("/", (req, res) => {
  const { trabajador, mes, area, solo_retrasos } = req.query;
  let { desde, hasta } = req.query;
  if (mes) {
    if (!esMes(mes)) return res.status(400).json({ error: "mes debe tener formato YYYY-MM" });
    ({ desde, hasta } = rangoDelMes(mes));
  }

  const visibilidad = filtroVisibilidad(req.usuario, "a.id_trabajador");
  let sql = `${SELECT_ASISTENCIA} WHERE 1=1${visibilidad.sql}`;
  const params = [...visibilidad.params];

  if (trabajador) { sql += " AND a.id_trabajador = ?"; params.push(trabajador); }
  if (area) { sql += " AND tr.area = ?"; params.push(area); }
  if (desde) { sql += " AND a.fecha >= ?"; params.push(desde); }
  if (hasta) { sql += " AND a.fecha <= ?"; params.push(hasta); }
  if (solo_retrasos) sql += " AND a.minutos_retraso > 0";
  sql += " ORDER BY a.fecha DESC, tr.apellido, tr.nombre";

  res.json(db.prepare(sql).all(...params));
});

// Situación de hoy del usuario actual: turno, marcación y ausencia
// GET /api/asistencia/hoy
router.get("/hoy", (req, res) => {
  const fecha = hoyLocal();
  const idTrabajador = req.usuario.id_trabajador;
  const { turno, feriado, laborable } = jornadaDelDia(idTrabajador, fecha);
  const registro = db.prepare("SELECT * FROM asistencia WHERE id_trabajador = ? AND fecha = ?").get(idTrabajador, fecha);

  res.json({
    fecha,
    hora: horaLocal(),
    turno,
    feriado,
    laborable,
    tolerancia_minutos: toleranciaMinutos(),
    registro: registro || null,
    ausencia: ausenciaDe(idTrabajador, fecha) || null,
    solicitud: solicitudAprobadaEn(idTrabajador, fecha)
  });
});

// Marcar la entrada propia con la hora del servidor
// POST /api/asistencia/entrada
router.post("/entrada", (req, res) => {
  const fecha = hoyLocal();
  const hora = horaLocal();
  const idTrabajador = req.usuario.id_trabajador;

  if (ausenciaDe(idTrabajador, fecha)) {
    return res.status(409).json({ error: "RRHH registró una ausencia para hoy; consulte con Recursos Humanos" });
  }
  if (db.prepare("SELECT id FROM asistencia WHERE id_trabajador = ? AND fecha = ?").get(idTrabajador, fecha)) {
    return res.status(409).json({ error: "Ya registró su entrada hoy" });
  }
  const solicitud = solicitudAprobadaEn(idTrabajador, fecha);
  if (solicitud) {
    return res.status(409).json({ error: `Hoy tiene ${textoSolicitudAprobada(solicitud)}; no corresponde marcar asistencia` });
  }

  const campos = calcularCampos(idTrabajador, fecha, hora, null);
  const resultado = db.prepare(`
    INSERT INTO asistencia (id_trabajador, fecha, hora_entrada, id_turno, minutos_retraso)
    VALUES (?, ?, ?, ?, ?)
  `).run(idTrabajador, fecha, hora, campos.id_turno, campos.minutos_retraso);

  res.status(201).json(obtenerRegistro(resultado.lastInsertRowid));
});

// Marcar la salida propia con la hora del servidor
// POST /api/asistencia/salida
router.post("/salida", (req, res) => {
  const fecha = hoyLocal();
  const hora = horaLocal();
  const registro = db.prepare(
    "SELECT * FROM asistencia WHERE id_trabajador = ? AND fecha = ?"
  ).get(req.usuario.id_trabajador, fecha);

  if (!registro) return res.status(409).json({ error: "Primero debe registrar su entrada" });
  if (registro.hora_salida) return res.status(409).json({ error: "Ya registró su salida hoy" });
  if (hora <= registro.hora_entrada) {
    return res.status(409).json({ error: "La salida debe ser posterior a la entrada; intente en un minuto" });
  }

  db.prepare("UPDATE asistencia SET hora_salida = ?, horas_trabajadas = ? WHERE id = ?")
    .run(hora, calcularHoras(registro.hora_entrada, hora), registro.id);
  res.json(obtenerRegistro(registro.id));
});

// Validación común de una marcación manual o corregida. Devuelve un mensaje de error o null.
function validarMarcacion({ hora_entrada, hora_salida, observacion }) {
  if (!esHora(hora_entrada)) return "hora_entrada debe tener formato HH:MM";
  if (hora_salida && !esHora(hora_salida)) return "hora_salida debe tener formato HH:MM";
  if (hora_salida && hora_salida <= hora_entrada) return "La hora de salida debe ser posterior a la de entrada";
  if (!observacion || !String(observacion).trim()) return "observacion es obligatoria: indique el motivo del registro o la corrección";
  return null;
}

// Registrar manualmente una marcación (ej. el trabajador olvidó marcar). Solo RRHH.
// POST /api/asistencia  body: { id_trabajador, fecha, hora_entrada, hora_salida?, observacion }
router.post("/", permitirRoles("rrhh"), (req, res) => {
  const { id_trabajador, fecha, hora_entrada, hora_salida, observacion } = req.body || {};
  if (!id_trabajador || !esFecha(fecha)) {
    return res.status(400).json({ error: "id_trabajador y fecha (YYYY-MM-DD) son obligatorios" });
  }
  if (fecha > hoyLocal()) return res.status(400).json({ error: "No se puede registrar asistencia en una fecha futura" });
  const error = validarMarcacion({ hora_entrada, hora_salida, observacion });
  if (error) return res.status(400).json({ error });

  const trabajador = db.prepare("SELECT id FROM trabajadores WHERE id = ?").get(id_trabajador);
  if (!trabajador) return res.status(404).json({ error: "Trabajador no encontrado" });
  if (ausenciaDe(id_trabajador, fecha)) {
    return res.status(409).json({ error: "Hay una ausencia registrada ese día; elimínela antes de registrar asistencia" });
  }
  const solicitud = solicitudAprobadaEn(id_trabajador, fecha);
  if (solicitud) {
    return res.status(409).json({ error: `El trabajador tiene ${textoSolicitudAprobada(solicitud)} ese día` });
  }
  if (db.prepare("SELECT id FROM asistencia WHERE id_trabajador = ? AND fecha = ?").get(id_trabajador, fecha)) {
    return res.status(409).json({ error: "Ya existe una marcación para ese trabajador en esa fecha; corríjala en lugar de crear otra" });
  }

  const campos = calcularCampos(id_trabajador, fecha, hora_entrada, hora_salida);
  const resultado = db.prepare(`
    INSERT INTO asistencia
      (id_trabajador, fecha, hora_entrada, hora_salida, id_turno, minutos_retraso, horas_trabajadas,
       observacion, id_corregido_por, fecha_correccion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(
    id_trabajador, fecha, hora_entrada, hora_salida || null, campos.id_turno, campos.minutos_retraso,
    campos.horas_trabajadas, String(observacion).trim(), req.usuario.id
  );
  res.status(201).json(obtenerRegistro(resultado.lastInsertRowid));
});

// Corregir una marcación existente. Recalcula retraso y horas. Solo RRHH.
// PUT /api/asistencia/:id  body: { hora_entrada, hora_salida (null para quitarla), observacion }
router.put("/:id", permitirRoles("rrhh"), (req, res) => {
  const registro = db.prepare("SELECT * FROM asistencia WHERE id = ?").get(req.params.id);
  if (!registro) return res.status(404).json({ error: "Registro de asistencia no encontrado" });

  const cuerpo = req.body || {};
  const datos = {
    hora_entrada: cuerpo.hora_entrada ?? registro.hora_entrada,
    hora_salida: cuerpo.hora_salida === undefined ? registro.hora_salida : (cuerpo.hora_salida || null),
    observacion: cuerpo.observacion
  };
  const error = validarMarcacion(datos);
  if (error) return res.status(400).json({ error });

  const campos = calcularCampos(registro.id_trabajador, registro.fecha, datos.hora_entrada, datos.hora_salida);
  db.prepare(`
    UPDATE asistencia SET hora_entrada = ?, hora_salida = ?, id_turno = ?, minutos_retraso = ?,
      horas_trabajadas = ?, observacion = ?, id_corregido_por = ?, fecha_correccion = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    datos.hora_entrada, datos.hora_salida, campos.id_turno, campos.minutos_retraso, campos.horas_trabajadas,
    String(datos.observacion).trim(), req.usuario.id, registro.id
  );
  res.json(obtenerRegistro(registro.id));
});

module.exports = router;
