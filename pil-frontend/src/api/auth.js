// --- Autenticación ---
import { peticion } from "./cliente";

export function iniciarSesion(usuario, clave) {
  return peticion("/auth/login", { metodo: "POST", cuerpo: { usuario, clave } });
}

export function cerrarSesion() {
  return peticion("/auth/logout", { metodo: "POST" });
}

export function obtenerUsuarioActual() {
  return peticion("/auth/yo");
}

export function cambiarClave(clave_actual, clave_nueva) {
  return peticion("/auth/clave", { metodo: "PUT", cuerpo: { clave_actual, clave_nueva } });
}
