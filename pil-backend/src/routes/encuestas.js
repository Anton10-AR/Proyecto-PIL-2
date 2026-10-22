// Rutas de Encuestas de clima organizacional.
// - RRHH crea encuestas (borrador), las publica para toda la empresa o para áreas, y ve resultados.
// - Gerencia ve resultados. Todos responden las encuestas abiertas dirigidas a su área, una sola vez.
// - Las respuestas son anónimas (ver comentario del esquema) y los resultados de un grupo solo se
//   muestran con 3 o más respuestas (utils/encuestas.js).
const express = require("express");
const crypto = require("node:crypto");
const db = require("../db/database");
const { permitirRoles } = require("../middleware/auth");
const { hoyLocal, esFecha } = require("../utils/fechas");
const { notificarAreas, usuariosDeAreas } = require("../utils/notificar");
const { resumirResultados, promediosPorArea, MINIMO_RESPUESTAS } = require("../utils/encuestas");

const router = express.Router();

const TIPOS = ["escala", "opcion", "texto"];

class ErrorValidacion extends Error {
  constructor(mensaje, estado = 400) { super(mensaje); this.estado = estado; }
}

function responderError(res, err) {
  if (err instanceof ErrorValidacion) return res.status(err.estado).json({ error: err.message });
  throw err;
}

function areasDe(idEncuesta) {
  return db.prepare("SELECT area FROM encuesta_areas WHERE id_encuesta = ? ORDER BY area").all(idEncuesta).map((f) => f.area);
}

function preguntasDe(idEncuesta) {
  return db.prepare("SELECT * FROM preguntas_encuesta WHERE id_encuesta = ? ORDER BY orden, id").all(idEncuesta)
    .map((p) => ({ ...p, opciones: p.opciones ? JSON.parse(p.opciones) : null }));
}

// borrador | proxima | abierta | cerrada
function estadoActual(encuesta, hoy = hoyLocal()) {
  if (encuesta.estado === "borrador") return "borrador";
  if (hoy < encuesta.fecha_apertura) return "proxima";
  if (hoy > encuesta.fecha_cierre) return "cerrada";
  return "abierta";
}

function esDestinatario(areas, areaTrabajador) {
  return areas.length === 0 || areas.includes(areaTrabajador);
}

function completar(encuesta, usuario) {
  const areas = areasDe(encuesta.id);
  const respondida = Boolean(db.prepare(
    "SELECT 1 FROM encuesta_respondida WHERE id_encuesta = ? AND id_trabajador = ?"
  ).get(encuesta.id, usuario.id_trabajador));
  const respuestas = db.prepare("SELECT COUNT(*) AS total FROM envios_encuesta WHERE id_encuesta = ?").get(encuesta.id).total;
  return {
    ...encuesta,
    areas,
    estado_actual: estadoActual(encuesta),
    respondida,
    es_destinatario: esDestinatario(areas, usuario.area),
    respuestas,
    destinatarios: usuariosDeAreas(areas).length,
    preguntas_total: db.prepare("SELECT COUNT(*) AS total FROM preguntas_encuesta WHERE id_encuesta = ?").get(encuesta.id).total
  };
}

const puedeGestionar = (usuario) => usuario.rol === "rrhh" || usuario.rol === "gerencia";

// Valida el cuerpo de una encuesta. Devuelve los datos normalizados.
function validarEncuesta(cuerpo) {
  const titulo = String(cuerpo.titulo || "").trim();
  if (!titulo) throw new ErrorValidacion("titulo es obligatorio");
  if (!esFecha(cuerpo.fecha_apertura) || !esFecha(cuerpo.fecha_cierre)) {
    throw new ErrorValidacion("fecha_apertura y fecha_cierre deben tener formato YYYY-MM-DD");
  }
  if (cuerpo.fecha_cierre < cuerpo.fecha_apertura) throw new ErrorValidacion("La fecha de cierre no puede ser anterior a la de apertura");
  const areas = [...new Set((cuerpo.areas || []).map((a) => String(a).trim()).filter(Boolean))];
  const preguntas = Array.isArray(cuerpo.preguntas) ? cuerpo.preguntas : [];
  if (preguntas.length === 0) throw new ErrorValidacion("La encuesta necesita al menos una pregunta");
  const normalizadas = preguntas.map((p, i) => {
    const texto = String(p.texto || "").trim();
    if (!texto) throw new ErrorValidacion(`La pregunta ${i + 1} no tiene texto`);
    if (!TIPOS.includes(p.tipo)) throw new ErrorValidacion(`La pregunta ${i + 1} tiene un tipo inválido`);
    let opciones = null;
    if (p.tipo === "opcion") {
      opciones = [...new Set((p.opciones || []).map((o) => String(o).trim()).filter(Boolean))];
      if (opciones.length < 2) throw new ErrorValidacion(`La pregunta ${i + 1} necesita al menos dos opciones distintas`);
    }
    return { texto, tipo: p.tipo, opciones, obligatoria: p.obligatoria === false ? 0 : 1 };
  });
  return {
    titulo, descripcion: cuerpo.descripcion ? String(cuerpo.descripcion).trim() : null,
    fecha_apertura: cuerpo.fecha_apertura, fecha_cierre: cuerpo.fecha_cierre, areas, preguntas: normalizadas
  };
}

function guardarDetalle(idEncuesta, datos) {
  db.prepare("DELETE FROM encuesta_areas WHERE id_encuesta = ?").run(idEncuesta);
  db.prepare("DELETE FROM preguntas_encuesta WHERE id_encuesta = ?").run(idEncuesta);
  const insertarArea = db.prepare("INSERT INTO encuesta_areas (id_encuesta, area) VALUES (?, ?)");
  datos.areas.forEach((a) => insertarArea.run(idEncuesta, a));
  const insertarPregunta = db.prepare(
    "INSERT INTO preguntas_encuesta (id_encuesta, texto, tipo, opciones, obligatoria, orden) VALUES (?, ?, ?, ?, ?, ?)"
  );
  datos.preguntas.forEach((p, i) => insertarPregunta.run(idEncuesta, p.texto, p.tipo, p.opciones ? JSON.stringify(p.opciones) : null, p.obligatoria, i));
}

function enTransaccion(fn) {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// Encuestas del usuario (publicadas y dirigidas a su área) o, con alcance=gestion, todas (RRHH y Gerencia)
// GET /api/encuestas?alcance=mias|gestion
router.get("/", (req, res) => {
  const { alcance = "mias" } = req.query;
  if (alcance === "gestion") {
    if (!puedeGestionar(req.usuario)) return res.status(403).json({ error: "No tiene permiso" });
    const todas = db.prepare("SELECT * FROM encuestas ORDER BY fecha_apertura DESC").all();
    return res.json(todas.map((e) => completar(e, req.usuario)));
  }
  const publicadas = db.prepare("SELECT * FROM encuestas WHERE estado = 'publicada' ORDER BY fecha_cierre DESC").all();
  res.json(publicadas.map((e) => completar(e, req.usuario)).filter((e) => e.es_destinatario));
});

// GET /api/encuestas/:id
router.get("/:id", (req, res) => {
  const encuesta = db.prepare("SELECT * FROM encuestas WHERE id = ?").get(req.params.id);
  if (!encuesta) return res.status(404).json({ error: "Encuesta no encontrada" });
  const datos = completar(encuesta, req.usuario);
  if (!puedeGestionar(req.usuario) && (encuesta.estado !== "publicada" || !datos.es_destinatario)) {
    return res.status(403).json({ error: "Esta encuesta no está dirigida a usted" });
  }
  res.json({ ...datos, preguntas: preguntasDe(encuesta.id) });
});

// POST /api/encuestas  body: { titulo, descripcion, fecha_apertura, fecha_cierre, areas: [], preguntas: [{ texto, tipo, opciones, obligatoria }] }
router.post("/", permitirRoles("rrhh"), (req, res) => {
  try {
    const datos = validarEncuesta(req.body || {});
    const id = enTransaccion(() => {
      const nueva = db.prepare(`
        INSERT INTO encuestas (titulo, descripcion, fecha_apertura, fecha_cierre, id_creado_por) VALUES (?, ?, ?, ?, ?)
      `).run(datos.titulo, datos.descripcion, datos.fecha_apertura, datos.fecha_cierre, req.usuario.id).lastInsertRowid;
      guardarDetalle(nueva, datos);
      return nueva;
    });
    res.status(201).json(completar(db.prepare("SELECT * FROM encuestas WHERE id = ?").get(id), req.usuario));
  } catch (err) { responderError(res, err); }
});

// PUT /api/encuestas/:id  (solo en borrador)
router.put("/:id", permitirRoles("rrhh"), (req, res) => {
  try {
    const encuesta = db.prepare("SELECT * FROM encuestas WHERE id = ?").get(req.params.id);
    if (!encuesta) throw new ErrorValidacion("Encuesta no encontrada", 404);
    if (encuesta.estado !== "borrador") throw new ErrorValidacion("Una encuesta publicada ya no se puede modificar", 409);
    const datos = validarEncuesta(req.body || {});
    enTransaccion(() => {
      db.prepare("UPDATE encuestas SET titulo = ?, descripcion = ?, fecha_apertura = ?, fecha_cierre = ? WHERE id = ?")
        .run(datos.titulo, datos.descripcion, datos.fecha_apertura, datos.fecha_cierre, encuesta.id);
      guardarDetalle(encuesta.id, datos);
    });
    res.json(completar(db.prepare("SELECT * FROM encuestas WHERE id = ?").get(encuesta.id), req.usuario));
  } catch (err) { responderError(res, err); }
});

// DELETE /api/encuestas/:id  (solo en borrador)
router.delete("/:id", permitirRoles("rrhh"), (req, res) => {
  const encuesta = db.prepare("SELECT * FROM encuestas WHERE id = ?").get(req.params.id);
  if (!encuesta) return res.status(404).json({ error: "Encuesta no encontrada" });
  if (encuesta.estado !== "borrador") return res.status(409).json({ error: "Una encuesta publicada no se puede eliminar" });
  enTransaccion(() => {
    db.prepare("DELETE FROM encuesta_areas WHERE id_encuesta = ?").run(encuesta.id);
    db.prepare("DELETE FROM preguntas_encuesta WHERE id_encuesta = ?").run(encuesta.id);
    db.prepare("DELETE FROM encuestas WHERE id = ?").run(encuesta.id);
  });
  res.json({ mensaje: "Encuesta eliminada" });
});

// Publicar: avisa a los destinatarios
// POST /api/encuestas/:id/publicar
router.post("/:id/publicar", permitirRoles("rrhh"), (req, res) => {
  const encuesta = db.prepare("SELECT * FROM encuestas WHERE id = ?").get(req.params.id);
  if (!encuesta) return res.status(404).json({ error: "Encuesta no encontrada" });
  if (encuesta.estado !== "borrador") return res.status(409).json({ error: "La encuesta ya está publicada" });
  if (encuesta.fecha_cierre < hoyLocal()) return res.status(409).json({ error: "La fecha de cierre ya pasó; corríjala antes de publicar" });
  db.prepare("UPDATE encuestas SET estado = 'publicada' WHERE id = ?").run(encuesta.id);
  const desde = encuesta.fecha_apertura > hoyLocal() ? ` desde el ${encuesta.fecha_apertura}` : "";
  notificarAreas(areasDe(encuesta.id), "encuesta",
    `Nueva encuesta anónima${desde}: "${encuesta.titulo}" (hasta el ${encuesta.fecha_cierre})`, `/encuestas/${encuesta.id}`);
  res.json(completar(db.prepare("SELECT * FROM encuestas WHERE id = ?").get(encuesta.id), req.usuario));
});

// Responder (una sola vez). Se guarda por separado que respondió y qué respondió.
// POST /api/encuestas/:id/responder  body: { respuestas: [{ id_pregunta, valor }] }
router.post("/:id/responder", (req, res) => {
  try {
    const encuesta = db.prepare("SELECT * FROM encuestas WHERE id = ?").get(req.params.id);
    if (!encuesta) throw new ErrorValidacion("Encuesta no encontrada", 404);
    const estado = estadoActual(encuesta);
    if (estado !== "abierta") throw new ErrorValidacion(estado === "proxima" ? "La encuesta todavía no abrió" : "La encuesta no está abierta", 409);
    if (!esDestinatario(areasDe(encuesta.id), req.usuario.area)) throw new ErrorValidacion("Esta encuesta no está dirigida a su área", 403);
    if (db.prepare("SELECT 1 FROM encuesta_respondida WHERE id_encuesta = ? AND id_trabajador = ?").get(encuesta.id, req.usuario.id_trabajador)) {
      throw new ErrorValidacion("Ya respondió esta encuesta", 409);
    }

    const recibidas = new Map((req.body?.respuestas || []).map((r) => [Number(r.id_pregunta), r.valor]));
    const filas = preguntasDe(encuesta.id).map((p) => {
      const valor = recibidas.get(p.id);
      const vacia = valor === undefined || valor === null || String(valor).trim() === "";
      if (vacia) {
        if (p.obligatoria) throw new ErrorValidacion(`Responda la pregunta: "${p.texto}"`);
        return null;
      }
      if (p.tipo === "escala") {
        const n = Number(valor);
        if (!Number.isInteger(n) || n < 1 || n > 5) throw new ErrorValidacion(`"${p.texto}" se responde con un valor de 1 a 5`);
        return { id_pregunta: p.id, valor_numero: n, valor_texto: null };
      }
      if (p.tipo === "opcion" && !p.opciones.includes(valor)) throw new ErrorValidacion(`Elija una opción válida en "${p.texto}"`);
      const texto = String(valor).trim();
      if (texto.length > 2000) throw new ErrorValidacion("Las respuestas de texto admiten hasta 2000 caracteres");
      return { id_pregunta: p.id, valor_numero: null, valor_texto: texto };
    }).filter(Boolean);

    enTransaccion(() => {
      db.prepare("INSERT INTO encuesta_respondida (id_encuesta, id_trabajador) VALUES (?, ?)").run(encuesta.id, req.usuario.id_trabajador);
      const idEnvio = crypto.randomUUID();
      db.prepare("INSERT INTO envios_encuesta (id, id_encuesta, area) VALUES (?, ?, ?)").run(idEnvio, encuesta.id, req.usuario.area || null);
      const insertar = db.prepare("INSERT INTO respuestas_encuesta (id_envio, id_pregunta, valor_numero, valor_texto) VALUES (?, ?, ?, ?)");
      filas.forEach((f) => insertar.run(idEnvio, f.id_pregunta, f.valor_numero, f.valor_texto));
    });
    res.status(201).json({ mensaje: "¡Gracias! Su respuesta se registró de forma anónima." });
  } catch (err) { responderError(res, err); }
});

// Resultados agregados (RRHH y Gerencia). Con ?area=X filtra por área (si tiene suficientes respuestas).
// GET /api/encuestas/:id/resultados?area=Producción
router.get("/:id/resultados", permitirRoles("rrhh", "gerencia"), (req, res) => {
  const encuesta = db.prepare("SELECT * FROM encuestas WHERE id = ?").get(req.params.id);
  if (!encuesta) return res.status(404).json({ error: "Encuesta no encontrada" });
  const preguntas = preguntasDe(encuesta.id);
  const todos = db.prepare("SELECT id, area FROM envios_encuesta WHERE id_encuesta = ?").all(encuesta.id);
  const respuestas = db.prepare(`
    SELECT r.* FROM respuestas_encuesta r JOIN envios_encuesta e ON e.id = r.id_envio WHERE e.id_encuesta = ?
  `).all(encuesta.id);

  const envios = req.query.area ? todos.filter((e) => e.area === req.query.area) : todos;
  res.json({
    encuesta: completar(encuesta, req.usuario),
    minimo: MINIMO_RESPUESTAS,
    area: req.query.area || null,
    resultados: resumirResultados(preguntas, envios, respuestas),
    por_area: promediosPorArea(preguntas, todos, respuestas)
  });
});

module.exports = router;
