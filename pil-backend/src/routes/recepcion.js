// Módulo de Recepción y control de calidad de leche cruda (etapa 2 del proceso, documento secciones 6.1 y 9).
// Flujo: el operador registra el ingreso -> el analista registra el análisis y el sistema sugiere ->
// el supervisor de calidad decide (aceptar, derivar o rechazar) y se genera el lote -> el operador descarga.
// Los permisos dependen del puesto en el proceso (utils/puestos.js), no del rol de RRHH.
const express = require("express");
const db = require("../db/database");
const { permitirAccion, permisosRecepcion, notificarPuestos } = require("../utils/puestos");
const { notificarTrabajador } = require("../utils/notificar");
const {
  evaluarMuestra, describirLimite, codigoCorrelativo, RESULTADO_DE_SUGERENCIA, calcularIndicadoresCalidad, porcentaje
} = require("../utils/recepcion");
const { hoyLocal, horaLocal, esFecha, esHora, sumarDias } = require("../utils/fechas");

const router = express.Router();

const ESTADOS = ["en_analisis", "por_decidir", "aceptado", "derivado", "rechazado"];
const PENDIENTES = ["en_analisis", "por_decidir"];
const ahora = () => `${hoyLocal()} ${horaLocal()}`;
const texto = (v) => (typeof v === "string" ? v.trim() : "");

const SELECT_INGRESO = `
  SELECT i.*,
         pr.codigo AS codigo_proveedor, pr.nombre AS proveedor, pr.centro_acopio,
         c.placa, c.capacidad_l, c.transportista,
         op.nombre || ' ' || op.apellido AS operador,
         a.codigo_muestra, a.acidez, a.densidad, a.grasa, a.alcohol, a.antibioticos, a.sugerencia, a.observaciones,
         a.fecha_hora AS fecha_hora_analisis, a.id_analista, an.nombre || ' ' || an.apellido AS analista,
         d.resultado, d.coincide_sugerencia, d.motivo, d.tanque, d.codigo_lote, d.fecha_hora AS fecha_hora_decision,
         d.id_supervisor, su.nombre || ' ' || su.apellido AS supervisor,
         od.nombre || ' ' || od.apellido AS operador_descarga
  FROM ingresos_leche i
  JOIN proveedores pr ON pr.id = i.id_proveedor
  JOIN cisternas c ON c.id = i.id_cisterna
  JOIN trabajadores op ON op.id = i.id_operador
  LEFT JOIN analisis_leche a ON a.id_ingreso = i.id
  LEFT JOIN trabajadores an ON an.id = a.id_analista
  LEFT JOIN decisiones_leche d ON d.id_ingreso = i.id
  LEFT JOIN trabajadores su ON su.id = d.id_supervisor
  LEFT JOIN trabajadores od ON od.id = i.id_operador_descarga
`;

const conObservaciones = (fila) => fila && { ...fila, observaciones: fila.observaciones ? JSON.parse(fila.observaciones) : [] };

function obtenerIngreso(id) {
  return conObservaciones(db.prepare(`${SELECT_INGRESO} WHERE i.id = ?`).get(id));
}

function parametrosVigentes() {
  return db.prepare("SELECT * FROM parametros_calidad ORDER BY orden").all()
    .map((p) => ({ ...p, critico: Boolean(p.critico), limite: describirLimite(p) }));
}

// Siguiente número correlativo del día para un código (ING-, LR-): toma el mayor existente + 1
function siguienteCodigo(tabla, columna, prefijo, fecha) {
  const base = codigoCorrelativo(prefijo, fecha, 0).slice(0, -2);
  const fila = db.prepare(`SELECT MAX(${columna}) AS ultimo FROM ${tabla} WHERE ${columna} LIKE ?`).get(`${base}%`);
  const numero = fila.ultimo ? Number(fila.ultimo.slice(base.length)) + 1 : 1;
  return codigoCorrelativo(prefijo, fecha, numero);
}

function registrarBitacora(entidad, idRegistro, campo, anterior, nuevo, motivo, idUsuario) {
  db.prepare(`
    INSERT INTO bitacora_recepcion (entidad, id_registro, campo, valor_anterior, valor_nuevo, motivo, id_usuario)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(entidad, String(idRegistro), campo, anterior === null ? null : String(anterior), nuevo === null ? null : String(nuevo), motivo, idUsuario);
}

function bitacoraDe(entidad, idRegistro) {
  return db.prepare(`
    SELECT b.*, t.nombre || ' ' || t.apellido AS usuario
    FROM bitacora_recepcion b JOIN usuarios u ON u.id = b.id_usuario JOIN trabajadores t ON t.id = u.id_trabajador
    WHERE b.entidad = ? AND b.id_registro = ? ORDER BY b.fecha DESC, b.id DESC
  `).all(entidad, String(idRegistro));
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

// --- Validaciones ---

function validarDatosIngreso(datos) {
  const proveedor = db.prepare("SELECT * FROM proveedores WHERE id = ?").get(datos.id_proveedor);
  if (!proveedor || !proveedor.activo) return "Seleccione un proveedor activo";
  const cisterna = db.prepare("SELECT * FROM cisternas WHERE id = ?").get(datos.id_cisterna);
  if (!cisterna || !cisterna.activo) return "Seleccione una cisterna activa";
  const volumen = Number(datos.volumen_l);
  if (!Number.isFinite(volumen) || volumen <= 0) return "El volumen debe ser un número mayor a 0";
  if (volumen > cisterna.capacidad_l) return `El volumen supera la capacidad de la cisterna (${cisterna.capacidad_l} L)`;
  const temperatura = Number(datos.temperatura_c);
  if (datos.temperatura_c === "" || datos.temperatura_c === null || !Number.isFinite(temperatura) || temperatura < -5 || temperatura > 50) {
    return "La temperatura debe ser un número entre -5 y 50 °C";
  }
  return null;
}

function validarAnalisis(datos) {
  const numero = (campo, min, max, nombre) => {
    const n = Number(datos[campo]);
    if (datos[campo] === "" || datos[campo] === null || datos[campo] === undefined || !Number.isFinite(n) || n < min || n > max) {
      return `${nombre} debe ser un número entre ${min} y ${max}`;
    }
    return null;
  };
  return numero("acidez", 0, 1, "La acidez (%)")
    || numero("densidad", 1, 1.1, "La densidad (g/ml)")
    || numero("grasa", 0, 15, "La materia grasa (%)")
    || (!["negativo", "positivo"].includes(datos.alcohol) ? "La prueba de alcohol debe ser negativo o positivo" : null)
    || (!["ausencia", "presencia"].includes(datos.antibioticos) ? "Antibióticos debe ser ausencia o presencia" : null);
}

function evaluar(ingreso, datos) {
  return evaluarMuestra({
    temperatura: Number(ingreso.temperatura_c),
    acidez: Number(datos.acidez),
    densidad: Number(datos.densidad),
    grasa: Number(datos.grasa),
    alcohol: datos.alcohol,
    antibioticos: datos.antibioticos
  }, parametrosVigentes());
}

// --- Consultas ---

// Permisos del usuario en este módulo (el frontend los usa para mostrar u ocultar acciones)
// GET /api/recepcion/permisos
router.get("/permisos", (req, res) => {
  res.json(permisosRecepcion(req.usuario));
});

router.use(permitirAccion("consultar"));

// Catálogos para formularios y filtros
// GET /api/recepcion/catalogos
router.get("/catalogos", (req, res) => {
  res.json({
    proveedores: db.prepare("SELECT * FROM proveedores ORDER BY nombre").all(),
    cisternas: db.prepare("SELECT * FROM cisternas ORDER BY placa").all(),
    tanques: db.prepare("SELECT * FROM tanques WHERE activo = 1 ORDER BY codigo").all(),
    parametros: parametrosVigentes()
  });
});

// Ingresos. estado=pendientes trae todos los que esperan análisis o decisión, de cualquier fecha.
// GET /api/recepcion/ingresos?desde&hasta&estado&id_proveedor&buscar
router.get("/ingresos", (req, res) => {
  const { estado, id_proveedor, buscar } = req.query;
  let sql = `${SELECT_INGRESO} WHERE 1=1`;
  const params = [];

  if (estado === "pendientes") {
    sql += ` AND i.estado IN (${PENDIENTES.map(() => "?").join(",")})`;
    params.push(...PENDIENTES);
  } else {
    const hasta = esFecha(req.query.hasta) ? req.query.hasta : hoyLocal();
    const desde = esFecha(req.query.desde) ? req.query.desde : sumarDias(hasta, -6);
    sql += " AND substr(i.fecha_hora_llegada, 1, 10) BETWEEN ? AND ?";
    params.push(desde, hasta);
    if (estado) {
      if (!ESTADOS.includes(estado)) return res.status(400).json({ error: "Estado no válido" });
      sql += " AND i.estado = ?";
      params.push(estado);
    }
  }
  if (id_proveedor) { sql += " AND i.id_proveedor = ?"; params.push(id_proveedor); }
  if (buscar) {
    const t = `%${buscar}%`;
    sql += " AND (i.codigo LIKE ? OR d.codigo_lote LIKE ? OR pr.nombre LIKE ? OR c.placa LIKE ?)";
    params.push(t, t, t, t);
  }
  sql += " ORDER BY i.fecha_hora_llegada DESC";
  res.json(db.prepare(sql).all(...params).map(conObservaciones));
});

// Detalle de un ingreso con su bitácora
// GET /api/recepcion/ingresos/:id
router.get("/ingresos/:id", (req, res) => {
  const ingreso = obtenerIngreso(req.params.id);
  if (!ingreso) return res.status(404).json({ error: "Ingreso no encontrado" });
  res.json({
    ...ingreso,
    bitacora: [...bitacoraDe("ingreso", ingreso.id), ...bitacoraDe("analisis", ingreso.id)]
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  });
});

// Trazabilidad: busca por código de lote (LR-...) o de ingreso (ING-...)
// GET /api/recepcion/trazabilidad/:codigo
router.get("/trazabilidad/:codigo", (req, res) => {
  const codigo = texto(req.params.codigo).toUpperCase();
  const fila = db.prepare(`
    SELECT i.id FROM ingresos_leche i LEFT JOIN decisiones_leche d ON d.id_ingreso = i.id
    WHERE d.codigo_lote = ? OR i.codigo = ?
  `).get(codigo, codigo);
  if (!fila) return res.status(404).json({ error: `No se encontró un lote ni un ingreso con el código ${codigo}` });
  const ingreso = obtenerIngreso(fila.id);
  // Otros ingresos del mismo proveedor en los 30 días previos: ayuda a ver si el problema se repite
  const historialProveedor = db.prepare(`
    SELECT i.codigo, i.fecha_hora_llegada, i.volumen_l, i.estado, a.sugerencia
    FROM ingresos_leche i LEFT JOIN analisis_leche a ON a.id_ingreso = i.id
    WHERE i.id_proveedor = ? AND i.id <> ? AND i.fecha_hora_llegada BETWEEN ? AND ?
    ORDER BY i.fecha_hora_llegada DESC
  `).all(ingreso.id_proveedor, ingreso.id, `${sumarDias(ingreso.fecha_hora_llegada.slice(0, 10), -30)} 00:00`, ingreso.fecha_hora_llegada);
  res.json({
    ...ingreso,
    bitacora: [...bitacoraDe("ingreso", ingreso.id), ...bitacoraDe("analisis", ingreso.id)],
    historial_proveedor: historialProveedor
  });
});

// Indicadores de calidad del período (documento, sección 10.1)
// GET /api/recepcion/indicadores?desde&hasta
router.get("/indicadores", (req, res) => {
  const hasta = esFecha(req.query.hasta) ? req.query.hasta : hoyLocal();
  const desde = esFecha(req.query.desde) ? req.query.desde : sumarDias(hasta, -29);
  if (desde > hasta) return res.status(400).json({ error: "La fecha inicial no puede ser posterior a la final" });

  const ingresos = db.prepare(`${SELECT_INGRESO} WHERE substr(i.fecha_hora_llegada, 1, 10) BETWEEN ? AND ?`)
    .all(desde, hasta).map(conObservaciones);

  // Por proveedor: volumen, conformidad y rechazos (ordenado por menor conformidad)
  const porProveedor = Object.values(ingresos.reduce((grupos, i) => {
    const g = grupos[i.id_proveedor] ||= { id: i.id_proveedor, proveedor: i.proveedor, codigo: i.codigo_proveedor, filas: [] };
    g.filas.push(i);
    return grupos;
  }, {})).map(({ filas, ...g }) => {
    const r = calcularIndicadoresCalidad(filas);
    return { ...g, ingresos: r.ingresos, litros_recibidos: r.litros_recibidos, pct_conformidad: r.pct_conformidad,
      rechazados: filas.filter((i) => i.estado === "rechazado").length, pct_rechazo: r.pct_rechazo };
  }).sort((a, b) => (a.pct_conformidad ?? 101) - (b.pct_conformidad ?? 101));

  // Serie diaria de litros por resultado
  const dias = {};
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias[f] = { fecha: f, aceptado: 0, derivado: 0, rechazado: 0, pendiente: 0 };
  ingresos.forEach((i) => {
    const clave = PENDIENTES.includes(i.estado) ? "pendiente" : i.estado;
    dias[i.fecha_hora_llegada.slice(0, 10)][clave] += i.volumen_l;
  });

  // Parámetros que más fallan
  const conteo = {};
  ingresos.forEach((i) => i.observaciones.forEach((o) => { conteo[o.nombre] = (conteo[o.nombre] || 0) + 1; }));
  const analizados = ingresos.filter((i) => i.sugerencia).length;
  const parametrosFuera = Object.entries(conteo)
    .map(([parametro, veces]) => ({ parametro, veces, pct: porcentaje(veces, analizados) }))
    .sort((a, b) => b.veces - a.veces);

  // Decisiones que se apartaron de la sugerencia del sistema (siempre con motivo)
  const distintas = ingresos.filter((i) => i.resultado && !i.coincide_sugerencia).length;

  res.json({
    desde, hasta,
    ...calcularIndicadoresCalidad(ingresos),
    decisiones_distintas_a_sugerencia: distintas,
    por_proveedor: porProveedor,
    serie: Object.values(dias),
    parametros_fuera: parametrosFuera
  });
});

// Bitácora de cambios de parámetros
// GET /api/recepcion/parametros/bitacora
router.get("/parametros/bitacora", (req, res) => {
  res.json(db.prepare(`
    SELECT b.*, t.nombre || ' ' || t.apellido AS usuario, p.nombre AS parametro
    FROM bitacora_recepcion b JOIN usuarios u ON u.id = b.id_usuario JOIN trabajadores t ON t.id = u.id_trabajador
    LEFT JOIN parametros_calidad p ON p.codigo = b.id_registro
    WHERE b.entidad = 'parametro' ORDER BY b.fecha DESC, b.id DESC LIMIT 50
  `).all());
});

// --- Registro de ingresos (operador de recepción) ---

// POST /api/recepcion/ingresos  body: { id_proveedor, id_cisterna, volumen_l, temperatura_c, hora_llegada?, observacion? }
// hora_llegada (HH:MM, de hoy) permite registrar una cisterna que llegó hace unos minutos; por defecto, ahora.
router.post("/ingresos", permitirAccion("registrar"), (req, res) => {
  const datos = req.body || {};
  const error = validarDatosIngreso(datos);
  if (error) return res.status(400).json({ error });

  const hoy = hoyLocal();
  let llegada = ahora();
  if (datos.hora_llegada) {
    if (!esHora(datos.hora_llegada)) return res.status(400).json({ error: "La hora de llegada debe tener el formato HH:MM" });
    if (datos.hora_llegada > horaLocal()) return res.status(400).json({ error: "La hora de llegada no puede ser posterior a la hora actual" });
    llegada = `${hoy} ${datos.hora_llegada}`;
  }
  const enCurso = db.prepare(`
    SELECT codigo FROM ingresos_leche WHERE id_cisterna = ? AND estado IN ('en_analisis', 'por_decidir')
  `).get(datos.id_cisterna);
  if (enCurso) return res.status(409).json({ error: `Esa cisterna ya tiene un ingreso en curso (${enCurso.codigo})` });

  const id = enTransaccion(() => db.prepare(`
    INSERT INTO ingresos_leche (codigo, fecha_hora_llegada, id_proveedor, id_cisterna, volumen_l, temperatura_c,
      observacion, id_operador, id_registrado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    siguienteCodigo("ingresos_leche", "codigo", "ING", hoy), llegada, datos.id_proveedor, datos.id_cisterna,
    Number(datos.volumen_l), Number(datos.temperatura_c), texto(datos.observacion) || null,
    req.usuario.id_trabajador, req.usuario.id
  ).lastInsertRowid);

  const ingreso = obtenerIngreso(id);
  notificarPuestos(["analista_laboratorio"], "recepcion",
    `Nueva muestra por analizar: ${ingreso.codigo} (${ingreso.proveedor}, ${ingreso.volumen_l} L)`, `/recepcion/ingresos/${id}`);
  res.status(201).json(ingreso);
});

// Corrección de un ingreso antes de la decisión: motivo obligatorio y cada cambio queda en la bitácora.
// PUT /api/recepcion/ingresos/:id  body: { id_proveedor?, id_cisterna?, volumen_l?, temperatura_c?, observacion?, motivo }
router.put("/ingresos/:id", permitirAccion("registrar"), (req, res) => {
  const actual = db.prepare("SELECT * FROM ingresos_leche WHERE id = ?").get(req.params.id);
  if (!actual) return res.status(404).json({ error: "Ingreso no encontrado" });
  if (!PENDIENTES.includes(actual.estado)) return res.status(409).json({ error: "Un ingreso con decisión registrada no se modifica" });
  const motivo = texto(req.body?.motivo);
  if (!motivo) return res.status(400).json({ error: "Indique el motivo de la corrección" });

  const campos = ["id_proveedor", "id_cisterna", "volumen_l", "temperatura_c", "observacion"];
  const datos = { ...actual };
  campos.forEach((c) => { if (req.body[c] !== undefined) datos[c] = c === "observacion" ? texto(req.body[c]) || null : req.body[c]; });
  const error = validarDatosIngreso(datos);
  if (error) return res.status(400).json({ error });
  ["volumen_l", "temperatura_c", "id_proveedor", "id_cisterna"].forEach((c) => { datos[c] = Number(datos[c]); });

  const cambios = campos.filter((c) => datos[c] !== actual[c]);
  if (!cambios.length) return res.status(400).json({ error: "No hay cambios para guardar" });

  enTransaccion(() => {
    db.prepare(`
      UPDATE ingresos_leche SET id_proveedor = ?, id_cisterna = ?, volumen_l = ?, temperatura_c = ?, observacion = ? WHERE id = ?
    `).run(datos.id_proveedor, datos.id_cisterna, datos.volumen_l, datos.temperatura_c, datos.observacion, actual.id);
    cambios.forEach((c) => registrarBitacora("ingreso", actual.id, c, actual[c], datos[c], motivo, req.usuario.id));
    // La temperatura es un parámetro de aceptación: si ya hay análisis, se vuelve a evaluar
    const analisis = db.prepare("SELECT * FROM analisis_leche WHERE id_ingreso = ?").get(actual.id);
    if (analisis && cambios.includes("temperatura_c")) {
      const r = evaluar(datos, analisis);
      db.prepare("UPDATE analisis_leche SET sugerencia = ?, observaciones = ? WHERE id_ingreso = ?")
        .run(r.sugerencia, JSON.stringify(r.observaciones), actual.id);
    }
  });
  res.json(obtenerIngreso(actual.id));
});

// --- Análisis (analista de laboratorio) ---

// POST /api/recepcion/ingresos/:id/analisis  body: { acidez, densidad, grasa, alcohol, antibioticos }
router.post("/ingresos/:id/analisis", permitirAccion("analizar"), (req, res) => {
  const ingreso = db.prepare("SELECT * FROM ingresos_leche WHERE id = ?").get(req.params.id);
  if (!ingreso) return res.status(404).json({ error: "Ingreso no encontrado" });
  if (ingreso.estado !== "en_analisis") return res.status(409).json({ error: "Este ingreso ya tiene un análisis registrado" });
  const datos = req.body || {};
  const error = validarAnalisis(datos);
  if (error) return res.status(400).json({ error });

  const r = evaluar(ingreso, datos);
  enTransaccion(() => {
    db.prepare(`
      INSERT INTO analisis_leche (id_ingreso, codigo_muestra, acidez, densidad, grasa, alcohol, antibioticos, sugerencia,
        observaciones, fecha_hora, id_analista)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ingreso.id, ingreso.codigo.replace("ING", "M"), Number(datos.acidez), Number(datos.densidad), Number(datos.grasa),
      datos.alcohol, datos.antibioticos, r.sugerencia, JSON.stringify(r.observaciones), ahora(), req.usuario.id_trabajador);
    db.prepare("UPDATE ingresos_leche SET estado = 'por_decidir' WHERE id = ?").run(ingreso.id);
  });

  const textoSugerencia = { aceptar: "aceptar", derivar: "derivar", rechazar: "RECHAZAR" }[r.sugerencia];
  notificarPuestos(["supervisor_calidad"], "recepcion",
    `${ingreso.codigo} analizado: el sistema sugiere ${textoSugerencia}. Falta su decisión.`, `/recepcion/ingresos/${ingreso.id}`);
  res.status(201).json(obtenerIngreso(ingreso.id));
});

// Corrección del análisis antes de la decisión (motivo obligatorio, queda en bitácora y se vuelve a evaluar)
// PUT /api/recepcion/ingresos/:id/analisis  body: { ...campos, motivo }
router.put("/ingresos/:id/analisis", permitirAccion("analizar"), (req, res) => {
  const ingreso = db.prepare("SELECT * FROM ingresos_leche WHERE id = ?").get(req.params.id);
  const actual = ingreso && db.prepare("SELECT * FROM analisis_leche WHERE id_ingreso = ?").get(ingreso.id);
  if (!actual) return res.status(404).json({ error: "El ingreso no tiene análisis registrado" });
  if (ingreso.estado !== "por_decidir") return res.status(409).json({ error: "Un análisis con decisión registrada no se modifica" });
  const motivo = texto(req.body?.motivo);
  if (!motivo) return res.status(400).json({ error: "Indique el motivo de la corrección" });

  const campos = ["acidez", "densidad", "grasa", "alcohol", "antibioticos"];
  const datos = { ...actual };
  campos.forEach((c) => { if (req.body[c] !== undefined) datos[c] = req.body[c]; });
  const error = validarAnalisis(datos);
  if (error) return res.status(400).json({ error });
  ["acidez", "densidad", "grasa"].forEach((c) => { datos[c] = Number(datos[c]); });
  const cambios = campos.filter((c) => datos[c] !== actual[c]);
  if (!cambios.length) return res.status(400).json({ error: "No hay cambios para guardar" });

  const r = evaluar(ingreso, datos);
  enTransaccion(() => {
    db.prepare(`
      UPDATE analisis_leche SET acidez = ?, densidad = ?, grasa = ?, alcohol = ?, antibioticos = ?, sugerencia = ?, observaciones = ?
      WHERE id_ingreso = ?
    `).run(datos.acidez, datos.densidad, datos.grasa, datos.alcohol, datos.antibioticos, r.sugerencia, JSON.stringify(r.observaciones), ingreso.id);
    cambios.forEach((c) => registrarBitacora("analisis", ingreso.id, c, actual[c], datos[c], motivo, req.usuario.id));
  });
  res.json(obtenerIngreso(ingreso.id));
});

// --- Decisión (supervisor de calidad) ---

// POST /api/recepcion/ingresos/:id/decision  body: { resultado: aceptado|derivado|rechazado, motivo?, tanque? }
// El motivo es obligatorio si no se acepta o si la decisión se aparta de la sugerencia del sistema.
router.post("/ingresos/:id/decision", permitirAccion("decidir"), (req, res) => {
  const ingreso = obtenerIngreso(req.params.id);
  if (!ingreso) return res.status(404).json({ error: "Ingreso no encontrado" });
  if (ingreso.estado === "en_analisis") return res.status(409).json({ error: "Falta el análisis de la muestra antes de decidir" });
  if (ingreso.estado !== "por_decidir") return res.status(409).json({ error: "Este ingreso ya tiene una decisión registrada" });
  if (ingreso.id_analista === req.usuario.id_trabajador) {
    return res.status(403).json({ error: "Quien analizó la muestra no puede decidir sobre ella (segregación de funciones)" });
  }

  const { resultado } = req.body || {};
  const motivo = texto(req.body?.motivo);
  if (!["aceptado", "derivado", "rechazado"].includes(resultado)) {
    return res.status(400).json({ error: "resultado debe ser aceptado, derivado o rechazado" });
  }
  const coincide = RESULTADO_DE_SUGERENCIA[ingreso.sugerencia] === resultado;
  if (!coincide && !motivo) {
    return res.status(400).json({ error: `El sistema sugirió ${ingreso.sugerencia}: indique el motivo para decidir distinto` });
  }
  if (resultado !== "aceptado" && !motivo) return res.status(400).json({ error: "Indique el motivo de la derivación o el rechazo" });

  let tanque = null;
  let lote = null;
  const fechaHora = ahora();
  if (resultado !== "rechazado") {
    tanque = db.prepare("SELECT codigo FROM tanques WHERE codigo = ? AND activo = 1").get(String(req.body.tanque || ""))?.codigo;
    if (!tanque) return res.status(400).json({ error: "Seleccione el tanque de destino" });
    lote = siguienteCodigo("decisiones_leche", "codigo_lote", "LR", hoyLocal());
  }

  enTransaccion(() => {
    db.prepare(`
      INSERT INTO decisiones_leche (id_ingreso, resultado, coincide_sugerencia, motivo, tanque, codigo_lote, fecha_hora, id_supervisor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ingreso.id, resultado, coincide ? 1 : 0, motivo || null, tanque, lote, fechaHora, req.usuario.id_trabajador);
    db.prepare("UPDATE ingresos_leche SET estado = ? WHERE id = ?").run(resultado, ingreso.id);
  });

  const enlace = `/recepcion/ingresos/${ingreso.id}`;
  if (resultado === "rechazado") {
    notificarTrabajador(ingreso.id_operador, "recepcion", `${ingreso.codigo} RECHAZADO: no descargar; devolver la cisterna ${ingreso.placa}. Motivo: ${motivo}`, enlace);
    notificarPuestos(["coordinador_acopio", "jefatura_planta"], "recepcion",
      `Rechazo de leche de ${ingreso.proveedor} (${ingreso.volumen_l} L, ${ingreso.codigo}). Motivo: ${motivo}`, enlace);
  } else {
    notificarTrabajador(ingreso.id_operador, "recepcion",
      `${ingreso.codigo} ${resultado}: descargar en el tanque ${tanque} con el lote ${lote}`, enlace);
  }
  res.status(201).json(obtenerIngreso(ingreso.id));
});

// Descarga a tanque (operador de recepción), después de la decisión
// POST /api/recepcion/ingresos/:id/descarga
router.post("/ingresos/:id/descarga", permitirAccion("registrar"), (req, res) => {
  const ingreso = db.prepare("SELECT * FROM ingresos_leche WHERE id = ?").get(req.params.id);
  if (!ingreso) return res.status(404).json({ error: "Ingreso no encontrado" });
  if (!["aceptado", "derivado"].includes(ingreso.estado)) {
    return res.status(409).json({ error: "Solo se descarga la leche aceptada o derivada" });
  }
  if (ingreso.fecha_hora_descarga) return res.status(409).json({ error: "La descarga ya fue registrada" });
  db.prepare("UPDATE ingresos_leche SET fecha_hora_descarga = ?, id_operador_descarga = ? WHERE id = ?")
    .run(ahora(), req.usuario.id_trabajador, ingreso.id);
  res.json(obtenerIngreso(ingreso.id));
});

// --- Catálogos y parámetros (supervisor de calidad) ---

// POST /api/recepcion/proveedores  body: { codigo, nombre, centro_acopio?, telefono? }
router.post("/proveedores", permitirAccion("administrar"), (req, res) => {
  const codigo = texto(req.body?.codigo).toUpperCase();
  const nombre = texto(req.body?.nombre);
  if (!codigo || !nombre) return res.status(400).json({ error: "codigo y nombre son obligatorios" });
  try {
    const id = db.prepare("INSERT INTO proveedores (codigo, nombre, centro_acopio, telefono) VALUES (?, ?, ?, ?)")
      .run(codigo, nombre, texto(req.body.centro_acopio) || null, texto(req.body.telefono) || null).lastInsertRowid;
    res.status(201).json(db.prepare("SELECT * FROM proveedores WHERE id = ?").get(id));
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Ya existe un proveedor con ese código" });
    throw err;
  }
});

// PUT /api/recepcion/proveedores/:id  body: { nombre?, centro_acopio?, telefono?, activo? }
router.put("/proveedores/:id", permitirAccion("administrar"), (req, res) => {
  const actual = db.prepare("SELECT * FROM proveedores WHERE id = ?").get(req.params.id);
  if (!actual) return res.status(404).json({ error: "Proveedor no encontrado" });
  const d = { ...actual, ...req.body };
  if (!texto(d.nombre)) return res.status(400).json({ error: "El nombre es obligatorio" });
  db.prepare("UPDATE proveedores SET nombre = ?, centro_acopio = ?, telefono = ?, activo = ? WHERE id = ?")
    .run(texto(d.nombre), texto(d.centro_acopio) || null, texto(d.telefono) || null, d.activo ? 1 : 0, actual.id);
  res.json(db.prepare("SELECT * FROM proveedores WHERE id = ?").get(actual.id));
});

// POST /api/recepcion/cisternas  body: { placa, capacidad_l, transportista? }
router.post("/cisternas", permitirAccion("administrar"), (req, res) => {
  const placa = texto(req.body?.placa).toUpperCase();
  const capacidad = Number(req.body?.capacidad_l);
  if (!placa) return res.status(400).json({ error: "La placa es obligatoria" });
  if (!Number.isInteger(capacidad) || capacidad <= 0) return res.status(400).json({ error: "La capacidad debe ser un número entero de litros" });
  try {
    const id = db.prepare("INSERT INTO cisternas (placa, capacidad_l, transportista) VALUES (?, ?, ?)")
      .run(placa, capacidad, texto(req.body.transportista) || null).lastInsertRowid;
    res.status(201).json(db.prepare("SELECT * FROM cisternas WHERE id = ?").get(id));
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Ya existe una cisterna con esa placa" });
    throw err;
  }
});

// PUT /api/recepcion/cisternas/:id  body: { capacidad_l?, transportista?, activo? }
router.put("/cisternas/:id", permitirAccion("administrar"), (req, res) => {
  const actual = db.prepare("SELECT * FROM cisternas WHERE id = ?").get(req.params.id);
  if (!actual) return res.status(404).json({ error: "Cisterna no encontrada" });
  const d = { ...actual, ...req.body };
  const capacidad = Number(d.capacidad_l);
  if (!Number.isInteger(capacidad) || capacidad <= 0) return res.status(400).json({ error: "La capacidad debe ser un número entero de litros" });
  db.prepare("UPDATE cisternas SET capacidad_l = ?, transportista = ?, activo = ? WHERE id = ?")
    .run(capacidad, texto(d.transportista) || null, d.activo ? 1 : 0, actual.id);
  res.json(db.prepare("SELECT * FROM cisternas WHERE id = ?").get(actual.id));
});

// Cambiar un parámetro de aceptación. Motivo obligatorio; cada valor cambiado queda en la bitácora.
// PUT /api/recepcion/parametros/:codigo  body: { minimo?, maximo?, valor_aceptable?, critico?, motivo }
router.put("/parametros/:codigo", permitirAccion("administrar"), (req, res) => {
  const actual = db.prepare("SELECT * FROM parametros_calidad WHERE codigo = ?").get(req.params.codigo);
  if (!actual) return res.status(404).json({ error: "Parámetro no encontrado" });
  const motivo = texto(req.body?.motivo);
  if (!motivo) return res.status(400).json({ error: "Indique el motivo del cambio (ej. norma o instrucción que lo respalda)" });

  const numeroONulo = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
  const nuevo = { ...actual };
  if (actual.tipo === "rango") {
    if (req.body.minimo !== undefined) nuevo.minimo = numeroONulo(req.body.minimo);
    if (req.body.maximo !== undefined) nuevo.maximo = numeroONulo(req.body.maximo);
    if ([nuevo.minimo, nuevo.maximo].some((v) => v !== null && !Number.isFinite(v))) {
      return res.status(400).json({ error: "Los límites deben ser números" });
    }
    if (nuevo.minimo === null && nuevo.maximo === null) return res.status(400).json({ error: "Indique al menos un límite" });
    if (nuevo.minimo !== null && nuevo.maximo !== null && nuevo.maximo < nuevo.minimo) {
      return res.status(400).json({ error: "El máximo no puede ser menor que el mínimo" });
    }
  }
  if (req.body.critico !== undefined) nuevo.critico = req.body.critico ? 1 : 0;

  const cambios = ["minimo", "maximo", "critico"].filter((c) => nuevo[c] !== actual[c]);
  if (!cambios.length) return res.status(400).json({ error: "No hay cambios para guardar" });

  enTransaccion(() => {
    db.prepare(`
      UPDATE parametros_calidad SET minimo = ?, maximo = ?, critico = ?, id_actualizado_por = ?, fecha_actualizacion = datetime('now', 'localtime')
      WHERE codigo = ?
    `).run(nuevo.minimo, nuevo.maximo, nuevo.critico, req.usuario.id, actual.codigo);
    cambios.forEach((c) => registrarBitacora("parametro", actual.codigo, c, actual[c], nuevo[c], motivo, req.usuario.id));
  });
  res.json(parametrosVigentes().find((p) => p.codigo === actual.codigo));
});

module.exports = router;
