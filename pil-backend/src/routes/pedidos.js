// Pedidos y despacho (etapa 7 del proceso, documento sección 5: "pedidos despachados, identificados por lote").
// Flujo: atención de pedidos registra el pedido (cliente, productos y cantidades, sin precios) -> el almacén
// lo despacha completo: el sistema propone los lotes por FEFO y apartarse exige motivo -> si el cliente devuelve
// producto, el almacén registra la devolución por lote (no vuelve al stock).
// Los permisos dependen del puesto en el proceso (PUESTOS_ALMACEN en utils/puestos.js).
const express = require("express");
const db = require("../db/database");
const { permitirAccion, notificarPuestos, PUESTOS_ALMACEN } = require("../utils/puestos");
const { notificarTrabajador } = require("../utils/notificar");
const { siguienteCodigo } = require("../utils/codigos");
const { proponerFEFO, errorAsignacion, coincideConPropuesta } = require("../utils/inventario");
const { hoyLocal, horaLocal, esFecha, sumarDias } = require("../utils/fechas");

const router = express.Router();
const permitir = (accion) => permitirAccion(accion, PUESTOS_ALMACEN);

const ESTADOS = ["pendiente", "despachado", "cancelado"];
// Un pedido se agenda como máximo con 30 días de anticipación
const DIAS_MAX_ENTREGA = 30;
const ahora = () => `${hoyLocal()} ${horaLocal()}`;
const texto = (v) => (typeof v === "string" ? v.trim() : "");

const SELECT_PEDIDO = `
  SELECT pe.*, c.codigo AS codigo_cliente, c.nombre AS cliente, c.tipo AS tipo_cliente, c.ciudad,
         r.nombre || ' ' || r.apellido AS responsable,
         d.fecha_hora AS fecha_hora_despacho, d.coincide_fefo, d.motivo AS motivo_despacho, d.vehiculo,
         d.id_despachador, de.nombre || ' ' || de.apellido AS despachador,
         (SELECT SUM(i.cantidad) FROM pedido_items i WHERE i.id_pedido = pe.id) AS unidades,
         (SELECT group_concat(p.codigo || ' x ' || i.cantidad, ', ') FROM pedido_items i
          JOIN productos p ON p.id = i.id_producto WHERE i.id_pedido = pe.id) AS resumen,
         COALESCE((SELECT SUM(dv.cantidad) FROM devoluciones dv WHERE dv.id_pedido = pe.id), 0) AS devuelto
  FROM pedidos pe
  JOIN clientes c ON c.id = pe.id_cliente
  JOIN trabajadores r ON r.id = pe.id_responsable
  LEFT JOIN despachos d ON d.id_pedido = pe.id
  LEFT JOIN trabajadores de ON de.id = d.id_despachador
`;

// atrasado: pendiente con la fecha de entrega ya pasada
const conAtraso = (hoy) => (pedido) => pedido && { ...pedido, atrasado: pedido.estado === "pendiente" && pedido.fecha_entrega < hoy };

function obtenerPedido(id) {
  return conAtraso(hoyLocal())(db.prepare(`${SELECT_PEDIDO} WHERE pe.id = ?`).get(id));
}

function itemsDe(idPedido) {
  return db.prepare(`
    SELECT i.id_producto, i.cantidad, p.codigo AS codigo_producto, p.nombre AS producto, p.presentacion
    FROM pedido_items i JOIN productos p ON p.id = i.id_producto WHERE i.id_pedido = ? ORDER BY p.codigo
  `).all(idPedido);
}

// Lotes de los productos indicados con su stock actual: Map id -> lote
function lotesDeProductos(idsProducto) {
  if (!idsProducto.length) return new Map();
  return new Map(db.prepare(`
    SELECT l.id, l.codigo, l.id_producto, l.estado, l.fecha_elaboracion, l.fecha_vencimiento,
           COALESCE((SELECT SUM(m.cantidad) FROM movimientos_inventario m WHERE m.id_lote_producto = l.id), 0) AS stock
    FROM lotes_producto l WHERE l.id_producto IN (${idsProducto.map(() => "?").join(",")})
  `).all(...idsProducto).map((l) => [l.id, l]));
}

// Propuesta FEFO para cada producto del pedido en la fecha: [{ ...item, asignacion, faltante }]
function propuestaFEFO(items, fecha) {
  const lotes = [...lotesDeProductos(items.map((i) => i.id_producto)).values()];
  return items.map((item) => ({
    ...item,
    ...proponerFEFO(lotes.filter((l) => l.id_producto === item.id_producto), item.cantidad, fecha)
  }));
}

// Ejecuta una función dentro de una transacción
function enTransaccion(fn) {
  db.exec("BEGIN");
  try {
    const resultado = fn();
    db.exec("COMMIT");
    return resultado;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

router.use(permitirAccion("consultar", PUESTOS_ALMACEN));

// --- Consultas ---

// estado=pendiente trae todos los pendientes (de cualquier fecha); si no, filtra por fecha de entrega.
// GET /api/pedidos?estado&desde&hasta&id_cliente&buscar
router.get("/", (req, res) => {
  const { estado, id_cliente, buscar } = req.query;
  let sql = `${SELECT_PEDIDO} WHERE 1=1`;
  const params = [];
  if (estado && !ESTADOS.includes(estado)) return res.status(400).json({ error: "Estado no válido" });
  if (estado === "pendiente") {
    sql += " AND pe.estado = 'pendiente'";
  } else {
    const hasta = esFecha(req.query.hasta) ? req.query.hasta : sumarDias(hoyLocal(), DIAS_MAX_ENTREGA);
    const desde = esFecha(req.query.desde) ? req.query.desde : sumarDias(hoyLocal(), -13);
    sql += " AND pe.fecha_entrega BETWEEN ? AND ?";
    params.push(desde, hasta);
    if (estado) { sql += " AND pe.estado = ?"; params.push(estado); }
  }
  if (id_cliente) { sql += " AND pe.id_cliente = ?"; params.push(id_cliente); }
  if (buscar) {
    const t = `%${texto(buscar)}%`;
    sql += " AND (pe.codigo LIKE ? OR c.nombre LIKE ?)";
    params.push(t, t);
  }
  sql += " ORDER BY pe.fecha_entrega DESC, pe.codigo DESC";
  res.json(db.prepare(sql).all(...params).map(conAtraso(hoyLocal())));
});

// Detalle: productos, lotes despachados, devoluciones y, si está pendiente, la propuesta FEFO de hoy
// GET /api/pedidos/:id
router.get("/:id", (req, res) => {
  const pedido = obtenerPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });
  const items = itemsDe(pedido.id);
  const lotesDespachados = db.prepare(`
    SELECT m.id_lote_producto, -m.cantidad AS cantidad, l.codigo, l.id_producto, l.fecha_vencimiento, p.codigo AS codigo_producto,
           (SELECT group_concat(d.codigo_lote, ', ') FROM lote_producto_origen o JOIN decisiones_leche d ON d.id_ingreso = o.id_ingreso
            WHERE o.id_lote_producto = l.id) AS lotes_recepcion,
           COALESCE((SELECT SUM(dv.cantidad) FROM devoluciones dv
                     WHERE dv.id_pedido = m.id_pedido AND dv.id_lote_producto = m.id_lote_producto), 0) AS devuelto
    FROM movimientos_inventario m JOIN lotes_producto l ON l.id = m.id_lote_producto JOIN productos p ON p.id = l.id_producto
    WHERE m.id_pedido = ? AND m.tipo = 'despacho' ORDER BY p.codigo, l.fecha_vencimiento
  `).all(pedido.id);
  const devoluciones = db.prepare(`
    SELECT dv.*, l.codigo AS codigo_lote, t.nombre || ' ' || t.apellido AS trabajador
    FROM devoluciones dv JOIN lotes_producto l ON l.id = dv.id_lote_producto JOIN trabajadores t ON t.id = dv.id_trabajador
    WHERE dv.id_pedido = ? ORDER BY dv.fecha_hora
  `).all(pedido.id);
  res.json({
    ...pedido,
    items,
    lotes_despachados: lotesDespachados,
    devoluciones,
    propuesta: pedido.estado === "pendiente" ? propuestaFEFO(items, hoyLocal()) : null
  });
});

// --- Registro (atención de pedidos) ---

function validarItems(items) {
  if (!Array.isArray(items) || !items.length) return "Agregue al menos un producto al pedido";
  const vistos = new Set();
  for (const item of items) {
    const producto = db.prepare("SELECT * FROM productos WHERE id = ?").get(item.id_producto);
    if (!producto || !producto.activo) return "Seleccione productos activos";
    if (vistos.has(producto.id)) return `El producto ${producto.codigo} está repetido en el pedido`;
    vistos.add(producto.id);
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) return `La cantidad de ${producto.codigo} debe ser un número entero mayor a 0`;
  }
  return null;
}

// POST /api/pedidos  body: { id_cliente, fecha_entrega, items: [{ id_producto, cantidad }], observacion? }
// No exige stock al registrar: si hoy no alcanza, la respuesta lo advierte y el pedido espera.
router.post("/", permitir("pedir"), (req, res) => {
  const datos = req.body || {};
  const cliente = db.prepare("SELECT * FROM clientes WHERE id = ?").get(datos.id_cliente);
  if (!cliente || !cliente.activo) return res.status(400).json({ error: "Seleccione un cliente activo" });
  const hoy = hoyLocal();
  if (!esFecha(datos.fecha_entrega)) return res.status(400).json({ error: "La fecha de entrega debe tener el formato AAAA-MM-DD" });
  if (datos.fecha_entrega < hoy) return res.status(400).json({ error: "La fecha de entrega no puede ser pasada" });
  if (datos.fecha_entrega > sumarDias(hoy, DIAS_MAX_ENTREGA)) {
    return res.status(400).json({ error: `La fecha de entrega no puede superar los ${DIAS_MAX_ENTREGA} días` });
  }
  const items = (Array.isArray(datos.items) ? datos.items : []).map((i) => ({ id_producto: Number(i.id_producto), cantidad: Number(i.cantidad) }));
  const error = validarItems(items);
  if (error) return res.status(400).json({ error });

  const id = enTransaccion(() => {
    const nuevo = db.prepare(`
      INSERT INTO pedidos (codigo, id_cliente, fecha_entrega, observacion, fecha_hora_registro, id_responsable)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(siguienteCodigo("pedidos", "codigo", "PED", hoy), cliente.id, datos.fecha_entrega, texto(datos.observacion) || null,
      ahora(), req.usuario.id_trabajador).lastInsertRowid;
    items.forEach((i) => db.prepare("INSERT INTO pedido_items (id_pedido, id_producto, cantidad) VALUES (?, ?, ?)").run(nuevo, i.id_producto, i.cantidad));
    return nuevo;
  });

  const pedido = obtenerPedido(id);
  const advertencias = propuestaFEFO(itemsDe(id), hoy).filter((p) => p.faltante > 0)
    .map((p) => `Hoy faltan ${p.faltante} unidades de ${p.codigo_producto} para despacharlo completo`);
  notificarPuestos(["encargado_almacen", "auxiliar_despacho"], "almacen",
    `Nuevo pedido ${pedido.codigo} de ${pedido.cliente} para el ${pedido.fecha_entrega}: ${pedido.resumen}`, `/pedidos/${id}`);
  res.status(201).json({ ...pedido, advertencias });
});

// Cancelación de un pedido pendiente (motivo obligatorio)
// POST /api/pedidos/:id/cancelar  body: { motivo }
router.post("/:id/cancelar", permitir("pedir"), (req, res) => {
  const pedido = obtenerPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });
  if (pedido.estado !== "pendiente") return res.status(409).json({ error: "Solo se cancela un pedido pendiente" });
  const motivo = texto(req.body?.motivo);
  if (!motivo) return res.status(400).json({ error: "Indique el motivo de la cancelación" });
  db.prepare("UPDATE pedidos SET estado = 'cancelado', motivo_cancelacion = ?, fecha_hora_cancelacion = ? WHERE id = ?")
    .run(motivo, ahora(), pedido.id);
  notificarPuestos(["encargado_almacen", "auxiliar_despacho"], "almacen",
    `Pedido ${pedido.codigo} de ${pedido.cliente} CANCELADO: no preparar. Motivo: ${motivo}`, `/pedidos/${pedido.id}`);
  res.json(obtenerPedido(pedido.id));
});

// --- Despacho (almacén) ---

// Despacha el pedido completo. Sin "lotes" se usa la propuesta FEFO; con "lotes" distintos a la propuesta,
// el motivo es obligatorio (igual que apartarse de la sugerencia en recepción).
// POST /api/pedidos/:id/despacho  body: { lotes?: [{ id_lote_producto, cantidad }], motivo?, vehiculo? }
router.post("/:id/despacho", permitir("despachar"), (req, res) => {
  const pedido = obtenerPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });
  if (pedido.estado !== "pendiente") return res.status(409).json({ error: `El pedido está ${pedido.estado}: no se puede despachar` });
  if (pedido.id_responsable === req.usuario.id_trabajador) {
    return res.status(403).json({ error: "Quien registró el pedido no puede despacharlo (segregación de funciones)" });
  }

  const hoy = hoyLocal();
  const items = itemsDe(pedido.id);
  const propuesta = propuestaFEFO(items, hoy);
  const sinStock = propuesta.filter((p) => p.faltante > 0);
  if (sinStock.length) {
    return res.status(409).json({
      error: `Stock insuficiente para despachar completo: ${sinStock.map((p) => `faltan ${p.faltante} de ${p.codigo_producto}`).join("; ")}`
    });
  }
  const sugerida = propuesta.flatMap((p) => p.asignacion);
  const elegida = Array.isArray(req.body?.lotes)
    ? req.body.lotes.map((l) => ({ id_lote_producto: Number(l.id_lote_producto), cantidad: Number(l.cantidad) }))
    : sugerida;
  const error = errorAsignacion(items, elegida, lotesDeProductos(items.map((i) => i.id_producto)), hoy);
  if (error) return res.status(400).json({ error });
  const coincide = coincideConPropuesta(sugerida, elegida);
  const motivo = texto(req.body?.motivo);
  if (!coincide && !motivo) {
    return res.status(400).json({ error: "Los lotes elegidos no son los que vencen primero (FEFO): indique el motivo" });
  }

  const fechaHora = ahora();
  enTransaccion(() => {
    db.prepare("INSERT INTO despachos (id_pedido, fecha_hora, coincide_fefo, motivo, vehiculo, id_despachador) VALUES (?, ?, ?, ?, ?, ?)")
      .run(pedido.id, fechaHora, coincide ? 1 : 0, motivo || null, texto(req.body?.vehiculo).toUpperCase() || null, req.usuario.id_trabajador);
    elegida.forEach((e) => db.prepare(`
      INSERT INTO movimientos_inventario (id_lote_producto, tipo, cantidad, id_pedido, fecha_hora, id_trabajador)
      VALUES (?, 'despacho', ?, ?, ?, ?)
    `).run(e.id_lote_producto, -e.cantidad, pedido.id, fechaHora, req.usuario.id_trabajador));
    db.prepare("UPDATE pedidos SET estado = 'despachado' WHERE id = ?").run(pedido.id);
  });

  notificarTrabajador(pedido.id_responsable, "almacen", `Pedido ${pedido.codigo} de ${pedido.cliente} despachado.`, `/pedidos/${pedido.id}`);
  res.status(201).json(obtenerPedido(pedido.id));
});

// Devolución de un cliente: por lote despachado en este pedido, con motivo. No vuelve al stock.
// POST /api/pedidos/:id/devoluciones  body: { id_lote_producto, cantidad, motivo }
router.post("/:id/devoluciones", permitir("devolver"), (req, res) => {
  const pedido = obtenerPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });
  if (pedido.estado !== "despachado") return res.status(409).json({ error: "Solo se registran devoluciones de pedidos despachados" });
  const idLote = Number(req.body?.id_lote_producto);
  const cantidad = Number(req.body?.cantidad);
  const motivo = texto(req.body?.motivo);
  const fila = db.prepare(`
    SELECT l.codigo, -SUM(m.cantidad) AS despachado,
           COALESCE((SELECT SUM(dv.cantidad) FROM devoluciones dv WHERE dv.id_pedido = ? AND dv.id_lote_producto = ?), 0) AS devuelto
    FROM movimientos_inventario m JOIN lotes_producto l ON l.id = m.id_lote_producto
    WHERE m.id_pedido = ? AND m.id_lote_producto = ? AND m.tipo = 'despacho'
  `).get(pedido.id, idLote, pedido.id, idLote);
  if (!fila || !fila.codigo) return res.status(400).json({ error: "Ese lote no se despachó en este pedido" });
  if (!Number.isInteger(cantidad) || cantidad <= 0) return res.status(400).json({ error: "La cantidad debe ser un número entero mayor a 0" });
  if (cantidad > fila.despachado - fila.devuelto) {
    return res.status(400).json({ error: `Del lote ${fila.codigo} se despacharon ${fila.despachado} unidades y ya se devolvieron ${fila.devuelto}` });
  }
  if (!motivo) return res.status(400).json({ error: "Indique el motivo de la devolución" });

  db.prepare("INSERT INTO devoluciones (id_pedido, id_lote_producto, cantidad, motivo, fecha_hora, id_trabajador) VALUES (?, ?, ?, ?, ?, ?)")
    .run(pedido.id, idLote, cantidad, motivo, ahora(), req.usuario.id_trabajador);
  // Calidad y jefatura deben saberlo: una devolución puede revelar un problema del lote (rastreo hacia atrás)
  notificarPuestos(["supervisor_calidad", "jefatura_planta"], "almacen",
    `Devolución de ${cantidad} unidades del lote ${fila.codigo} (${pedido.cliente}, ${pedido.codigo}). Motivo: ${motivo}`, `/pedidos/${pedido.id}`);
  res.status(201).json(obtenerPedido(pedido.id));
});

module.exports = router;
