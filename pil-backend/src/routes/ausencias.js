// Rutas de Ausencias: RRHH las registra manualmente (justificadas o injustificadas);
// cada rol las consulta según su visibilidad.
const express = require("express");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");
const { filtroVisibilidad } = require("../utils/visibilidad");
const { hoyLocal, esFecha, esMes, rangoDelMes } = require("../utils/fechas");
const { notificarTrabajador } = require("../utils/notificar");
const { jornadaDelDia } = require("../utils/jornada");
const { solicitudAprobadaEn, textoSolicitudAprobada } = require("../utils/solicitudes");

const router = express.Router();

const SELECT_AUSENCIA = `
  SELECT au.*, tr.nombre, tr.apellido, tr.area
  FROM ausencias au JOIN trabajadores tr ON tr.id = au.id_trabajador
`;

// GET /api/ausencias?trabajador=1&mes=2026-10&justificada=0
router.get("/", (req, res) => {
  const { trabajador, mes, justificada } = req.query;
  const visibilidad = filtroVisibilidad(req.usuario, "au.id_trabajador");
  let sql = `${SELECT_AUSENCIA} WHERE 1=1${visibilidad.sql}`;
  const params = [...visibilidad.params];

  if (trabajador) { sql += " AND au.id_trabajador = ?"; params.push(trabajador); }
  if (mes) {
    if (!esMes(mes)) return res.status(400).json({ error: "mes debe tener formato YYYY-MM" });
    const { desde, hasta } = rangoDelMes(mes);
    sql += " AND au.fecha BETWEEN ? AND ?";
    params.push(desde, hasta);
  }
  if (justificada === "0" || justificada === "1") { sql += " AND au.justificada = ?"; params.push(Number(justificada)); }
  sql += " ORDER BY au.fecha DESC, tr.apellido";

  res.json(db.prepare(sql).all(...params));
});

// POST /api/ausencias  body: { id_trabajador, fecha, justificada, motivo }
router.post("/", permitirRoles("rrhh"), (req, res) => {
  const { id_trabajador, fecha, justificada, motivo } = req.body || {};
  if (!id_trabajador || !esFecha(fecha)) {
    return res.status(400).json({ error: "id_trabajador y fecha (YYYY-MM-DD) son obligatorios" });
  }
  if (fecha > hoyLocal()) return res.status(400).json({ error: "No se puede registrar una ausencia en una fecha futura" });
  const trabajador = db.prepare("SELECT id FROM trabajadores WHERE id = ?").get(id_trabajador);
  if (!trabajador) return res.status(404).json({ error: "Trabajador no encontrado" });
  if (db.prepare("SELECT id FROM asistencia WHERE id_trabajador = ? AND fecha = ?").get(id_trabajador, fecha)) {
    return res.status(409).json({ error: "El trabajador tiene una marcación de asistencia ese día" });
  }
  const solicitud = solicitudAprobadaEn(id_trabajador, fecha);
  if (solicitud) {
    return res.status(409).json({ error: `El trabajador tiene ${textoSolicitudAprobada(solicitud)} ese día` });
  }
  const { turno, feriado, laborable } = jornadaDelDia(id_trabajador, fecha);
  if (!laborable) {
    const razon = !turno ? "el trabajador no tenía turno asignado" : feriado ? `es feriado (${feriado.descripcion})` : `no es día laborable del turno ${turno.nombre}`;
    return res.status(400).json({ error: `No se puede registrar la ausencia: ${razon}` });
  }

  try {
    const resultado = db.prepare(`
      INSERT INTO ausencias (id_trabajador, fecha, justificada, motivo, id_registrado_por) VALUES (?, ?, ?, ?, ?)
    `).run(id_trabajador, fecha, justificada ? 1 : 0, motivo || null, req.usuario.id);

    notificarTrabajador(
      id_trabajador, "ausencia",
      `RRHH registró una ausencia ${justificada ? "justificada" : "injustificada"} el ${fecha}`,
      "/asistencia"
    );
    res.status(201).json(db.prepare(`${SELECT_AUSENCIA} WHERE au.id = ?`).get(resultado.lastInsertRowid));
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "Ya hay una ausencia registrada ese día" });
    res.status(500).json({ error: "Error al registrar la ausencia" });
  }
});

// PUT /api/ausencias/:id  body: { justificada, motivo }
router.put("/:id", permitirRoles("rrhh"), (req, res) => {
  const ausencia = db.prepare("SELECT * FROM ausencias WHERE id = ?").get(req.params.id);
  if (!ausencia) return res.status(404).json({ error: "Ausencia no encontrada" });

  const justificada = req.body?.justificada === undefined ? ausencia.justificada : (req.body.justificada ? 1 : 0);
  const motivo = req.body?.motivo === undefined ? ausencia.motivo : (req.body.motivo || null);
  db.prepare("UPDATE ausencias SET justificada = ?, motivo = ? WHERE id = ?").run(justificada, motivo, ausencia.id);
  res.json(db.prepare(`${SELECT_AUSENCIA} WHERE au.id = ?`).get(ausencia.id));
});

// DELETE /api/ausencias/:id
router.delete("/:id", permitirRoles("rrhh"), (req, res) => {
  const resultado = db.prepare("DELETE FROM ausencias WHERE id = ?").run(req.params.id);
  if (resultado.changes === 0) return res.status(404).json({ error: "Ausencia no encontrada" });
  res.json({ mensaje: "Ausencia eliminada" });
});

module.exports = router;
