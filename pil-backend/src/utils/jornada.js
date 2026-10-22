// Reglas de jornada laboral compartidas por asistencia, solicitudes y reportes:
// turno vigente de un trabajador, feriados, día laborable y tolerancia de retraso.
// (El cálculo puro del retraso está en fechas.js para poder probarlo sin base de datos.)
const db = require("../db/database");
const { diaSemana } = require("./fechas");

// "1,2,3,4,5" -> [1, 2, 3, 4, 5]
function diasDelTurno(turno) {
  return turno.dias_laborables.split(",").map(Number);
}

function toleranciaMinutos() {
  const fila = db.prepare("SELECT valor FROM configuracion WHERE clave = 'tolerancia_minutos'").get();
  return fila ? Number(fila.valor) : 0;
}

// Turno asignado al trabajador en esa fecha (o null si no tiene)
function turnoVigente(idTrabajador, fecha) {
  return db.prepare(`
    SELECT t.* FROM asignaciones_turno a
    JOIN turnos t ON t.id = a.id_turno
    WHERE a.id_trabajador = ? AND a.fecha_desde <= ?
      AND (a.fecha_hasta IS NULL OR a.fecha_hasta >= ?)
  `).get(idTrabajador, fecha, fecha) || null;
}

function feriadoDe(fecha) {
  return db.prepare("SELECT * FROM feriados WHERE fecha = ?").get(fecha) || null;
}

// Situación del trabajador en una fecha: su turno, si es feriado y si le toca trabajar
function jornadaDelDia(idTrabajador, fecha) {
  const turno = turnoVigente(idTrabajador, fecha);
  const feriado = feriadoDe(fecha);
  const laborable = Boolean(turno && !feriado && diasDelTurno(turno).includes(diaSemana(fecha)));
  return { turno, feriado, laborable };
}

module.exports = { diasDelTurno, toleranciaMinutos, turnoVigente, feriadoDe, jornadaDelDia };
