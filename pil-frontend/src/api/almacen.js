// --- Almacén: producto terminado e inventario ---
import { peticion, consulta } from "./cliente";

export function obtenerCatalogosAlmacen() {
  return peticion("/almacen/catalogos");
}

export function listarOrigenes(fecha) {
  return peticion(`/almacen/origenes${consulta({ fecha })}`);
}

export function listarLotes({ desde, hasta, estado, id_producto, con_stock, buscar } = {}) {
  return peticion(`/almacen/lotes${consulta({ desde, hasta, estado, id_producto, con_stock, buscar })}`);
}

export function obtenerLote(id) {
  return peticion(`/almacen/lotes/${id}`);
}

export function registrarLote(datos) {
  return peticion("/almacen/lotes", { metodo: "POST", cuerpo: datos });
}

export function recibirLote(id, datos) {
  return peticion(`/almacen/lotes/${id}/recepcion`, { metodo: "POST", cuerpo: datos });
}

export function ajustarLote(id, datos) {
  return peticion(`/almacen/lotes/${id}/ajustes`, { metodo: "POST", cuerpo: datos });
}

export function obtenerInventario(fecha) {
  return peticion(`/almacen/inventario${consulta({ fecha })}`);
}

export function listarMovimientos({ desde, hasta, tipo, id_producto } = {}) {
  return peticion(`/almacen/movimientos${consulta({ desde, hasta, tipo, id_producto })}`);
}

export function crearProducto(datos) {
  return peticion("/almacen/productos", { metodo: "POST", cuerpo: datos });
}

export function actualizarProducto(id, datos) {
  return peticion(`/almacen/productos/${id}`, { metodo: "PUT", cuerpo: datos });
}

export function crearCliente(datos) {
  return peticion("/almacen/clientes", { metodo: "POST", cuerpo: datos });
}

export function actualizarCliente(id, datos) {
  return peticion(`/almacen/clientes/${id}`, { metodo: "PUT", cuerpo: datos });
}
