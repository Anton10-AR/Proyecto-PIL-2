// --- Pedidos y despacho ---
import { peticion, consulta } from "./cliente";

export function listarPedidos({ desde, hasta, estado, id_cliente, buscar } = {}) {
  return peticion(`/pedidos${consulta({ desde, hasta, estado, id_cliente, buscar })}`);
}

export function obtenerPedido(id) {
  return peticion(`/pedidos/${id}`);
}

export function registrarPedido(datos) {
  return peticion("/pedidos", { metodo: "POST", cuerpo: datos });
}

export function cancelarPedido(id, motivo) {
  return peticion(`/pedidos/${id}/cancelar`, { metodo: "POST", cuerpo: { motivo } });
}

// Sin "lotes" el backend usa la propuesta FEFO
export function despacharPedido(id, datos) {
  return peticion(`/pedidos/${id}/despacho`, { metodo: "POST", cuerpo: datos });
}

export function registrarDevolucion(id, datos) {
  return peticion(`/pedidos/${id}/devoluciones`, { metodo: "POST", cuerpo: datos });
}
