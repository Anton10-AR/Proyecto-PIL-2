// --- Turnos y asignaciones ---
import { peticion, consulta } from "./cliente";

export function listarTurnos() {
  return peticion("/turnos");
}

export function crearTurno(datos) {
  return peticion("/turnos", { metodo: "POST", cuerpo: datos });
}

export function actualizarTurno(id, datos) {
  return peticion(`/turnos/${id}`, { metodo: "PUT", cuerpo: datos });
}

export function listarTurnosVigentes() {
  return peticion("/turnos/vigentes");
}

export function listarAsignaciones(trabajador) {
  return peticion(`/turnos/asignaciones${consulta({ trabajador })}`);
}

export function asignarTurno(datos) {
  return peticion("/turnos/asignaciones", { metodo: "POST", cuerpo: datos });
}
