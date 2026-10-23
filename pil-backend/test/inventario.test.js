const { test } = require("node:test");
const assert = require("node:assert");
const {
  fechaVencimiento, estaVencido, diasParaVencer, porVencer, situacionLote, errorRecepcion, proponerFEFO, errorAsignacion,
  coincideConPropuesta
} = require("../src/utils/inventario");

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

test("por vencer: queda un cuarto de la vida útil o menos", () => {
  // Pasteurizada (7 días): avisa con 2 días; UHT (120 días): con 30
  assert.strictEqual(diasParaVencer(lote(1, "2026-10-23", 1), "2026-10-21"), 2);
  assert.strictEqual(porVencer(lote(1, "2026-10-23", 1), "2026-10-21", 7), true);
  assert.strictEqual(porVencer(lote(1, "2026-10-24", 1), "2026-10-21", 7), false);
  assert.strictEqual(porVencer(lote(1, "2026-11-20", 1), "2026-10-21", 120), true);
  assert.strictEqual(porVencer(lote(1, "2026-12-20", 1), "2026-10-21", 120), false);
  assert.strictEqual(porVencer(lote(1, "2026-10-20", 1), "2026-10-21", 7), false); // ya vencido
});

test("la recepción en almacén exige observación si faltan unidades", () => {
  assert.strictEqual(errorRecepcion(100, 100, ""), null);
  assert.match(errorRecepcion(100, 90, ""), /observación/);
  assert.strictEqual(errorRecepcion(100, 90, "Cajas aplastadas"), null);
  assert.match(errorRecepcion(100, 101, ""), /más unidades/);
  assert.match(errorRecepcion(100, 2.5, ""), /entero/);
});

test("situación del lote en el inventario", () => {
  assert.strictEqual(situacionLote(lote(1, "2026-11-30", 0, { estado: "registrado" }), "2026-10-21", 120), "por_recibir");
  assert.strictEqual(situacionLote(lote(1, "2026-11-30", 0), "2026-10-21", 120), "agotado");
  assert.strictEqual(situacionLote(lote(1, "2026-10-20", 5), "2026-10-21", 7), "vencido");
  assert.strictEqual(situacionLote(lote(1, "2026-10-22", 5), "2026-10-21", 7), "por_vencer");
  assert.strictEqual(situacionLote(lote(1, "2027-02-01", 5), "2026-10-21", 120), "vigente");
});

test("errorAsignacion: los lotes elegidos deben cubrir exactamente el pedido", () => {
  const lotes = new Map([
    [1, lote(1, "2026-11-01", 100, { id_producto: 1 })],
    [2, lote(2, "2026-11-05", 50, { id_producto: 1 })],
    [3, lote(3, "2027-02-01", 500, { id_producto: 2 })],
    [4, lote(4, "2026-10-20", 80, { id_producto: 1 })]
  ]);
  const items = [{ id_producto: 1, cantidad: 120 }, { id_producto: 2, cantidad: 30 }];
  const ok = [{ id_lote_producto: 1, cantidad: 100 }, { id_lote_producto: 2, cantidad: 20 }, { id_lote_producto: 3, cantidad: 30 }];
  assert.strictEqual(errorAsignacion(items, ok, lotes, "2026-10-21"), null);
  assert.match(errorAsignacion(items, [], lotes, "2026-10-21"), /Indique/);
  assert.match(errorAsignacion(items, [{ id_lote_producto: 1, cantidad: 100 }, { id_lote_producto: 3, cantidad: 30 }], lotes, "2026-10-21"), /se eligieron 100/);
  assert.match(errorAsignacion(items, [{ id_lote_producto: 2, cantidad: 120 }, { id_lote_producto: 3, cantidad: 30 }], lotes, "2026-10-21"), /tiene 50/);
  assert.match(errorAsignacion(items, [{ id_lote_producto: 4, cantidad: 80 }, { id_lote_producto: 2, cantidad: 40 }, { id_lote_producto: 3, cantidad: 30 }], lotes, "2026-10-21"), /no se puede despachar/);
  assert.match(errorAsignacion([{ id_producto: 2, cantidad: 30 }], ok, lotes, "2026-10-21"), /no está en el pedido/);
  assert.match(errorAsignacion(items, [{ id_lote_producto: 9, cantidad: 1 }], lotes, "2026-10-21"), /no existe/);
});
