// --- Asistencia: marcación propia, consulta y correcciones (RRHH) ---
import { peticion, consulta } from "./cliente";

export function obtenerMiDiaHoy() {
  return peticion("/asistencia/hoy");
}

export function marcarEntrada() {
  return peticion("/asistencia/entrada", { metodo: "POST" });
}

export function marcarSalida() {
  return peticion("/asistencia/salida", { metodo: "POST" });
}

export function consultarAsistencia({ trabajador, mes, area, solo_retrasos } = {}) {
  return peticion(`/asistencia${consulta({ trabajador, mes, area, solo_retrasos: solo_retrasos ? 1 : "" })}`);
}

export function registrarAsistenciaManual(datos) {
  return peticion("/asistencia", { metodo: "POST", cuerpo: datos });
}

export function corregirAsistencia(id, datos) {
  return peticion(`/asistencia/${id}`, { metodo: "PUT", cuerpo: datos });
}
