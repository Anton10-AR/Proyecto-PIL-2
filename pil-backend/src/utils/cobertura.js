// Cobertura de puestos críticos (documento, sección 7.3): cuántas personas ocupan cada puesto crítico en un
// día de operación de planta, cuántas están programadas, cuántas marcaron y si se alcanza la cobertura mínima.
// Es el punto donde RRHH (turnos, asistencia, solicitudes, capacitación) se conecta con el proceso.
const db = require("../db/database");
const { jornadaDelDia, feriadoDe } = require("./jornada");
const { solicitudAprobadaEn } = require("./solicitudes");
const { hoyLocal, diaSemana, sumarDias } = require("./fechas");
const { porcentaje } = require("./recepcion");

const DIAS_CAPACITACION_VIGENTE = 365;

// Días de la semana en que opera la planta (configuracion.dias_operacion_planta, ISO 1-7)
function diasOperacion() {
  const fila = db.prepare("SELECT valor FROM configuracion WHERE clave = 'dias_operacion_planta'").get();
  return (fila ? fila.valor : "1,2,3,4,5,6").split(",").map(Number);
}

function plantaOpera(fecha) {
  return diasOperacion().includes(diaSemana(fecha)) && !feriadoDe(fecha);
}

function puestosCriticos() {
  return db.prepare(`
    SELECT p.*, e.nombre AS etapa FROM puestos_proceso p JOIN etapas_proceso e ON e.id = p.id_etapa
    WHERE p.critico = 1 ORDER BY p.id_etapa, p.id
  `).all();
}

// Solicitud pendiente (aún no aprobada) que cubre la fecha: es un riesgo para la cobertura si se aprueba
function solicitudPendienteEn(idTrabajador, fecha) {
  return db.prepare(`
    SELECT id, tipo, estado FROM solicitudes
    WHERE id_trabajador = ? AND estado LIKE 'pendiente_%' AND fecha_inicio <= ? AND fecha_fin >= ?
  `).get(idTrabajador, fecha, fecha) || null;
}

function capacitacionVigente(idTrabajador, fecha) {
  return Boolean(db.prepare(`
    SELECT 1 FROM participantes_capacitacion pc JOIN capacitaciones c ON c.id = pc.id_capacitacion
    WHERE pc.id_trabajador = ? AND pc.resultado = 'aprobado' AND c.fecha_fin <= ? AND c.fecha_fin >= ?
  `).get(idTrabajador, fecha, sumarDias(fecha, -DIAS_CAPACITACION_VIGENTE)));
}

// Situación de una persona en un puesto crítico en una fecha
function situacionPersona(t, fecha, hoy) {
  const base = { id: t.id, nombre: `${t.nombre} ${t.apellido}`, capacitacion_vigente: capacitacionVigente(t.id, fecha) };
  const { turno, laborable } = jornadaDelDia(t.id, fecha);
  if (!laborable) return { ...base, situacion: "no_programado", turno: turno?.nombre || null };
  base.turno = turno.nombre;

  const solicitud = solicitudAprobadaEn(t.id, fecha);
  if (solicitud) return { ...base, situacion: solicitud.tipo === "vacacion" ? "vacacion" : "permiso" };

  if (fecha <= hoy) {
    if (db.prepare("SELECT 1 FROM asistencia WHERE id_trabajador = ? AND fecha = ?").get(t.id, fecha)) {
      return { ...base, situacion: "presente" };
    }
    if (db.prepare("SELECT 1 FROM ausencias WHERE id_trabajador = ? AND fecha = ?").get(t.id, fecha)) {
      return { ...base, situacion: "ausente" };
    }
    if (fecha < hoy) return { ...base, situacion: "sin_registro" };
  }
  // Hoy sin marcar todavía, o un día futuro: está programado; puede estar en riesgo por una solicitud pendiente
  return { ...base, situacion: solicitudPendienteEn(t.id, fecha) ? "en_riesgo" : "programado" };
}

// Estado del puesto en la fecha:
// - cubierto: llegan a la cobertura mínima los presentes (días pasados u hoy)
// - por_confirmar: hoy, aún falta que marquen los programados para alcanzarla
// - planificado: día futuro con suficientes programados
// - en_riesgo: se alcanza solo si no se aprueban solicitudes pendientes
// - descubierto: no se alcanza la cobertura mínima
function estadoPuesto(personas, minimo, fecha, hoy) {
  const contar = (...situaciones) => personas.filter((p) => situaciones.includes(p.situacion)).length;
  const presentes = contar("presente");
  if (fecha < hoy) return presentes >= minimo ? "cubierto" : "descubierto";
  if (presentes >= minimo) return "cubierto";
  const esperados = presentes + contar("programado");
  if (esperados >= minimo) return fecha === hoy ? "por_confirmar" : "planificado";
  if (esperados + contar("en_riesgo") >= minimo) return "en_riesgo";
  return "descubierto";
}

// Cobertura de todos los puestos críticos en una fecha
function coberturaDelDia(fecha) {
  const hoy = hoyLocal();
  const opera = plantaOpera(fecha);
  const puestos = puestosCriticos().map((p) => {
    const personas = db.prepare(`
      SELECT id, nombre, apellido FROM trabajadores WHERE id_puesto = ? AND estado = 'activo' ORDER BY apellido, nombre
    `).all(p.id).map((t) => situacionPersona(t, fecha, hoy));
    return {
      id: p.id,
      codigo: p.codigo,
      puesto: p.nombre,
      id_etapa: p.id_etapa,
      etapa: p.etapa,
      cobertura_minima: p.cobertura_minima,
      competencia_requerida: p.competencia_requerida,
      personas,
      presentes: personas.filter((x) => x.situacion === "presente").length,
      estado: opera ? estadoPuesto(personas, p.cobertura_minima, fecha, hoy) : "sin_operacion"
    };
  });
  return { fecha, opera, puestos };
}

// Indicadores de cobertura de un período (documento, sección 10.1):
// - Cobertura de puestos críticos = días-puesto cubiertos ÷ días-puesto requeridos × 100. Cuentan los días de
//   operación desde configuracion.inicio_registros hasta hoy; hoy solo cuenta si ya no está "por confirmar".
// - Capacitación vigente en puestos críticos = personas con una capacitación aprobada en los últimos 12 meses
//   ÷ personas activas en puestos críticos × 100.
function indicadoresCobertura(desde, hasta) {
  const hoy = hoyLocal();
  const inicio = db.prepare("SELECT valor FROM configuracion WHERE clave = 'inicio_registros'").get()?.valor || desde;
  const primerDia = desde > inicio ? desde : inicio;
  const ultimoDia = hasta < hoy ? hasta : hoy;

  let requeridos = 0;
  let cubiertos = 0;
  const descubiertos = [];
  for (let fecha = primerDia; fecha <= ultimoDia; fecha = sumarDias(fecha, 1)) {
    const dia = coberturaDelDia(fecha);
    if (!dia.opera) continue;
    dia.puestos.forEach((p) => {
      if (p.estado === "por_confirmar") return;
      requeridos++;
      if (p.estado === "cubierto") cubiertos++;
      else descubiertos.push({ fecha, puesto: p.puesto, etapa: p.etapa });
    });
  }

  const personas = db.prepare(`
    SELECT t.id FROM trabajadores t JOIN puestos_proceso p ON p.id = t.id_puesto
    WHERE p.critico = 1 AND t.estado = 'activo'
  `).all();
  const capacitadas = personas.filter((t) => capacitacionVigente(t.id, hoy)).length;

  return {
    desde: primerDia,
    hasta: ultimoDia,
    dias_puesto_requeridos: requeridos,
    dias_puesto_cubiertos: cubiertos,
    pct_cobertura: porcentaje(cubiertos, requeridos),
    descubiertos: descubiertos.reverse(),
    personas_puestos_criticos: personas.length,
    personas_capacitacion_vigente: capacitadas,
    pct_capacitacion_vigente: porcentaje(capacitadas, personas.length)
  };
}

// Días en que aprobar una solicitud dejaría un puesto crítico por debajo de su cobertura mínima.
// Se usa en la bandeja de aprobación para que supervisor, RRHH o Gerencia decidan sabiendo el impacto.
function impactoSolicitud(idSolicitud) {
  const s = db.prepare(`
    SELECT s.*, t.id_puesto, p.nombre AS puesto, p.critico, p.cobertura_minima
    FROM solicitudes s JOIN trabajadores t ON t.id = s.id_trabajador
    LEFT JOIN puestos_proceso p ON p.id = t.id_puesto
    WHERE s.id = ?
  `).get(idSolicitud);
  if (!s) return null;
  if (!s.critico) return { puesto: s.puesto || null, critico: false, dias: [] };

  const hoy = hoyLocal();
  const dias = [];
  for (let fecha = s.fecha_inicio; fecha <= s.fecha_fin; fecha = sumarDias(fecha, 1)) {
    if (fecha < hoy || !plantaOpera(fecha) || !jornadaDelDia(s.id_trabajador, fecha).laborable) continue;
    // Compañeros del mismo puesto que quedarían disponibles ese día (sin contar a quien pide la solicitud)
    const disponibles = db.prepare(`
      SELECT id, nombre, apellido FROM trabajadores WHERE id_puesto = ? AND estado = 'activo' AND id <> ?
    `).all(s.id_puesto, s.id_trabajador)
      .map((t) => situacionPersona(t, fecha, hoy))
      .filter((p) => ["presente", "programado"].includes(p.situacion));
    if (disponibles.length < s.cobertura_minima) {
      dias.push({ fecha, disponibles: disponibles.map((p) => p.nombre) });
    }
  }
  return { puesto: s.puesto, critico: true, cobertura_minima: s.cobertura_minima, dias };
}

module.exports = { diasOperacion, plantaOpera, coberturaDelDia, indicadoresCobertura, impactoSolicitud, capacitacionVigente };
