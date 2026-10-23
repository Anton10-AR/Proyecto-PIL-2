const { test } = require("node:test");
const assert = require("node:assert");
const { fechaVencimiento, estaVencido, proponerFEFO, coincideConPropuesta } = require("../src/utils/inventario");

const lote = (id, vencimiento, stock, extra = {}) => ({
  id, codigo: `LP-${id}`, estado: "en_almacen", fecha_elaboracion: "2026-10-01", fecha_vencimiento: vencimiento, stock, ...extra
});

test("el vencimiento es la elaboración más la vida útil", () => {
  assert.strictEqual(fechaVencimiento("2026-10-28", 7), "2026-11-04");
});

test("un lote se puede despachar hasta su fecha de vencimiento inclusive", () => {
  assert.strictEqual(estaVencido(lote(1, "2026-10-20", 10), "2026-10-20"), false);
  assert.strictEqual(estaVencido(lote(1, "2026-10-20", 10), "2026-10-21"), true);
});

test("FEFO toma primero el lote que vence antes y completa con el siguiente", () => {
  const lotes = [lote(1, "2026-11-30", 500), lote(2, "2026-11-05", 300), lote(3, "2026-11-10", 400)];
  const r = proponerFEFO(lotes, 600, "2026-10-21");
  assert.deepStrictEqual(r.asignacion.map((a) => [a.id_lote_producto, a.cantidad]), [[2, 300], [3, 300]]);
  assert.strictEqual(r.faltante, 0);
});

test("FEFO ignora lotes vencidos, sin stock o sin recibir en almacén", () => {
  const lotes = [
    lote(1, "2026-10-20", 100), lote(2, "2026-11-01", 0), lote(3, "2026-11-02", 100, { estado: "registrado" }), lote(4, "2026-11-03", 100)
  ];
  const r = proponerFEFO(lotes, 50, "2026-10-21");
  assert.deepStrictEqual(r.asignacion.map((a) => a.id_lote_producto), [4]);
});

test("si no alcanza el stock informa lo que falta", () => {
  const r = proponerFEFO([lote(1, "2026-11-01", 120)], 200, "2026-10-21");
  assert.strictEqual(r.asignacion[0].cantidad, 120);
  assert.strictEqual(r.faltante, 80);
});

test("a igual vencimiento desempata por elaboración y código", () => {
  const lotes = [lote(2, "2026-11-01", 10), lote(1, "2026-11-01", 10, { fecha_elaboracion: "2026-09-30" })];
  assert.strictEqual(proponerFEFO(lotes, 5, "2026-10-21").asignacion[0].id_lote_producto, 1);
});

test("coincideConPropuesta compara lotes y unidades sin importar el orden", () => {
  const propuesta = [{ id_lote_producto: 2, cantidad: 300 }, { id_lote_producto: 3, cantidad: 300 }];
  assert.strictEqual(coincideConPropuesta(propuesta, [{ id_lote_producto: 3, cantidad: 300 }, { id_lote_producto: 2, cantidad: 300 }]), true);
  assert.strictEqual(coincideConPropuesta(propuesta, [{ id_lote_producto: 2, cantidad: 300 }, { id_lote_producto: 1, cantidad: 300 }]), false);
  assert.strictEqual(coincideConPropuesta(propuesta, [{ id_lote_producto: 2, cantidad: 200 }, { id_lote_producto: 3, cantidad: 400 }]), false);
});
