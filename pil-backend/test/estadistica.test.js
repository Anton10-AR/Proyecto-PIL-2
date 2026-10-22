// Pruebas de los helpers de indicadores y exportación
const { test } = require("node:test");
const assert = require("node:assert");
const { porcentaje, promedio, horasEntre, aCSV } = require("../src/utils/estadistica");

test("porcentaje con un decimal y sin división por cero", () => {
  assert.strictEqual(porcentaje(2, 3), 66.7);
  assert.strictEqual(porcentaje(0, 5), 0);
  assert.strictEqual(porcentaje(3, 0), null);
});

test("promedio ignora valores vacíos", () => {
  assert.strictEqual(promedio([4, null, 5]), 4.5);
  assert.strictEqual(promedio([]), null);
});

test("horas entre marcas de tiempo, cruzando días", () => {
  assert.strictEqual(horasEntre("2026-10-01 09:00:00", "2026-10-02 10:30:00"), 25.5);
  assert.strictEqual(horasEntre("2026-10-01 09:00:00", null), null);
});

test("CSV con BOM, separador ; y comillas cuando hace falta", () => {
  const csv = aCSV([{ clave: "a", titulo: "Nombre" }, { clave: "b", titulo: "Nota" }],
    [{ a: "Pérez; Juan", b: 4.5 }, { a: 'Dijo "hola"', b: null }]);
  assert.ok(csv.startsWith("﻿"));
  assert.strictEqual(csv.slice(1), 'Nombre;Nota\r\n"Pérez; Juan";4.5\r\n"Dijo ""hola""";');
});
