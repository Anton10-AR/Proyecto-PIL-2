// Rutas del módulo Capacitación y desarrollo.
// - RRHH crea y administra capacitaciones, inscribe participantes, registra resultados y certificados.
// - El supervisor propone a miembros de su equipo (RRHH confirma o descarta la propuesta).
// - Todos consultan el listado; cada rol ve participantes según su visibilidad.
const express = require("express");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");
const { filtroVisibilidad, veTodos } = require("../utils/visibilidad");
const { hoyLocal, esFecha } = require("../utils/fechas");
const { notificarTrabajador, notificarRol, notificarUsuario } = require("../utils/notificar");
const { errorArchivoParaAsociar } = require("./archivos");

const router = express.Router();

const SELECT_CAPACITACION = `
  SELECT c.*,
    (SELECT COUNT(*) FROM participantes_capacitacion p WHERE p.id_capacitacion = c.id AND p.estado_inscripcion = 'inscrito') AS inscritos,
    (SELECT COUNT(*) FROM participantes_capacitacion p WHERE p.id_capacitacion = c.id AND p.estado_inscripcion = 'propuesto') AS propuestos,
    (SELECT COUNT(*) FROM participantes_capacitacion p WHERE p.id_capacitacion = c.id AND p.resultado = 'aprobado') AS aprobados,
    (SELECT COUNT(*) FROM participantes_capacitacion p WHERE p.id_capacitacion = c.id AND p.estado_inscripcion = 'inscrito' AND p.resultado IS NULL) AS sin_resultado
  FROM capacitaciones c
`;

// Estado para mostrar: a "programada" se le distingue si está en curso o ya pasó y falta cerrarla
function estadoActual(capacitacion, hoy = hoyLocal()) {
  if (capacitacion.estado !== "programada") return capacitacion.estado;
  if (hoy < capacitacion.fecha_inicio) return "programada";
  if (hoy <= capacitacion.fecha_fin) return "en_curso";
  return "por_cerrar";
}

function conEstado(capacitacion) {
  return capacitacion && { ...capacitacion, estado_actual: estadoActual(capacitacion) };
}

function obtenerCapacitacion(id) {
  return conEstado(db.prepare(`${SELECT_CAPACITACION} WHERE c.id = ?`).get(id));
}

class ErrorValidacion extends Error {
  constructor(mensaje, estado = 400) { super(mensaje); this.estado = estado; }
}

function responderError(res, err) {
  if (err instanceof ErrorValidacion) return res.status(err.estado).json({ error: err.message });
  throw err;
}

function validarDatos(cuerpo) {
  const titulo = String(cuerpo.titulo || "").trim();
  if (!titulo) throw new ErrorValidacion("titulo es obligatorio");
  if (!esFecha(cuerpo.fecha_inicio) || !esFecha(cuerpo.fecha_fin)) throw new ErrorValidacion("fecha_inicio y fecha_fin deben tener formato YYYY-MM-DD");
  if (cuerpo.fecha_fin < cuerpo.fecha_inicio) throw new ErrorValidacion("La fecha de fin no puede ser anterior a la de inicio");
  const horas = Number(cuerpo.horas);
  if (!(horas > 0) || horas > 1000) throw new ErrorValidacion("horas debe ser un número mayor que 0");
  let cupo = null;
  if (cuerpo.cupo !== null && cuerpo.cupo !== undefined && cuerpo.cupo !== "") {
    cupo = Number(cuerpo.cupo);
    if (!Number.isInteger(cupo) || cupo <= 0) throw new ErrorValidacion("cupo debe ser un entero mayor que 0 o vacío (sin límite)");
  }
  const texto = (campo) => (cuerpo[campo] ? String(cuerpo[campo]).trim() : null);
  return {
    titulo, descripcion: texto("descripcion"), instructor: texto("instructor"), lugar: texto("lugar"),
    fecha_inicio: cuerpo.fecha_inicio, fecha_fin: cuerpo.fecha_fin, horas, cupo
  };
}

function exigirProgramada(capacitacion) {
  if (!capacitacion) throw new ErrorValidacion("Capacitación no encontrada", 404);
  if (capacitacion.estado !== "programada") {
    throw new ErrorValidacion(`La capacitación está ${capacitacion.estado}; ya no admite cambios`, 409);
  }
}

function exigirCupo(capacitacion, nuevos) {
  if (capacitacion.cupo && capacitacion.inscritos + nuevos > capacitacion.cupo) {
    throw new ErrorValidacion(`Supera el cupo: ${capacitacion.cupo} lugares, ${capacitacion.inscritos} ya inscritos`, 409);
  }
}

function textoCapacitacion(c) {
  return c.fecha_inicio === c.fecha_fin
    ? `"${c.titulo}" (${c.fecha_inicio})`
    : `"${c.titulo}" (${c.fecha_inicio} al ${c.fecha_fin})`;
}

// Listado con la participación del usuario actual
// GET /api/capacitaciones?vista=proximas|finalizadas|todas&buscar=texto
router.get("/", (req, res) => {
  const { vista = "todas", buscar } = req.query;
  let sql = `
    SELECT x.*, mp.estado_inscripcion AS mi_inscripcion, mp.resultado AS mi_resultado
    FROM (${SELECT_CAPACITACION}) x
    LEFT JOIN participantes_capacitacion mp ON mp.id_capacitacion = x.id AND mp.id_trabajador = ?
    WHERE 1=1`;
  const params = [req.usuario.id_trabajador];
  if (vista === "proximas") sql += " AND x.estado = 'programada'";
  if (vista === "finalizadas") sql += " AND x.estado IN ('finalizada', 'cancelada')";
  if (buscar) {
    sql += " AND (x.titulo LIKE ? OR x.instructor LIKE ? OR x.descripcion LIKE ?)";
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  sql += vista === "proximas" ? " ORDER BY x.fecha_inicio" : " ORDER BY x.fecha_inicio DESC";
  res.json(db.prepare(sql).all(...params).map(conEstado));
});

// Historial de capacitación del usuario actual
// GET /api/capacitaciones/mias
router.get("/mias", (req, res) => {
  const filas = db.prepare(`
    SELECT p.*, c.titulo, c.fecha_inicio, c.fecha_fin, c.horas, c.instructor, c.estado, ar.nombre_original AS certificado_nombre
    FROM participantes_capacitacion p
    JOIN capacitaciones c ON c.id = p.id_capacitacion
    LEFT JOIN archivos ar ON ar.id = p.id_archivo_certificado
    WHERE p.id_trabajador = ? AND p.estado_inscripcion <> 'rechazado'
    ORDER BY c.fecha_inicio DESC
  `).all(req.usuario.id_trabajador);
  res.json(filas.map((f) => ({ ...f, estado_actual: estadoActual(f) })));
});

// Detalle con los participantes que el usuario puede ver
// GET /api/capacitaciones/:id
router.get("/:id", (req, res) => {
  const capacitacion = obtenerCapacitacion(req.params.id);
  if (!capacitacion) return res.status(404).json({ error: "Capacitación no encontrada" });

  const visibilidad = filtroVisibilidad(req.usuario, "p.id_trabajador");
  const participantes = db.prepare(`
    SELECT p.*, t.nombre, t.apellido, t.area, t.cargo,
           r.nombre || ' ' || r.apellido AS registrado_por, ur.rol AS rol_registrado_por,
           ar.nombre_original AS certificado_nombre
    FROM participantes_capacitacion p
    JOIN trabajadores t ON t.id = p.id_trabajador
    JOIN usuarios ur ON ur.id = p.id_registrado_por
    JOIN trabajadores r ON r.id = ur.id_trabajador
    LEFT JOIN archivos ar ON ar.id = p.id_archivo_certificado
    WHERE p.id_capacitacion = ?${visibilidad.sql}
    ORDER BY CASE p.estado_inscripcion WHEN 'propuesto' THEN 0 WHEN 'inscrito' THEN 1 ELSE 2 END, t.apellido, t.nombre
  `).all(capacitacion.id, ...visibilidad.params);

  const hoy = hoyLocal();
  const abierta = capacitacion.estado === "programada";
  res.json({
    ...capacitacion,
    participantes,
    ve_todos: veTodos(req.usuario),
    puede_administrar: req.usuario.rol === "rrhh",
    puede_inscribir: req.usuario.rol === "rrhh" && abierta && hoy <= capacitacion.fecha_fin,
    puede_proponer: req.usuario.rol === "supervisor" && abierta && hoy < capacitacion.fecha_inicio,
    puede_registrar_resultados: req.usuario.rol === "rrhh" && capacitacion.estado !== "cancelada" && hoy >= capacitacion.fecha_inicio
  });
});

// POST /api/capacitaciones
router.post("/", permitirRoles("rrhh"), (req, res) => {
  try {
    const d = validarDatos(req.body || {});
    const resultado = db.prepare(`
      INSERT INTO capacitaciones (titulo, descripcion, instructor, lugar, fecha_inicio, fecha_fin, horas, cupo, id_creado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(d.titulo, d.descripcion, d.instructor, d.lugar, d.fecha_inicio, d.fecha_fin, d.horas, d.cupo, req.usuario.id);
    res.status(201).json(obtenerCapacitacion(resultado.lastInsertRowid));
  } catch (err) { responderError(res, err); }
});

// PUT /api/capacitaciones/:id  (solo mientras esté programada)
router.put("/:id", permitirRoles("rrhh"), (req, res) => {
  try {
    const actual = obtenerCapacitacion(req.params.id);
    exigirProgramada(actual);
    const d = validarDatos({ ...actual, ...req.body });
    if (d.cupo && d.cupo < actual.inscritos) {
      throw new ErrorValidacion(`El cupo no puede ser menor que los ${actual.inscritos} inscritos`);
    }
    db.prepare(`
      UPDATE capacitaciones SET titulo = ?, descripcion = ?, instructor = ?, lugar = ?, fecha_inicio = ?, fecha_fin = ?, horas = ?, cupo = ?
      WHERE id = ?
    `).run(d.titulo, d.descripcion, d.instructor, d.lugar, d.fecha_inicio, d.fecha_fin, d.horas, d.cupo, actual.id);
    res.json(obtenerCapacitacion(actual.id));
  } catch (err) { responderError(res, err); }
});

// Cancelar: avisa a los inscritos
// POST /api/capacitaciones/:id/cancelar
router.post("/:id/cancelar", permitirRoles("rrhh"), (req, res) => {
  try {
    const actual = obtenerCapacitacion(req.params.id);
    exigirProgramada(actual);
    db.prepare("UPDATE capacitaciones SET estado = 'cancelada' WHERE id = ?").run(actual.id);
    db.prepare("SELECT id_trabajador FROM participantes_capacitacion WHERE id_capacitacion = ? AND estado_inscripcion = 'inscrito'")
      .all(actual.id)
      .forEach((p) => notificarTrabajador(p.id_trabajador, "capacitacion", `Se canceló la capacitación ${textoCapacitacion(actual)}`, "/capacitaciones"));
    res.json(obtenerCapacitacion(actual.id));
  } catch (err) { responderError(res, err); }
});

// Finalizar: exige que haya empezado, sin propuestas pendientes y con resultado para cada inscrito
// POST /api/capacitaciones/:id/finalizar
router.post("/:id/finalizar", permitirRoles("rrhh"), (req, res) => {
  try {
    const actual = obtenerCapacitacion(req.params.id);
    exigirProgramada(actual);
    if (hoyLocal() < actual.fecha_inicio) throw new ErrorValidacion("La capacitación todavía no empezó", 409);
    if (actual.propuestos > 0) throw new ErrorValidacion(`Hay ${actual.propuestos} propuesta(s) sin resolver`, 409);
    if (actual.inscritos === 0) throw new ErrorValidacion("No hay participantes inscritos; si no se realizó, cancélela", 409);
    if (actual.sin_resultado > 0) throw new ErrorValidacion(`Falta registrar el resultado de ${actual.sin_resultado} participante(s)`, 409);
    db.prepare("UPDATE capacitaciones SET estado = 'finalizada' WHERE id = ?").run(actual.id);
    res.json(obtenerCapacitacion(actual.id));
  } catch (err) { responderError(res, err); }
});

// Agregar participantes. RRHH los inscribe; el supervisor los propone (solo de su equipo directo).
// POST /api/capacitaciones/:id/participantes  body: { ids_trabajadores: [1, 2] }
router.post("/:id/participantes", permitirRoles("rrhh", "supervisor"), (req, res) => {
  try {
    const capacitacion = obtenerCapacitacion(req.params.id);
    exigirProgramada(capacitacion);
    const esRRHH = req.usuario.rol === "rrhh";
    const hoy = hoyLocal();
    if (esRRHH && hoy > capacitacion.fecha_fin) throw new ErrorValidacion("La capacitación ya terminó", 409);
    if (!esRRHH && hoy >= capacitacion.fecha_inicio) throw new ErrorValidacion("Solo se puede proponer participantes antes de que empiece", 409);

    const ids = [...new Set((req.body?.ids_trabajadores || []).map(Number))];
    if (ids.length === 0) throw new ErrorValidacion("Seleccione al menos un trabajador");

    ids.forEach((id) => {
      const trabajador = db.prepare("SELECT * FROM trabajadores WHERE id = ?").get(id);
      if (!trabajador || trabajador.estado !== "activo") throw new ErrorValidacion(`El trabajador ${id} no existe o está inactivo`);
      if (!esRRHH && trabajador.id_supervisor !== req.usuario.id_trabajador) {
        throw new ErrorValidacion(`${trabajador.nombre} ${trabajador.apellido} no pertenece a su equipo`, 403);
      }
      const existente = db.prepare(
        "SELECT estado_inscripcion FROM participantes_capacitacion WHERE id_capacitacion = ? AND id_trabajador = ?"
      ).get(capacitacion.id, id);
      if (existente && existente.estado_inscripcion !== "rechazado") {
        throw new ErrorValidacion(`${trabajador.nombre} ${trabajador.apellido} ya está ${existente.estado_inscripcion} en esta capacitación`, 409);
      }
    });
    if (esRRHH) exigirCupo(capacitacion, ids.length);

    const estado = esRRHH ? "inscrito" : "propuesto";
    db.exec("BEGIN");
    try {
      ids.forEach((id) => {
        // Una propuesta descartada antes puede volver a proponerse o inscribirse
        db.prepare("DELETE FROM participantes_capacitacion WHERE id_capacitacion = ? AND id_trabajador = ? AND estado_inscripcion = 'rechazado'")
          .run(capacitacion.id, id);
        db.prepare(`
          INSERT INTO participantes_capacitacion (id_capacitacion, id_trabajador, estado_inscripcion, id_registrado_por) VALUES (?, ?, ?, ?)
        `).run(capacitacion.id, id, estado, req.usuario.id);
      });
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    const enlace = `/capacitaciones/${capacitacion.id}`;
    if (esRRHH) {
      ids.forEach((id) => notificarTrabajador(id, "capacitacion", `Fue inscrito en la capacitación ${textoCapacitacion(capacitacion)}`, enlace));
    } else {
      notificarRol("rrhh", "capacitacion",
        `${req.usuario.nombre} ${req.usuario.apellido} propuso ${ids.length} participante(s) para ${textoCapacitacion(capacitacion)}`, enlace);
    }
    res.status(201).json(obtenerCapacitacion(capacitacion.id));
  } catch (err) { responderError(res, err); }
});

function obtenerParticipante(idCapacitacion, idParticipante) {
  return db.prepare("SELECT * FROM participantes_capacitacion WHERE id = ? AND id_capacitacion = ?").get(idParticipante, idCapacitacion);
}

// Confirmar o descartar una propuesta del supervisor (RRHH)
// PUT /api/capacitaciones/:id/participantes/:idp  body: { estado_inscripcion: 'inscrito' | 'rechazado' }
router.put("/:id/participantes/:idp", permitirRoles("rrhh"), (req, res) => {
  try {
    const capacitacion = obtenerCapacitacion(req.params.id);
    exigirProgramada(capacitacion);
    const participante = obtenerParticipante(capacitacion.id, req.params.idp);
    if (!participante) throw new ErrorValidacion("Participante no encontrado", 404);
    if (participante.estado_inscripcion !== "propuesto") throw new ErrorValidacion("Solo se pueden resolver propuestas pendientes", 409);
    const nuevo = req.body?.estado_inscripcion;
    if (!["inscrito", "rechazado"].includes(nuevo)) throw new ErrorValidacion("estado_inscripcion debe ser 'inscrito' o 'rechazado'");
    if (nuevo === "inscrito") exigirCupo(capacitacion, 1);

    db.prepare("UPDATE participantes_capacitacion SET estado_inscripcion = ? WHERE id = ?").run(nuevo, participante.id);
    const trabajador = db.prepare("SELECT nombre, apellido FROM trabajadores WHERE id = ?").get(participante.id_trabajador);
    const enlace = `/capacitaciones/${capacitacion.id}`;
    if (nuevo === "inscrito") {
      notificarTrabajador(participante.id_trabajador, "capacitacion", `Fue inscrito en la capacitación ${textoCapacitacion(capacitacion)}`, enlace);
    }
    notificarUsuario(participante.id_registrado_por, "capacitacion",
      `RRHH ${nuevo === "inscrito" ? "confirmó" : "descartó"} su propuesta de ${trabajador.nombre} ${trabajador.apellido} para ${textoCapacitacion(capacitacion)}`, enlace);
    res.json(obtenerCapacitacion(capacitacion.id));
  } catch (err) { responderError(res, err); }
});

// Quitar un participante: RRHH (si aún no tiene resultado) o el supervisor que lo propuso (mientras sea propuesta)
// DELETE /api/capacitaciones/:id/participantes/:idp
router.delete("/:id/participantes/:idp", permitirRoles("rrhh", "supervisor"), (req, res) => {
  try {
    const capacitacion = obtenerCapacitacion(req.params.id);
    exigirProgramada(capacitacion);
    const participante = obtenerParticipante(capacitacion.id, req.params.idp);
    if (!participante) throw new ErrorValidacion("Participante no encontrado", 404);
    if (participante.resultado) throw new ErrorValidacion("El participante ya tiene un resultado registrado", 409);
    const esQuienPropuso = participante.estado_inscripcion === "propuesto" && participante.id_registrado_por === req.usuario.id;
    if (req.usuario.rol !== "rrhh" && !esQuienPropuso) throw new ErrorValidacion("Solo puede retirar sus propias propuestas pendientes", 403);

    db.prepare("DELETE FROM participantes_capacitacion WHERE id = ?").run(participante.id);
    if (participante.estado_inscripcion === "inscrito") {
      notificarTrabajador(participante.id_trabajador, "capacitacion", `Fue retirado de la capacitación ${textoCapacitacion(capacitacion)}`, "/capacitaciones");
    }
    res.json(obtenerCapacitacion(capacitacion.id));
  } catch (err) { responderError(res, err); }
});

// Registrar o corregir el resultado de un inscrito (RRHH). También se puede corregir después de finalizar.
// PUT /api/capacitaciones/:id/participantes/:idp/resultado
//   body: { resultado, asistencia_pct, nota?, observacion?, id_archivo_certificado? (solo si aprobó; null lo quita) }
router.put("/:id/participantes/:idp/resultado", permitirRoles("rrhh"), (req, res) => {
  try {
    const capacitacion = obtenerCapacitacion(req.params.id);
    if (!capacitacion) throw new ErrorValidacion("Capacitación no encontrada", 404);
    if (capacitacion.estado === "cancelada") throw new ErrorValidacion("La capacitación fue cancelada", 409);
    if (hoyLocal() < capacitacion.fecha_inicio) throw new ErrorValidacion("La capacitación todavía no empezó", 409);
    const participante = obtenerParticipante(capacitacion.id, req.params.idp);
    if (!participante) throw new ErrorValidacion("Participante no encontrado", 404);
    if (participante.estado_inscripcion !== "inscrito") throw new ErrorValidacion("Solo se registran resultados de participantes inscritos", 409);

    const cuerpo = req.body || {};
    const { resultado } = cuerpo;
    if (!["aprobado", "reprobado", "no_asistio"].includes(resultado)) {
      throw new ErrorValidacion("resultado debe ser 'aprobado', 'reprobado' o 'no_asistio'");
    }
    let asistencia = cuerpo.asistencia_pct === "" || cuerpo.asistencia_pct === undefined || cuerpo.asistencia_pct === null
      ? null : Number(cuerpo.asistencia_pct);
    if (resultado === "no_asistio") asistencia = 0;
    if (!Number.isInteger(asistencia) || asistencia < 0 || asistencia > 100) {
      throw new ErrorValidacion("asistencia_pct debe ser un entero de 0 a 100");
    }
    if (resultado !== "no_asistio" && asistencia === 0) {
      throw new ErrorValidacion("Con 0% de asistencia el resultado debe ser 'no asistió'");
    }
    let nota = null;
    if (resultado !== "no_asistio" && cuerpo.nota !== "" && cuerpo.nota !== undefined && cuerpo.nota !== null) {
      nota = Number(cuerpo.nota);
      if (!(nota >= 0 && nota <= 100)) throw new ErrorValidacion("nota debe estar entre 0 y 100");
    }

    // Certificado: solo para aprobados. Si no se envía el campo, se conserva el actual.
    let certificado = participante.id_archivo_certificado;
    if (cuerpo.id_archivo_certificado !== undefined) {
      certificado = cuerpo.id_archivo_certificado ? Number(cuerpo.id_archivo_certificado) : null;
      if (certificado && certificado !== participante.id_archivo_certificado) {
        const errorArchivo = errorArchivoParaAsociar(certificado, req.usuario);
        if (errorArchivo) throw new ErrorValidacion(errorArchivo);
      }
    }
    if (resultado !== "aprobado") certificado = null;

    db.prepare(`
      UPDATE participantes_capacitacion SET resultado = ?, asistencia_pct = ?, nota = ?, observacion = ?, id_archivo_certificado = ?
      WHERE id = ?
    `).run(resultado, asistencia, nota, cuerpo.observacion ? String(cuerpo.observacion).trim() : null, certificado, participante.id);

    const textos = { aprobado: "aprobó", reprobado: "no aprobó", no_asistio: "figura como no asistente a" };
    notificarTrabajador(participante.id_trabajador, "capacitacion",
      `Se registró su resultado: ${textos[resultado]} la capacitación ${textoCapacitacion(capacitacion)}`, "/capacitaciones");
    res.json(obtenerCapacitacion(capacitacion.id));
  } catch (err) { responderError(res, err); }
});

module.exports = router;
