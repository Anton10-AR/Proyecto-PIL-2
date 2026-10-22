// Cálculo de los indicadores de RR.HH. (sección 14 del documento) para un rango de fechas,
// limitado a los trabajadores que el usuario puede ver y, opcionalmente, a un área.
//
// - Días programados = días laborables del turno - feriados - días con vacación o permiso aprobados.
//   El día de hoy solo cuenta si ya tiene marcación o ausencia (la jornada sigue en curso).
// - Tasa de asistencia = días asistidos / programados; ausentismo = ausencias registradas / programados.
//   Los días programados sin marcación ni ausencia se informan aparte como "sin registro".
// - Cumplimiento de capacitación = aprobados / inscritos (capacitaciones finalizadas en el rango).
// - Tiempo promedio de aprobación = de la solicitud a la resolución final, en horas, con desglose por etapa.
// - Evaluación promedio = puntaje de las evaluaciones completadas de los períodos que tocan el rango.
const db = require("../db/database");
const { idsVisibles } = require("./visibilidad");
const { hoyLocal, sumarDias } = require("./fechas");
const { jornadaDelDia } = require("./jornada");
const { solicitudAprobadaEn } = require("./solicitudes");
const { categoriaPuntaje } = require("./evaluacion");
const { porcentaje, promedio, horasEntre } = require("./estadistica");

// Trabajadores activos del alcance (visibilidad del usuario + área opcional)
function trabajadoresDelAlcance(usuario, area) {
  const ids = idsVisibles(usuario);
  let sql = "SELECT id, nombre, apellido, area, cargo FROM trabajadores WHERE estado = 'activo'";
  const params = [];
  if (ids) { sql += ` AND id IN (${ids.map(() => "?").join(",")})`; params.push(...ids); }
  if (area) { sql += " AND area = ?"; params.push(area); }
  return db.prepare(`${sql} ORDER BY apellido, nombre`).all(...params);
}

const enLista = (ids) => ids.map(() => "?").join(",") || "NULL";

function inicioRegistros() {
  return db.prepare("SELECT valor FROM configuracion WHERE clave = 'inicio_registros'").get()?.valor || null;
}

function indicadoresAsistencia(trabajadores, desdeSolicitado, hasta) {
  const hoy = hoyLocal();
  const fin = hasta < hoy ? hasta : hoy;
  // Los días anteriores al inicio de registros del sistema no se consideran programados
  const inicio = inicioRegistros();
  const desde = inicio && inicio > desdeSolicitado ? inicio : desdeSolicitado;
  const ids = trabajadores.map((t) => t.id);
  const marcaciones = new Map();
  db.prepare(`SELECT * FROM asistencia WHERE fecha BETWEEN ? AND ? AND id_trabajador IN (${enLista(ids)})`)
    .all(desde, fin, ...ids).forEach((m) => marcaciones.set(`${m.id_trabajador}|${m.fecha}`, m));
  const ausencias = new Map();
  db.prepare(`SELECT * FROM ausencias WHERE fecha BETWEEN ? AND ? AND id_trabajador IN (${enLista(ids)})`)
    .all(desde, fin, ...ids).forEach((a) => ausencias.set(`${a.id_trabajador}|${a.fecha}`, a));

  const serie = new Map();
  const porTrabajador = trabajadores.map((t) => ({
    id: t.id, trabajador: `${t.apellido}, ${t.nombre}`, area: t.area || "Sin área", cargo: t.cargo,
    programados: 0, asistidos: 0, ausencias: 0, justificadas: 0, sin_registro: 0, retrasos: 0, minutos_retraso: 0, horas: []
  }));

  for (let fecha = desde; fecha <= fin; fecha = sumarDias(fecha, 1)) {
    const dia = { fecha, programados: 0, asistidos: 0, ausencias: 0, sin_registro: 0 };
    porTrabajador.forEach((fila) => {
      const clave = `${fila.id}|${fecha}`;
      const marcacion = marcaciones.get(clave);
      const ausencia = ausencias.get(clave);
      if (!jornadaDelDia(fila.id, fecha).laborable || solicitudAprobadaEn(fila.id, fecha)) return;
      if (fecha === hoy && !marcacion && !ausencia) return;

      fila.programados++; dia.programados++;
      if (marcacion) {
        fila.asistidos++; dia.asistidos++;
        if (marcacion.minutos_retraso > 0) { fila.retrasos++; fila.minutos_retraso += marcacion.minutos_retraso; }
        if (marcacion.horas_trabajadas) fila.horas.push(marcacion.horas_trabajadas);
      } else if (ausencia) {
        fila.ausencias++; dia.ausencias++;
        if (ausencia.justificada) fila.justificadas++;
      } else {
        fila.sin_registro++; dia.sin_registro++;
      }
    });
    serie.set(fecha, dia);
  }

  const sumar = (filas, campo) => filas.reduce((t, f) => t + f[campo], 0);
  const resumir = (filas) => ({
    programados: sumar(filas, "programados"),
    asistidos: sumar(filas, "asistidos"),
    ausencias: sumar(filas, "ausencias"),
    justificadas: sumar(filas, "justificadas"),
    sin_registro: sumar(filas, "sin_registro"),
    retrasos: sumar(filas, "retrasos"),
    tasa_asistencia: porcentaje(sumar(filas, "asistidos"), sumar(filas, "programados")),
    tasa_ausentismo: porcentaje(sumar(filas, "ausencias"), sumar(filas, "programados")),
    tasa_puntualidad: porcentaje(sumar(filas, "asistidos") - sumar(filas, "retrasos"), sumar(filas, "asistidos")),
    horas_promedio: promedio(filas.flatMap((f) => f.horas))
  });

  const areas = [...new Set(porTrabajador.map((f) => f.area))].sort((a, b) => a.localeCompare(b, "es"));
  return {
    desde_efectivo: desde <= fin ? desde : null,
    resumen: resumir(porTrabajador),
    serie_diaria: [...serie.values()],
    por_area: areas.map((area) => {
      const filas = porTrabajador.filter((f) => f.area === area);
      return { area, trabajadores: filas.length, ...resumir(filas) };
    }),
    por_trabajador: porTrabajador.map(({ horas, ...f }) => ({
      ...f,
      horas_promedio: promedio(horas),
      tasa_asistencia: porcentaje(f.asistidos, f.programados),
      tasa_ausentismo: porcentaje(f.ausencias, f.programados)
    }))
  };
}

function indicadoresSolicitudes(ids, desde, hasta) {
  const solicitudes = db.prepare(`
    SELECT s.*, t.nombre, t.apellido, t.area, tp.nombre AS tipo_permiso
    FROM solicitudes s JOIN trabajadores t ON t.id = s.id_trabajador
    LEFT JOIN tipos_permiso tp ON tp.id = s.id_tipo_permiso
    WHERE date(s.fecha_solicitud) BETWEEN ? AND ? AND s.id_trabajador IN (${enLista(ids)})
    ORDER BY s.fecha_solicitud
  `).all(desde, hasta, ...ids);

  const decisiones = {};
  if (solicitudes.length) {
    db.prepare(`SELECT * FROM aprobaciones_solicitud WHERE id_solicitud IN (${enLista(solicitudes.map((s) => s.id))})`)
      .all(...solicitudes.map((s) => s.id))
      .forEach((a) => { (decisiones[a.id_solicitud] ||= {})[a.etapa] = a.fecha; });
  }

  const etapas = { supervisor: [], rrhh: [], gerencia: [] };
  const totales = [];
  const filas = solicitudes.map((s) => {
    const d = decisiones[s.id] || {};
    if (d.supervisor) etapas.supervisor.push(horasEntre(s.fecha_solicitud, d.supervisor));
    if (d.rrhh && d.supervisor) etapas.rrhh.push(horasEntre(d.supervisor, d.rrhh));
    if (d.gerencia) etapas.gerencia.push(horasEntre(s.fecha_solicitud, d.gerencia));
    const horas = s.fecha_resolucion ? horasEntre(s.fecha_solicitud, s.fecha_resolucion) : null;
    if (horas !== null) totales.push(horas);
    return {
      id: s.id, trabajador: `${s.apellido}, ${s.nombre}`, area: s.area, tipo: s.tipo === "vacacion" ? "Vacación" : `Permiso: ${s.tipo_permiso}`,
      fecha_inicio: s.fecha_inicio, fecha_fin: s.fecha_fin, dias_habiles: s.dias_habiles, estado: s.estado,
      fecha_solicitud: s.fecha_solicitud, fecha_resolucion: s.fecha_resolucion, horas_resolucion: horas
    };
  });

  const porEstado = { pendiente: 0, aprobado: 0, rechazado: 0, cancelado: 0 };
  solicitudes.forEach((s) => { porEstado[s.estado.startsWith("pendiente") ? "pendiente" : s.estado]++; });
  return {
    total: solicitudes.length,
    por_estado: porEstado,
    dias_aprobados: solicitudes.filter((s) => s.estado === "aprobado").reduce((t, s) => t + s.dias_habiles, 0),
    tiempo_promedio_horas: promedio(totales, 1),
    tiempo_por_etapa: {
      supervisor: promedio(etapas.supervisor, 1), rrhh: promedio(etapas.rrhh, 1), gerencia: promedio(etapas.gerencia, 1)
    },
    filas
  };
}

function indicadoresCapacitacion(ids, desde, hasta) {
  const filas = db.prepare(`
    SELECT c.id AS id_capacitacion, c.titulo, c.fecha_inicio, c.fecha_fin, c.horas, t.nombre, t.apellido, t.area,
           p.asistencia_pct, p.nota, p.resultado
    FROM participantes_capacitacion p
    JOIN capacitaciones c ON c.id = p.id_capacitacion
    JOIN trabajadores t ON t.id = p.id_trabajador
    WHERE c.estado = 'finalizada' AND c.fecha_fin BETWEEN ? AND ? AND p.estado_inscripcion = 'inscrito'
      AND p.id_trabajador IN (${enLista(ids)})
    ORDER BY c.fecha_inicio, t.apellido
  `).all(desde, hasta, ...ids);

  const porCapacitacion = {};
  filas.forEach((f) => {
    const c = (porCapacitacion[f.id_capacitacion] ||= { titulo: f.titulo, fecha_fin: f.fecha_fin, horas: f.horas, inscritos: 0, aprobados: 0 });
    c.inscritos++;
    if (f.resultado === "aprobado") c.aprobados++;
  });
  const aprobados = filas.filter((f) => f.resultado === "aprobado");
  return {
    inscritos: filas.length,
    aprobados: aprobados.length,
    cumplimiento: porcentaje(aprobados.length, filas.length),
    horas_acreditadas: aprobados.reduce((t, f) => t + f.horas, 0),
    por_capacitacion: Object.values(porCapacitacion).map((c) => ({ ...c, cumplimiento: porcentaje(c.aprobados, c.inscritos) })),
    filas: filas.map((f) => ({
      capacitacion: f.titulo, fecha_fin: f.fecha_fin, horas: f.horas, trabajador: `${f.apellido}, ${f.nombre}`, area: f.area,
      asistencia_pct: f.asistencia_pct, nota: f.nota, resultado: f.resultado
    }))
  };
}

function indicadoresEvaluacion(ids, desde, hasta) {
  const filas = db.prepare(`
    SELECT e.puntaje_final, e.fecha_lectura, pe.nombre AS periodo, t.nombre, t.apellido, t.area,
           ev.nombre || ' ' || ev.apellido AS evaluador
    FROM evaluaciones e
    JOIN periodos_evaluacion pe ON pe.id = e.id_periodo
    JOIN trabajadores t ON t.id = e.id_trabajador
    LEFT JOIN usuarios u ON u.id = e.id_evaluador LEFT JOIN trabajadores ev ON ev.id = u.id_trabajador
    WHERE e.estado = 'completada' AND pe.fecha_inicio <= ? AND pe.fecha_fin >= ? AND e.id_trabajador IN (${enLista(ids)})
    ORDER BY pe.fecha_inicio, t.apellido
  `).all(hasta, desde, ...ids);

  const categorias = ["Sobresaliente", "Bueno", "Aceptable", "Necesita mejorar"];
  const areas = [...new Set(filas.map((f) => f.area || "Sin área"))].sort((a, b) => a.localeCompare(b, "es"));
  return {
    completadas: filas.length,
    promedio: promedio(filas.map((f) => f.puntaje_final)),
    leidas: porcentaje(filas.filter((f) => f.fecha_lectura).length, filas.length),
    por_categoria: categorias.map((c) => ({ categoria: c, cantidad: filas.filter((f) => categoriaPuntaje(f.puntaje_final) === c).length })),
    por_area: areas.map((area) => ({ area, promedio: promedio(filas.filter((f) => (f.area || "Sin área") === area).map((f) => f.puntaje_final)) })),
    filas: filas.map((f) => ({
      periodo: f.periodo, trabajador: `${f.apellido}, ${f.nombre}`, area: f.area, evaluador: f.evaluador,
      puntaje: f.puntaje_final, categoria: categoriaPuntaje(f.puntaje_final), leida: f.fecha_lectura ? "Sí" : "No"
    }))
  };
}

function calcularIndicadores(usuario, { desde, hasta, area }) {
  const trabajadores = trabajadoresDelAlcance(usuario, area);
  const ids = trabajadores.map((t) => t.id);
  return {
    filtros: { desde, hasta, area: area || null },
    alcance: usuario.rol === "trabajador" ? "propio" : usuario.rol === "supervisor" ? "equipo" : "empresa",
    personal: {
      activos: trabajadores.length,
      por_area: Object.entries(trabajadores.reduce((m, t) => { m[t.area || "Sin área"] = (m[t.area || "Sin área"] || 0) + 1; return m; }, {}))
        .map(([nombre, cantidad]) => ({ area: nombre, cantidad })).sort((a, b) => a.area.localeCompare(b.area, "es")),
      filas: trabajadores.map((t) => ({ trabajador: `${t.apellido}, ${t.nombre}`, area: t.area, cargo: t.cargo }))
    },
    asistencia: indicadoresAsistencia(trabajadores, desde, hasta),
    solicitudes: indicadoresSolicitudes(ids, desde, hasta),
    capacitacion: indicadoresCapacitacion(ids, desde, hasta),
    evaluacion: indicadoresEvaluacion(ids, desde, hasta)
  };
}

module.exports = { calcularIndicadores };
