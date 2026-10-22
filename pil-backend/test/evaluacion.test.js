// Pruebas de las reglas de evaluación del desempeño: pesos de criterios y puntaje ponderado
const { test } = require("node:test");
const assert = require("node:assert");
const { errorCriterios, calcularPuntaje, categoriaPuntaje } = require("../src/utils/evaluacion");

const criterios = [
  { id: 1, nombre: "Puntualidad", peso: 20 },
  { id: 2, nombre: "Calidad", peso: 50 },
  { id: 3, nombre: "Trabajo en equipo", peso: 30 }
];

test("los pesos deben sumar 100", () => {
  assert.strictEqual(errorCriterios(criterios), null);
  assert.match(errorCriterios([{ nombre: "A", peso: 60 }, { nombre: "B", peso: 30 }]), /suman 90/);
});

test("criterios sin nombre, repetidos o con peso inválido", () => {
  assert.ok(errorCriterios([]));
  assert.ok(errorCriterios([{ nombre: "", peso: 100 }]));
  assert.match(errorCriterios([{ nombre: "A", peso: 50 }, { nombre: "a", peso: 50 }]), /repetido/);
  assert.match(errorCriterios([{ nombre: "A", peso: 0 }, { nombre: "B", peso: 100 }]), /entero de 1 a 100/);
  assert.match(errorCriterios([{ nombre: "A", peso: 50.5 }, { nombre: "B", peso: 49.5 }]), /entero/);
});

test("puntaje ponderado en escala 1 a 5", () => {
  assert.strictEqual(calcularPuntaje(criterios, { 1: 5, 2: 5, 3: 5 }), 5);
  assert.strictEqual(calcularPuntaje(criterios, { 1: 1, 2: 1, 3: 1 }), 1);
  // 3*0.2 + 4*0.5 + 2*0.3 = 0.6 + 2 + 0.6 = 3.2
  assert.strictEqual(calcularPuntaje(criterios, { 1: 3, 2: 4, 3: 2 }), 3.2);
});

test("sin calificar todos los criterios no hay puntaje", () => {
  assert.strictEqual(calcularPuntaje(criterios, { 1: 3, 2: 4 }), null);
  assert.strictEqual(calcularPuntaje(criterios, { 1: 3, 2: 4, 3: 6 }), null);
});

test("categorías del puntaje", () => {
  assert.strictEqual(categoriaPuntaje(4.6), "Sobresaliente");
  assert.strictEqual(categoriaPuntaje(3.5), "Bueno");
  assert.strictEqual(categoriaPuntaje(2.5), "Aceptable");
  assert.strictEqual(categoriaPuntaje(2.49), "Necesita mejorar");
  assert.strictEqual(categoriaPuntaje(null), null);
});
