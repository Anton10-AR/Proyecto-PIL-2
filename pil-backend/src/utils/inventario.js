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

// Valida los lotes elegidos para despachar un pedido completo. items: [{ id_producto, cantidad }];
// elegida: [{ id_lote_producto, cantidad }]; lotes: Map id -> { id, codigo, id_producto, estado, fecha_vencimiento, stock }.
// Devuelve un mensaje de error o null.
function errorAsignacion(items, elegida, lotes, fecha) {
  if (!Array.isArray(elegida) || !elegida.length) return "Indique los lotes a despachar";
  const porLote = new Map();
  for (const e of elegida) {
    const lote = lotes.get(Number(e.id_lote_producto));
    if (!lote) return "Uno de los lotes elegidos no existe";
    if (!Number.isInteger(e.cantidad) || e.cantidad <= 0) return `La cantidad del lote ${lote.codigo} debe ser un entero mayor a 0`;
    if (!items.some((i) => i.id_producto === lote.id_producto)) return `El lote ${lote.codigo} es de un producto que no está en el pedido`;
    if (!despachable(lote, fecha)) return `El lote ${lote.codigo} no se puede despachar (sin recibir, vencido o sin stock)`;
    porLote.set(lote.id, (porLote.get(lote.id) || 0) + e.cantidad);
    if (porLote.get(lote.id) > lote.stock) return `El lote ${lote.codigo} tiene ${lote.stock} unidades`;
  }
  for (const item of items) {
    const total = elegida.filter((e) => lotes.get(Number(e.id_lote_producto)).id_producto === item.id_producto)
      .reduce((s, e) => s + e.cantidad, 0);
    if (total !== item.cantidad) return `El pedido lleva ${item.cantidad} unidades de un producto y se eligieron ${total}`;
  }
  return null;
}

// Con dos decimales: devoluciones y mermas suelen ser fracciones de 1 % que con uno solo se verían como 0
const porcentaje = (parte, total) => (total ? Math.round((parte / total) * 10000) / 100 : null);

// Indicadores de la etapa 7 (documento, sección 5: despachos con lote registrado y devoluciones), más FEFO,
// entregas a tiempo, faltantes al recibir y mermas.
// despachos: [{ coincide_fefo, a_tiempo, con_lote, unidades }]; lotes recibidos: [{ unidades, unidades_recibidas }];
// unidadesDevueltas y unidadesBaja (ajustes negativos) del período.
function calcularIndicadoresDespacho({ despachos, lotesRecibidos, unidadesDevueltas, unidadesBaja }) {
  const unidadesDespachadas = despachos.reduce((s, d) => s + d.unidades, 0);
  const envasadas = lotesRecibidos.reduce((s, l) => s + l.unidades, 0);
  const recibidas = lotesRecibidos.reduce((s, l) => s + l.unidades_recibidas, 0);
  return {
    despachos: despachos.length,
    unidades_despachadas: unidadesDespachadas,
    // Despachos con lote correctamente registrado ÷ despachos totales × 100
    pct_con_lote: porcentaje(despachos.filter((d) => d.con_lote).length, despachos.length),
    // Despachos según FEFO (los lotes que vencen primero) ÷ despachos × 100
    pct_fefo: porcentaje(despachos.filter((d) => d.coincide_fefo).length, despachos.length),
    // Despachados hasta la fecha de entrega ÷ despachos × 100
    pct_a_tiempo: porcentaje(despachos.filter((d) => d.a_tiempo).length, despachos.length),
    // Unidades devueltas por clientes ÷ unidades despachadas × 100
    unidades_devueltas: unidadesDevueltas,
    pct_devolucion: porcentaje(unidadesDevueltas, unidadesDespachadas),
    // Faltantes al recibir en almacén ÷ unidades envasadas × 100
    pct_faltante_recepcion: porcentaje(envasadas - recibidas, envasadas),
    // Bajas (merma, vencidos) ÷ unidades recibidas × 100
    unidades_baja: unidadesBaja,
    pct_merma: porcentaje(unidadesBaja, recibidas)
  };
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
  errorAsignacion, coincideConPropuesta, calcularIndicadoresDespacho
};
