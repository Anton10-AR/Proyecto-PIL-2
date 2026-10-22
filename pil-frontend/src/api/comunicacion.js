// --- Clima organizacional y comunicación interna: comunicados, encuestas y sugerencias ---
import { peticion, consulta } from "./cliente";

export function listarComunicados({ limite } = {}) {
  return peticion(`/comunicados${consulta({ limite })}`);
}

export function publicarComunicado(datos) {
  return peticion("/comunicados", { metodo: "POST", cuerpo: datos });
}

export function eliminarComunicado(id) {
  return peticion(`/comunicados/${id}`, { metodo: "DELETE" });
}

export function listarEncuestas({ alcance } = {}) {
  return peticion(`/encuestas${consulta({ alcance })}`);
}

export function obtenerEncuesta(id) {
  return peticion(`/encuestas/${id}`);
}

export function crearEncuesta(datos) {
  return peticion("/encuestas", { metodo: "POST", cuerpo: datos });
}

export function actualizarEncuesta(id, datos) {
  return peticion(`/encuestas/${id}`, { metodo: "PUT", cuerpo: datos });
}

export function eliminarEncuesta(id) {
  return peticion(`/encuestas/${id}`, { metodo: "DELETE" });
}

export function publicarEncuesta(id) {
  return peticion(`/encuestas/${id}/publicar`, { metodo: "POST" });
}

export function responderEncuesta(id, respuestas) {
  return peticion(`/encuestas/${id}/responder`, { metodo: "POST", cuerpo: { respuestas } });
}

export function resultadosEncuesta(id, area) {
  return peticion(`/encuestas/${id}/resultados${consulta({ area })}`);
}

export function enviarSugerencia(datos) {
  return peticion("/sugerencias", { metodo: "POST", cuerpo: datos });
}

export function listarSugerencias({ alcance, estado, categoria } = {}) {
  return peticion(`/sugerencias${consulta({ alcance, estado, categoria })}`);
}

export function seguimientoSugerencia(codigo) {
  return peticion(`/sugerencias/seguimiento/${encodeURIComponent(codigo)}`);
}

export function responderSugerencia(id, datos) {
  return peticion(`/sugerencias/${id}`, { metodo: "PUT", cuerpo: datos });
}
