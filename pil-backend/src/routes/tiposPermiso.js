// Rutas del catálogo de tipos de permiso: cualquier usuario los consulta, solo RRHH los administra
const express = require("express");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");

const router = express.Router();

function enteroPositivo(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Valida y normaliza. Devuelve { error } o { datos }
function validarTipo(cuerpo) {
  const nombre = String(cuerpo.nombre || "").trim();
  if (!nombre) return { error: "nombre es obligatorio" };
  const diasMax = enteroPositivo(cuerpo.dias_max_solicitud);
  if (!diasMax) return { error: "dias_max_solicitud debe ser un entero mayor que 0" };
  let limiteAnual = null;
  if (cuerpo.limite_anual_dias !== null && cuerpo.limite_anual_dias !== undefined && cuerpo.limite_anual_dias !== "") {
    limiteAnual = enteroPositivo(cuerpo.limite_anual_dias);
    if (!limiteAnual) return { error: "limite_anual_dias debe ser un entero mayor que 0 o vacío (sin límite)" };
    if (limiteAnual < diasMax) return { error: "El límite anual no puede ser menor que los días máximos por solicitud" };
  }
  return {
    datos: {
      nombre,
      descripcion: cuerpo.descripcion ? String(cuerpo.descripcion).trim() : null,
      dias_max_solicitud: diasMax,
      limite_anual_dias: limiteAnual,
      requiere_respaldo: cuerpo.requiere_respaldo ? 1 : 0,
      con_goce: cuerpo.con_goce === undefined ? 1 : (cuerpo.con_goce ? 1 : 0),
      activo: cuerpo.activo === undefined ? 1 : (cuerpo.activo ? 1 : 0)
    }
  };
}

// GET /api/tipos-permiso?activos=1
router.get("/", (req, res) => {
  const sql = req.query.activos
    ? "SELECT * FROM tipos_permiso WHERE activo = 1 ORDER BY nombre"
    : "SELECT * FROM tipos_permiso ORDER BY activo DESC, nombre";
  res.json(db.prepare(sql).all());
});

// POST /api/tipos-permiso
router.post("/", permitirRoles("rrhh"), (req, res) => {
  const { error, datos } = validarTipo(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    const resultado = db.prepare(`
      INSERT INTO tipos_permiso (nombre, descripcion, dias_max_solicitud, limite_anual_dias, requiere_respaldo, con_goce, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(datos.nombre, datos.descripcion, datos.dias_max_solicitud, datos.limite_anual_dias, datos.requiere_respaldo, datos.con_goce, datos.activo);
    res.status(201).json(db.prepare("SELECT * FROM tipos_permiso WHERE id = ?").get(resultado.lastInsertRowid));
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe un tipo de permiso con ese nombre" });
    res.status(500).json({ error: "Error al crear el tipo de permiso" });
  }
});

// PUT /api/tipos-permiso/:id  (los cambios no afectan a solicitudes ya creadas)
router.put("/:id", permitirRoles("rrhh"), (req, res) => {
  const existente = db.prepare("SELECT * FROM tipos_permiso WHERE id = ?").get(req.params.id);
  if (!existente) return res.status(404).json({ error: "Tipo de permiso no encontrado" });
  const { error, datos } = validarTipo({ ...existente, ...req.body });
  if (error) return res.status(400).json({ error });
  try {
    db.prepare(`
      UPDATE tipos_permiso SET nombre = ?, descripcion = ?, dias_max_solicitud = ?, limite_anual_dias = ?,
        requiere_respaldo = ?, con_goce = ?, activo = ? WHERE id = ?
    `).run(datos.nombre, datos.descripcion, datos.dias_max_solicitud, datos.limite_anual_dias, datos.requiere_respaldo, datos.con_goce, datos.activo, existente.id);
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe un tipo de permiso con ese nombre" });
    return res.status(500).json({ error: "Error al modificar el tipo de permiso" });
  }
  res.json(db.prepare("SELECT * FROM tipos_permiso WHERE id = ?").get(existente.id));
});

module.exports = router;
