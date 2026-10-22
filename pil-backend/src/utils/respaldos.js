// Respaldos (RNF06): un ZIP con una copia consistente de la base de datos (VACUUM INTO, válido
// aunque el servidor esté en uso) y la carpeta de archivos subidos.
// - Manuales: los genera RRHH desde la app; se conservan todos.
// - Automáticos: uno por día al arrancar el servidor y cada hora se revisa si falta el del día;
//   se conservan los últimos 7.
const fs = require("fs");
const path = require("path");
const { ZipArchive } = require("archiver");
const db = require("../db/database");
const { hoyLocal } = require("./fechas");
const { CARPETA: CARPETA_ARCHIVOS } = require("../routes/archivos");

const CARPETA_RESPALDOS = path.join(__dirname, "..", "..", "respaldos");
const AUTOMATICOS_A_CONSERVAR = 7;
const PATRON = /^respaldo_(manual|automatico)_(\d{4}-\d{2}-\d{2})_(\d{6})\.zip$/;

fs.mkdirSync(CARPETA_RESPALDOS, { recursive: true });

function marcaDeTiempo() {
  const f = new Date();
  const dos = (n) => String(n).padStart(2, "0");
  return `${hoyLocal()}_${dos(f.getHours())}${dos(f.getMinutes())}${dos(f.getSeconds())}`;
}

async function crearRespaldo(tipo = "manual") {
  const nombre = `respaldo_${tipo}_${marcaDeTiempo()}.zip`;
  const copiaBD = path.join(CARPETA_RESPALDOS, `tmp_${Date.now()}.db`);
  db.exec(`VACUUM INTO '${copiaBD.replace(/'/g, "''")}'`);

  try {
    await new Promise((resolve, reject) => {
      const salida = fs.createWriteStream(path.join(CARPETA_RESPALDOS, nombre));
      const zip = new ZipArchive({ zlib: { level: 9 } });
      salida.on("close", resolve);
      zip.on("error", reject);
      zip.pipe(salida);
      zip.file(copiaBD, { name: "pil_rrhh.db" });
      if (fs.existsSync(CARPETA_ARCHIVOS)) zip.directory(CARPETA_ARCHIVOS, "uploads");
      zip.append(
        `Respaldo ${tipo} del Sistema de RR.HH. PIL Andina\nGenerado: ${new Date().toLocaleString("es-BO")}\n\n` +
        "Para restaurar: detener el backend, reemplazar pil-backend/pil_rrhh.db y la carpeta pil-backend/uploads con el contenido de este ZIP y volver a iniciarlo.\n",
        { name: "LEEME.txt" }
      );
      zip.finalize();
    });
  } finally {
    fs.rmSync(copiaBD, { force: true });
  }
  if (tipo === "automatico") depurarAutomaticos();
  return describir(nombre);
}

function describir(nombre) {
  const [, tipo, fecha, hora] = nombre.match(PATRON);
  const { size } = fs.statSync(path.join(CARPETA_RESPALDOS, nombre));
  return { nombre, tipo, fecha: `${fecha} ${hora.slice(0, 2)}:${hora.slice(2, 4)}:${hora.slice(4)}`, tamano: size };
}

function listarRespaldos() {
  return fs.readdirSync(CARPETA_RESPALDOS)
    .filter((n) => PATRON.test(n))
    .map(describir)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function depurarAutomaticos() {
  listarRespaldos().filter((r) => r.tipo === "automatico").slice(AUTOMATICOS_A_CONSERVAR)
    .forEach((r) => fs.rmSync(path.join(CARPETA_RESPALDOS, r.nombre), { force: true }));
}

// Ruta segura de un respaldo existente (o null): evita salir de la carpeta con "../"
function rutaRespaldo(nombre) {
  if (!PATRON.test(nombre)) return null;
  const ruta = path.join(CARPETA_RESPALDOS, nombre);
  return fs.existsSync(ruta) ? ruta : null;
}

async function asegurarRespaldoDelDia() {
  const hoy = hoyLocal();
  if (listarRespaldos().some((r) => r.tipo === "automatico" && r.fecha.startsWith(hoy))) return;
  try {
    const r = await crearRespaldo("automatico");
    console.log(`Respaldo automático creado: ${r.nombre}`);
  } catch (err) {
    console.error("No se pudo crear el respaldo automático:", err.message);
  }
}

function programarRespaldoDiario() {
  asegurarRespaldoDelDia();
  setInterval(asegurarRespaldoDelDia, 60 * 60 * 1000).unref();
}

module.exports = { crearRespaldo, listarRespaldos, rutaRespaldo, programarRespaldoDiario, CARPETA_RESPALDOS };
