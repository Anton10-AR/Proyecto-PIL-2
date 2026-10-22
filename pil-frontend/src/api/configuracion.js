// --- Configuración general y feriados ---
import { peticion, consulta } from "./cliente";

export function obtenerConfiguracion() {
  return peticion("/configuracion");
}

export function guardarConfiguracion(clave, valor) {
  return peticion(`/configuracion/${clave}`, { metodo: "PUT", cuerpo: { valor } });
}

export function listarFeriados(anio) {
  return peticion(`/feriados${consulta({ anio })}`);
}

export function crearFeriado(datos) {
  return peticion("/feriados", { metodo: "POST", cuerpo: datos });
}

export function eliminarFeriado(fecha) {
  return peticion(`/feriados/${fecha}`, { metodo: "DELETE" });
}
