// --- Ausencias (registradas por RRHH) ---
import { peticion, consulta } from "./cliente";

export function listarAusencias({ trabajador, mes, justificada } = {}) {
  return peticion(`/ausencias${consulta({ trabajador, mes, justificada })}`);
}

export function registrarAusencia(datos) {
  return peticion("/ausencias", { metodo: "POST", cuerpo: datos });
}

export function actualizarAusencia(id, datos) {
  return peticion(`/ausencias/${id}`, { metodo: "PUT", cuerpo: datos });
}

export function eliminarAusencia(id) {
  return peticion(`/ausencias/${id}`, { metodo: "DELETE" });
}
