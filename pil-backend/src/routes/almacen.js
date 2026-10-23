// Módulo de Almacén: producto terminado e inventario (etapas 6 y 7 del proceso, documento secciones 5 y 6.2).
// Flujo: envasado registra el lote de producto terminado con sus lotes de recepción de origen -> el encargado
// de almacén lo recibe y confirma las unidades -> el lote entra al inventario. El stock de cada lote es la suma
// de sus movimientos (ingreso, despacho, ajuste). Los pedidos y despachos están en routes/pedidos.js.
// Los permisos dependen del puesto en el proceso (PUESTOS_ALMACEN en utils/puestos.js).
const express = require("express");
const db = require("../db/database");
const { permitirAccion, permisosAlmacen, notificarPuestos, PUESTOS_ALMACEN } = require("../utils/puestos");
const { notificarTrabajador } = require("../utils/notificar");
const { siguienteCodigo } = require("../utils/codigos");
const { fechaVencimiento, situacionLote, errorRecepcion, despachable } = require("../utils/inventario");
const { hoyLocal, horaLocal, esFecha, sumarDias } = require("../utils/fechas");

const router = express.Router();
const permitir = (accion) => permitirAccion(accion, PUESTOS_ALMACEN);

// La leche cruda aceptada se procesa dentro de las 48 h de descargada: es el plazo para usarla como origen
const DIAS_MAX_ORIGEN = 2;
const TIPOS_CLIENTE = ["distribuidor", "supermercado", "tienda", "institucional"];
const ahora = () => `${hoyLocal()} ${horaLocal()}`;
const texto = (v) => (typeof v === "string" ? v.trim() : "");

const SELECT_LOTE = `
  SELECT l.*, p.codigo AS codigo_producto, p.nombre AS producto, p.presentacion, p.vida_util_dias, p.litros_por_unidad,
         r.nombre || ' ' || r.apellido AS responsable, rc.nombre || ' ' || rc.apellido AS receptor,
         COALESCE((SELECT SUM(m.cantidad) FROM movimientos_inventario m WHERE m.id_lote_producto = l.id), 0) AS stock,
         COALESCE((SELECT -SUM(m.cantidad) FROM movimientos_inventario m
                   WHERE m.id_lote_producto = l.id AND m.tipo = 'despacho'), 0) AS despachado,
         (SELECT group_concat(d.codigo_lote, ', ') FROM lote_producto_origen o
          JOIN decisiones_leche d ON d.id_ingreso = o.id_ingreso WHERE o.id_lote_producto = l.id) AS lotes_recepcion
  FROM lotes_producto l
  JOIN productos p ON p.id = l.id_producto
  JOIN trabajadores r ON r.id = l.id_responsable
  LEFT JOIN trabajadores rc ON rc.id = l.id_receptor
`;

const conSituacion = (fecha) => (lote) => lote && { ...lote, situacion: situacionLote(lote, fecha, lote.vida_util_dias) };

function obtenerLote(id) {
  return conSituacion(hoyLocal())(db.prepare(`${SELECT_LOTE} WHERE l.id = ?`).get(id));
}

// Ingresos de leche que pueden ser origen de un lote elaborado en la fecha: aceptados, descargados y
// recibidos dentro del plazo (DIAS_MAX_ORIGEN) previo a la elaboración
function origenesDisponibles(fecha) {
  return db.prepare(`
    SELECT i.id, i.codigo, i.volumen_l, i.fecha_hora_descarga, d.codigo_lote, d.tanque, pr.nombre AS proveedor,
           (SELECT group_concat(l.codigo, ', ') FROM lote_producto_origen o JOIN lotes_producto l ON l.id = o.id_lote_producto
            WHERE o.id_ingreso = i.id) AS usado_en
    FROM ingresos_leche i
    JOIN decisiones_leche d ON d.id_ingreso = i.id
    JOIN proveedores pr ON pr.id = i.id_proveedor
    WHERE d.resultado = 'aceptado' AND i.fecha_hora_descarga IS NOT NULL
      AND substr(i.fecha_hora_descarga, 1, 10) BETWEEN ? AND ?
    ORDER BY i.fecha_hora_descarga DESC
  `).all(sumarDias(fecha, -DIAS_MAX_ORIGEN), fecha);
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

// --- Consultas ---

// Permisos del usuario en este módulo (el frontend los usa para mostrar u ocultar acciones)
// GET /api/almacen/permisos
router.get("/permisos", (req, res) => {
  res.json(permisosAlmacen(req.usuario));
});

router.use(permitir("consultar"));

// GET /api/almacen/catalogos
router.get("/catalogos", (req, res) => {
  res.json({
    productos: db.prepare("SELECT * FROM productos ORDER BY codigo").all(),
    clientes: db.prepare("SELECT * FROM clientes ORDER BY nombre").all(),
    tipos_cliente: TIPOS_CLIENTE
  });
});

// Lotes de recepción que se pueden usar como origen de un lote elaborado en la fecha (por defecto, hoy)
// GET /api/almacen/origenes?fecha
router.get("/origenes", (req, res) => {
  res.json(origenesDisponibles(esFecha(req.query.fecha) ? req.query.fecha : hoyLocal()));
});

// Lotes de producto terminado. estado=registrado trae los que esperan recepción, de cualquier fecha.
// con_stock=1 trae solo los que tienen unidades en almacén.
// GET /api/almacen/lotes?desde&hasta&estado&id_producto&con_stock&buscar
router.get("/lotes", (req, res) => {
  const { estado, id_producto, con_stock, buscar } = req.query;
  let sql = `${SELECT_LOTE} WHERE 1=1`;
  const params = [];
  if (estado === "registrado") {
    sql += " AND l.estado = 'registrado'";
  } else if (con_stock !== "1") {
    const hasta = esFecha(req.query.hasta) ? req.query.hasta : hoyLocal();
    const desde = esFecha(req.query.desde) ? req.query.desde : sumarDias(hasta, -13);
    sql += " AND l.fecha_elaboracion BETWEEN ? AND ?";
    params.push(desde, hasta);
  }
  if (id_producto) { sql += " AND l.id_producto = ?"; params.push(id_producto); }
  if (buscar) {
    const t = `%${texto(buscar)}%`;
    sql += " AND (l.codigo LIKE ? OR p.nombre LIKE ? OR lotes_recepcion LIKE ?)";
    params.push(t, t, t);
  }
  sql += " ORDER BY l.fecha_elaboracion DESC, l.codigo DESC";
  let lotes = db.prepare(sql).all(...params).map(conSituacion(hoyLocal()));
  if (con_stock === "1") lotes = lotes.filter((l) => l.stock > 0);
  res.json(lotes);
});

// Detalle de un lote: origen (lotes de recepción), movimientos y devoluciones
// GET /api/almacen/lotes/:id
router.get("/lotes/:id", (req, res) => {
  const lote = obtenerLote(req.params.id);
  if (!lote) return res.status(404).json({ error: "Lote no encontrado" });
  const origen = db.prepare(`
    SELECT i.id, i.codigo, i.volumen_l, i.fecha_hora_llegada, i.fecha_hora_descarga, d.codigo_lote, d.tanque,
           pr.codigo AS codigo_proveedor, pr.nombre AS proveedor
    FROM lote_producto_origen o
    JOIN ingresos_leche i ON i.id = o.id_ingreso
    JOIN decisiones_leche d ON d.id_ingreso = i.id
    JOIN proveedores pr ON pr.id = i.id_proveedor
    WHERE o.id_lote_producto = ? ORDER BY i.fecha_hora_llegada
  `).all(lote.id);
  const movimientos = db.prepare(`
    SELECT m.*, t.nombre || ' ' || t.apellido AS trabajador, pe.codigo AS codigo_pedido, c.nombre AS cliente
    FROM movimientos_inventario m
    JOIN trabajadores t ON t.id = m.id_trabajador
    LEFT JOIN pedidos pe ON pe.id = m.id_pedido
    LEFT JOIN clientes c ON c.id = pe.id_cliente
    WHERE m.id_lote_producto = ? ORDER BY m.fecha_hora, m.id
  `).all(lote.id);
  const devoluciones = db.prepare(`
    SELECT dv.*, t.nombre || ' ' || t.apellido AS trabajador, pe.codigo AS codigo_pedido, c.nombre AS cliente
    FROM devoluciones dv
    JOIN trabajadores t ON t.id = dv.id_trabajador
    JOIN pedidos pe ON pe.id = dv.id_pedido
    JOIN clientes c ON c.id = pe.id_cliente
    WHERE dv.id_lote_producto = ? ORDER BY dv.fecha_hora
  `).all(lote.id);
  res.json({ ...lote, origen, movimientos, devoluciones });
});

// Inventario por producto en una fecha (por defecto, hoy): stock en almacén, cuánto se puede despachar,
// vencido, por vencer, por recibir y comprometido en pedidos pendientes
// GET /api/almacen/inventario?fecha
router.get("/inventario", (req, res) => {
  const fecha = esFecha(req.query.fecha) ? req.query.fecha : hoyLocal();
  const lotes = db.prepare(`${SELECT_LOTE} WHERE l.estado = 'registrado' OR
    (SELECT SUM(m.cantidad) FROM movimientos_inventario m WHERE m.id_lote_producto = l.id) > 0
    ORDER BY l.fecha_vencimiento, l.codigo`).all().map(conSituacion(fecha));
  const comprometido = Object.fromEntries(db.prepare(`
    SELECT i.id_producto, SUM(i.cantidad) AS cantidad FROM pedido_items i JOIN pedidos p ON p.id = i.id_pedido
    WHERE p.estado = 'pendiente' GROUP BY i.id_producto
  `).all().map((f) => [f.id_producto, f.cantidad]));

  const productos = db.prepare("SELECT * FROM productos ORDER BY codigo").all().map((p) => {
    const delProducto = lotes.filter((l) => l.id_producto === p.id);
    const suma = (filtro) => delProducto.filter(filtro).reduce((s, l) => s + l.stock, 0);
    const despachableHoy = suma((l) => despachable(l, fecha));
    return {
      ...p,
      stock: suma((l) => l.estado === "en_almacen"),
      despachable: despachableHoy,
      vencido: suma((l) => l.situacion === "vencido"),
      por_vencer: suma((l) => l.situacion === "por_vencer"),
      por_recibir: delProducto.filter((l) => l.estado === "registrado").reduce((s, l) => s + l.unidades, 0),
      comprometido: comprometido[p.id] || 0,
      disponible: despachableHoy - (comprometido[p.id] || 0),
      lotes: delProducto
    };
  });
  res.json({ fecha, productos });
});

// Kardex: movimientos del período
// GET /api/almacen/movimientos?desde&hasta&tipo&id_producto
router.get("/movimientos", (req, res) => {
  const hasta = esFecha(req.query.hasta) ? req.query.hasta : hoyLocal();
  const desde = esFecha(req.query.desde) ? req.query.desde : sumarDias(hasta, -6);
  if (desde > hasta) return res.status(400).json({ error: "La fecha inicial no puede ser posterior a la final" });
  let sql = `
    SELECT m.*, l.codigo AS codigo_lote, p.codigo AS codigo_producto, p.nombre AS producto,
           t.nombre || ' ' || t.apellido AS trabajador, pe.codigo AS codigo_pedido, c.nombre AS cliente
    FROM movimientos_inventario m
    JOIN lotes_producto l ON l.id = m.id_lote_producto
    JOIN productos p ON p.id = l.id_producto
    JOIN trabajadores t ON t.id = m.id_trabajador
    LEFT JOIN pedidos pe ON pe.id = m.id_pedido
    LEFT JOIN clientes c ON c.id = pe.id_cliente
    WHERE substr(m.fecha_hora, 1, 10) BETWEEN ? AND ?`;
  const params = [desde, hasta];
  if (req.query.tipo) {
    if (!["ingreso", "despacho", "ajuste"].includes(req.query.tipo)) return res.status(400).json({ error: "Tipo de movimiento no válido" });
    sql += " AND m.tipo = ?";
    params.push(req.query.tipo);
  }
  if (req.query.id_producto) { sql += " AND l.id_producto = ?"; params.push(req.query.id_producto); }
  sql += " ORDER BY m.fecha_hora DESC, m.id DESC";
  res.json(db.prepare(sql).all(...params));
});

// --- Lotes de producto terminado (envasado) ---

// POST /api/almacen/lotes  body: { id_producto, unidades, origen: [id_ingreso], fecha_elaboracion?, observacion? }
// fecha_elaboracion por defecto es hoy; se acepta hasta DIAS_MAX_ORIGEN días atrás (registro tardío).
router.post("/lotes", permitir("envasar"), (req, res) => {
  const datos = req.body || {};
  const producto = db.prepare("SELECT * FROM productos WHERE id = ?").get(datos.id_producto);
  if (!producto || !producto.activo) return res.status(400).json({ error: "Seleccione un producto activo" });
  const unidades = Number(datos.unidades);
  if (!Number.isInteger(unidades) || unidades <= 0) return res.status(400).json({ error: "Las unidades deben ser un número entero mayor a 0" });

  const hoy = hoyLocal();
  const fecha = datos.fecha_elaboracion || hoy;
  if (!esFecha(fecha)) return res.status(400).json({ error: "La fecha de elaboración debe tener el formato AAAA-MM-DD" });
  if (fecha > hoy) return res.status(400).json({ error: "La fecha de elaboración no puede ser futura" });
  if (fecha < sumarDias(hoy, -DIAS_MAX_ORIGEN)) {
    return res.status(400).json({ error: `Solo se registran lotes elaborados en los últimos ${DIAS_MAX_ORIGEN} días` });
  }

  // Origen: lotes de recepción de leche aceptada, descargada y dentro del plazo (trazabilidad hacia atrás)
  const ids = [...new Set((Array.isArray(datos.origen) ? datos.origen : []).map(Number))];
  if (!ids.length) return res.status(400).json({ error: "Indique de qué lotes de recepción sale este lote" });
  const disponibles = new Map(origenesDisponibles(fecha).map((i) => [i.id, i]));
  const noValido = ids.find((id) => !disponibles.has(id));
  if (noValido !== undefined) {
    return res.status(400).json({
      error: `Solo se puede usar leche aceptada y descargada en los ${DIAS_MAX_ORIGEN} días previos a la elaboración`
    });
  }
  // El lote no puede contener más leche que la de sus lotes de origen
  const litrosOrigen = ids.reduce((s, id) => s + disponibles.get(id).volumen_l, 0);
  const litrosLote = unidades * producto.litros_por_unidad;
  if (litrosLote > litrosOrigen) {
    return res.status(400).json({
      error: `El lote equivale a ${Math.round(litrosLote)} L y los lotes de recepción de origen suman ${litrosOrigen} L`
    });
  }

  const id = enTransaccion(() => {
    const nuevo = db.prepare(`
      INSERT INTO lotes_producto (codigo, id_producto, fecha_elaboracion, fecha_vencimiento, unidades, observacion,
        fecha_hora_registro, id_responsable)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      siguienteCodigo("lotes_producto", "codigo", "LP", fecha), producto.id, fecha, fechaVencimiento(fecha, producto.vida_util_dias),
      unidades, texto(datos.observacion) || null, ahora(), req.usuario.id_trabajador
    ).lastInsertRowid;
    ids.forEach((idIngreso) => db.prepare("INSERT INTO lote_producto_origen (id_lote_producto, id_ingreso) VALUES (?, ?)").run(nuevo, idIngreso));
    return nuevo;
  });

  const lote = obtenerLote(id);
  notificarPuestos(["encargado_almacen"], "almacen",
    `Lote ${lote.codigo} envasado (${lote.producto}, ${lote.unidades} unidades): falta recibirlo en almacén.`, `/almacen/lotes/${id}`);
  res.status(201).json(lote);
});

// --- Almacén (encargado de almacén) ---

// Recepción del lote en almacén: confirma las unidades que llegan; desde ahí el lote está en el inventario.
// POST /api/almacen/lotes/:id/recepcion  body: { unidades_recibidas, observacion? }
router.post("/lotes/:id/recepcion", permitir("recibir"), (req, res) => {
  const lote = db.prepare("SELECT * FROM lotes_producto WHERE id = ?").get(req.params.id);
  if (!lote) return res.status(404).json({ error: "Lote no encontrado" });
  if (lote.estado !== "registrado") return res.status(409).json({ error: "Este lote ya fue recibido en almacén" });
  if (lote.id_responsable === req.usuario.id_trabajador) {
    return res.status(403).json({ error: "Quien registró el lote en envasado no puede recibirlo en almacén (segregación de funciones)" });
  }
  const recibidas = Number(req.body?.unidades_recibidas);
  const observacion = texto(req.body?.observacion);
  const error = errorRecepcion(lote.unidades, recibidas, observacion);
  if (error) return res.status(400).json({ error });

  const fechaHora = ahora();
  enTransaccion(() => {
    db.prepare(`
      UPDATE lotes_producto SET estado = 'en_almacen', unidades_recibidas = ?, observacion_recepcion = ?, fecha_hora_recepcion = ?,
        id_receptor = ?
      WHERE id = ?
    `).run(recibidas, observacion || null, fechaHora, req.usuario.id_trabajador, lote.id);
    if (recibidas > 0) {
      db.prepare(`
        INSERT INTO movimientos_inventario (id_lote_producto, tipo, cantidad, fecha_hora, id_trabajador) VALUES (?, 'ingreso', ?, ?, ?)
      `).run(lote.id, recibidas, fechaHora, req.usuario.id_trabajador);
    }
  });

  if (recibidas < lote.unidades) {
    notificarTrabajador(lote.id_responsable, "almacen",
      `Lote ${lote.codigo} recibido con ${lote.unidades - recibidas} unidades de menos: ${observacion}`, `/almacen/lotes/${lote.id}`);
  }
  res.json(obtenerLote(lote.id));
});

// Ajuste de stock con motivo (merma, baja por vencimiento, corrección de conteo físico)
// POST /api/almacen/lotes/:id/ajustes  body: { cantidad (entero, + o -), motivo }
router.post("/lotes/:id/ajustes", permitir("recibir"), (req, res) => {
  const lote = obtenerLote(req.params.id);
  if (!lote) return res.status(404).json({ error: "Lote no encontrado" });
  if (lote.estado !== "en_almacen") return res.status(409).json({ error: "El lote todavía no fue recibido en almacén" });
  const cantidad = Number(req.body?.cantidad);
  const motivo = texto(req.body?.motivo);
  if (!Number.isInteger(cantidad) || cantidad === 0) {
    return res.status(400).json({ error: "La cantidad debe ser un número entero distinto de 0 (negativo para bajas)" });
  }
  if (!motivo) return res.status(400).json({ error: "Indique el motivo del ajuste" });
  if (lote.stock + cantidad < 0) return res.status(400).json({ error: `El stock del lote es ${lote.stock}: no puede quedar negativo` });

  db.prepare(`
    INSERT INTO movimientos_inventario (id_lote_producto, tipo, cantidad, motivo, fecha_hora, id_trabajador)
    VALUES (?, 'ajuste', ?, ?, ?, ?)
  `).run(lote.id, cantidad, motivo, ahora(), req.usuario.id_trabajador);
  res.status(201).json(obtenerLote(lote.id));
});

// --- Catálogos ---

function validarProducto(d) {
  if (!texto(d.nombre) || !texto(d.presentacion)) return "nombre y presentacion son obligatorios";
  const litros = Number(d.litros_por_unidad);
  if (!Number.isFinite(litros) || litros <= 0) return "Los litros por unidad deben ser un número mayor a 0";
  const vida = Number(d.vida_util_dias);
  if (!Number.isInteger(vida) || vida <= 0) return "La vida útil debe ser un número entero de días";
  return null;
}

// POST /api/almacen/productos  body: { codigo, nombre, presentacion, litros_por_unidad, vida_util_dias }
router.post("/productos", permitir("productos"), (req, res) => {
  const d = req.body || {};
  const codigo = texto(d.codigo).toUpperCase();
  if (!codigo) return res.status(400).json({ error: "El código es obligatorio" });
  const error = validarProducto(d);
  if (error) return res.status(400).json({ error });
  try {
    const id = db.prepare(`
      INSERT INTO productos (codigo, nombre, presentacion, litros_por_unidad, vida_util_dias) VALUES (?, ?, ?, ?, ?)
    `).run(codigo, texto(d.nombre), texto(d.presentacion), Number(d.litros_por_unidad), Number(d.vida_util_dias)).lastInsertRowid;
    res.status(201).json(db.prepare("SELECT * FROM productos WHERE id = ?").get(id));
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Ya existe un producto con ese código" });
    throw err;
  }
});

// La vida útil nueva se aplica a los lotes que se registren después: los ya registrados conservan su vencimiento.
// PUT /api/almacen/productos/:id  body: { nombre?, presentacion?, litros_por_unidad?, vida_util_dias?, activo? }
router.put("/productos/:id", permitir("productos"), (req, res) => {
  const actual = db.prepare("SELECT * FROM productos WHERE id = ?").get(req.params.id);
  if (!actual) return res.status(404).json({ error: "Producto no encontrado" });
  const d = { ...actual, ...req.body };
  const error = validarProducto(d);
  if (error) return res.status(400).json({ error });
  db.prepare("UPDATE productos SET nombre = ?, presentacion = ?, litros_por_unidad = ?, vida_util_dias = ?, activo = ? WHERE id = ?")
    .run(texto(d.nombre), texto(d.presentacion), Number(d.litros_por_unidad), Number(d.vida_util_dias), d.activo ? 1 : 0, actual.id);
  res.json(db.prepare("SELECT * FROM productos WHERE id = ?").get(actual.id));
});

function validarCliente(d) {
  if (!texto(d.nombre)) return "El nombre es obligatorio";
  if (!TIPOS_CLIENTE.includes(d.tipo)) return `El tipo debe ser ${TIPOS_CLIENTE.join(", ")}`;
  return null;
}

// POST /api/almacen/clientes  body: { codigo, nombre, tipo, ciudad?, direccion?, telefono? }
router.post("/clientes", permitir("clientes"), (req, res) => {
  const d = req.body || {};
  const codigo = texto(d.codigo).toUpperCase();
  if (!codigo) return res.status(400).json({ error: "El código es obligatorio" });
  const error = validarCliente(d);
  if (error) return res.status(400).json({ error });
  try {
    const id = db.prepare("INSERT INTO clientes (codigo, nombre, tipo, ciudad, direccion, telefono) VALUES (?, ?, ?, ?, ?, ?)")
      .run(codigo, texto(d.nombre), d.tipo, texto(d.ciudad) || null, texto(d.direccion) || null, texto(d.telefono) || null).lastInsertRowid;
    res.status(201).json(db.prepare("SELECT * FROM clientes WHERE id = ?").get(id));
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Ya existe un cliente con ese código" });
    throw err;
  }
});

// PUT /api/almacen/clientes/:id  body: { nombre?, tipo?, ciudad?, direccion?, telefono?, activo? }
router.put("/clientes/:id", permitir("clientes"), (req, res) => {
  const actual = db.prepare("SELECT * FROM clientes WHERE id = ?").get(req.params.id);
  if (!actual) return res.status(404).json({ error: "Cliente no encontrado" });
  const d = { ...actual, ...req.body };
  const error = validarCliente(d);
  if (error) return res.status(400).json({ error });
  db.prepare("UPDATE clientes SET nombre = ?, tipo = ?, ciudad = ?, direccion = ?, telefono = ?, activo = ? WHERE id = ?")
    .run(texto(d.nombre), d.tipo, texto(d.ciudad) || null, texto(d.direccion) || null, texto(d.telefono) || null, d.activo ? 1 : 0, actual.id);
  res.json(db.prepare("SELECT * FROM clientes WHERE id = ?").get(actual.id));
});

module.exports = router;
