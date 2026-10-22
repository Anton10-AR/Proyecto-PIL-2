// Rutas de Respaldos (solo RRHH): listar, generar uno manual y descargar.
// La restauración no se hace desde la app (ver LEEME.txt dentro de cada ZIP).
const express = require("express");
const { crearRespaldo, listarRespaldos, rutaRespaldo } = require("../utils/respaldos");

const router = express.Router();

// GET /api/respaldos
router.get("/", (req, res) => {
  res.json(listarRespaldos());
});

// POST /api/respaldos
router.post("/", async (req, res) => {
  res.status(201).json(await crearRespaldo("manual"));
});

// GET /api/respaldos/:nombre
router.get("/:nombre", (req, res) => {
  const ruta = rutaRespaldo(req.params.nombre);
  if (!ruta) return res.status(404).json({ error: "Respaldo no encontrado" });
  res.download(ruta, req.params.nombre);
});

module.exports = router;
