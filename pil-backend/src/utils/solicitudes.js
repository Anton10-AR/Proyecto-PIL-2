// Reglas de solicitudes compartidas por las rutas de solicitudes, asistencia, ausencias y personal:
// días hábiles, saldo de vacaciones, días cubiertos por permisos/vacaciones y flujo de aprobación.
const db = require("../db/database");
const { sumarDias, hoyLocal } = require("./fechas");
const { jornadaDelDia } = require("./jornada");
const { calcularDerechoVacaciones } = require("./vacaciones");

// Estados que "ocupan" fechas y días: pendientes y aprobadas
const ESTADOS_PENDIENTES = ["pendiente_supervisor", "pendiente_rrhh", "pendiente_gerencia"];
const ESTADOS_ACTIVOS = [...ESTADOS_PENDIENTES, "aprobado"];
const ETAPA_DE_ESTADO = { pendiente_supervisor: "supervisor", pendiente_rrhh: "rrhh", pendiente_gerencia: "gerencia" };

const enLista = (lista) => lista.map((e) => `'${e}'`).join(", ");

// Días laborables del trabajador en el rango (según su turno vigente cada día y los feriados)
function diasHabilesEntre(idTrabajador, desde, hasta) {
  let total = 0;
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    if (jornadaDelDia(idTrabajador, fecha).laborable) total++;
  }
  return total;
}

// Saldo de vacaciones de la gestión vigente (o de la que contiene "fecha")
function saldoVacaciones(idTrabajador, fecha = hoyLocal()) {
  const trabajador = db.prepare("SELECT fecha_ingreso FROM trabajadores WHERE id = ?").get(idTrabajador);
  const derecho = calcularDerechoVacaciones(trabajador?.fecha_ingreso, fecha);
  const usados = { aprobados: 0, pendientes: 0 };

  if (derecho.gestion_inicio) {
    const fila = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN estado = 'aprobado' THEN dias_habiles END), 0) AS aprobados,
             COALESCE(SUM(CASE WHEN estado <> 'aprobado' THEN dias_habiles END), 0) AS pendientes
      FROM solicitudes
      WHERE id_trabajador = ? AND tipo = 'vacacion' AND gestion_inicio = ?
        AND estado IN (${enLista(ESTADOS_ACTIVOS)})
    `).get(idTrabajador, derecho.gestion_inicio);
    usados.aprobados = fila.aprobados;
    usados.pendientes = fila.pendientes;
  }

  return {
    ...derecho,
    fecha_ingreso: trabajador?.fecha_ingreso || null,
    usados: usados.aprobados,
    reservados: usados.pendientes,
    disponibles: Math.max(derecho.dias - usados.aprobados - usados.pendientes, 0)
  };
}

// Solicitud aprobada que cubre esa fecha (para bloquear marcaciones y ausencias)
function solicitudAprobadaEn(idTrabajador, fecha) {
  return db.prepare(`
    SELECT s.*, tp.nombre AS tipo_permiso FROM solicitudes s
    LEFT JOIN tipos_permiso tp ON tp.id = s.id_tipo_permiso
    WHERE s.id_trabajador = ? AND s.estado = 'aprobado' AND s.fecha_inicio <= ? AND s.fecha_fin >= ?
  `).get(idTrabajador, fecha, fecha) || null;
}

function describirSolicitud(solicitud) {
  return solicitud.tipo === "vacacion" ? "vacación" : `permiso${solicitud.tipo_permiso ? ` (${solicitud.tipo_permiso})` : ""}`;
}

// "una vacación aprobada" / "un permiso (Médico) aprobado"
function textoSolicitudAprobada(solicitud) {
  return solicitud.tipo === "vacacion" ? "una vacación aprobada" : `un ${describirSolicitud(solicitud)} aprobado`;
}

// Solicitud activa del trabajador que se superpone con el rango (excluyendo una, si se indica)
function solicitudSuperpuesta(idTrabajador, desde, hasta, excluirId = null) {
  return db.prepare(`
    SELECT * FROM solicitudes
    WHERE id_trabajador = ? AND estado IN (${enLista(ESTADOS_ACTIVOS)})
      AND fecha_inicio <= ? AND fecha_fin >= ? AND id <> ?
  `).get(idTrabajador, hasta, desde, excluirId ?? -1) || null;
}

// Primer estado según quién solicita:
// - personal de RRHH, Gerencia o quien no tiene un supervisor activo con cuenta habilitada:
//   aprueba Gerencia (un paso), para que la solicitud no quede sin nadie que pueda decidirla
// - el resto: primero su supervisor directo y luego RRHH
function estadoInicial(idTrabajador) {
  const fila = db.prepare(`
    SELECT u.rol, us.id AS cuenta_supervisor
    FROM trabajadores t
    LEFT JOIN usuarios u ON u.id_trabajador = t.id
    LEFT JOIN trabajadores s ON s.id = t.id_supervisor AND s.estado = 'activo'
    LEFT JOIN usuarios us ON us.id_trabajador = s.id AND us.activo = 1
    WHERE t.id = ?
  `).get(idTrabajador);
  if (!fila || fila.rol === "rrhh" || fila.rol === "gerencia" || !fila.cuenta_supervisor) return "pendiente_gerencia";
  return "pendiente_supervisor";
}

// ¿Puede este usuario decidir la etapa actual de la solicitud? Devuelve null si puede o el motivo si no.
function motivoNoPuedeDecidir(usuario, solicitud) {
  const etapa = ETAPA_DE_ESTADO[solicitud.estado];
  if (!etapa) return "La solicitud ya no está pendiente";
  if (solicitud.id_trabajador === usuario.id_trabajador) return "No puede decidir sobre su propia solicitud";

  if (etapa === "supervisor") {
    const { id_supervisor } = db.prepare("SELECT id_supervisor FROM trabajadores WHERE id = ?").get(solicitud.id_trabajador);
    return id_supervisor === usuario.id_trabajador ? null : "Solo el supervisor directo del trabajador puede decidir esta etapa";
  }
  if (etapa === "rrhh") {
    if (usuario.rol !== "rrhh") return "Esta etapa la decide Recursos Humanos";
    const yaDecidio = db.prepare(
      "SELECT 1 FROM aprobaciones_solicitud WHERE id_solicitud = ? AND id_aprobador = ?"
    ).get(solicitud.id, usuario.id);
    return yaDecidio ? "Ya aprobó esta solicitud como supervisor; la etapa de RRHH debe decidirla otra persona" : null;
  }
  return usuario.rol === "gerencia" ? null : "Esta etapa la decide Gerencia";
}

// Condición SQL de las solicitudes que esperan una decisión del usuario (su bandeja)
function filtroBandeja(usuario) {
  const condiciones = ["(s.estado = 'pendiente_supervisor' AND t.id_supervisor = ?)"];
  const params = [usuario.id_trabajador];
  if (usuario.rol === "rrhh") {
    condiciones.push(`(s.estado = 'pendiente_rrhh' AND NOT EXISTS (
      SELECT 1 FROM aprobaciones_solicitud a WHERE a.id_solicitud = s.id AND a.id_aprobador = ?))`);
    params.push(usuario.id);
  }
  if (usuario.rol === "gerencia") condiciones.push("s.estado = 'pendiente_gerencia'");
  return { sql: ` AND s.id_trabajador <> ? AND (${condiciones.join(" OR ")})`, params: [usuario.id_trabajador, ...params] };
}

module.exports = {
  ESTADOS_PENDIENTES, ESTADOS_ACTIVOS, ETAPA_DE_ESTADO,
  diasHabilesEntre, saldoVacaciones, solicitudAprobadaEn, describirSolicitud, textoSolicitudAprobada, solicitudSuperpuesta,
  estadoInicial, motivoNoPuedeDecidir, filtroBandeja
};
