// Reglas puras de producto terminado, inventario y despacho (sin base de datos, con pruebas en test/inventario.test.js)
const { sumarDias, aFechaLocal } = require("./fechas");

// Un lote está "por vencer" cuando le queda un cuarto de su vida útil o menos (al menos 1 día):
// la pasteurizada (7 días) avisa con 2 días de anticipación, la UHT (120 días) con 30.
const FRACCION_POR_VENCER = 0.25;

function fechaVencimiento(fechaElaboracion, vidaUtilDias) {
  return sumarDias(fechaElaboracion, vidaUtilDias);
}

// Un lote vence al terminar su fecha de vencimiento: ese mismo día todavía se puede despachar
function estaVencido(lote, fecha) {
  return lote.fecha_vencimiento < fecha;
}

function diasParaVencer(lote, fecha) {
  return Math.round((aFechaLocal(lote.fecha_vencimiento) - aFechaLocal(fecha)) / 86400000);
}

function porVencer(lote, fecha, vidaUtilDias) {
  const dias = diasParaVencer(lote, fecha);
  return dias >= 0 && dias <= Math.max(1, Math.ceil(vidaUtilDias * FRACCION_POR_VENCER));
}

// Validación de la recepción en almacén: unidades recibidas entre 0 y las envasadas; si faltan, observación
function errorRecepcion(unidadesEnvasadas, unidadesRecibidas, observacion) {
  if (!Number.isInteger(unidadesRecibidas) || unidadesRecibidas < 0) return "Las unidades recibidas deben ser un número entero mayor o igual a 0";
  if (unidadesRecibidas > unidadesEnvasadas) return `No se pueden recibir más unidades que las envasadas (${unidadesEnvasadas})`;
  if (unidadesRecibidas < unidadesEnvasadas && !observacion) return "Indique en la observación por qué faltan unidades";
  return null;
}

// Situación de un lote para el inventario: por_recibir, agotado, vencido, por_vencer o vigente
function situacionLote(lote, fecha, vidaUtilDias) {
  if (lote.estado !== "en_almacen") return "por_recibir";
  if (lote.stock <= 0) return "agotado";
  if (estaVencido(lote, fecha)) return "vencido";
  return porVencer(lote, fecha, vidaUtilDias) ? "por_vencer" : "vigente";
}

// Lote que se puede despachar en la fecha: recibido en almacén, con stock y sin vencer
function despachable(lote, fecha) {
  return lote.estado === "en_almacen" && lote.stock > 0 && !estaVencido(lote, fecha);
}

// FEFO (first expired, first out): reparte la cantidad entre los lotes despachables de un producto, empezando
// por el que vence primero. lotes: [{ id, codigo, estado, fecha_elaboracion, fecha_vencimiento, stock }].
// Devuelve { asignacion: [{ id_lote_producto, codigo, fecha_vencimiento, cantidad }], faltante }.
function proponerFEFO(lotes, cantidad, fecha) {
  const ordenados = lotes
    .filter((l) => despachable(l, fecha))
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento)
      || a.fecha_elaboracion.localeCompare(b.fecha_elaboracion)
      || a.codigo.localeCompare(b.codigo));
  const asignacion = [];
  let restante = cantidad;
  for (const lote of ordenados) {
    if (restante === 0) break;
    const toma = Math.min(lote.stock, restante);
    asignacion.push({ id_lote_producto: lote.id, codigo: lote.codigo, fecha_vencimiento: lote.fecha_vencimiento, cantidad: toma });
    restante -= toma;
  }
  return { asignacion, faltante: restante };
}

// ¿La asignación elegida usa los mismos lotes y unidades que la propuesta? (el orden no importa)
function coincideConPropuesta(propuesta, elegida) {
  const aMapa = (lista) => {
    const mapa = new Map();
    lista.filter((x) => x.cantidad > 0).forEach((x) => mapa.set(x.id_lote_producto, (mapa.get(x.id_lote_producto) || 0) + x.cantidad));
    return mapa;
  };
  const a = aMapa(propuesta);
  const b = aMapa(elegida);
  return a.size === b.size && [...a].every(([id, cantidad]) => b.get(id) === cantidad);
}

module.exports = {
  fechaVencimiento, estaVencido, diasParaVencer, porVencer, situacionLote, errorRecepcion, despachable, proponerFEFO,
  coincideConPropuesta
};
