// Rutas de Comunicados internos: RRHH y Gerencia publican para toda la empresa o para áreas;
// cada usuario ve los dirigidos a su área. Publicar notifica a los destinatarios.
const express = require("express");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");
const { notificarAreas, usuariosDeAreas } = require("../utils/notificar");

const router = express.Router();

function areasDe(idComunicado) {
  return db.prepare("SELECT area FROM comunicado_areas WHERE id_comunicado = ? ORDER BY area").all(idComunicado).map((f) => f.area);
}

const SELECT_COMUNICADO = `
  SELECT c.*, t.nombre || ' ' || t.apellido AS autor, u.rol AS rol_autor
  FROM comunicados c JOIN usuarios u ON u.id = c.id_autor JOIN trabajadores t ON t.id = u.id_trabajador
`;

function conAreas(comunicado) {
  return { ...comunicado, areas: areasDe(comunicado.id) };
}

// RRHH y Gerencia ven todos; los demás, los de toda la empresa y los de su área
// GET /api/comunicados?limite=5
router.get("/", (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 100, 100);
  let comunicados = db.prepare(`${SELECT_COMUNICADO} ORDER BY c.importante DESC, c.fecha_publicacion DESC`).all().map(conAreas);
  const veTodos = ["rrhh", "gerencia"].includes(req.usuario.rol);
  if (!veTodos) comunicados = comunicados.filter((c) => c.areas.length === 0 || c.areas.includes(req.usuario.area));
  res.json(comunicados.slice(0, limite).map((c) => ({
    ...c,
    puede_eliminar: req.usuario.rol === "rrhh" || c.id_autor === req.usuario.id
  })));
});

// POST /api/comunicados  body: { titulo, contenido, areas: [], importante }
router.post("/", permitirRoles("rrhh", "gerencia"), (req, res) => {
  const titulo = String(req.body?.titulo || "").trim();
  const contenido = String(req.body?.contenido || "").trim();
  if (!titulo || !contenido) return res.status(400).json({ error: "titulo y contenido son obligatorios" });
  const areas = [...new Set((req.body?.areas || []).map((a) => String(a).trim()).filter(Boolean))];
  if (areas.length && usuariosDeAreas(areas).length === 0) {
    return res.status(400).json({ error: "Las áreas elegidas no tienen trabajadores activos" });
  }

  db.exec("BEGIN");
  let id;
  try {
    id = db.prepare("INSERT INTO comunicados (titulo, contenido, importante, id_autor) VALUES (?, ?, ?, ?)")
      .run(titulo, contenido, req.body?.importante ? 1 : 0, req.usuario.id).lastInsertRowid;
    const insertarArea = db.prepare("INSERT INTO comunicado_areas (id_comunicado, area) VALUES (?, ?)");
    areas.forEach((a) => insertarArea.run(id, a));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  notificarAreas(areas, "comunicado", `${req.body?.importante ? "Comunicado importante" : "Nuevo comunicado"}: ${titulo}`, "/comunicados", req.usuario.id);
  res.status(201).json(conAreas(db.prepare(`${SELECT_COMUNICADO} WHERE c.id = ?`).get(id)));
});

// RRHH elimina cualquiera; Gerencia, los suyos
// DELETE /api/comunicados/:id
router.delete("/:id", permitirRoles("rrhh", "gerencia"), (req, res) => {
  const comunicado = db.prepare("SELECT * FROM comunicados WHERE id = ?").get(req.params.id);
  if (!comunicado) return res.status(404).json({ error: "Comunicado no encontrado" });
  if (req.usuario.rol !== "rrhh" && comunicado.id_autor !== req.usuario.id) {
    return res.status(403).json({ error: "Solo puede eliminar sus propios comunicados" });
  }
  db.exec("BEGIN");
  db.prepare("DELETE FROM comunicado_areas WHERE id_comunicado = ?").run(comunicado.id);
  db.prepare("DELETE FROM comunicados WHERE id = ?").run(comunicado.id);
  db.exec("COMMIT");
  res.json({ mensaje: "Comunicado eliminado" });
});

module.exports = router;
