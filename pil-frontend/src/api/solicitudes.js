// --- Solicitudes (permisos y vacaciones), tipos de permiso y archivos de respaldo ---
import { peticion, consulta, abrirArchivo } from "./cliente";

export function listarSolicitudes({ alcance = "mias", estado, tipo, trabajador, anio } = {}) {
  return peticion(`/solicitudes${consulta({ alcance, estado, tipo, trabajador, anio })}`);
}

export function obtenerSolicitud(id) {
  return peticion(`/solicitudes/${id}`);
}

export function obtenerSaldoVacaciones(trabajador) {
  return peticion(`/solicitudes/saldo${consulta({ trabajador })}`);
}

export function calcularSolicitud({ tipo, id_tipo_permiso, fecha_inicio, fecha_fin }) {
  return peticion(`/solicitudes/calcular${consulta({ tipo, id_tipo_permiso, fecha_inicio, fecha_fin })}`);
}

export function crearSolicitud(datos) {
  return peticion("/solicitudes", { metodo: "POST", cuerpo: datos });
}

export function decidirSolicitud(id, decision, comentario) {
  return peticion(`/solicitudes/${id}/decision`, { metodo: "POST", cuerpo: { decision, comentario } });
}

export function cancelarSolicitud(id) {
  return peticion(`/solicitudes/${id}/cancelar`, { metodo: "POST" });
}

export function obtenerCalendario(mes, area) {
  return peticion(`/solicitudes/calendario${consulta({ mes, area })}`);
}

export function listarTiposPermiso({ activos } = {}) {
  return peticion(`/tipos-permiso${consulta({ activos: activos ? 1 : "" })}`);
}

export function crearTipoPermiso(datos) {
  return peticion("/tipos-permiso", { metodo: "POST", cuerpo: datos });
}

export function actualizarTipoPermiso(id, datos) {
  return peticion(`/tipos-permiso/${id}`, { metodo: "PUT", cuerpo: datos });
}

export function subirArchivo(archivo) {
  const formulario = new FormData();
  formulario.append("archivo", archivo);
  return peticion("/archivos", { metodo: "POST", cuerpo: formulario });
}

export function verArchivo(id) {
  return abrirArchivo(`/archivos/${id}`);
}
