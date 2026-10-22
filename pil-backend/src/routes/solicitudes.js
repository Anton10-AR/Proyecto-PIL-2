// Rutas del módulo Solicitudes (permisos y vacaciones): creación por el propio trabajador, flujo de
// aprobación (supervisor -> RRHH, o Gerencia en un paso), cancelación, saldo de vacaciones y calendario.
// Las reglas compartidas están en utils/solicitudes.js.
const express = require("express");
const db = require("../db/database");
const { filtroVisibilidad, puedeVerTrabajador } = require("../utils/visibilidad");
const { hoyLocal, sumarDias, esFecha, esMes, rangoDelMes } = require("../utils/fechas");
const { notificarTrabajador, notificarRol, notificarUsuario } = require("../utils/notificar");
const { errorArchivoParaAsociar } = require("./archivos");
const {
  ESTADOS_PENDIENTES, ESTADOS_ACTIVOS, ETAPA_DE_ESTADO,
  diasHabilesEntre, saldoVacaciones, describirSolicitud, solicitudSuperpuesta,
  estadoInicial, motivoNoPuedeDecidir, filtroBandeja
} = require("../utils/solicitudes");

const router = express.Router();

const MAX_DIAS_CALENDARIO = 120;     // rango máximo de una solicitud
const MAX_DIAS_RETROACTIVO = 30;     // un permiso puede pedirse hasta 30 días después de ocurrido

const SELECT_SOLICITUD = `
  SELECT s.*, t.nombre, t.apellido, t.area, t.id_supervisor,
         tp.nombre AS tipo_permiso, tp.con_goce, ar.nombre_original AS archivo_nombre
  FROM solicitudes s
  JOIN trabajadores t ON t.id = s.id_trabajador
  LEFT JOIN tipos_permiso tp ON tp.id = s.id_tipo_permiso
  LEFT JOIN archivos ar ON ar.id = s.id_archivo_respaldo
`;

function obtenerSolicitud(id) {
  return db.prepare(`${SELECT_SOLICITUD} WHERE s.id = ?`).get(id);
}

class ErrorValidacion extends Error {
  constructor(mensaje, estado = 400) { super(mensaje); this.estado = estado; }
}

// Valida una solicitud nueva del trabajador y calcula sus días hábiles.
// Con { vistaPrevia: true } no exige el archivo de respaldo (sirve para mostrar el cálculo en el formulario).
function validarNueva(idTrabajador, cuerpo, { vistaPrevia = false } = {}) {
  const { tipo, fecha_inicio, fecha_fin } = cuerpo;
  const hoy = hoyLocal();

  if (!["permiso", "vacacion"].includes(tipo)) throw new ErrorValidacion("tipo debe ser 'permiso' o 'vacacion'");
  if (!esFecha(fecha_inicio) || !esFecha(fecha_fin)) throw new ErrorValidacion("fecha_inicio y fecha_fin deben tener formato YYYY-MM-DD");
  if (fecha_fin < fecha_inicio) throw new ErrorValidacion("La fecha de fin no puede ser anterior a la de inicio");
  if (fecha_fin > sumarDias(fecha_inicio, MAX_DIAS_CALENDARIO - 1)) {
    throw new ErrorValidacion(`Una solicitud no puede abarcar más de ${MAX_DIAS_CALENDARIO} días corridos`);
  }
  if (tipo === "vacacion" && fecha_inicio < hoy) throw new ErrorValidacion("Las vacaciones no pueden empezar en una fecha pasada");
  if (tipo === "permiso" && fecha_inicio < sumarDias(hoy, -MAX_DIAS_RETROACTIVO)) {
    throw new ErrorValidacion(`Un permiso puede solicitarse hasta ${MAX_DIAS_RETROACTIVO} días después de ocurrido`);
  }

  const dias = diasHabilesEntre(idTrabajador, fecha_inicio, fecha_fin);
  if (dias === 0) throw new ErrorValidacion("El rango no incluye días laborables de su turno (o no tiene turno asignado)");

  const superpuesta = solicitudSuperpuesta(idTrabajador, fecha_inicio, fecha_fin);
  if (superpuesta) {
    throw new ErrorValidacion(`Se superpone con otra solicitud ${superpuesta.estado === "aprobado" ? "aprobada" : "pendiente"} (${superpuesta.fecha_inicio} al ${superpuesta.fecha_fin})`, 409);
  }
  const marcacion = db.prepare(
    "SELECT fecha FROM asistencia WHERE id_trabajador = ? AND fecha BETWEEN ? AND ? ORDER BY fecha LIMIT 1"
  ).get(idTrabajador, fecha_inicio, fecha_fin);
  if (marcacion) throw new ErrorValidacion(`Ya tiene asistencia registrada el ${marcacion.fecha}`, 409);
  const ausencia = db.prepare(
    "SELECT fecha FROM ausencias WHERE id_trabajador = ? AND fecha BETWEEN ? AND ? ORDER BY fecha LIMIT 1"
  ).get(idTrabajador, fecha_inicio, fecha_fin);
  if (ausencia) {
    throw new ErrorValidacion(`RRHH registró una ausencia el ${ausencia.fecha}; si corresponde, pida a RRHH que la justifique`, 409);
  }

  const datos = { tipo, fecha_inicio, fecha_fin, dias_habiles: dias, id_tipo_permiso: null, gestion_inicio: null };

  if (tipo === "permiso") {
    const tipoPermiso = db.prepare("SELECT * FROM tipos_permiso WHERE id = ? AND activo = 1").get(cuerpo.id_tipo_permiso);
    if (!tipoPermiso) throw new ErrorValidacion("Seleccione un tipo de permiso válido");
    if (dias > tipoPermiso.dias_max_solicitud) {
      throw new ErrorValidacion(`El permiso "${tipoPermiso.nombre}" admite hasta ${tipoPermiso.dias_max_solicitud} día(s) hábil(es) por solicitud; pidió ${dias}`);
    }
    if (tipoPermiso.limite_anual_dias) {
      const anio = fecha_inicio.slice(0, 4);
      const { usados } = db.prepare(`
        SELECT COALESCE(SUM(dias_habiles), 0) AS usados FROM solicitudes
        WHERE id_trabajador = ? AND id_tipo_permiso = ? AND fecha_inicio LIKE ?
          AND estado IN (${ESTADOS_ACTIVOS.map((e) => `'${e}'`).join(", ")})
      `).get(idTrabajador, tipoPermiso.id, `${anio}-%`);
      if (usados + dias > tipoPermiso.limite_anual_dias) {
        throw new ErrorValidacion(`Supera el límite anual de "${tipoPermiso.nombre}": ${tipoPermiso.limite_anual_dias} día(s) en ${anio}, ya tiene ${usados} usado(s) o pendiente(s)`);
      }
    }
    if (!vistaPrevia && tipoPermiso.requiere_respaldo && !cuerpo.id_archivo_respaldo) {
      throw new ErrorValidacion(`El permiso "${tipoPermiso.nombre}" requiere adjuntar un documento de respaldo`);
    }
    datos.id_tipo_permiso = tipoPermiso.id;
  } else {
    const saldo = saldoVacaciones(idTrabajador, hoy);
    if (!saldo.fecha_ingreso) throw new ErrorValidacion("No tiene fecha de ingreso registrada; consulte con RRHH");
    if (saldo.dias === 0) throw new ErrorValidacion("Aún no cumple un año de servicio, por lo que no tiene vacaciones disponibles");
    if (dias > saldo.disponibles) {
      throw new ErrorValidacion(`Pidió ${dias} día(s) hábil(es) y tiene ${saldo.disponibles} disponible(s) en la gestión ${saldo.gestion_inicio} a ${saldo.gestion_fin}`);
    }
    datos.gestion_inicio = saldo.gestion_inicio;
  }
  return datos;
}

// Avisa a quienes deben decidir la etapa actual de la solicitud
function notificarAprobadores(solicitud) {
  const texto = `${solicitud.nombre} ${solicitud.apellido} solicita ${describirSolicitud(solicitud)} del ${solicitud.fecha_inicio} al ${solicitud.fecha_fin} (${solicitud.dias_habiles} día(s) hábil(es))`;
  const solicitante = db.prepare("SELECT id FROM usuarios WHERE id_trabajador = ?").get(solicitud.id_trabajador);
  const enlace = "/solicitudes/bandeja";
  if (solicitud.estado === "pendiente_supervisor") notificarTrabajador(solicitud.id_supervisor, "solicitud", texto, enlace);
  if (solicitud.estado === "pendiente_rrhh") notificarRol("rrhh", "solicitud", `${texto}. Aprobada por su supervisor.`, enlace, solicitante?.id);
  if (solicitud.estado === "pendiente_gerencia") notificarRol("gerencia", "solicitud", texto, enlace, solicitante?.id);
}

// Listado según el alcance:
//   mias    -> las del usuario
//   bandeja -> las que esperan una decisión del usuario
//   todas   -> las de los trabajadores visibles (supervisor: su equipo; RRHH y Gerencia: todos)
// GET /api/solicitudes?alcance=mias&estado=pendiente&tipo=vacacion&trabajador=3&anio=2026
router.get("/", (req, res) => {
  const { alcance = "mias", estado, tipo, trabajador, anio } = req.query;
  let sql = `${SELECT_SOLICITUD} WHERE 1=1`;
  let params = [];

  if (alcance === "mias") {
    sql += " AND s.id_trabajador = ?";
    params.push(req.usuario.id_trabajador);
  } else if (alcance === "bandeja") {
    const bandeja = filtroBandeja(req.usuario);
    sql += bandeja.sql;
    params = params.concat(bandeja.params);
  } else if (alcance === "todas") {
    const visibilidad = filtroVisibilidad(req.usuario, "s.id_trabajador");
    sql += visibilidad.sql;
    params = params.concat(visibilidad.params);
  } else {
    return res.status(400).json({ error: "alcance debe ser 'mias', 'bandeja' o 'todas'" });
  }

  if (estado === "pendiente") sql += ` AND s.estado IN (${ESTADOS_PENDIENTES.map((e) => `'${e}'`).join(", ")})`;
  else if (estado) { sql += " AND s.estado = ?"; params.push(estado); }
  if (tipo) { sql += " AND s.tipo = ?"; params.push(tipo); }
  if (trabajador) { sql += " AND s.id_trabajador = ?"; params.push(trabajador); }
  if (anio) { sql += " AND s.fecha_inicio LIKE ?"; params.push(`${anio}-%`); }
  sql += alcance === "bandeja" ? " ORDER BY s.fecha_solicitud" : " ORDER BY s.fecha_solicitud DESC";

  res.json(db.prepare(sql).all(...params));
});

// Saldo de vacaciones de la gestión vigente (propio por defecto)
// GET /api/solicitudes/saldo?trabajador=3
router.get("/saldo", (req, res) => {
  const idTrabajador = Number(req.query.trabajador || req.usuario.id_trabajador);
  if (!puedeVerTrabajador(req.usuario, idTrabajador)) {
    return res.status(403).json({ error: "No tiene permiso para ver a este trabajador" });
  }
  res.json(saldoVacaciones(idTrabajador));
});

// Vista previa de una solicitud propia: días hábiles y, si no es válida, el motivo
// GET /api/solicitudes/calcular?tipo=permiso&id_tipo_permiso=1&fecha_inicio=...&fecha_fin=...
router.get("/calcular", (req, res) => {
  try {
    const datos = validarNueva(req.usuario.id_trabajador, req.query, { vistaPrevia: true });
    res.json({ valida: true, dias_habiles: datos.dias_habiles });
  } catch (err) {
    if (!(err instanceof ErrorValidacion)) throw err;
    res.json({ valida: false, error: err.message });
  }
});

// Permisos y vacaciones aprobados que tocan un mes, de los trabajadores visibles
// GET /api/solicitudes/calendario?mes=2026-10&area=Producción
router.get("/calendario", (req, res) => {
  const { mes, area } = req.query;
  if (!esMes(mes)) return res.status(400).json({ error: "mes debe tener formato YYYY-MM" });
  const { desde, hasta } = rangoDelMes(mes);
  const visibilidad = filtroVisibilidad(req.usuario, "s.id_trabajador");

  let sql = `${SELECT_SOLICITUD} WHERE s.estado = 'aprobado' AND s.fecha_inicio <= ? AND s.fecha_fin >= ?${visibilidad.sql}`;
  const params = [hasta, desde, ...visibilidad.params];
  if (area) { sql += " AND t.area = ?"; params.push(area); }
  sql += " ORDER BY s.fecha_inicio, t.apellido";
  res.json(db.prepare(sql).all(...params));
});

// Detalle con historial de decisiones y lo que el usuario puede hacer con ella
// GET /api/solicitudes/:id
router.get("/:id", (req, res) => {
  const solicitud = obtenerSolicitud(req.params.id);
  if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
  const puedeDecidir = motivoNoPuedeDecidir(req.usuario, solicitud) === null;
  if (!puedeVerTrabajador(req.usuario, solicitud.id_trabajador) && !puedeDecidir) {
    return res.status(403).json({ error: "No tiene permiso para ver esta solicitud" });
  }

  const aprobaciones = db.prepare(`
    SELECT a.*, t.nombre || ' ' || t.apellido AS aprobador
    FROM aprobaciones_solicitud a
    JOIN usuarios u ON u.id = a.id_aprobador JOIN trabajadores t ON t.id = u.id_trabajador
    WHERE a.id_solicitud = ? ORDER BY a.fecha, a.id
  `).all(solicitud.id);

  // Etapas que recorre (o habría recorrido) la solicitud, para mostrar su avance
  const decidida = (etapa) => aprobaciones.some((a) => a.etapa === etapa);
  let porGerencia = solicitud.estado === "pendiente_gerencia" || decidida("gerencia");
  if (!porGerencia && !decidida("supervisor") && !["pendiente_supervisor", "pendiente_rrhh"].includes(solicitud.estado)) {
    porGerencia = estadoInicial(solicitud.id_trabajador) === "pendiente_gerencia";
  }

  res.json({
    ...solicitud,
    etapas: porGerencia ? ["gerencia"] : ["supervisor", "rrhh"],
    aprobaciones,
    puede_decidir: puedeDecidir,
    puede_cancelar: solicitud.id_trabajador === req.usuario.id_trabajador && ESTADOS_PENDIENTES.includes(solicitud.estado),
    saldo: solicitud.tipo === "vacacion" ? saldoVacaciones(solicitud.id_trabajador) : null
  });
});

// Crear una solicitud propia
// POST /api/solicitudes  body: { tipo, id_tipo_permiso?, fecha_inicio, fecha_fin, motivo?, id_archivo_respaldo? }
router.post("/", (req, res) => {
  const cuerpo = req.body || {};
  const idTrabajador = req.usuario.id_trabajador;
  let datos;
  try {
    datos = validarNueva(idTrabajador, cuerpo);
  } catch (err) {
    if (err instanceof ErrorValidacion) return res.status(err.estado).json({ error: err.message });
    throw err;
  }

  const motivo = cuerpo.motivo ? String(cuerpo.motivo).trim() : null;
  if (datos.tipo === "permiso" && !motivo) return res.status(400).json({ error: "Indique el motivo del permiso" });

  let idArchivo = null;
  if (cuerpo.id_archivo_respaldo) {
    const errorArchivo = errorArchivoParaAsociar(cuerpo.id_archivo_respaldo, req.usuario);
    if (errorArchivo) return res.status(400).json({ error: errorArchivo });
    idArchivo = Number(cuerpo.id_archivo_respaldo);
  }

  const resultado = db.prepare(`
    INSERT INTO solicitudes
      (id_trabajador, tipo, id_tipo_permiso, fecha_inicio, fecha_fin, dias_habiles, gestion_inicio, motivo, estado, id_archivo_respaldo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    idTrabajador, datos.tipo, datos.id_tipo_permiso, datos.fecha_inicio, datos.fecha_fin, datos.dias_habiles,
    datos.gestion_inicio, motivo, estadoInicial(idTrabajador), idArchivo
  );

  const nueva = obtenerSolicitud(resultado.lastInsertRowid);
  notificarAprobadores(nueva);
  res.status(201).json(nueva);
});

// Aprobar o rechazar la etapa actual
// POST /api/solicitudes/:id/decision  body: { decision: 'aprobado' | 'rechazado', comentario }
router.post("/:id/decision", (req, res) => {
  const { decision } = req.body || {};
  const comentario = req.body?.comentario ? String(req.body.comentario).trim() : null;
  if (!["aprobado", "rechazado"].includes(decision)) {
    return res.status(400).json({ error: "decision debe ser 'aprobado' o 'rechazado'" });
  }
  if (decision === "rechazado" && !comentario) {
    return res.status(400).json({ error: "Indique el motivo del rechazo en el comentario" });
  }

  const solicitud = obtenerSolicitud(req.params.id);
  if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
  const motivo = motivoNoPuedeDecidir(req.usuario, solicitud);
  if (motivo) return res.status(ETAPA_DE_ESTADO[solicitud.estado] ? 403 : 409).json({ error: motivo });

  const etapa = ETAPA_DE_ESTADO[solicitud.estado];
  let nuevoEstado = decision === "rechazado" ? "rechazado" : "aprobado";
  if (decision === "aprobado" && etapa === "supervisor") nuevoEstado = "pendiente_rrhh";

  // Al aprobar vacaciones se revisa de nuevo el saldo (pudo cambiar desde que se pidió)
  if (nuevoEstado === "aprobado" && solicitud.tipo === "vacacion") {
    const saldo = saldoVacaciones(solicitud.id_trabajador);
    if (saldo.gestion_inicio !== solicitud.gestion_inicio) {
      return res.status(409).json({ error: "La gestión de vacaciones cambió desde que se hizo la solicitud; el trabajador debe volver a pedirla" });
    }
  }

  try {
    db.exec("BEGIN");
    db.prepare(`
      INSERT INTO aprobaciones_solicitud (id_solicitud, etapa, id_aprobador, decision, comentario) VALUES (?, ?, ?, ?, ?)
    `).run(solicitud.id, etapa, req.usuario.id, decision, comentario);
    const final = nuevoEstado === "aprobado" || nuevoEstado === "rechazado";
    db.prepare(`
      UPDATE solicitudes SET estado = ?, fecha_resolucion = ${final ? "datetime('now', 'localtime')" : "NULL"} WHERE id = ?
    `).run(nuevoEstado, solicitud.id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const actualizada = obtenerSolicitud(solicitud.id);
  const descripcion = `Su solicitud de ${describirSolicitud(actualizada)} del ${actualizada.fecha_inicio} al ${actualizada.fecha_fin}`;
  if (nuevoEstado === "pendiente_rrhh") {
    notificarTrabajador(actualizada.id_trabajador, "solicitud", `${descripcion} fue aprobada por su supervisor y pasó a RRHH`, "/solicitudes");
    notificarAprobadores(actualizada);
  } else {
    const texto = nuevoEstado === "aprobado" ? "fue aprobada" : `fue rechazada: ${comentario}`;
    notificarTrabajador(actualizada.id_trabajador, "solicitud", `${descripcion} ${texto}`, "/solicitudes");
  }
  res.json(actualizada);
});

// Cancelar una solicitud propia mientras siga pendiente
// POST /api/solicitudes/:id/cancelar
router.post("/:id/cancelar", (req, res) => {
  const solicitud = obtenerSolicitud(req.params.id);
  if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
  if (solicitud.id_trabajador !== req.usuario.id_trabajador) {
    return res.status(403).json({ error: "Solo quien hizo la solicitud puede cancelarla" });
  }
  if (!ESTADOS_PENDIENTES.includes(solicitud.estado)) {
    return res.status(409).json({ error: "Solo se pueden cancelar solicitudes pendientes" });
  }

  db.prepare("UPDATE solicitudes SET estado = 'cancelado' WHERE id = ?").run(solicitud.id);
  // Si ya la había aprobado el supervisor, se le avisa de la cancelación
  db.prepare("SELECT id_aprobador FROM aprobaciones_solicitud WHERE id_solicitud = ?").all(solicitud.id)
    .forEach((a) => notificarUsuario(a.id_aprobador, "solicitud",
      `${solicitud.nombre} ${solicitud.apellido} canceló su solicitud de ${describirSolicitud(solicitud)} del ${solicitud.fecha_inicio}`, "/solicitudes/bandeja"));
  res.json(obtenerSolicitud(solicitud.id));
});

module.exports = router;
