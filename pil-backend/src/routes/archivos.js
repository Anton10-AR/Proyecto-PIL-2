// Rutas de Archivos adjuntos (respaldos de permisos y certificados de capacitación).
// Se guardan en pil-backend/uploads/ con un nombre aleatorio; la BD conserva el nombre original.
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("node:crypto");
const multer = require("multer");
const db = require("../db/database");
const { puedeVerTrabajador } = require("../utils/visibilidad");

const router = express.Router();

const CARPETA = path.join(__dirname, "..", "..", "uploads");
const TAMANO_MAXIMO = 5 * 1024 * 1024;
const TIPOS_PERMITIDOS = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp"
};

fs.mkdirSync(CARPETA, { recursive: true });

const subida = multer({
  storage: multer.diskStorage({
    destination: CARPETA,
    filename: (req, archivo, cb) => cb(null, crypto.randomUUID() + TIPOS_PERMITIDOS[archivo.mimetype])
  }),
  limits: { fileSize: TAMANO_MAXIMO, files: 1 },
  fileFilter: (req, archivo, cb) => {
    if (TIPOS_PERMITIDOS[archivo.mimetype]) return cb(null, true);
    cb(Object.assign(new Error("Solo se permiten archivos PDF o imágenes (PNG, JPG, WEBP)"), { esValidacion: true }));
  }
}).single("archivo");

// Trabajadores "dueños" de un archivo según dónde se usa. Cada fase que adjunte archivos agrega su consulta.
const REFERENCIAS = [
  "SELECT id_trabajador FROM solicitudes WHERE id_archivo_respaldo = ?",
  "SELECT id_trabajador FROM participantes_capacitacion WHERE id_archivo_certificado = ?"
];

// Valida que un archivo recién subido pueda asociarse: debe existir, haberlo subido el usuario
// y no estar asociado todavía a nada. Devuelve un mensaje de error o null.
function errorArchivoParaAsociar(idArchivo, usuario) {
  const archivo = db.prepare("SELECT * FROM archivos WHERE id = ?").get(idArchivo);
  if (!archivo || archivo.id_subido_por !== usuario.id) return "El archivo adjunto no es válido";
  const enUso = REFERENCIAS.some((sql) => db.prepare(sql).all(archivo.id).length > 0);
  return enUso ? "Ese archivo ya está asociado a otro registro" : null;
}

function puedeVerArchivo(usuario, archivo) {
  if (archivo.id_subido_por === usuario.id) return true;
  return REFERENCIAS.some((sql) =>
    db.prepare(sql).all(archivo.id).some((fila) => puedeVerTrabajador(usuario, fila.id_trabajador))
  );
}

// Subir un archivo. Devuelve su id para asociarlo luego (ej. id_archivo_respaldo de una solicitud).
// POST /api/archivos  (multipart/form-data, campo "archivo")
router.post("/", (req, res) => {
  subida(req, res, (err) => {
    if (err) {
      const mensaje = err.code === "LIMIT_FILE_SIZE" ? "El archivo supera el máximo de 5 MB" : err.esValidacion ? err.message : "No se pudo subir el archivo";
      return res.status(400).json({ error: mensaje });
    }
    if (!req.file) return res.status(400).json({ error: "Debe adjuntar un archivo en el campo 'archivo'" });

    // multer entrega el nombre original en latin1; se convierte para conservar tildes y eñes
    const nombreOriginal = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const resultado = db.prepare(`
      INSERT INTO archivos (nombre_original, ruta, mime, tamano, id_subido_por) VALUES (?, ?, ?, ?, ?)
    `).run(nombreOriginal, req.file.filename, req.file.mimetype, req.file.size, req.usuario.id);

    res.status(201).json(db.prepare(
      "SELECT id, nombre_original, mime, tamano, fecha FROM archivos WHERE id = ?"
    ).get(resultado.lastInsertRowid));
  });
});

// Descargar un archivo (solo quien lo subió o quien puede ver al trabajador al que pertenece)
// GET /api/archivos/:id
router.get("/:id", (req, res) => {
  const archivo = db.prepare("SELECT * FROM archivos WHERE id = ?").get(req.params.id);
  if (!archivo) return res.status(404).json({ error: "Archivo no encontrado" });
  if (!puedeVerArchivo(req.usuario, archivo)) {
    return res.status(403).json({ error: "No tiene permiso para ver este archivo" });
  }

  const ruta = path.join(CARPETA, path.basename(archivo.ruta));
  if (!fs.existsSync(ruta)) return res.status(404).json({ error: "El archivo ya no está disponible" });
  res.type(archivo.mime);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(archivo.nombre_original)}`);
  res.sendFile(ruta);
});

module.exports = { router, CARPETA, errorArchivoParaAsociar };
