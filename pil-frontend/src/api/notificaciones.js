// --- Notificaciones (campana) ---
import { peticion, consulta } from "./cliente";

export function listarNotificaciones({ no_leidas } = {}) {
  return peticion(`/notificaciones${consulta({ no_leidas: no_leidas ? 1 : "" })}`);
}

export function marcarNotificacionLeida(id) {
  return peticion(`/notificaciones/${id}/leida`, { metodo: "PUT" });
}

export function marcarTodasLeidas() {
  return peticion("/notificaciones/leidas", { metodo: "PUT" });
}
