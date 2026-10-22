// Rutas de notificaciones (campana): cada usuario ve y marca solo las suyas
const express = require("express");
const db = require("../db/database");

const router = express.Router();

// GET /api/notificaciones?no_leidas=1
router.get("/", (req, res) => {
  let sql = "SELECT * FROM notificaciones WHERE id_usuario = ?";
  if (req.query.no_leidas) sql += " AND leida = 0";
  sql += " ORDER BY fecha DESC, id DESC LIMIT 50";

  const notificaciones = db.prepare(sql).all(req.usuario.id);
  const { total } = db.prepare(
    "SELECT COUNT(*) AS total FROM notificaciones WHERE id_usuario = ? AND leida = 0"
  ).get(req.usuario.id);

  res.json({ no_leidas: total, notificaciones });
});

// PUT /api/notificaciones/leidas — marca todas como leídas
router.put("/leidas", (req, res) => {
  db.prepare("UPDATE notificaciones SET leida = 1 WHERE id_usuario = ?").run(req.usuario.id);
  res.json({ mensaje: "Notificaciones marcadas como leídas" });
});

// PUT /api/notificaciones/:id/leida
router.put("/:id/leida", (req, res) => {
  const resultado = db.prepare(
    "UPDATE notificaciones SET leida = 1 WHERE id = ? AND id_usuario = ?"
  ).run(req.params.id, req.usuario.id);

  if (resultado.changes === 0) {
    return res.status(404).json({ error: "Notificación no encontrada" });
  }
  res.json({ mensaje: "Notificación marcada como leída" });
});

module.exports = router;
