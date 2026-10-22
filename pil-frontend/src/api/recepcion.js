// --- Recepción y control de calidad de leche cruda ---
import { peticion, consulta } from "./cliente";

export function obtenerCatalogos() {
  return peticion("/recepcion/catalogos");
}

export function listarIngresos({ desde, hasta, estado, id_proveedor, buscar } = {}) {
  return peticion(`/recepcion/ingresos${consulta({ desde, hasta, estado, id_proveedor, buscar })}`);
}

export function obtenerIngreso(id) {
  return peticion(`/recepcion/ingresos/${id}`);
}

export function registrarIngreso(datos) {
  return peticion("/recepcion/ingresos", { metodo: "POST", cuerpo: datos });
}

export function corregirIngreso(id, datos) {
  return peticion(`/recepcion/ingresos/${id}`, { metodo: "PUT", cuerpo: datos });
}

export function registrarAnalisis(id, datos) {
  return peticion(`/recepcion/ingresos/${id}/analisis`, { metodo: "POST", cuerpo: datos });
}

export function corregirAnalisis(id, datos) {
  return peticion(`/recepcion/ingresos/${id}/analisis`, { metodo: "PUT", cuerpo: datos });
}

export function registrarDecision(id, datos) {
  return peticion(`/recepcion/ingresos/${id}/decision`, { metodo: "POST", cuerpo: datos });
}

export function registrarDescarga(id) {
  return peticion(`/recepcion/ingresos/${id}/descarga`, { metodo: "POST" });
}

export function buscarTrazabilidad(codigo) {
  return peticion(`/recepcion/trazabilidad/${encodeURIComponent(codigo)}`);
}

export function obtenerIndicadoresCalidad({ desde, hasta } = {}) {
  return peticion(`/recepcion/indicadores${consulta({ desde, hasta })}`);
}

export function actualizarParametro(codigo, datos) {
  return peticion(`/recepcion/parametros/${codigo}`, { metodo: "PUT", cuerpo: datos });
}

export function obtenerBitacoraParametros() {
  return peticion("/recepcion/parametros/bitacora");
}

export function crearProveedor(datos) {
  return peticion("/recepcion/proveedores", { metodo: "POST", cuerpo: datos });
}

export function actualizarProveedor(id, datos) {
  return peticion(`/recepcion/proveedores/${id}`, { metodo: "PUT", cuerpo: datos });
}

export function crearCisterna(datos) {
  return peticion("/recepcion/cisternas", { metodo: "POST", cuerpo: datos });
}

export function actualizarCisterna(id, datos) {
  return peticion(`/recepcion/cisternas/${id}`, { metodo: "PUT", cuerpo: datos });
}
