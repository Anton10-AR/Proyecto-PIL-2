// Proceso productivo y diseño organizacional: etapas, puestos, cobertura de puestos críticos e impacto de
// las solicitudes de permiso o vacación sobre esa cobertura (documento, secciones 5 y 7).
const express = require("express");
const db = require("../db/database");
const { puedeVerCobertura } = require("../utils/puestos");
const { puedeVerTrabajador } = require("../utils/visibilidad");
const { coberturaDelDia, indicadoresCobertura, impactoSolicitud, diasOperacion } = require("../utils/cobertura");
const { hoyLocal, esFecha, sumarDias } = require("../utils/fechas");

const router = express.Router();

// Etapas con sus puestos y cuántas personas activas ocupa cada uno (lo usa también el formulario de Personal)
// GET /api/proceso/etapas
router.get("/etapas", (req, res) => {
  const puestos = db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM trabajadores t WHERE t.id_puesto = p.id AND t.estado = 'activo') AS personas
    FROM puestos_proceso p ORDER BY COALESCE(p.id_etapa, 99), p.id
  `).all().map((p) => ({ ...p, critico: Boolean(p.critico) }));
  const etapas = db.prepare("SELECT * FROM etapas_proceso ORDER BY id").all()
    .map((e) => ({ ...e, puestos: puestos.filter((p) => p.id_etapa === e.id) }));
  res.json({ etapas, transversales: puestos.filter((p) => p.id_etapa === null), dias_operacion: diasOperacion() });
});

function soloCobertura(req, res, next) {
  if (!puedeVerCobertura(req.usuario)) return res.status(403).json({ error: "No tiene permiso para ver la cobertura del proceso" });
  next();
}

// Cobertura de puestos críticos en un día (hoy por defecto; sirve también para planificar días futuros)
// GET /api/proceso/cobertura?fecha=YYYY-MM-DD
router.get("/cobertura", soloCobertura, (req, res) => {
  const fecha = esFecha(req.query.fecha) ? req.query.fecha : hoyLocal();
  res.json(coberturaDelDia(fecha));
});

// Indicadores de cobertura y capacitación vigente en puestos críticos
// GET /api/proceso/indicadores?desde&hasta
router.get("/indicadores", soloCobertura, (req, res) => {
  const hasta = esFecha(req.query.hasta) ? req.query.hasta : hoyLocal();
  const desde = esFecha(req.query.desde) ? req.query.desde : sumarDias(hasta, -29);
  if (desde > hasta) return res.status(400).json({ error: "La fecha inicial no puede ser posterior a la final" });
  res.json(indicadoresCobertura(desde, hasta));
});

// Días en que aprobar la solicitud dejaría descubierto el puesto crítico de quien la pide
// GET /api/proceso/impacto-solicitud/:id
router.get("/impacto-solicitud/:id", (req, res) => {
  const solicitud = db.prepare("SELECT id_trabajador FROM solicitudes WHERE id = ?").get(req.params.id);
  if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
  if (!puedeVerTrabajador(req.usuario, solicitud.id_trabajador)) {
    return res.status(403).json({ error: "No tiene permiso para ver esta solicitud" });
  }
  res.json(impactoSolicitud(req.params.id));
});

module.exports = router;
