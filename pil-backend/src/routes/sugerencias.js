// Rutas del Buzón de sugerencias. Cualquier usuario envía (con anonimato opcional); RRHH las gestiona
// y responde; Gerencia las consulta. Las anónimas no guardan autor: se siguen con un código.
const express = require("express");
const crypto = require("node:crypto");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");
const { notificarRol, notificarTrabajador } = require("../utils/notificar");

const router = express.Router();

const CATEGORIAS = ["condiciones", "procesos", "seguridad", "bienestar", "comunicacion", "otro"];
const ESTADOS = ["recibida", "en_revision", "atendida"];

// Código legible sin caracteres ambiguos (sin 0/O ni 1/I)
function generarCodigo() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(8), (b) => alfabeto[b % alfabeto.length]).join("");
}

// Datos visibles: el autor solo aparece si no es anónima
const SELECT_SUGERENCIA = `
  SELECT s.id, s.id_trabajador, s.categoria, s.texto, s.estado, s.respuesta, s.fecha, s.fecha_respuesta,
         CASE WHEN s.id_trabajador IS NULL THEN 1 ELSE 0 END AS anonima,
         t.nombre || ' ' || t.apellido AS autor, t.area,
         r.nombre || ' ' || r.apellido AS respondido_por
  FROM sugerencias s
  LEFT JOIN trabajadores t ON t.id = s.id_trabajador
  LEFT JOIN usuarios ur ON ur.id = s.id_respondido_por
  LEFT JOIN trabajadores r ON r.id = ur.id_trabajador
`;

// POST /api/sugerencias  body: { categoria, texto, anonima }
router.post("/", (req, res) => {
  const { categoria, anonima } = req.body || {};
  const texto = String(req.body?.texto || "").trim();
  if (!CATEGORIAS.includes(categoria)) return res.status(400).json({ error: "Seleccione una categoría válida" });
  if (texto.length < 10) return res.status(400).json({ error: "Escriba la sugerencia (al menos 10 caracteres)" });
  if (texto.length > 2000) return res.status(400).json({ error: "La sugerencia admite hasta 2000 caracteres" });

  const codigo = anonima ? generarCodigo() : null;
  const id = db.prepare("INSERT INTO sugerencias (id_trabajador, codigo_seguimiento, categoria, texto) VALUES (?, ?, ?, ?)")
    .run(anonima ? null : req.usuario.id_trabajador, codigo, categoria, texto).lastInsertRowid;
  notificarRol("rrhh", "sugerencia", `Nueva sugerencia${anonima ? " anónima" : ""} en el buzón`, "/sugerencias");
  res.status(201).json({ id, codigo_seguimiento: codigo });
});

// Listado: mias (solo las identificadas del usuario) o todas (RRHH y Gerencia)
// GET /api/sugerencias?alcance=mias|todas&estado=recibida&categoria=seguridad
router.get("/", (req, res) => {
  const { alcance = "mias", estado, categoria } = req.query;
  let sql = `${SELECT_SUGERENCIA} WHERE 1=1`;
  const params = [];
  if (alcance === "mias") {
    sql += " AND s.id_trabajador = ?";
    params.push(req.usuario.id_trabajador);
  } else if (!["rrhh", "gerencia"].includes(req.usuario.rol)) {
    return res.status(403).json({ error: "No tiene permiso para ver todas las sugerencias" });
  }
  if (estado) { sql += " AND s.estado = ?"; params.push(estado); }
  if (categoria) { sql += " AND s.categoria = ?"; params.push(categoria); }
  sql += " ORDER BY s.estado = 'atendida', s.fecha DESC, s.id DESC";
  res.json(db.prepare(sql).all(...params));
});

// Seguimiento de una sugerencia anónima por su código
// GET /api/sugerencias/seguimiento/:codigo
router.get("/seguimiento/:codigo", (req, res) => {
  const sugerencia = db.prepare(`${SELECT_SUGERENCIA} WHERE s.codigo_seguimiento = ?`).get(String(req.params.codigo).trim().toUpperCase());
  if (!sugerencia) return res.status(404).json({ error: "No hay ninguna sugerencia con ese código" });
  res.json(sugerencia);
});

// Cambiar estado y responder (RRHH). Atendida exige una respuesta.
// PUT /api/sugerencias/:id  body: { estado, respuesta }
router.put("/:id", permitirRoles("rrhh"), (req, res) => {
  const actual = db.prepare("SELECT * FROM sugerencias WHERE id = ?").get(req.params.id);
  if (!actual) return res.status(404).json({ error: "Sugerencia no encontrada" });
  const estado = req.body?.estado ?? actual.estado;
  if (!ESTADOS.includes(estado)) return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS.join(", ")}` });
  const respuesta = req.body?.respuesta === undefined ? actual.respuesta : (String(req.body.respuesta).trim() || null);
  if (estado === "atendida" && !respuesta) return res.status(400).json({ error: "Para marcarla como atendida escriba una respuesta" });

  const respondida = respuesta && respuesta !== actual.respuesta;
  db.prepare(`
    UPDATE sugerencias SET estado = ?, respuesta = ?,
      id_respondido_por = CASE WHEN ? THEN ? ELSE id_respondido_por END,
      fecha_respuesta = CASE WHEN ? THEN datetime('now', 'localtime') ELSE fecha_respuesta END
    WHERE id = ?
  `).run(estado, respuesta, respondida ? 1 : 0, req.usuario.id, respondida ? 1 : 0, actual.id);

  if (actual.id_trabajador && (respondida || estado !== actual.estado)) {
    const textos = { recibida: "fue recibida", en_revision: "está en revisión", atendida: "fue atendida" };
    notificarTrabajador(actual.id_trabajador, "sugerencia", `Su sugerencia ${textos[estado]}${respondida ? " y tiene una respuesta de RRHH" : ""}`, "/sugerencias");
  }
  res.json(db.prepare(`${SELECT_SUGERENCIA} WHERE s.id = ?`).get(actual.id));
});

module.exports = router;
