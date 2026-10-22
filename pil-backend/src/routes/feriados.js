// Rutas de Feriados: los consulta cualquier usuario, solo RRHH los administra
const express = require("express");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");
const { esFecha } = require("../utils/fechas");

const router = express.Router();

// GET /api/feriados?anio=2026
router.get("/", (req, res) => {
  const { anio } = req.query;
  const feriados = anio
    ? db.prepare("SELECT * FROM feriados WHERE fecha LIKE ? ORDER BY fecha").all(`${anio}-%`)
    : db.prepare("SELECT * FROM feriados ORDER BY fecha").all();
  res.json(feriados);
});

// POST /api/feriados  body: { fecha, descripcion }
router.post("/", permitirRoles("rrhh"), (req, res) => {
  const { fecha, descripcion } = req.body || {};
  if (!esFecha(fecha) || !descripcion || !String(descripcion).trim()) {
    return res.status(400).json({ error: "fecha (YYYY-MM-DD) y descripcion son obligatorias" });
  }
  try {
    db.prepare("INSERT INTO feriados (fecha, descripcion) VALUES (?, ?)").run(fecha, String(descripcion).trim());
  } catch (err) {
    if (err.message.includes("UNIQUE") || err.message.includes("PRIMARY KEY")) {
      return res.status(409).json({ error: "Ya hay un feriado registrado en esa fecha" });
    }
    return res.status(500).json({ error: "Error al registrar el feriado" });
  }
  res.status(201).json(db.prepare("SELECT * FROM feriados WHERE fecha = ?").get(fecha));
});

// DELETE /api/feriados/:fecha
router.delete("/:fecha", permitirRoles("rrhh"), (req, res) => {
  const resultado = db.prepare("DELETE FROM feriados WHERE fecha = ?").run(req.params.fecha);
  if (resultado.changes === 0) return res.status(404).json({ error: "Feriado no encontrado" });
  res.json({ mensaje: "Feriado eliminado" });
});

module.exports = router;
