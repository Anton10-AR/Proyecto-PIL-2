// Rutas de Configuración general (pares clave/valor). Solo RRHH modifica; cada clave se valida aparte.
const express = require("express");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");
const { esFecha } = require("../utils/fechas");

const router = express.Router();

// Claves editables y su validación. Devuelve un mensaje de error o null.
const VALIDADORES = {
  tolerancia_minutos: (valor) => {
    const n = Number(valor);
    return Number.isInteger(n) && n >= 0 && n <= 120 ? null : "La tolerancia debe ser un número entero de 0 a 120 minutos";
  },
  // Primer día en que se registra asistencia en el sistema: los días anteriores no cuentan como programados
  inicio_registros: (valor) => (esFecha(valor) ? null : "La fecha de inicio de registros debe tener formato YYYY-MM-DD")
};

function configuracionActual() {
  const config = {};
  db.prepare("SELECT clave, valor FROM configuracion").all().forEach(({ clave, valor }) => { config[clave] = valor; });
  return config;
}

// GET /api/configuracion
router.get("/", (req, res) => {
  res.json(configuracionActual());
});

// PUT /api/configuracion/:clave  body: { valor }
router.put("/:clave", permitirRoles("rrhh"), (req, res) => {
  const validar = VALIDADORES[req.params.clave];
  if (!validar) return res.status(404).json({ error: "Clave de configuración desconocida" });

  const valor = req.body?.valor;
  const error = validar(valor);
  if (error) return res.status(400).json({ error });

  db.prepare(`
    INSERT INTO configuracion (clave, valor) VALUES (?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor
  `).run(req.params.clave, String(valor));
  res.json(configuracionActual());
});

module.exports = router;
