// Trazabilidad hacia adelante (documento, sección 6.2): lote de recepción -> lotes de producto terminado ->
// pedidos y clientes. La comparten la trazabilidad de recepción (LR-, ING-) y la de almacén (LP-).
const db = require("../db/database");

// Pedidos a los que se despachó un lote, con las unidades devueltas de ese lote en cada pedido
function despachosDeLote(idLote) {
  return db.prepare(`
    SELECT m.id_pedido, pe.codigo AS codigo_pedido, c.codigo AS codigo_cliente, c.nombre AS cliente, c.ciudad,
           m.fecha_hora, -m.cantidad AS cantidad, d.coincide_fefo,
           COALESCE((SELECT SUM(dv.cantidad) FROM devoluciones dv
                     WHERE dv.id_pedido = m.id_pedido AND dv.id_lote_producto = m.id_lote_producto), 0) AS devuelto
    FROM movimientos_inventario m
    JOIN pedidos pe ON pe.id = m.id_pedido
    JOIN clientes c ON c.id = pe.id_cliente
    JOIN despachos d ON d.id_pedido = pe.id
    WHERE m.id_lote_producto = ? AND m.tipo = 'despacho'
    ORDER BY m.fecha_hora
  `).all(idLote);
}

// Lotes de producto terminado elaborados con la leche de un ingreso, cada uno con sus despachos
function destinoDeIngreso(idIngreso) {
  return db.prepare(`
    SELECT l.id, l.codigo, l.estado, l.unidades, l.fecha_elaboracion, l.fecha_vencimiento, p.nombre AS producto, p.presentacion,
           COALESCE((SELECT SUM(m.cantidad) FROM movimientos_inventario m WHERE m.id_lote_producto = l.id), 0) AS stock
    FROM lote_producto_origen o
    JOIN lotes_producto l ON l.id = o.id_lote_producto
    JOIN productos p ON p.id = l.id_producto
    WHERE o.id_ingreso = ? ORDER BY l.fecha_elaboracion, l.codigo
  `).all(idIngreso).map((l) => ({ ...l, despachos: despachosDeLote(l.id) }));
}

module.exports = { despachosDeLote, destinoDeIngreso };
