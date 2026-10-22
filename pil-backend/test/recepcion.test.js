const { test } = require("node:test");
const assert = require("node:assert");
const {
  evaluarMuestra, describirLimite, codigoCorrelativo, minutosEntre, calcularIndicadoresCalidad
} = require("../src/utils/recepcion");

const PARAMETROS = [
  { codigo: "temperatura", nombre: "Temperatura", unidad: "°C", tipo: "rango", minimo: null, maximo: 10, critico: 0 },
  { codigo: "acidez", nombre: "Acidez", unidad: "%", tipo: "rango", minimo: 0.13, maximo: 0.17, critico: 0 },
  { codigo: "densidad", nombre: "Densidad", unidad: "g/ml", tipo: "rango", minimo: 1.03, maximo: 1.033, critico: 0 },
  { codigo: "grasa", nombre: "Grasa", unidad: "%", tipo: "rango", minimo: 3, maximo: null, critico: 0 },
  { codigo: "alcohol", nombre: "Alcohol", tipo: "cualitativo", valor_aceptable: "negativo", critico: 1 },
  { codigo: "antibioticos", nombre: "Antibióticos", tipo: "cualitativo", valor_aceptable: "ausencia", critico: 1 }
];

const NORMAL = { temperatura: 6, acidez: 0.15, densidad: 1.031, grasa: 3.4, alcohol: "negativo", antibioticos: "ausencia" };

test("una muestra dentro de norma se sugiere aceptar", () => {
  const r = evaluarMuestra(NORMAL, PARAMETROS);
  assert.strictEqual(r.sugerencia, "aceptar");
  assert.deepStrictEqual(r.observaciones, []);
});

test("los límites son inclusivos", () => {
  const r = evaluarMuestra({ ...NORMAL, temperatura: 10, acidez: 0.17, densidad: 1.03, grasa: 3 }, PARAMETROS);
  assert.strictEqual(r.sugerencia, "aceptar");
});

test("un parámetro no crítico fuera de norma sugiere derivar", () => {
  const r = evaluarMuestra({ ...NORMAL, acidez: 0.19 }, PARAMETROS);
  assert.strictEqual(r.sugerencia, "derivar");
  assert.strictEqual(r.observaciones.length, 1);
  assert.strictEqual(r.observaciones[0].codigo, "acidez");
  assert.strictEqual(r.observaciones[0].limite, "0,13 – 0,17 %");
});

test("un parámetro crítico fuera de norma sugiere rechazar aunque haya otros no críticos", () => {
  const r = evaluarMuestra({ ...NORMAL, acidez: 0.19, antibioticos: "presencia" }, PARAMETROS);
  assert.strictEqual(r.sugerencia, "rechazar");
  assert.strictEqual(r.observaciones.length, 2);
});

test("describe los límites de cada tipo de parámetro", () => {
  assert.strictEqual(describirLimite(PARAMETROS[0]), "≤ 10 °C");
  assert.strictEqual(describirLimite(PARAMETROS[3]), "≥ 3 %");
  assert.strictEqual(describirLimite(PARAMETROS[4]), "negativo");
});

test("arma códigos correlativos por día", () => {
  assert.strictEqual(codigoCorrelativo("LR", "2026-10-21", 3), "LR-20261021-03");
  assert.strictEqual(codigoCorrelativo("ING", "2026-01-05", 12), "ING-20260105-12");
});

test("cuenta los minutos entre dos marcas de tiempo", () => {
  assert.strictEqual(minutosEntre("2026-10-21 06:40", "2026-10-21 07:25:00"), 45);
  assert.strictEqual(minutosEntre("2026-10-21 23:50", "2026-10-22 00:10"), 20);
});

test("calcula los indicadores de calidad del período", () => {
  const ingresos = [
    { volumen_l: 6000, estado: "aceptado", sugerencia: "aceptar", fecha_hora_llegada: "2026-10-20 06:00", fecha_hora_decision: "2026-10-20 06:40" },
    { volumen_l: 3000, estado: "rechazado", sugerencia: "rechazar", fecha_hora_llegada: "2026-10-20 07:00", fecha_hora_decision: "2026-10-20 08:00" },
    { volumen_l: 1000, estado: "derivado", sugerencia: "derivar", fecha_hora_llegada: "2026-10-20 08:00", fecha_hora_decision: "2026-10-20 08:20" },
    { volumen_l: 5000, estado: "por_decidir", sugerencia: "aceptar", fecha_hora_llegada: "2026-10-21 06:00", fecha_hora_decision: null },
    { volumen_l: 4000, estado: "en_analisis", sugerencia: null, fecha_hora_llegada: "2026-10-21 06:30", fecha_hora_decision: null }
  ];
  const r = calcularIndicadoresCalidad(ingresos);
  assert.strictEqual(r.ingresos, 5);
  assert.strictEqual(r.pendientes, 2);
  assert.strictEqual(r.litros_recibidos, 19000);
  assert.strictEqual(r.litros_rechazados, 3000);
  assert.strictEqual(r.pct_rechazo, 30);            // 3000 / 10000 decididos
  assert.strictEqual(r.pct_conformidad, 50);        // 2 de 4 analizados con sugerencia aceptar
  assert.strictEqual(r.tiempo_recepcion_min, 40);   // (40 + 60 + 20) / 3
  assert.strictEqual(r.pct_registros_completos, 60); // 3 de 5
});

test("sin ingresos los porcentajes quedan vacíos", () => {
  const r = calcularIndicadoresCalidad([]);
  assert.strictEqual(r.pct_rechazo, null);
  assert.strictEqual(r.tiempo_recepcion_min, null);
});
