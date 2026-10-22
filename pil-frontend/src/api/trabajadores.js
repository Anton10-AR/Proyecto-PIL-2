// --- Trabajadores (Personal) y sus cuentas de acceso ---
import { peticion, consulta } from "./cliente";

export function listarTrabajadores({ buscar, area, cargo, estado, etapa } = {}) {
  return peticion(`/trabajadores${consulta({ buscar, area, cargo, estado, etapa })}`);
}

export function obtenerOpcionesPersonal() {
  return peticion("/trabajadores/opciones");
}

export function obtenerTrabajador(id) {
  return peticion(`/trabajadores/${id}`);
}

export function crearTrabajador(datos) {
  return peticion("/trabajadores", { metodo: "POST", cuerpo: datos });
}

export function actualizarTrabajador(id, datos) {
  return peticion(`/trabajadores/${id}`, { metodo: "PUT", cuerpo: datos });
}

export function darDeBajaTrabajador(id) {
  return peticion(`/trabajadores/${id}`, { metodo: "DELETE" });
}

export function crearCuenta(id, datos) {
  return peticion(`/trabajadores/${id}/cuenta`, { metodo: "POST", cuerpo: datos });
}

export function actualizarCuenta(id, datos) {
  return peticion(`/trabajadores/${id}/cuenta`, { metodo: "PUT", cuerpo: datos });
}

export function restablecerClave(id) {
  return peticion(`/trabajadores/${id}/cuenta/restablecer-clave`, { metodo: "POST" });
}
