// --- Evaluación del desempeño ---
import { peticion, consulta } from "./cliente";

export function listarEvaluaciones({ alcance = "mias", periodo } = {}) {
  return peticion(`/evaluaciones${consulta({ alcance, periodo })}`);
}

export function obtenerEvaluacion(id) {
  return peticion(`/evaluaciones/${id}`);
}

export function guardarEvaluacion(id, datos) {
  return peticion(`/evaluaciones/${id}`, { metodo: "PUT", cuerpo: datos });
}

export function confirmarLectura(id) {
  return peticion(`/evaluaciones/${id}/lectura`, { metodo: "POST" });
}

export function reasignarEvaluador(id, idEvaluador) {
  return peticion(`/evaluaciones/${id}/evaluador`, { metodo: "PUT", cuerpo: { id_evaluador: idEvaluador } });
}

export function quitarEvaluacion(id) {
  return peticion(`/evaluaciones/${id}`, { metodo: "DELETE" });
}

export function agregarAccion(idEvaluacion, datos) {
  return peticion(`/evaluaciones/${idEvaluacion}/acciones`, { metodo: "POST", cuerpo: datos });
}

export function actualizarAccion(idAccion, datos) {
  return peticion(`/evaluaciones/acciones/${idAccion}`, { metodo: "PUT", cuerpo: datos });
}

export function eliminarAccion(idAccion) {
  return peticion(`/evaluaciones/acciones/${idAccion}`, { metodo: "DELETE" });
}

export function misAcciones() {
  return peticion("/evaluaciones/acciones/mias");
}

export function listarPlantillas() {
  return peticion("/evaluaciones/plantillas");
}

export function crearPlantilla(datos) {
  return peticion("/evaluaciones/plantillas", { metodo: "POST", cuerpo: datos });
}

export function actualizarPlantilla(id, datos) {
  return peticion(`/evaluaciones/plantillas/${id}`, { metodo: "PUT", cuerpo: datos });
}

export function listarPeriodos() {
  return peticion("/evaluaciones/periodos");
}

export function obtenerPeriodo(id) {
  return peticion(`/evaluaciones/periodos/${id}`);
}

export function crearPeriodo(datos) {
  return peticion("/evaluaciones/periodos", { metodo: "POST", cuerpo: datos });
}

export function asignarEvaluaciones(idPeriodo, idsTrabajadores, idPlantilla) {
  return peticion(`/evaluaciones/periodos/${idPeriodo}/asignar`, {
    metodo: "POST", cuerpo: { ids_trabajadores: idsTrabajadores, id_plantilla: idPlantilla || undefined }
  });
}

export function cerrarPeriodo(id) {
  return peticion(`/evaluaciones/periodos/${id}/cerrar`, { metodo: "POST" });
}
