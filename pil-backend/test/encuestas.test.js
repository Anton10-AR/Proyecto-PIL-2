// Pruebas de la agregación de resultados de encuestas y del mínimo de respuestas por grupo
const { test } = require("node:test");
const assert = require("node:assert");
const { resumirResultados, promediosPorArea } = require("../src/utils/encuestas");

const preguntas = [
  { id: 1, texto: "Me siento valorado", tipo: "escala", opciones: null },
  { id: 2, texto: "Prioridad", tipo: "opcion", opciones: ["Salarios", "Capacitación"] },
  { id: 3, texto: "Comentarios", tipo: "texto", opciones: null }
];
const envios = [
  { id: "a", area: "Producción" }, { id: "b", area: "Producción" }, { id: "c", area: "Producción" },
  { id: "d", area: "Calidad" }, { id: "e", area: "Calidad" }
];
const respuestas = [
  { id_envio: "a", id_pregunta: 1, valor_numero: 5 }, { id_envio: "b", id_pregunta: 1, valor_numero: 4 },
  { id_envio: "c", id_pregunta: 1, valor_numero: 3 }, { id_envio: "d", id_pregunta: 1, valor_numero: 2 },
  { id_envio: "e", id_pregunta: 1, valor_numero: 1 },
  { id_envio: "a", id_pregunta: 2, valor_texto: "Salarios" }, { id_envio: "b", id_pregunta: 2, valor_texto: "Salarios" },
  { id_envio: "d", id_pregunta: 2, valor_texto: "Capacitación" },
  { id_envio: "c", id_pregunta: 3, valor_texto: "Zeta" }, { id_envio: "a", id_pregunta: 3, valor_texto: "Alfa" }
];

test("con menos de 3 envíos no se muestran resultados", () => {
  const r = resumirResultados(preguntas, envios.slice(0, 2), respuestas);
  assert.deepStrictEqual(r, { total: 2, suficiente: false, preguntas: [] });
});

test("escala: distribución y promedio", () => {
  const r = resumirResultados(preguntas, envios, respuestas);
  assert.strictEqual(r.total, 5);
  assert.deepStrictEqual(r.preguntas[0].distribucion, [1, 1, 1, 1, 1]);
  assert.strictEqual(r.preguntas[0].promedio, 3);
});

test("opción única: conteo por opción", () => {
  const r = resumirResultados(preguntas, envios, respuestas);
  assert.deepStrictEqual(r.preguntas[1].conteo, [{ opcion: "Salarios", cantidad: 2 }, { opcion: "Capacitación", cantidad: 1 }]);
});

test("texto libre: ordenado alfabéticamente, no por llegada", () => {
  const r = resumirResultados(preguntas, envios, respuestas);
  assert.deepStrictEqual(r.preguntas[2].textos, ["Alfa", "Zeta"]);
});

test("por área: solo las que tienen 3 o más envíos", () => {
  const r = promediosPorArea(preguntas, envios, respuestas);
  assert.deepStrictEqual(r.areas, [{ area: "Producción", envios: 3, promedio: 4 }]);
  assert.strictEqual(r.envios_otras_areas, 2);
});
