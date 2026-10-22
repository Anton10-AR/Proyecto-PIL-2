// Pruebas del derecho a vacaciones (Ley General del Trabajo) y de la gestión por año de servicio
const { test } = require("node:test");
const assert = require("node:assert");
const { diasSegunAntiguedad, calcularDerechoVacaciones } = require("../src/utils/vacaciones");

test("días según años de servicio cumplidos", () => {
  assert.strictEqual(diasSegunAntiguedad(0), 0);
  assert.strictEqual(diasSegunAntiguedad(1), 15);
  assert.strictEqual(diasSegunAntiguedad(4), 15);
  assert.strictEqual(diasSegunAntiguedad(5), 20);
  assert.strictEqual(diasSegunAntiguedad(9), 20);
  assert.strictEqual(diasSegunAntiguedad(10), 30);
});

test("menos de un año de servicio: sin derecho", () => {
  assert.deepStrictEqual(calcularDerechoVacaciones("2026-03-01", "2026-10-06"),
    { anios: 0, dias: 0, gestion_inicio: null, gestion_fin: null });
});

test("sin fecha de ingreso: sin derecho", () => {
  assert.strictEqual(calcularDerechoVacaciones(null, "2026-10-06").dias, 0);
});

test("la gestión empieza en el último aniversario y dura un año", () => {
  assert.deepStrictEqual(calcularDerechoVacaciones("2022-06-01", "2026-10-06"),
    { anios: 4, dias: 15, gestion_inicio: "2026-06-01", gestion_fin: "2027-05-31" });
});

test("el día del aniversario cambia de gestión", () => {
  assert.strictEqual(calcularDerechoVacaciones("2021-10-06", "2026-10-05").anios, 4);
  const enAniversario = calcularDerechoVacaciones("2021-10-06", "2026-10-06");
  assert.strictEqual(enAniversario.anios, 5);
  assert.strictEqual(enAniversario.dias, 20);
  assert.strictEqual(enAniversario.gestion_inicio, "2026-10-06");
});

test("ingreso el 29 de febrero: en años no bisiestos el aniversario es el 28", () => {
  const derecho = calcularDerechoVacaciones("2024-02-29", "2026-03-01");
  assert.strictEqual(derecho.anios, 2);
  assert.strictEqual(derecho.gestion_inicio, "2026-02-28");
  assert.strictEqual(derecho.gestion_fin, "2027-02-27");
});
