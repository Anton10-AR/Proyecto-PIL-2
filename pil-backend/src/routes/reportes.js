// Rutas de Reportes e indicadores (vista agregada, sin tabla propia).
// - GET /indicadores: todos los roles, con el alcance de su visibilidad (empresa, equipo o propio).
// - GET /exportar/:tipo: RRHH y Gerencia exportan a CSV, Excel o PDF.
const express = require("express");
const { permitirRoles } = require("../middleware/auth");
const { esFecha, hoyLocal, rangoDelMes } = require("../utils/fechas");
const { calcularIndicadores } = require("../utils/indicadores");
const { aCSV } = require("../utils/estadistica");
const { generarExcel, generarPDF } = require("../utils/exportar");

const router = express.Router();

const MAX_DIAS = 366;
const ESTADOS = {
  pendiente_supervisor: "Pendiente del supervisor", pendiente_rrhh: "Pendiente de RRHH", pendiente_gerencia: "Pendiente de Gerencia",
  aprobado: "Aprobada", rechazado: "Rechazada", cancelado: "Cancelada"
};
const RESULTADOS = { aprobado: "Aprobado", reprobado: "Reprobado", no_asistio: "No asistió" };

// Filtros comunes: por defecto, el mes en curso
function leerFiltros(query) {
  const mes = rangoDelMes(hoyLocal().slice(0, 7));
  const desde = query.desde || mes.desde;
  const hasta = query.hasta || mes.hasta;
  if (!esFecha(desde) || !esFecha(hasta)) return { error: "desde y hasta deben tener formato YYYY-MM-DD" };
  if (hasta < desde) return { error: "La fecha final no puede ser anterior a la inicial" };
  const dias = (new Date(hasta) - new Date(desde)) / 86400000;
  if (dias > MAX_DIAS) return { error: `El rango no puede superar ${MAX_DIAS} días` };
  return { desde, hasta, area: query.area || null };
}

const formatoPct = (v) => (v === null || v === undefined ? "—" : `${v}%`);

// Reportes tabulares exportables a partir de los indicadores
function reportesDe(ind) {
  const a = ind.asistencia;
  return {
    asistencia: {
      titulo: "Asistencia por trabajador", hoja: "Asistencia",
      columnas: [
        { clave: "trabajador", titulo: "Trabajador", ancho: 24 }, { clave: "area", titulo: "Área", ancho: 16 },
        { clave: "programados", titulo: "Días programados", ancho: 11 }, { clave: "asistidos", titulo: "Asistidos", ancho: 10 },
        { clave: "ausencias", titulo: "Ausencias", ancho: 10 }, { clave: "justificadas", titulo: "Justificadas", ancho: 11 },
        { clave: "sin_registro", titulo: "Sin registro", ancho: 10 }, { clave: "retrasos", titulo: "Retrasos", ancho: 9 },
        { clave: "minutos_retraso", titulo: "Min. de retraso", ancho: 10 }, { clave: "horas_promedio", titulo: "Horas promedio", ancho: 10 },
        { clave: "tasa_asistencia", titulo: "Asistencia %", ancho: 10 }, { clave: "tasa_ausentismo", titulo: "Ausentismo %", ancho: 10 }
      ],
      filas: a.por_trabajador
    },
    areas: {
      titulo: "Asistencia por área", hoja: "Por área",
      columnas: [
        { clave: "area", titulo: "Área", ancho: 20 }, { clave: "trabajadores", titulo: "Trabajadores", ancho: 11 },
        { clave: "programados", titulo: "Días programados", ancho: 12 }, { clave: "asistidos", titulo: "Asistidos", ancho: 10 },
        { clave: "ausencias", titulo: "Ausencias", ancho: 10 }, { clave: "retrasos", titulo: "Retrasos", ancho: 10 },
        { clave: "tasa_asistencia", titulo: "Asistencia %", ancho: 11 }, { clave: "tasa_ausentismo", titulo: "Ausentismo %", ancho: 11 }
      ],
      filas: a.por_area
    },
    solicitudes: {
      titulo: "Solicitudes de permisos y vacaciones", hoja: "Solicitudes",
      columnas: [
        { clave: "trabajador", titulo: "Trabajador", ancho: 22 }, { clave: "area", titulo: "Área", ancho: 14 },
        { clave: "tipo", titulo: "Tipo", ancho: 18 }, { clave: "fecha_inicio", titulo: "Desde", ancho: 11 }, { clave: "fecha_fin", titulo: "Hasta", ancho: 11 },
        { clave: "dias_habiles", titulo: "Días hábiles", ancho: 9 }, { clave: "estado_texto", titulo: "Estado", ancho: 18 },
        { clave: "fecha_solicitud", titulo: "Solicitada", ancho: 17 }, { clave: "horas_resolucion", titulo: "Horas hasta resolver", ancho: 11 }
      ],
      filas: ind.solicitudes.filas.map((f) => ({ ...f, estado_texto: ESTADOS[f.estado] }))
    },
    capacitacion: {
      titulo: "Resultados de capacitación", hoja: "Capacitación",
      columnas: [
        { clave: "capacitacion", titulo: "Capacitación", ancho: 28 }, { clave: "fecha_fin", titulo: "Finalizó", ancho: 11 },
        { clave: "horas", titulo: "Horas", ancho: 7 }, { clave: "trabajador", titulo: "Trabajador", ancho: 22 }, { clave: "area", titulo: "Área", ancho: 14 },
        { clave: "asistencia_pct", titulo: "Asistencia %", ancho: 10 }, { clave: "nota", titulo: "Nota", ancho: 7 }, { clave: "resultado_texto", titulo: "Resultado", ancho: 12 }
      ],
      filas: ind.capacitacion.filas.map((f) => ({ ...f, resultado_texto: RESULTADOS[f.resultado] || "Pendiente" }))
    },
    evaluaciones: {
      titulo: "Evaluaciones del desempeño", hoja: "Evaluaciones",
      columnas: [
        { clave: "periodo", titulo: "Período", ancho: 12 }, { clave: "trabajador", titulo: "Trabajador", ancho: 22 }, { clave: "area", titulo: "Área", ancho: 14 },
        { clave: "evaluador", titulo: "Evaluador", ancho: 20 }, { clave: "puntaje", titulo: "Puntaje (1-5)", ancho: 10 },
        { clave: "categoria", titulo: "Categoría", ancho: 16 }, { clave: "leida", titulo: "Leída", ancho: 7 }
      ],
      filas: ind.evaluacion.filas
    },
    personal: {
      titulo: "Personal activo", hoja: "Personal",
      columnas: [{ clave: "trabajador", titulo: "Trabajador", ancho: 26 }, { clave: "area", titulo: "Área", ancho: 18 }, { clave: "cargo", titulo: "Cargo", ancho: 24 }],
      filas: ind.personal.filas
    }
  };
}

function lineasResumen(ind) {
  const a = ind.asistencia.resumen;
  const s = ind.solicitudes;
  const c = ind.capacitacion;
  const e = ind.evaluacion;
  return [
    `Personal activo: ${ind.personal.activos}`,
    `Tasa de asistencia: ${formatoPct(a.tasa_asistencia)} (${a.asistidos} de ${a.programados} días programados)`,
    `Tasa de ausentismo: ${formatoPct(a.tasa_ausentismo)} (${a.ausencias} ausencias, ${a.justificadas} justificadas; ${a.sin_registro} días sin registro)`,
    `Retrasos: ${a.retrasos} · Puntualidad: ${formatoPct(a.tasa_puntualidad)} · Horas promedio por jornada: ${a.horas_promedio ?? "—"}`,
    `Cumplimiento de capacitación: ${formatoPct(c.cumplimiento)} (${c.aprobados} aprobados de ${c.inscritos} inscritos; ${c.horas_acreditadas} horas acreditadas)`,
    `Tiempo promedio de aprobación de solicitudes: ${s.tiempo_promedio_horas ?? "—"} h (supervisor ${s.tiempo_por_etapa.supervisor ?? "—"} h · RRHH ${s.tiempo_por_etapa.rrhh ?? "—"} h · Gerencia ${s.tiempo_por_etapa.gerencia ?? "—"} h)`,
    `Evaluación promedio: ${e.promedio ?? "—"} / 5 (${e.completadas} evaluaciones completadas)`
  ];
}

// GET /api/reportes/indicadores?desde=2026-10-01&hasta=2026-10-31&area=Producción
router.get("/indicadores", (req, res) => {
  const filtros = leerFiltros(req.query);
  if (filtros.error) return res.status(400).json({ error: filtros.error });
  res.json(calcularIndicadores(req.usuario, filtros));
});

// Exportar un reporte. tipo: asistencia | areas | solicitudes | capacitacion | evaluaciones | personal | informe
// formato: csv | xlsx | pdf (el "informe" reúne indicadores y tablas; admite xlsx y pdf)
// GET /api/reportes/exportar/asistencia?formato=xlsx&desde=...&hasta=...&area=...
router.get("/exportar/:tipo", permitirRoles("rrhh", "gerencia"), async (req, res) => {
  const filtros = leerFiltros(req.query);
  if (filtros.error) return res.status(400).json({ error: filtros.error });
  const { tipo } = req.params;
  const formato = req.query.formato || "xlsx";
  if (!["csv", "xlsx", "pdf"].includes(formato)) return res.status(400).json({ error: "formato debe ser csv, xlsx o pdf" });

  const ind = calcularIndicadores(req.usuario, filtros);
  const reportes = reportesDe(ind);
  const subtitulo = `Período ${filtros.desde} al ${filtros.hasta}${filtros.area ? ` · Área: ${filtros.area}` : " · Toda la empresa"} · Generado el ${new Date().toLocaleString("es-BO")}`;
  const nombreBase = `${tipo}_${filtros.desde}_${filtros.hasta}${filtros.area ? `_${filtros.area}` : ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_");

  let contenido;
  let mime;
  if (tipo === "informe") {
    if (formato === "csv") return res.status(400).json({ error: "El informe completo se exporta en Excel o PDF" });
    const tablas = ["areas", "asistencia", "solicitudes", "capacitacion", "evaluaciones"].map((t) => reportes[t]);
    if (formato === "xlsx") {
      const resumen = { titulo: "Indicadores de RR.HH.", hoja: "Indicadores", columnas: [{ clave: "linea", titulo: "Indicador", ancho: 110 }], filas: lineasResumen(ind).map((linea) => ({ linea })) };
      contenido = await generarExcel([resumen, ...tablas], subtitulo);
    } else {
      contenido = await generarPDF("Informe de Recursos Humanos — PIL Andina", subtitulo, [
        { titulo: "Indicadores", texto: lineasResumen(ind) },
        ...tablas.map((t) => ({ titulo: t.titulo, tabla: t }))
      ]);
    }
  } else {
    const reporte = reportes[tipo];
    if (!reporte) return res.status(404).json({ error: "Tipo de reporte desconocido" });
    if (formato === "csv") contenido = Buffer.from(aCSV(reporte.columnas, reporte.filas), "utf8");
    else if (formato === "xlsx") contenido = await generarExcel([reporte], subtitulo);
    else contenido = await generarPDF(`${reporte.titulo} — PIL Andina`, subtitulo, [{ titulo: reporte.titulo, tabla: reporte }]);
  }

  mime = { csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" }[formato];
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `attachment; filename="${nombreBase}.${formato}"`);
  res.send(contenido);
});

module.exports = router;
