// --- Proceso productivo: etapas, puestos, cobertura de puestos críticos ---
import { peticion, consulta } from "./cliente";

export function obtenerEtapas() {
  return peticion("/proceso/etapas");
}

export function obtenerCobertura(fecha) {
  return peticion(`/proceso/cobertura${consulta({ fecha })}`);
}

export function obtenerIndicadoresCobertura({ desde, hasta } = {}) {
  return peticion(`/proceso/indicadores${consulta({ desde, hasta })}`);
}

export function obtenerImpactoSolicitud(id) {
  return peticion(`/proceso/impacto-solicitud/${id}`);
}
