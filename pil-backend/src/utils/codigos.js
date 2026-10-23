// Códigos correlativos por día (ING-, LR-, LP-, PED-AAAAMMDD-NN), compartidos por los módulos del proceso
const db = require("../db/database");
const { codigoCorrelativo } = require("./recepcion");

// Siguiente número correlativo del día para un código: toma el mayor existente + 1
function siguienteCodigo(tabla, columna, prefijo, fecha) {
  const base = codigoCorrelativo(prefijo, fecha, 0).slice(0, -2);
  const fila = db.prepare(`SELECT MAX(${columna}) AS ultimo FROM ${tabla} WHERE ${columna} LIKE ?`).get(`${base}%`);
  const numero = fila.ultimo ? Number(fila.ultimo.slice(base.length)) + 1 : 1;
  return codigoCorrelativo(prefijo, fecha, numero);
}

module.exports = { siguienteCodigo };
