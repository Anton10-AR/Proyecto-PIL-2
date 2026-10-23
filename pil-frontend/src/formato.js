// Formato de fechas para mostrar. Las fechas viajan como "YYYY-MM-DD" (hora local).
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export const NOMBRES_DIA_ISO = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function dosDigitos(n) {
  return String(n).padStart(2, "0");
}

export function hoy() {
  const f = new Date();
  return `${f.getFullYear()}-${dosDigitos(f.getMonth() + 1)}-${dosDigitos(f.getDate())}`;
}

export function mesActual() {
  return hoy().slice(0, 7);
}

// "2026-10-06" -> "mar 06/10/2026"
export function fechaCorta(fecha) {
  if (!fecha) return "—";
  const [a, m, d] = fecha.split("-").map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${dosDigitos(d)}/${dosDigitos(m)}/${a}`;
}

// Estados de una solicitud: etiqueta y clase de la insignia
export const ESTADOS_SOLICITUD = {
  pendiente_supervisor: { texto: "Pendiente del supervisor", clase: "insignia-pendiente" },
  pendiente_rrhh: { texto: "Pendiente de RRHH", clase: "insignia-pendiente" },
  pendiente_gerencia: { texto: "Pendiente de Gerencia", clase: "insignia-pendiente" },
  aprobado: { texto: "Aprobada", clase: "insignia-activo" },
  rechazado: { texto: "Rechazada", clase: "insignia-injustificada" },
  cancelado: { texto: "Cancelada", clase: "insignia-inactivo" }
};

export const ETAPAS = { supervisor: "Supervisor", rrhh: "RRHH", gerencia: "Gerencia" };

// Estado de una capacitación (estado_actual que calcula el backend)
export const ESTADOS_CAPACITACION = {
  programada: { texto: "Programada", clase: "insignia-pendiente" },
  en_curso: { texto: "En curso", clase: "insignia-justificada" },
  por_cerrar: { texto: "Por cerrar", clase: "insignia-pendiente" },
  finalizada: { texto: "Finalizada", clase: "insignia-activo" },
  cancelada: { texto: "Cancelada", clase: "insignia-inactivo" }
};

export const RESULTADOS_CAPACITACION = {
  aprobado: { texto: "Aprobado", clase: "insignia-activo" },
  reprobado: { texto: "Reprobado", clase: "insignia-injustificada" },
  no_asistio: { texto: "No asistió", clase: "insignia-inactivo" }
};

// Evaluación del desempeño
export const ESCALA_EVALUACION = { 1: "Deficiente", 2: "Regular", 3: "Aceptable", 4: "Bueno", 5: "Excelente" };

export const ESTADOS_ACCION = {
  pendiente: { texto: "Pendiente", clase: "insignia-pendiente" },
  en_progreso: { texto: "En progreso", clase: "insignia-justificada" },
  completada: { texto: "Completada", clase: "insignia-activo" }
};

// Clase de insignia según la categoría del puntaje (la calcula el backend)
export function claseCategoria(categoria) {
  return { Sobresaliente: "insignia-activo", Bueno: "insignia-justificada", Aceptable: "insignia-pendiente" }[categoria] || "insignia-injustificada";
}

// Clima y comunicación
export const ESTADOS_ENCUESTA = {
  borrador: { texto: "Borrador", clase: "insignia-inactivo" },
  proxima: { texto: "Próxima", clase: "insignia-justificada" },
  abierta: { texto: "Abierta", clase: "insignia-activo" },
  cerrada: { texto: "Cerrada", clase: "insignia-inactivo" }
};

export const CATEGORIAS_SUGERENCIA = {
  condiciones: "Condiciones de trabajo",
  procesos: "Procesos",
  seguridad: "Seguridad",
  bienestar: "Bienestar",
  comunicacion: "Comunicación",
  otro: "Otro"
};

export const ESTADOS_SUGERENCIA = {
  recibida: { texto: "Recibida", clase: "insignia-pendiente" },
  en_revision: { texto: "En revisión", clase: "insignia-justificada" },
  atendida: { texto: "Atendida", clase: "insignia-activo" }
};

export const INSCRIPCION_CAPACITACION = {
  propuesto: { texto: "Propuesto", clase: "insignia-pendiente" },
  inscrito: { texto: "Inscrito", clase: "insignia-justificada" },
  rechazado: { texto: "Descartado", clase: "insignia-inactivo" }
};

// "Vacación" o "Permiso: Médico"
export function textoTipoSolicitud(solicitud) {
  return solicitud.tipo === "vacacion" ? "Vacación" : `Permiso${solicitud.tipo_permiso ? `: ${solicitud.tipo_permiso}` : ""}`;
}

// Rango de fechas: "lun 12/10/2026" o "lun 12/10/2026 al vie 16/10/2026"
export function rangoFechas(desde, hasta) {
  return desde === hasta ? fechaCorta(desde) : `${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
}

// Minutos de retraso para mostrar: null = fuera de turno
export function textoRetraso(minutos) {
  if (minutos === null || minutos === undefined) return "Fuera de turno";
  return minutos > 0 ? `${minutos} min` : "—";
}

// --- Proceso productivo: recepción y cobertura ---

// Estado de un ingreso de leche cruda
export const ESTADOS_INGRESO = {
  en_analisis: { texto: "Esperando análisis", clase: "insignia-pendiente" },
  por_decidir: { texto: "Esperando decisión", clase: "insignia-justificada" },
  aceptado: { texto: "Aceptado", clase: "insignia-activo" },
  derivado: { texto: "Derivado", clase: "insignia-derivado" },
  rechazado: { texto: "Rechazado", clase: "insignia-injustificada" }
};

// Sugerencia del sistema tras el análisis
export const SUGERENCIAS = {
  aceptar: { texto: "Aceptar", clase: "insignia-activo", resultado: "aceptado" },
  derivar: { texto: "Derivar", clase: "insignia-derivado", resultado: "derivado" },
  rechazar: { texto: "Rechazar", clase: "insignia-injustificada", resultado: "rechazado" }
};

// Estado de un puesto crítico en un día
export const ESTADOS_COBERTURA = {
  cubierto: { texto: "Cubierto", clase: "insignia-activo" },
  por_confirmar: { texto: "Por confirmar", clase: "insignia-justificada" },
  planificado: { texto: "Planificado", clase: "insignia-justificada" },
  en_riesgo: { texto: "En riesgo", clase: "insignia-pendiente" },
  descubierto: { texto: "Descubierto", clase: "insignia-injustificada" },
  sin_operacion: { texto: "Sin operación", clase: "insignia-inactivo" }
};

// Situación de una persona en un día
export const SITUACIONES = {
  presente: "Presente",
  programado: "Programado",
  en_riesgo: "Con solicitud pendiente",
  vacacion: "De vacación",
  permiso: "Con permiso",
  ausente: "Ausente",
  sin_registro: "Sin registro",
  no_programado: "No le toca"
};

// "2026-10-21 06:15" -> "06:15" (mismo día) o "mar 20/10/2026 06:15"
export function fechaHora(texto, referencia) {
  if (!texto) return "—";
  const [f, h] = texto.split(" ");
  const hora = (h || "").slice(0, 5);
  return referencia && f === referencia ? hora : `${fechaCorta(f)} ${hora}`;
}

// Número con separador de miles: 12500 -> "12.500"
export function miles(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("es-BO");
}

// Decimal con coma: 0.15 -> "0,15"
export function decimal(n) {
  if (n === null || n === undefined || n === "") return "—";
  return String(n).replace(".", ",");
}

// --- Proceso productivo: almacén y despacho ---

// Situación de un lote de producto terminado (la calcula el backend)
export const SITUACIONES_LOTE = {
  por_recibir: { texto: "Por recibir", clase: "insignia-pendiente" },
  vigente: { texto: "Vigente", clase: "insignia-activo" },
  por_vencer: { texto: "Por vencer", clase: "insignia-derivado" },
  vencido: { texto: "Vencido", clase: "insignia-injustificada" },
  agotado: { texto: "Agotado", clase: "insignia-inactivo" }
};

export const ESTADOS_PEDIDO = {
  pendiente: { texto: "Pendiente", clase: "insignia-pendiente" },
  despachado: { texto: "Despachado", clase: "insignia-activo" },
  cancelado: { texto: "Cancelado", clase: "insignia-inactivo" }
};

export const TIPOS_CLIENTE = {
  distribuidor: "Distribuidor",
  supermercado: "Supermercado",
  tienda: "Tienda",
  institucional: "Institucional"
};

export const TIPOS_MOVIMIENTO = {
  ingreso: { texto: "Ingreso", clase: "insignia-activo" },
  despacho: { texto: "Despacho", clase: "insignia-justificada" },
  ajuste: { texto: "Ajuste", clase: "insignia-pendiente" }
};

// Fecha "YYYY-MM-DD" más n días
export function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(a, m - 1, d + dias);
  return `${f.getFullYear()}-${dosDigitos(f.getMonth() + 1)}-${dosDigitos(f.getDate())}`;
}
