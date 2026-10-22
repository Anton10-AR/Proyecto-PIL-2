// Pruebas de las utilidades de contraseñas y tokens
const { test } = require("node:test");
const assert = require("node:assert");
const { hashearClave, verificarClave, generarToken, hashToken, validarNuevaClave } = require("../src/utils/claves");

test("una clave se verifica con su propio hash y sal", () => {
  const { hash, sal } = hashearClave("Clave123");
  assert.ok(verificarClave("Clave123", hash, sal));
  assert.ok(!verificarClave("clave123", hash, sal));
});

test("la misma clave produce hashes distintos por la sal", () => {
  assert.notStrictEqual(hashearClave("Clave123").hash, hashearClave("Clave123").hash);
});

test("los tokens son aleatorios y su hash es determinista", () => {
  const token = generarToken();
  assert.notStrictEqual(token, generarToken());
  assert.strictEqual(hashToken(token), hashToken(token));
});

test("reglas de nueva contraseña", () => {
  assert.ok(validarNuevaClave("corta1"));
  assert.ok(validarNuevaClave("soloLetrasLargas"));
  assert.ok(validarNuevaClave("1234567890"));
  assert.strictEqual(validarNuevaClave("Segura2026"), null);
});
