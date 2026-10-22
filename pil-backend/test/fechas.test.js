// Pruebas de las utilidades de fechas y del cálculo de retraso
const { test } = require("node:test");
const assert = require("node:assert");
const { esFecha, esHora, esMes, calcularHoras, calcularRetraso, diaSemana, sumarDias, rangoDelMes } = require("../src/utils/fechas");

test("valida formatos de fecha, hora y mes", () => {
  assert.ok(esFecha("2026-02-28"));
  assert.ok(!esFecha("2026-02-30"));
  assert.ok(!esFecha("2026-2-3"));
  assert.ok(esHora("08:05"));
  assert.ok(esHora("23:59"));
  assert.ok(!esHora("24:00"));
  assert.ok(!esHora("8:05"));
  assert.ok(esMes("2026-10"));
  assert.ok(!esMes("2026-13"));
});

test("calcula horas trabajadas en el mismo día", () => {
  assert.strictEqual(calcularHoras("08:30", "17:00"), 8.5);
  assert.strictEqual(calcularHoras("06:00", "14:20"), 8.33);
});

test("día de la semana ISO (lunes = 1, domingo = 7)", () => {
  assert.strictEqual(diaSemana("2026-10-05"), 1);
  assert.strictEqual(diaSemana("2026-10-11"), 7);
});

test("suma días cruzando mes y año", () => {
  assert.strictEqual(sumarDias("2026-01-31", 1), "2026-02-01");
  assert.strictEqual(sumarDias("2027-01-01", -1), "2026-12-31");
});

test("rango de un mes, incluido febrero bisiesto", () => {
  assert.deepStrictEqual(rangoDelMes("2028-02"), { desde: "2028-02-01", hasta: "2028-02-29" });
  assert.deepStrictEqual(rangoDelMes("2026-10"), { desde: "2026-10-01", hasta: "2026-10-31" });
});

test("retraso: dentro de la tolerancia no cuenta; pasada, cuentan todos los minutos", () => {
  assert.strictEqual(calcularRetraso("08:25", "08:30", 10), 0);
  assert.strictEqual(calcularRetraso("08:40", "08:30", 10), 0);
  assert.strictEqual(calcularRetraso("08:41", "08:30", 10), 11);
  assert.strictEqual(calcularRetraso("08:31", "08:30", 0), 1);
});
