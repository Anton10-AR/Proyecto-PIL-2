// Conexión a SQLite y creación de tablas (se ejecuta una sola vez al arrancar el servidor)
// Usa el módulo nativo de Node.js (node:sqlite), disponible desde Node 22 sin instalar nada más.
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const { crearEsquema } = require("./esquema");

const dbPath = path.join(__dirname, "..", "..", "pil_rrhh.db");
const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON;");
crearEsquema(db);

module.exports = db;
