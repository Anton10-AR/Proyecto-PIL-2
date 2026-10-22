// --- Reportes e indicadores, exportación y respaldos ---
import { peticion, consulta, descargarArchivo } from "./cliente";

export function obtenerIndicadores({ desde, hasta, area } = {}) {
  return peticion(`/reportes/indicadores${consulta({ desde, hasta, area })}`);
}

export function exportarReporte(tipo, formato, { desde, hasta, area } = {}) {
  return descargarArchivo(`/reportes/exportar/${tipo}${consulta({ formato, desde, hasta, area })}`, `${tipo}.${formato}`);
}

export function listarRespaldos() {
  return peticion("/respaldos");
}

export function crearRespaldo() {
  return peticion("/respaldos", { metodo: "POST" });
}

export function descargarRespaldo(nombre) {
  return descargarArchivo(`/respaldos/${encodeURIComponent(nombre)}`, nombre);
}
