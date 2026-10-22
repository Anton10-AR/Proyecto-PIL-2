// --- Capacitación y desarrollo ---
import { peticion, consulta } from "./cliente";

export function listarCapacitaciones({ vista, buscar } = {}) {
  return peticion(`/capacitaciones${consulta({ vista, buscar })}`);
}

export function misCapacitaciones() {
  return peticion("/capacitaciones/mias");
}

export function obtenerCapacitacion(id) {
  return peticion(`/capacitaciones/${id}`);
}

export function crearCapacitacion(datos) {
  return peticion("/capacitaciones", { metodo: "POST", cuerpo: datos });
}

export function actualizarCapacitacion(id, datos) {
  return peticion(`/capacitaciones/${id}`, { metodo: "PUT", cuerpo: datos });
}

export function cancelarCapacitacion(id) {
  return peticion(`/capacitaciones/${id}/cancelar`, { metodo: "POST" });
}

export function finalizarCapacitacion(id) {
  return peticion(`/capacitaciones/${id}/finalizar`, { metodo: "POST" });
}

export function agregarParticipantes(id, idsTrabajadores) {
  return peticion(`/capacitaciones/${id}/participantes`, { metodo: "POST", cuerpo: { ids_trabajadores: idsTrabajadores } });
}

export function resolverPropuesta(id, idParticipante, estado_inscripcion) {
  return peticion(`/capacitaciones/${id}/participantes/${idParticipante}`, { metodo: "PUT", cuerpo: { estado_inscripcion } });
}

export function quitarParticipante(id, idParticipante) {
  return peticion(`/capacitaciones/${id}/participantes/${idParticipante}`, { metodo: "DELETE" });
}

export function registrarResultado(id, idParticipante, datos) {
  return peticion(`/capacitaciones/${id}/participantes/${idParticipante}/resultado`, { metodo: "PUT", cuerpo: datos });
}
