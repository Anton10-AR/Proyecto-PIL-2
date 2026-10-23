// Script de carga de datos de ejemplo, útil para la demo del prototipo.
// Uso: node src/seed.js
const db = require("./db/database");
const { TABLAS, crearEsquema } = require("./db/esquema");
const { hashearClave } = require("./utils/claves");
const { hoyLocal, sumarDias, diaSemana, minutosDelDia, calcularHoras, calcularRetraso } = require("./utils/fechas");
const fs = require("fs");
const crypto = require("node:crypto");
const path = require("path");
const { jornadaDelDia, toleranciaMinutos } = require("./utils/jornada");
const { diasHabilesEntre, solicitudAprobadaEn } = require("./utils/solicitudes");
const { calcularDerechoVacaciones } = require("./utils/vacaciones");
const { calcularPuntaje } = require("./utils/evaluacion");
const { CARPETA: CARPETA_ARCHIVOS } = require("./routes/archivos");

// PDF mínimo válido de una página, usado como documento de respaldo de ejemplo
const PDF_EJEMPLO = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
  "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 120]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
  "4 0 obj<</Length 55>>stream\nBT /F1 14 Tf 20 60 Td (Certificado medico de ejemplo) Tj ET\nendstream endobj\n" +
  "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";

// Recrea el esquema desde cero: así los cambios de esquema de cada fase se aplican al correr el seed
function recrearEsquema() {
  db.exec("PRAGMA foreign_keys = OFF;");
  [...TABLAS].reverse().forEach((tabla) => db.exec(`DROP TABLE IF EXISTS ${tabla};`));
  db.exec("PRAGMA foreign_keys = ON;");
  crearEsquema(db);
}

console.log("Recreando el esquema y vaciando la carpeta de archivos subidos...");
recrearEsquema();
fs.readdirSync(CARPETA_ARCHIVOS).forEach((archivo) => fs.unlinkSync(path.join(CARPETA_ARCHIVOS, archivo)));

console.log("Insertando trabajadores...");
const insertarTrabajador = db.prepare(`
  INSERT INTO trabajadores (nombre, apellido, ci, cargo, area, fecha_ingreso, tipo_contrato, telefono, correo, id_supervisor, estado)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const trabajadores = [
  ["Ana", "Rojas", "4521301", "Jefa de Producción", "Producción", "2019-03-10", "Indefinido", "70011111", "arojas@pilandina.bo", null, "activo"],
  ["Juan", "Perez", "5891023", "Operario", "Producción", "2022-06-01", "Indefinido", "70011112", "jperez@pilandina.bo", 1, "activo"],
  ["Maria", "Lopez", "3341987", "Operaria", "Producción", "2023-01-15", "Plazo fijo", "70011113", "mlopez@pilandina.bo", 1, "activo"],
  ["Luis", "Mamani", "6672310", "Supervisor de Calidad", "Calidad", "2018-11-20", "Indefinido", "70011114", "lmamani@pilandina.bo", null, "activo"],
  ["Rosa", "Choque", "2219876", "Analista de Calidad", "Calidad", "2021-09-05", "Indefinido", "70011115", "rchoque@pilandina.bo", 4, "activo"],
  ["Carlos", "Vargas", "7783456", "Chofer", "Logística", "2020-02-14", "Indefinido", "70011116", "cvargas@pilandina.bo", null, "activo"],
  ["Elena", "Fernandez", "1109988", "Asistente de RRHH", "Recursos Humanos", "2024-04-01", "Plazo fijo", "70011117", "efernandez@pilandina.bo", null, "activo"],
  ["Pedro", "Quispe", "8890123", "Operario", "Producción", "2017-07-22", "Indefinido", "70011118", "pquispe@pilandina.bo", 1, "inactivo"],
  ["Jorge", "Salinas", "3456789", "Gerente General", "Gerencia", "2015-01-05", "Indefinido", "70011119", "jsalinas@pilandina.bo", null, "activo"],
  // Personal de planta que ocupa los puestos críticos del proceso (ids 10 a 16)
  ["Miguel", "Torrez", "5567012", "Operador de Recepción", "Recepción", "2021-03-01", "Indefinido", "70011120", "mtorrez@pilandina.bo", 4, "activo"],
  ["Silvia", "Condori", "6120934", "Operadora de Recepción", "Recepción", "2023-08-14", "Plazo fijo", "70011121", "scondori@pilandina.bo", 4, "activo"],
  ["Diego", "Flores", "7012456", "Analista de Laboratorio", "Calidad", "2022-02-07", "Indefinido", "70011122", "dflores@pilandina.bo", 4, "activo"],
  ["Patricia", "Ramos", "4890321", "Operadora de Clarificación", "Producción", "2020-05-18", "Indefinido", "70011123", "pramos@pilandina.bo", 1, "activo"],
  ["Hugo", "Mendoza", "5234789", "Operador de Estandarización", "Producción", "2019-09-02", "Indefinido", "70011124", "hmendoza@pilandina.bo", 1, "activo"],
  ["Ramiro", "Aguilar", "3987654", "Encargado de Almacén", "Logística", "2018-04-23", "Indefinido", "70011125", "raguilar@pilandina.bo", 1, "activo"],
  ["Teresa", "Huanca", "6678123", "Operadora Térmica", "Producción", "2021-11-08", "Indefinido", "70011126", "thuanca@pilandina.bo", 1, "activo"],
  // Almacén y despacho (ids 17 y 18)
  ["Gabriela", "Torrico", "5678234", "Ejecutiva de Atención de Pedidos", "Logística", "2022-10-03", "Indefinido", "70011127", "gtorrico@pilandina.bo", 1, "activo"],
  ["Wilson", "Cruz", "6789345", "Auxiliar de Despacho", "Logística", "2024-02-12", "Plazo fijo", "70011128", "wcruz@pilandina.bo", 1, "activo"]
];

trabajadores.forEach((t) => insertarTrabajador.run(...t));

// Puesto de cada trabajador en el proceso (documento, sección 7). RRHH y Gerencia no ocupan un puesto.
// Las etapas 3, 4 y 7 tienen una sola persona: así la cobertura muestra qué pasa cuando esa persona falta.
const puestosAsignados = {
  1: "supervisor_produccion", 2: "operador_termico", 3: "operario_envasado", 4: "supervisor_calidad",
  5: "analista_laboratorio", 6: "conductor_cisterna", 8: "operador_clarificacion", 10: "operador_recepcion",
  11: "operador_recepcion", 12: "analista_laboratorio", 13: "operador_clarificacion", 14: "operador_estandarizacion",
  15: "encargado_almacen", 16: "operador_termico", 17: "ejecutivo_pedidos", 18: "auxiliar_despacho"
};
const asignarPuesto = db.prepare("UPDATE trabajadores SET id_puesto = (SELECT id FROM puestos_proceso WHERE codigo = ?) WHERE id = ?");
Object.entries(puestosAsignados).forEach(([id, codigo]) => asignarPuesto.run(codigo, Number(id)));

console.log("Creando cuentas de usuario (una por rol como mínimo)...");
const insertarUsuario = db.prepare(`
  INSERT INTO usuarios (id_trabajador, usuario, hash_clave, sal, rol, debe_cambiar_clave)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// [id_trabajador, usuario, rol, debe_cambiar_clave]. La contraseña inicial es el CI.
// mlopez queda con cambio obligatorio para poder demostrar ese flujo.
const cuentas = [
  [1, "arojas", "supervisor", 0],
  [2, "jperez", "trabajador", 0],
  [3, "mlopez", "trabajador", 1],
  [4, "lmamani", "supervisor", 0],
  [5, "rchoque", "trabajador", 0],
  [6, "cvargas", "trabajador", 0],
  [7, "efernandez", "rrhh", 0],
  [9, "jsalinas", "gerencia", 0],
  [10, "mtorrez", "trabajador", 0],
  [11, "scondori", "trabajador", 0],
  [12, "dflores", "trabajador", 0],
  [13, "pramos", "trabajador", 0],
  [15, "raguilar", "trabajador", 0],
  [17, "gtorrico", "trabajador", 0],
  [18, "wcruz", "trabajador", 0]
];

cuentas.forEach(([idTrabajador, usuario, rol, debeCambiar]) => {
  const ci = trabajadores[idTrabajador - 1][2];
  const { hash, sal } = hashearClave(ci);
  insertarUsuario.run(idTrabajador, usuario, hash, sal, rol, debeCambiar);
});

db.prepare(`
  INSERT INTO notificaciones (id_usuario, tipo, mensaje, enlace)
  SELECT id, 'bienvenida', 'Bienvenido al sistema del proceso productivo de PIL Andina', '/' FROM usuarios
`).run();

console.log("Insertando turnos, feriados y asignaciones...");
const insertarTurno = db.prepare(
  "INSERT INTO turnos (nombre, hora_inicio, hora_fin, dias_laborables) VALUES (?, ?, ?, ?)"
);
const turnos = [
  ["Mañana", "06:00", "14:00", "1,2,3,4,5,6"],        // id 1: planta, lunes a sábado
  ["Tarde", "14:00", "22:00", "1,2,3,4,5,6"],         // id 2: planta, lunes a sábado
  ["Administrativo", "08:30", "17:30", "1,2,3,4,5"]   // id 3: oficinas, lunes a viernes
];
turnos.forEach((t) => insertarTurno.run(...t));

// Feriados nacionales de Bolivia (2026 y comienzo de 2027), editables por RRHH
const feriados = [
  ["2026-01-01", "Año Nuevo"], ["2026-01-22", "Día del Estado Plurinacional"],
  ["2026-02-16", "Carnaval"], ["2026-02-17", "Carnaval"], ["2026-04-03", "Viernes Santo"],
  ["2026-05-01", "Día del Trabajo"], ["2026-06-04", "Corpus Christi"],
  ["2026-06-21", "Año Nuevo Andino Amazónico"], ["2026-08-06", "Día de la Independencia"],
  ["2026-11-02", "Día de Todos los Difuntos"], ["2026-12-25", "Navidad"],
  ["2027-01-01", "Año Nuevo"], ["2027-01-22", "Día del Estado Plurinacional"]
];
const insertarFeriado = db.prepare("INSERT INTO feriados (fecha, descripcion) VALUES (?, ?)");
feriados.forEach((f) => insertarFeriado.run(...f));

// [id_trabajador, id_turno, fecha_desde, fecha_hasta]
const asignaciones = [
  [1, 3, "2026-01-01", null], [2, 1, "2026-01-01", "2026-06-30"], [2, 2, "2026-07-01", null],
  [3, 1, "2026-01-01", null], [4, 1, "2026-01-01", null], [5, 3, "2026-01-01", null],
  [6, 1, "2026-01-01", null], [7, 3, "2026-01-01", null], [9, 3, "2026-01-01", null],
  [8, 1, "2026-01-01", "2026-03-31"],
  // Personal de planta: la recepción de leche se concentra en el turno mañana
  [10, 1, "2026-01-01", null], [11, 1, "2026-01-01", null], [12, 1, "2026-01-01", null], [13, 1, "2026-01-01", null],
  [14, 1, "2026-01-01", null], [15, 1, "2026-01-01", null], [16, 1, "2026-01-01", null],
  // Atención de pedidos trabaja en oficina; el despacho, en el turno mañana con el almacén
  [17, 3, "2026-01-01", null], [18, 1, "2026-01-01", null]
];
const insertarAsignacion = db.prepare(`
  INSERT INTO asignaciones_turno (id_trabajador, id_turno, fecha_desde, fecha_hasta, id_asignado_por)
  VALUES (?, ?, ?, ?, 7)
`);
asignaciones.forEach((a) => insertarAsignacion.run(...a));

const hoy = hoyLocal();

console.log("Insertando tipos de permiso...");
// [nombre, descripcion, dias_max_solicitud, limite_anual_dias, requiere_respaldo, con_goce]
// Valores de ejemplo: RRHH los ajusta desde Configuración.
const tiposPermiso = [
  ["Médico", "Enfermedad o consulta médica, con certificado", 3, null, 1, 1],
  ["Personal", "Trámites o asuntos personales", 1, 3, 0, 0],
  ["Duelo", "Fallecimiento de un familiar directo", 3, null, 1, 1],
  ["Matrimonio", "Matrimonio del trabajador", 3, null, 1, 1],
  ["Maternidad", "Descanso pre y post natal", 90, null, 1, 1],
  ["Paternidad", "Nacimiento de un hijo", 3, null, 1, 1],
  ["Estudios", "Exámenes o defensa de grado", 1, 5, 1, 1]
];
const insertarTipoPermiso = db.prepare(`
  INSERT INTO tipos_permiso (nombre, descripcion, dias_max_solicitud, limite_anual_dias, requiere_respaldo, con_goce)
  VALUES (?, ?, ?, ?, ?, ?)
`);
tiposPermiso.forEach((t) => insertarTipoPermiso.run(...t));
const idTipo = (nombre) => tiposPermiso.findIndex((t) => t[0] === nombre) + 1;

console.log("Insertando solicitudes con su flujo de aprobación...");
// Archivo de respaldo de ejemplo (un PDF mínimo) para el permiso médico de Rosa
const nombreRespaldo = "certificado-medico-ejemplo.pdf";
fs.writeFileSync(path.join(CARPETA_ARCHIVOS, nombreRespaldo), PDF_EJEMPLO);
const idArchivoRespaldo = db.prepare(`
  INSERT INTO archivos (nombre_original, ruta, mime, tamano, id_subido_por) VALUES (?, ?, 'application/pdf', ?, 5)
`).run("Certificado médico.pdf", nombreRespaldo, Buffer.byteLength(PDF_EJEMPLO)).lastInsertRowid;

// Primer día laborable del trabajador a partir de una fecha (para que el ejemplo valga cualquier día que se corra)
function primerDiaLaborable(idTrabajador, fecha) {
  let f = fecha;
  while (!jornadaDelDia(idTrabajador, f).laborable) f = sumarDias(f, 1);
  return f;
}

const fechaHora = (dias, hora) => `${sumarDias(hoy, dias)} ${hora}`;
const insertarSolicitud = db.prepare(`
  INSERT INTO solicitudes (id_trabajador, tipo, id_tipo_permiso, fecha_inicio, fecha_fin, dias_habiles, gestion_inicio,
    motivo, estado, id_archivo_respaldo, fecha_solicitud, fecha_resolucion)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertarAprobacion = db.prepare(`
  INSERT INTO aprobaciones_solicitud (id_solicitud, etapa, id_aprobador, decision, comentario, fecha) VALUES (?, ?, ?, ?, ?, ?)
`);

// Usuarios aprobadores (id de usuarios): 1 Ana (sup.), 4 Luis (sup.), 7 Elena (RRHH), 8 Jorge (Gerencia).
// desde/hasta: días relativos a hoy. aprobaciones: [etapa, id_usuario, decision, comentario, días después de pedida]
const solicitudes = [
  { id: 2, tipo: "vacacion", desde: -5, hasta: 4, motivo: "Vacación anual", estado: "aprobado", pedida: -20,
    aprobaciones: [["supervisor", 1, "aprobado", null, 1], ["rrhh", 7, "aprobado", null, 2]] },
  { id: 3, tipo: "permiso", permiso: "Personal", desde: 3, motivo: "Trámite en el SEGIP", estado: "pendiente_supervisor", pedida: -1 },
  { id: 5, tipo: "permiso", permiso: "Médico", desde: -15, motivo: "Consulta y estudios médicos", estado: "aprobado", pedida: -16,
    archivo: idArchivoRespaldo, aprobaciones: [["supervisor", 4, "aprobado", null, 0], ["rrhh", 7, "aprobado", "Certificado verificado", 1]] },
  { id: 6, tipo: "vacacion", desde: 34, hasta: 39, motivo: "Viaje familiar", estado: "pendiente_gerencia", pedida: -2 },
  { id: 7, tipo: "permiso", permiso: "Personal", desde: -26, motivo: "Asunto familiar", estado: "rechazado", pedida: -30,
    aprobaciones: [["gerencia", 8, "rechazado", "Cierre de planillas esa semana; reprogramar", 2]] },
  { id: 2, tipo: "permiso", permiso: "Personal", desde: -48, motivo: "Trámite bancario", estado: "cancelado", pedida: -50 },
  { id: 4, tipo: "vacacion", desde: 13, hasta: 17, motivo: "Descanso", estado: "pendiente_gerencia", pedida: -3 },
  { id: 5, tipo: "vacacion", desde: 20, hasta: 24, motivo: "Vacación anual", estado: "pendiente_rrhh", pedida: -4,
    aprobaciones: [["supervisor", 4, "aprobado", null, 1]] },
  { id: 1, tipo: "vacacion", desde: 76, hasta: 86, motivo: "Fin de año", estado: "aprobado", pedida: -10,
    aprobaciones: [["gerencia", 8, "aprobado", null, 3]] },
  // Patricia es la única operadora de clarificación: su permiso aprobado deja la etapa 3 descubierta hoy
  { id: 13, tipo: "permiso", permiso: "Personal", desde: 0, motivo: "Trámite familiar", estado: "aprobado", pedida: -3,
    aprobaciones: [["supervisor", 1, "aprobado", null, 1], ["rrhh", 7, "aprobado", null, 2]] },
  // Silvia pide vacaciones: hay otro operador de recepción, así que no deja el puesto descubierto
  { id: 11, tipo: "vacacion", desde: 27, hasta: 31, motivo: "Vacación anual", estado: "pendiente_supervisor", pedida: -1 }
];

solicitudes.forEach((s) => {
  const inicio = primerDiaLaborable(s.id, sumarDias(hoy, s.desde));
  const fin = s.hasta === undefined ? inicio : sumarDias(hoy, s.hasta);
  const ingreso = trabajadores[s.id - 1][5];
  const gestion = s.tipo === "vacacion" ? calcularDerechoVacaciones(ingreso, hoy).gestion_inicio : null;
  const ultima = s.aprobaciones?.[s.aprobaciones.length - 1];
  const resolucion = ["aprobado", "rechazado"].includes(s.estado) ? fechaHora(s.pedida + ultima[4], "11:30:00") : null;

  const idSolicitud = insertarSolicitud.run(
    s.id, s.tipo, s.permiso ? idTipo(s.permiso) : null, inicio, fin, diasHabilesEntre(s.id, inicio, fin), gestion,
    s.motivo, s.estado, s.archivo || null, fechaHora(s.pedida, "09:15:00"), resolucion
  ).lastInsertRowid;
  (s.aprobaciones || []).forEach(([etapa, idUsuario, decision, comentario, diasDespues], n) => {
    insertarAprobacion.run(idSolicitud, etapa, idUsuario, decision, comentario, fechaHora(s.pedida + diasDespues, `1${n}:30:00`));
  });
});

console.log("Insertando capacitaciones y participantes...");
const insertarCapacitacion = db.prepare(`
  INSERT INTO capacitaciones (titulo, descripcion, instructor, lugar, fecha_inicio, fecha_fin, horas, cupo, estado, id_creado_por)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 7)
`);
const insertarParticipante = db.prepare(`
  INSERT INTO participantes_capacitacion
    (id_capacitacion, id_trabajador, estado_inscripcion, id_registrado_por, asistencia_pct, nota, resultado, id_archivo_certificado)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Certificado de ejemplo para la capacitación de BPM aprobada por María
const nombreCertificado = "certificado-bpm-ejemplo.pdf";
fs.writeFileSync(path.join(CARPETA_ARCHIVOS, nombreCertificado), PDF_EJEMPLO);
const idCertificado = db.prepare(`
  INSERT INTO archivos (nombre_original, ruta, mime, tamano, id_subido_por) VALUES (?, ?, 'application/pdf', ?, 7)
`).run("Certificado BPM - Maria Lopez.pdf", nombreCertificado, Buffer.byteLength(PDF_EJEMPLO)).lastInsertRowid;

// desde/hasta en días relativos a hoy. participantes: [id_trabajador, estado, id_usuario_registro, asistencia, nota, resultado, certificado]
const capacitaciones = [
  { titulo: "Buenas Prácticas de Manufactura (BPM)", descripcion: "Higiene, inocuidad y control de procesos en planta",
    instructor: "Ing. Carla Gutiérrez", lugar: "Sala de capacitación, Planta Sucre", desde: -40, hasta: -39, horas: 8, cupo: 20, estado: "finalizada",
    participantes: [[3, "inscrito", 7, 100, 85, "aprobado", idCertificado], [2, "inscrito", 7, 90, 78, "aprobado", null],
      [5, "inscrito", 7, 100, 52, "reprobado", null], [6, "inscrito", 7, 0, null, "no_asistio", null]] },
  { titulo: "Seguridad industrial y uso de EPP", descripcion: "Equipos de protección personal y prevención de accidentes",
    instructor: "Lic. Marco Torrez", lugar: "Planta Sucre", desde: -20, hasta: -20, horas: 4, cupo: null, estado: "finalizada",
    participantes: [[2, "inscrito", 7, 100, 90, "aprobado", null], [3, "inscrito", 7, 100, 88, "aprobado", null], [6, "inscrito", 7, 100, 70, "aprobado", null]] },
  { titulo: "Manejo defensivo", descripcion: "Conducción segura de vehículos de distribución",
    instructor: "Escuela de Conductores Bolivia", lugar: "Centro de distribución", desde: -1, hasta: 1, horas: 12, cupo: 8, estado: "programada",
    participantes: [[6, "inscrito", 7, null, null, null, null]] },
  { titulo: "Excel intermedio para reportes", descripcion: "Tablas dinámicas, fórmulas y gráficos para informes de área",
    instructor: "Lic. Paola Rivera", lugar: "Laboratorio de computación", desde: 10, hasta: 12, horas: 9, cupo: 10, estado: "programada",
    participantes: [[7, "inscrito", 7, null, null, null, null], [5, "inscrito", 7, null, null, null, null], [3, "propuesto", 1, null, null, null, null]] },
  { titulo: "Inocuidad alimentaria HACCP", descripcion: "Análisis de peligros y puntos críticos de control",
    instructor: "Ing. Carla Gutiérrez", lugar: "Sala de capacitación, Planta Sucre", desde: 25, hasta: 26, horas: 16, cupo: 3, estado: "programada",
    participantes: [[4, "inscrito", 7, null, null, null, null], [5, "inscrito", 7, null, null, null, null]] },
  { titulo: "Liderazgo de equipos", descripcion: "Comunicación y gestión de equipos de trabajo",
    instructor: "Consultora Andes", lugar: "Auditorio", desde: 5, hasta: 5, horas: 6, cupo: 15, estado: "cancelada", participantes: [] },
  // Competencias de los puestos críticos de recepción y tratamiento térmico (capacitación vigente: últimos 12 meses)
  { titulo: "Muestreo y análisis de leche cruda en plataforma", descripcion: "Toma de muestras, acidez, densidad, alcohol y antibióticos",
    instructor: "Ing. Carla Gutiérrez", lugar: "Laboratorio de recepción", desde: -90, hasta: -89, horas: 12, cupo: 10, estado: "finalizada",
    participantes: [[10, "inscrito", 7, 100, 88, "aprobado", null], [11, "inscrito", 7, 100, 81, "aprobado", null],
      [12, "inscrito", 7, 100, 92, "aprobado", null], [5, "inscrito", 7, 100, 86, "aprobado", null], [4, "inscrito", 7, 100, 95, "aprobado", null]] },
  { titulo: "Control de pasteurización y entrega de turno", descripcion: "Temperatura y tiempo de tratamiento, desvío y registro de novedades",
    instructor: "Ing. Mario Saavedra", lugar: "Sala de capacitación, Planta Sucre", desde: -200, hasta: -200, horas: 6, cupo: 10, estado: "finalizada",
    participantes: [[2, "inscrito", 7, 100, 84, "aprobado", null], [16, "inscrito", 7, 100, 90, "aprobado", null]] }
];

capacitaciones.forEach((c) => {
  const idCapacitacion = insertarCapacitacion.run(
    c.titulo, c.descripcion, c.instructor, c.lugar, sumarDias(hoy, c.desde), sumarDias(hoy, c.hasta), c.horas, c.cupo, c.estado
  ).lastInsertRowid;
  c.participantes.forEach((p) => insertarParticipante.run(idCapacitacion, ...p));
});

console.log("Insertando plantillas, períodos y evaluaciones de desempeño...");
const insertarPlantilla = db.prepare("INSERT INTO plantillas_evaluacion (nombre, descripcion) VALUES (?, ?)");
const insertarCriterio = db.prepare(
  "INSERT INTO criterios_evaluacion (id_plantilla, nombre, descripcion, peso, orden) VALUES (?, ?, ?, ?, ?)"
);
// [nombre, descripcion, [[criterio, descripcion, peso], ...]]
const plantillas = [
  ["Personal de planta", "Operarios, choferes y personal de producción", [
    ["Puntualidad y asistencia", "Cumple su horario y turnos", 20],
    ["Calidad del trabajo", "Cumple los estándares de producción", 30],
    ["Seguridad e higiene", "Aplica BPM y usa el equipo de protección", 25],
    ["Trabajo en equipo", "Colabora con compañeros y supervisores", 15],
    ["Iniciativa", "Propone mejoras y resuelve problemas", 10]
  ]],
  ["Personal administrativo", "Personal de oficina, supervisión y jefaturas", [
    ["Puntualidad y asistencia", "Cumple su horario", 15],
    ["Calidad del trabajo", "Exactitud y prolijidad", 30],
    ["Cumplimiento de plazos", "Entrega a tiempo lo comprometido", 25],
    ["Trabajo en equipo", "Colaboración y relación con otras áreas", 15],
    ["Comunicación", "Claridad al informar y coordinar", 15]
  ]]
];
const criteriosPorPlantilla = {};
plantillas.forEach(([nombre, descripcion, criterios]) => {
  const idPlantilla = insertarPlantilla.run(nombre, descripcion).lastInsertRowid;
  criteriosPorPlantilla[idPlantilla] = criterios.map(([c, d, peso], i) => ({
    id: insertarCriterio.run(idPlantilla, c, d, peso, i).lastInsertRowid, peso
  }));
});
const PLANTA = 1;
const ADMINISTRATIVO = 2;

const anioActual = hoy.slice(0, 4);
const insertarPeriodo = db.prepare(`
  INSERT INTO periodos_evaluacion (nombre, id_plantilla, fecha_inicio, fecha_fin, estado, id_creado_por, fecha_cierre)
  VALUES (?, ?, ?, ?, ?, 7, ?)
`);
const periodoCerrado = insertarPeriodo.run(`${anioActual}-S1`, PLANTA, `${anioActual}-01-01`, `${anioActual}-06-30`, "cerrado", `${anioActual}-07-15 17:00:00`).lastInsertRowid;
const periodoAbierto = insertarPeriodo.run(`${anioActual}-S2`, PLANTA, `${anioActual}-07-01`, `${anioActual}-12-31`, "abierto", null).lastInsertRowid;

const insertarEvaluacion = db.prepare(`
  INSERT INTO evaluaciones (id_periodo, id_trabajador, id_plantilla, id_evaluador, estado, puntaje_final, retroalimentacion,
    fecha_asignacion, fecha_completada, fecha_lectura)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertarCalificacion = db.prepare(
  "INSERT INTO calificaciones (id_evaluacion, id_criterio, puntaje, observacion) VALUES (?, ?, ?, ?)"
);
const insertarAccion = db.prepare(`
  INSERT INTO acciones_mejora (id_evaluacion, descripcion, id_responsable, fecha_limite, estado, id_capacitacion) VALUES (?, ?, ?, ?, ?, ?)
`);
const idCapacitacionPorTitulo = (inicio) => db.prepare("SELECT id FROM capacitaciones WHERE titulo LIKE ?").get(`${inicio}%`).id;

// Usuarios evaluadores: 1 Ana, 4 Luis, 7 Elena (RRHH), 8 Jorge (Gerencia)
// puntajes: uno por criterio de la plantilla (1 a 5); null = evaluación pendiente
const evaluaciones = [
  { periodo: periodoCerrado, id: 2, plantilla: PLANTA, evaluador: 1, puntajes: [4, 4, 5, 4, 3], leida: true,
    retro: "Buen desempeño general; cumple los procedimientos de BPM." },
  { periodo: periodoCerrado, id: 3, plantilla: PLANTA, evaluador: 1, puntajes: [5, 4, 4, 5, 4], leida: true,
    retro: "Muy comprometida con el equipo y con la calidad." },
  { periodo: periodoCerrado, id: 5, plantilla: ADMINISTRATIVO, evaluador: 4, puntajes: [4, 3, 3, 4, 3], leida: true,
    retro: "Debe reforzar el conocimiento de inocuidad para los análisis de calidad.",
    acciones: [["Completar la capacitación de inocuidad alimentaria HACCP", 5, 40, "en_progreso", "Inocuidad"]] },
  { periodo: periodoCerrado, id: 6, plantilla: PLANTA, evaluador: 7, puntajes: [2, 3, 3, 3, 2], leida: false,
    retro: "Se registraron ausencias sin aviso; mejorar la puntualidad.",
    acciones: [["Cumplir el horario de ingreso sin retrasos durante tres meses", 6, 60, "pendiente", null],
      ["Asistir a la capacitación de manejo defensivo", 6, -2, "completada", "Manejo"]] },
  { periodo: periodoAbierto, id: 2, plantilla: PLANTA, evaluador: 1, puntajes: null },
  { periodo: periodoAbierto, id: 3, plantilla: PLANTA, evaluador: 1, puntajes: [5, 5, 4, 5, 4], leida: false,
    retro: "Sigue siendo un referente para el equipo de producción." },
  { periodo: periodoAbierto, id: 5, plantilla: ADMINISTRATIVO, evaluador: 4, puntajes: null },
  { periodo: periodoAbierto, id: 6, plantilla: PLANTA, evaluador: null, puntajes: null },
  { periodo: periodoAbierto, id: 1, plantilla: ADMINISTRATIVO, evaluador: 8, puntajes: null },
  { periodo: periodoAbierto, id: 7, plantilla: ADMINISTRATIVO, evaluador: 8, puntajes: null }
];

evaluaciones.forEach((ev) => {
  const criterios = criteriosPorPlantilla[ev.plantilla];
  const completada = Boolean(ev.puntajes);
  const puntaje = completada
    ? calcularPuntaje(criterios, Object.fromEntries(criterios.map((c, i) => [c.id, ev.puntajes[i]])))
    : null;
  const cerrado = ev.periodo === periodoCerrado;
  const idEvaluacion = insertarEvaluacion.run(
    ev.periodo, ev.id, ev.plantilla, ev.evaluador, completada ? "completada" : "pendiente", puntaje, ev.retro || null,
    cerrado ? `${anioActual}-06-01 09:00:00` : `${sumarDias(hoy, -10)} 09:00:00`,
    completada ? (cerrado ? `${anioActual}-06-20 16:00:00` : `${sumarDias(hoy, -2)} 16:00:00`) : null,
    ev.leida ? `${anioActual}-07-02 10:00:00` : null
  ).lastInsertRowid;
  if (completada) criterios.forEach((c, i) => insertarCalificacion.run(idEvaluacion, c.id, ev.puntajes[i], null));
  (ev.acciones || []).forEach(([descripcion, responsable, dias, estado, capacitacion]) => {
    insertarAccion.run(idEvaluacion, descripcion, responsable, sumarDias(hoy, dias), estado, capacitacion ? idCapacitacionPorTitulo(capacitacion) : null);
  });
});

console.log("Insertando comunicados, encuestas y sugerencias...");
const insertarComunicado = db.prepare(`
  INSERT INTO comunicados (titulo, contenido, importante, id_autor, fecha_publicacion) VALUES (?, ?, ?, ?, ?)
`);
const insertarComunicadoArea = db.prepare("INSERT INTO comunicado_areas (id_comunicado, area) VALUES (?, ?)");
// [titulo, contenido, importante, id_usuario_autor, días atrás, áreas]
const comunicados = [
  ["Nuevo registro de recepción de leche", "Desde este mes, cada cisterna se registra en el sistema: el operador registra el ingreso, el laboratorio el análisis y el supervisor de calidad la decisión y el lote. Las solicitudes de permisos y vacaciones y la marcación de asistencia también se gestionan aquí.", 1, 8, 7, []],
  ["Mantenimiento de la línea 2", "El sábado se realizará el mantenimiento preventivo de la línea 2 de envasado. El turno mañana de ese día se reasignará a la línea 1.", 0, 7, 3, ["Producción"]],
  ["Campaña de vacunación contra la influenza", "La Caja de Salud realizará una campaña de vacunación en el consultorio de planta. Inscríbase con su supervisor.", 0, 7, 1, []]
];
comunicados.forEach(([titulo, contenido, importante, autor, dias, areas]) => {
  const id = insertarComunicado.run(titulo, contenido, importante, autor, `${sumarDias(hoy, -dias)} 09:00:00`).lastInsertRowid;
  areas.forEach((a) => insertarComunicadoArea.run(id, a));
});

const insertarEncuesta = db.prepare(`
  INSERT INTO encuestas (titulo, descripcion, fecha_apertura, fecha_cierre, estado, id_creado_por) VALUES (?, ?, ?, ?, ?, 7)
`);
const insertarPregunta = db.prepare(
  "INSERT INTO preguntas_encuesta (id_encuesta, texto, tipo, opciones, obligatoria, orden) VALUES (?, ?, ?, ?, ?, ?)"
);
const insertarRespondida = db.prepare("INSERT INTO encuesta_respondida (id_encuesta, id_trabajador) VALUES (?, ?)");
const insertarEnvio = db.prepare("INSERT INTO envios_encuesta (id, id_encuesta, area) VALUES (?, ?, ?)");
const insertarRespuesta = db.prepare("INSERT INTO respuestas_encuesta (id_envio, id_pregunta, valor_numero, valor_texto) VALUES (?, ?, ?, ?)");

// preguntas: [texto, tipo, opciones, obligatoria]; respuestas: [id_trabajador, [valor por pregunta]]
const encuestas = [
  { titulo: "Clima laboral 2026", descripcion: "Queremos conocer su opinión sobre el ambiente de trabajo. Es anónima.",
    desde: -5, hasta: 10, estado: "publicada", areas: [],
    preguntas: [
      ["Me siento valorado en mi trabajo", "escala", null, 1],
      ["La comunicación con mi supervisor es buena", "escala", null, 1],
      ["Cuento con los recursos necesarios para hacer bien mi trabajo", "escala", null, 1],
      ["Recomendaría PIL Andina como lugar para trabajar", "escala", null, 1],
      ["¿Qué aspecto debería priorizar la empresa?", "opcion", ["Capacitación", "Salarios y beneficios", "Ambiente de trabajo", "Comunicación interna"], 1],
      ["¿Qué cambiaría para mejorar el clima laboral?", "texto", null, 0]
    ],
    respuestas: [
      [1, [4, 4, 3, 5, "Capacitación", "Más reuniones de equipo para planificar la semana"]],
      [2, [3, 4, 2, 4, "Salarios y beneficios", null]],
      [3, [5, 5, 4, 5, "Ambiente de trabajo", "Mejorar la ventilación del área de envasado"]],
      [4, [4, 3, 4, 4, "Comunicación interna", "Que los cambios de turno se avisen con más anticipación"]],
      [5, [3, 3, 3, 4, "Capacitación", null]],
      [6, [2, 3, 2, 3, "Salarios y beneficios", "Renovar los vehículos de reparto"]]
    ] },
  { titulo: "Evaluación de la capacitación en BPM", descripcion: "Opinión sobre la capacitación de Buenas Prácticas de Manufactura.",
    desde: -38, hasta: -30, estado: "publicada", areas: ["Producción"],
    preguntas: [
      ["El contenido fue útil para mi trabajo", "escala", null, 1],
      ["El instructor explicó con claridad", "escala", null, 1],
      ["Comentarios", "texto", null, 0]
    ],
    respuestas: [
      [1, [5, 4, "Muy buena, repetirla cada año"]], [2, [4, 4, null]], [3, [5, 5, "Faltó tiempo para la práctica"]]
    ] },
  { titulo: "Satisfacción con el servicio de comedor", descripcion: "Borrador en preparación por RRHH.",
    desde: 15, hasta: 25, estado: "borrador", areas: [],
    preguntas: [["La calidad de la comida es buena", "escala", null, 1], ["Sugerencias para el menú", "texto", null, 0]],
    respuestas: [] }
];
encuestas.forEach((enc) => {
  const idEncuesta = insertarEncuesta.run(enc.titulo, enc.descripcion, sumarDias(hoy, enc.desde), sumarDias(hoy, enc.hasta), enc.estado).lastInsertRowid;
  enc.areas.forEach((a) => db.prepare("INSERT INTO encuesta_areas (id_encuesta, area) VALUES (?, ?)").run(idEncuesta, a));
  const idsPreguntas = enc.preguntas.map(([texto, tipo, opciones, obligatoria], i) =>
    ({ id: insertarPregunta.run(idEncuesta, texto, tipo, opciones ? JSON.stringify(opciones) : null, obligatoria, i).lastInsertRowid, tipo }));
  enc.respuestas.forEach(([idTrabajador, valores]) => {
    insertarRespondida.run(idEncuesta, idTrabajador);
    const idEnvio = crypto.randomUUID();
    insertarEnvio.run(idEnvio, idEncuesta, trabajadores[idTrabajador - 1][4]);
    valores.forEach((valor, i) => {
      if (valor === null) return;
      const p = idsPreguntas[i];
      insertarRespuesta.run(idEnvio, p.id, p.tipo === "escala" ? valor : null, p.tipo === "escala" ? null : valor);
    });
  });
});

const insertarSugerencia = db.prepare(`
  INSERT INTO sugerencias (id_trabajador, codigo_seguimiento, categoria, texto, estado, respuesta, id_respondido_por, fecha, fecha_respuesta)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
// [id_trabajador (null = anónima), código, categoría, texto, estado, respuesta, días atrás]
const sugerencias = [
  [3, null, "condiciones", "Instalar un bebedero cerca de la línea 2 de envasado; el más cercano está lejos.", "atendida", "Se instalará un bebedero la próxima semana. ¡Gracias por la sugerencia!", 12],
  [null, "DEMO2026", "seguridad", "La iluminación del depósito de insumos es insuficiente en el turno tarde.", "en_revision", "Mantenimiento está evaluando cambiar las luminarias.", 6],
  [6, null, "procesos", "Rotar las rutas de reparto para equilibrar la carga entre choferes.", "recibida", null, 3],
  [null, "SUGE7K4P", "bienestar", "Organizar más capacitaciones en Excel y herramientas de oficina.", "recibida", null, 1]
];
sugerencias.forEach(([trabajador, codigo, categoria, texto, estado, respuesta, dias]) => {
  insertarSugerencia.run(trabajador, codigo, categoria, texto, estado, respuesta, respuesta ? 7 : null,
    sumarDias(hoy, -dias), respuesta ? `${sumarDias(hoy, -dias + 2)} 10:00:00` : null);
});

console.log("Insertando asistencia y ausencias de las últimas dos semanas...");
const insertarAsistencia = db.prepare(`
  INSERT INTO asistencia (id_trabajador, fecha, hora_entrada, hora_salida, id_turno, minutos_retraso, horas_trabajadas)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertarAusencia = db.prepare(`
  INSERT INTO ausencias (id_trabajador, fecha, justificada, motivo, id_registrado_por) VALUES (?, ?, ?, ?, 7)
`);

const tolerancia = toleranciaMinutos();
// La asistencia de ejemplo empieza hace 13 días: ese es el inicio de registros del sistema
db.prepare("UPDATE configuracion SET valor = ? WHERE clave = 'inicio_registros'").run(sumarDias(hoy, -13));
// Variación determinista para que cada corrida del seed genere los mismos datos relativos
const variacion = (id, dias, rango) => (id * 37 + dias * 17) % rango;
const sumarMinutos = (hora, minutos) => {
  const total = minutosDelDia(hora) + minutos;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

let totalAsistencia = 0;
let totalAusencias = 0;
for (let dias = 13; dias >= 0; dias--) {
  const fecha = sumarDias(hoy, -dias);
  [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].forEach((id) => {
    const { turno, laborable } = jornadaDelDia(id, fecha);
    if (!laborable || solicitudAprobadaEn(id, fecha)) return;

    // Algunas ausencias registradas por RRHH para que los reportes tengan variedad
    if (id === 6 && dias === 8) {
      insertarAusencia.run(id, fecha, 0, "No se presentó ni avisó");
      totalAusencias++;
      return;
    }
    if (id === 5 && dias === 4) {
      insertarAusencia.run(id, fecha, 1, "Reposo médico (presentó certificado)");
      totalAusencias++;
      return;
    }
    // Hugo es el único operador de estandarización: su falta deja la etapa 4 descubierta ese día
    if (id === 14 && dias === 6) {
      insertarAusencia.run(id, fecha, 0, "No se presentó; avisó tarde por teléfono");
      totalAusencias++;
      return;
    }
    // Hoy, el turno de la tarde todavía no empezó y Rosa aún no marcó
    if (dias === 0 && (turno.hora_inicio > "12:00" || id === 5)) return;

    // Entrada entre 12 min antes y 17 min después del inicio: algunas caen fuera de la tolerancia
    const entrada = sumarMinutos(turno.hora_inicio, variacion(id, dias, 30) - 12);
    const salida = dias === 0 ? null : sumarMinutos(turno.hora_fin, variacion(id, dias, 25));
    insertarAsistencia.run(
      id, fecha, entrada, salida, turno.id,
      calcularRetraso(entrada, turno.hora_inicio, tolerancia),
      salida ? calcularHoras(entrada, salida) : null
    );
    totalAsistencia++;
  });
}

// Una marcación fuera de turno: Carlos trabajó el domingo pasado
const domingo = sumarDias(hoy, -((diaSemana(hoy) % 7) || 7));
insertarAsistencia.run(6, domingo, "07:00", "11:00", null, null, calcularHoras("07:00", "11:00"));
totalAsistencia++;


console.log("Insertando proveedores, cisternas, tanques e ingresos de leche de las últimas dos semanas...");
const { evaluarMuestra, codigoCorrelativo, RESULTADO_DE_SUGERENCIA } = require("./utils/recepcion");
const { plantaOpera } = require("./utils/cobertura");

const proveedores = [
  ["PR-001", "Asociación de Productores Lecheros Yotala", "Centro de acopio Yotala", "70122001"],
  ["PR-002", "Módulo Lechero Tarabuco", "Centro de acopio Tarabuco", "70122002"],
  ["PR-003", "Cooperativa San Lucas", "Centro de acopio Zudáñez", "70122003"],
  ["PR-004", "Familia Quispe Mamani", "Centro de acopio Yotala", "70122004"],
  ["PR-005", "Asociación Ganadera Villa Serrano", "Centro de acopio Villa Serrano", "70122005"],
  ["PR-006", "Productores Unidos de Yamparáez", "Centro de acopio Yamparáez", "70122006"],
  ["PR-007", "Hacienda El Rosal", "Entrega directa en planta", "70122007"],
  ["PR-008", "Comunidad Lechera Sopachuy", "Centro de acopio Sopachuy", "70122008"]
];
const insertarProveedor = db.prepare("INSERT INTO proveedores (codigo, nombre, centro_acopio, telefono) VALUES (?, ?, ?, ?)");
proveedores.forEach((p) => insertarProveedor.run(...p));

const cisternas = [
  ["2847-KTR", 6000, "Transportes Chuquisaca"], ["3310-LMB", 8000, "Transportes Chuquisaca"],
  ["4192-GHP", 10000, "Trans Sucre SRL"], ["1876-BXN", 12000, "Trans Sucre SRL"], ["5021-PZD", 15000, "Carlos Vargas (flota propia)"]
];
const insertarCisterna = db.prepare("INSERT INTO cisternas (placa, capacidad_l, transportista) VALUES (?, ?, ?)");
cisternas.forEach((c) => insertarCisterna.run(...c));

// T-04 se usa para la leche derivada (subproductos)
[["T-01", 30000], ["T-02", 30000], ["T-03", 30000], ["T-04", 15000]]
  .forEach(([codigo, capacidad]) => db.prepare("INSERT INTO tanques (codigo, capacidad_l) VALUES (?, ?)").run(codigo, capacidad));

const parametros = db.prepare("SELECT * FROM parametros_calidad ORDER BY orden").all();
const insertarIngreso = db.prepare(`
  INSERT INTO ingresos_leche (codigo, fecha_hora_llegada, id_proveedor, id_cisterna, volumen_l, temperatura_c, observacion,
    estado, id_operador, id_registrado_por, fecha_hora_descarga, id_operador_descarga)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertarAnalisis = db.prepare(`
  INSERT INTO analisis_leche (id_ingreso, codigo_muestra, acidez, densidad, grasa, alcohol, antibioticos, sugerencia, observaciones, fecha_hora, id_analista)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertarDecision = db.prepare(`
  INSERT INTO decisiones_leche (id_ingreso, resultado, coincide_sugerencia, motivo, tanque, codigo_lote, fecha_hora, id_supervisor)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertarBitacora = db.prepare(`
  INSERT INTO bitacora_recepcion (entidad, id_registro, campo, valor_anterior, valor_nuevo, motivo, id_usuario, fecha)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
// Usuarios de recepción (id de usuarios): 9 Miguel, 10 Silvia (operadores)
const USUARIO_DE = { 10: 9, 11: 10 };
const horaMas = (hora, minutos) => sumarMinutos(hora, minutos);

// Casos especiales para que los indicadores y la trazabilidad tengan variedad. Clave: número de ingreso (k).
// El proveedor PR-006 concentra los problemas de calidad, para que destaque en la conformidad por proveedor.
const ESPECIALES = {
  4: { proveedor: 6, cambios: { acidez: 0.186 }, resultado: "derivado", motivo: "Acidez elevada: se deriva a elaboración de queso" },
  9: { proveedor: 6, cambios: { antibioticos: "presencia" }, resultado: "rechazado", motivo: "Residuos de antibióticos. Rechazo según procedimiento; se notifica al productor" },
  15: { proveedor: 3, temperatura: 11.4, resultado: "aceptado", motivo: "Temperatura apenas sobre el límite, acidez y alcohol normales: se acepta para procesar de inmediato" },
  21: { proveedor: 6, cambios: { grasa: 2.8 }, resultado: "derivado", motivo: "Materia grasa bajo el mínimo: se deriva a leche semidescremada" },
  27: { proveedor: 8, cambios: { alcohol: "positivo" }, resultado: "rechazado", motivo: "Prueba de alcohol positiva (leche inestable al calor)" },
  33: { proveedor: 6, cambios: { acidez: 0.181 }, resultado: "derivado", motivo: "Acidez elevada: se deriva a elaboración de queso" }
};

// Días de operación de las últimas dos semanas. Si hoy no opera la planta, los ingresos "de hoy" van al último día de operación.
const diasRecepcion = [];
for (let d = 13; d >= 0; d--) if (plantaOpera(sumarDias(hoy, -d))) diasRecepcion.push(sumarDias(hoy, -d));
const ultimoDia = diasRecepcion[diasRecepcion.length - 1];
const HORAS_LLEGADA = ["06:15", "06:50", "07:40", "09:10"];

let k = 0;
let totalIngresos = 0;
let correccionHecha = false;
const lotesPorDia = {};
diasRecepcion.forEach((fecha) => {
  const esUltimo = fecha === ultimoDia;
  HORAS_LLEGADA.forEach((hora, n) => {
    if (esUltimo && n === 3) return; // el último día solo llegaron tres cisternas (por ahora)
    k++;
    const especial = ESPECIALES[k] || {};
    const idProveedor = especial.proveedor || ((k * 3) % 8) + 1;
    const idCisterna = (k % 5) + 1;
    const capacidad = cisternas[idCisterna - 1][1];
    const volumen = Math.round((capacidad * (0.55 + ((k * 13) % 35) / 100)) / 50) * 50;
    const temperatura = especial.temperatura ?? Math.round((4 + ((k * 7) % 45) / 10) * 10) / 10;
    const idOperador = n % 2 === 0 ? 10 : 11;
    const llegada = `${fecha} ${hora}`;
    const codigo = codigoCorrelativo("ING", fecha, n + 1);

    // Estado del último día: el primero completo, el segundo esperando decisión y el tercero esperando análisis
    const pendiente = esUltimo ? ["", "por_decidir", "en_analisis"][n] : "";
    const valores = {
      temperatura, acidez: Math.round((0.14 + ((k * 3) % 3) / 100) * 1000) / 1000,
      densidad: Math.round((1.0305 + ((k * 7) % 20) / 10000) * 10000) / 10000,
      grasa: Math.round((3.1 + ((k * 11) % 8) / 10) * 10) / 10, alcohol: "negativo", antibioticos: "ausencia",
      ...(especial.cambios || {})
    };
    const evaluacion = evaluarMuestra(valores, parametros);
    const resultado = especial.resultado || RESULTADO_DE_SUGERENCIA[evaluacion.sugerencia];

    // Analista: Rosa (turno administrativo, desde 08:30) analiza el ingreso de las 09:10 si trabaja ese día; si no, Diego
    const idAnalista = n === 3 && jornadaDelDia(5, fecha).laborable && !db.prepare("SELECT 1 FROM ausencias WHERE id_trabajador = 5 AND fecha = ?").get(fecha) ? 5 : 12;
    const horaAnalisis = horaMas(hora, 18 + (k % 4) * 4);
    const horaDecision = horaMas(horaAnalisis, 8 + (k % 5) * 3);
    const horaDescarga = horaMas(horaDecision, 12);

    const estado = pendiente || resultado;
    const descarga = !pendiente && resultado !== "rechazado" ? `${fecha} ${horaDescarga}` : null;
    const idIngreso = insertarIngreso.run(
      codigo, llegada, idProveedor, idCisterna, volumen, temperatura,
      k === 15 ? "Cisterna demorada por desvío en la ruta" : null,
      estado, idOperador, USUARIO_DE[idOperador], descarga, descarga ? idOperador : null
    ).lastInsertRowid;
    totalIngresos++;

    if (pendiente === "en_analisis") return;
    insertarAnalisis.run(idIngreso, codigo.replace("ING", "M"), valores.acidez, valores.densidad, valores.grasa, valores.alcohol,
      valores.antibioticos, evaluacion.sugerencia, JSON.stringify(evaluacion.observaciones), `${fecha} ${horaAnalisis}`, idAnalista);
    if (pendiente === "por_decidir") return;

    const tanque = resultado === "rechazado" ? null : resultado === "derivado" ? "T-04" : `T-0${(diasRecepcion.indexOf(fecha) % 3) + 1}`;
    lotesPorDia[fecha] = (lotesPorDia[fecha] || 0) + (tanque ? 1 : 0);
    const lote = tanque ? codigoCorrelativo("LR", fecha, lotesPorDia[fecha]) : null;
    const coincide = RESULTADO_DE_SUGERENCIA[evaluacion.sugerencia] === resultado;
    insertarDecision.run(idIngreso, resultado, coincide ? 1 : 0, especial.motivo || null, tanque, lote, `${fecha} ${horaDecision}`, 4);

    // Una corrección de volumen con su motivo, para mostrar la bitácora
    if (!correccionHecha && k >= 6 && resultado === "aceptado") {
      insertarBitacora.run("ingreso", String(idIngreso), "volumen_l", String(volumen + 500), String(volumen),
        `Error de digitación: la guía de acopio indica ${volumen} L`, USUARIO_DE[idOperador], `${fecha} ${horaMas(hora, 9)}:00`);
      correccionHecha = true;
    }
  });
});

// Cambio de parámetro registrado en la bitácora (antes de que empiecen los registros de ejemplo)
const fechaCambio = `${sumarDias(hoy, -20)} 10:00:00`;
insertarBitacora.run("parametro", "temperatura", "maximo", "8", "10",
  "Se alinea al documento técnico: transporte a menos de 10 °C y luego enfriar a 4 ± 2 °C", 4, fechaCambio);
db.prepare("UPDATE parametros_calidad SET id_actualizado_por = 4, fecha_actualizacion = ? WHERE codigo = 'temperatura'").run(fechaCambio);

// Avisos pendientes del último día: el supervisor de calidad tiene una decisión por tomar y el analista una muestra
const pendientes = db.prepare("SELECT id, codigo, estado FROM ingresos_leche WHERE estado IN ('en_analisis', 'por_decidir')").all();
pendientes.forEach((i) => {
  const [idUsuario, mensaje] = i.estado === "por_decidir"
    ? [4, `${i.codigo} analizado: falta su decisión.`]
    : [11, `Nueva muestra por analizar: ${i.codigo}`];
  db.prepare("INSERT INTO notificaciones (id_usuario, tipo, mensaje, enlace) VALUES (?, 'recepcion', ?, ?)")
    .run(idUsuario, mensaje, `/recepcion/ingresos/${i.id}`);
});

console.log("Insertando productos, clientes, lotes de producto terminado, pedidos y despachos...");
const { fechaVencimiento, estaVencido, proponerFEFO } = require("./utils/inventario");

// [codigo, nombre, presentacion, litros_por_unidad, vida_util_dias]
const productos = [
  ["P-01", "Leche pasteurizada entera", "Bolsa 900 ml", 0.9, 7],
  ["P-02", "Leche entera UHT", "Caja 1 L", 1, 120],
  ["P-03", "Leche deslactosada UHT", "Caja 1 L", 1, 120],
  ["P-04", "Leche semidescremada UHT", "Caja 1 L", 1, 120]
];
const insertarProducto = db.prepare(
  "INSERT INTO productos (codigo, nombre, presentacion, litros_por_unidad, vida_util_dias) VALUES (?, ?, ?, ?, ?)"
);
productos.forEach((p) => insertarProducto.run(...p));
const PASTEURIZADA = 1;

// [codigo, nombre, tipo, ciudad, direccion, telefono]. El cliente institucional (desayuno escolar) pide más vida útil.
const clientes = [
  ["CL-001", "Distribuidora Sucre Norte", "distribuidor", "Sucre", "Av. Jaime Mendoza 1450", "64-41210"],
  ["CL-002", "Supermercado El Abasto", "supermercado", "Sucre", "Calle Ravelo 120", "64-52233"],
  ["CL-003", "Tienda Doña Carmen", "tienda", "Sucre", "Mercado Campesino, puesto 34", "71145870"],
  ["CL-004", "Desayuno Escolar GAM Sucre", "institucional", "Sucre", "Plaza 25 de Mayo s/n", "64-60100"],
  ["CL-005", "Distribuidora Lácteos Potosí", "distribuidor", "Potosí", "Av. Universitaria 812", "62-24455"],
  ["CL-006", "Minimarket La Recoleta", "tienda", "Sucre", "Calle Dalence 75", "72290311"]
];
const insertarCliente = db.prepare(
  "INSERT INTO clientes (codigo, nombre, tipo, ciudad, direccion, telefono) VALUES (?, ?, ?, ?, ?, ?)"
);
clientes.forEach((c) => insertarCliente.run(...c));

const insertarLote = db.prepare(`
  INSERT INTO lotes_producto (codigo, id_producto, fecha_elaboracion, fecha_vencimiento, unidades, fecha_hora_registro, id_responsable)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertarOrigen = db.prepare("INSERT INTO lote_producto_origen (id_lote_producto, id_ingreso) VALUES (?, ?)");
const recibirLote = db.prepare(`
  UPDATE lotes_producto SET estado = 'en_almacen', unidades_recibidas = ?, observacion_recepcion = ?, fecha_hora_recepcion = ?, id_receptor = ?
  WHERE id = ?
`);
const insertarMovimiento = db.prepare(`
  INSERT INTO movimientos_inventario (id_lote_producto, tipo, cantidad, id_pedido, motivo, fecha_hora, id_trabajador)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertarPedido = db.prepare(`
  INSERT INTO pedidos (codigo, id_cliente, fecha_entrega, observacion, fecha_hora_registro, id_responsable) VALUES (?, ?, ?, ?, ?, ?)
`);
const insertarItem = db.prepare("INSERT INTO pedido_items (id_pedido, id_producto, cantidad) VALUES (?, ?, ?)");
const insertarDespacho = db.prepare(`
  INSERT INTO despachos (id_pedido, fecha_hora, coincide_fefo, motivo, vehiculo, id_despachador) VALUES (?, ?, ?, ?, ?, ?)
`);
const lotesConStock = db.prepare(`
  SELECT l.*, COALESCE(SUM(m.cantidad), 0) AS stock FROM lotes_producto l
  LEFT JOIN movimientos_inventario m ON m.id_lote_producto = l.id
  WHERE l.id_producto = ? GROUP BY l.id
`);
const aceptadosDelDia = db.prepare(`
  SELECT i.id, i.volumen_l FROM ingresos_leche i JOIN decisiones_leche d ON d.id_ingreso = i.id
  WHERE d.resultado = 'aceptado' AND i.fecha_hora_descarga IS NOT NULL AND substr(i.fecha_hora_llegada, 1, 10) = ?
  ORDER BY i.id
`);
const disponible = (idProducto, fecha) => lotesConStock.all(idProducto)
  .filter((l) => l.estado === "en_almacen" && l.stock > 0 && !estaVencido(l, fecha))
  .reduce((suma, l) => suma + l.stock, 0);
const redondear100 = (n) => Math.floor(n / 100) * 100;

// Trabajadores: 3 María (envasado), 15 Ramiro (almacén), 17 Gabriela (pedidos), 18 Wilson (despacho)
const ENVASADO = 3, ALMACEN = 15, PEDIDOS = 17, DESPACHO = 18;
let totalLotesPT = 0, totalPedidos = 0, totalDespachos = 0;
let fefoOmitido = false, devolucionHecha = false, cancelacionHecha = false, mermaHecha = false;

diasRecepcion.forEach((fecha, indice) => {
  const esHoy = fecha === ultimoDia;

  // 1) Antes de abrir: el almacén da de baja lo que venció con stock (la leche pasteurizada dura 7 días)
  productos.forEach((_, i) => lotesConStock.all(i + 1)
    .filter((l) => l.estado === "en_almacen" && l.stock > 0 && estaVencido(l, fecha))
    .forEach((l) => insertarMovimiento.run(l.id, "ajuste", -l.stock, null, "Baja por vencimiento", `${fecha} 07:30`, ALMACEN)));

  // 2) Pedidos de la mañana, armados con el stock disponible. Se despachan a las 11:00 por FEFO; los de hoy siguen pendientes.
  const pasteurizada = disponible(PASTEURIZADA, fecha);
  const uht = 2 + (indice % 3); // P-02, P-03 o P-04 según el día
  const pedidosDelDia = [
    { cliente: (indice % 3) + 1, items: [[PASTEURIZADA, redondear100(pasteurizada * 0.5)], [2, redondear100(disponible(2, fecha) * 0.35)]], hora: "09:05" },
    { cliente: indice % 2 ? 4 : 5, items: [[PASTEURIZADA, redondear100(pasteurizada * 0.35)], [uht, redondear100(disponible(uht, fecha) * 0.4)]], hora: "09:40" }
  ];
  if (!cancelacionHecha && indice === 3) pedidosDelDia.push({ cliente: 3, items: [[2, 120]], hora: "10:10", cancelar: true });

  pedidosDelDia.forEach((p, n) => {
    const items = p.items.filter(([idProducto, cantidad]) => cantidad > 0 && disponible(idProducto, fecha) >= cantidad);
    if (!items.length) return;
    const codigo = codigoCorrelativo("PED", fecha, n + 1);
    const entrega = esHoy && n === 1 ? sumarDias(fecha, 1) : fecha;
    const idPedido = insertarPedido.run(codigo, p.cliente, entrega, p.cliente === 4 ? "Entrega en el almacén municipal" : null,
      `${fecha} ${p.hora}`, PEDIDOS).lastInsertRowid;
    items.forEach(([idProducto, cantidad]) => insertarItem.run(idPedido, idProducto, cantidad));
    totalPedidos++;

    if (p.cancelar) {
      db.prepare("UPDATE pedidos SET estado = 'cancelado', motivo_cancelacion = ?, fecha_hora_cancelacion = ? WHERE id = ?")
        .run("El cliente reprogramó su compra para la próxima semana", `${fecha} 10:30`, idPedido);
      cancelacionHecha = true;
      return;
    }
    if (esHoy) return;

    // El cliente institucional pide más vida útil: una vez se despachan los lotes más nuevos (se aparta de FEFO, con motivo)
    const omitir = !fefoOmitido && p.cliente === 4;
    const horaDespacho = `${fecha} 11:${n === 0 ? "00" : "20"}`;
    items.forEach(([idProducto, cantidad]) => {
      let asignacion = proponerFEFO(lotesConStock.all(idProducto), cantidad, fecha).asignacion;
      if (omitir && idProducto === PASTEURIZADA) {
        const nuevos = lotesConStock.all(idProducto).filter((l) => l.estado === "en_almacen" && l.stock > 0 && !estaVencido(l, fecha))
          .sort((a, b) => b.fecha_vencimiento.localeCompare(a.fecha_vencimiento));
        asignacion = [];
        let restante = cantidad;
        nuevos.forEach((l) => {
          const toma = Math.min(l.stock, restante);
          if (toma > 0) asignacion.push({ id_lote_producto: l.id, cantidad: toma });
          restante -= toma;
        });
      }
      asignacion.forEach((a) => insertarMovimiento.run(a.id_lote_producto, "despacho", -a.cantidad, idPedido, null, horaDespacho, DESPACHO));
    });
    insertarDespacho.run(idPedido, horaDespacho, omitir ? 0 : 1,
      omitir ? "El desayuno escolar exige al menos 5 días de vida útil al recibir: se despachan los lotes más recientes" : null,
      n === 0 ? "3310-LMB" : "2190-KDT", DESPACHO);
    db.prepare("UPDATE pedidos SET estado = 'despachado' WHERE id = ?").run(idPedido);
    if (omitir) fefoOmitido = true;
    totalDespachos++;

    // Una devolución al día siguiente: envases dañados en el transporte
    if (!devolucionHecha && indice >= 4 && n === 0) {
      const mov = db.prepare("SELECT id_lote_producto FROM movimientos_inventario WHERE id_pedido = ? ORDER BY id LIMIT 1").get(idPedido);
      db.prepare(`INSERT INTO devoluciones (id_pedido, id_lote_producto, cantidad, motivo, fecha_hora, id_trabajador)
        VALUES (?, ?, ?, ?, ?, ?)`).run(idPedido, mov.id_lote_producto, 36, "Bolsas rotas en el transporte; el cliente las devolvió",
        `${sumarDias(fecha, 1)} 10:15`, ALMACEN);
      devolucionHecha = true;
    }
  });

  // 3) Producción del día: envasado registra los lotes con su origen y el almacén los recibe por la tarde.
  //    La pasteurizada sale del primer ingreso aceptado y la UHT de los demás. El lote de hoy espera recepción.
  const aceptados = aceptadosDelDia.all(fecha);
  if (!aceptados.length) return;
  const lotesDelDia = [[PASTEURIZADA, aceptados.slice(0, 1)]];
  if (aceptados.length > 1) lotesDelDia.push([uht, aceptados.slice(1)]);
  lotesDelDia.forEach(([idProducto, origen], n) => {
    const [, , , litros, vida] = productos[idProducto - 1];
    const unidades = Math.floor((origen.reduce((s, i) => s + i.volumen_l, 0) * 0.97) / litros / 10) * 10;
    const codigo = codigoCorrelativo("LP", fecha, n + 1);
    const idLote = insertarLote.run(codigo, idProducto, fecha, fechaVencimiento(fecha, vida), unidades,
      `${fecha} ${esHoy ? "11:30" : "13:10"}`, ENVASADO).lastInsertRowid;
    origen.forEach((i) => insertarOrigen.run(idLote, i.id));
    totalLotesPT++;
    if (esHoy) return;

    // Un lote llega con faltante: queda la diferencia y su observación
    const faltante = !mermaHecha && indice === 6 && idProducto !== PASTEURIZADA ? 24 : 0;
    recibirLote.run(unidades - faltante, faltante ? "Faltan 24 cajas: llegaron aplastadas desde la línea de envasado" : null,
      `${fecha} 13:40`, ALMACEN, idLote);
    insertarMovimiento.run(idLote, "ingreso", unidades - faltante, null, null, `${fecha} 13:40`, ALMACEN);
    if (faltante) {
      insertarMovimiento.run(idLote, "ajuste", -12, null, "Merma: cajas dañadas al estibar en cámara", `${fecha} 16:00`, ALMACEN);
      mermaHecha = true;
    }
  });
});

// Avisos pendientes: el almacén tiene un lote por recibir y pedidos por despachar
const USUARIO_ALMACEN = 13, USUARIO_DESPACHO = 15;
const notificarAlmacen = db.prepare("INSERT INTO notificaciones (id_usuario, tipo, mensaje, enlace) VALUES (?, 'almacen', ?, ?)");
db.prepare("SELECT id, codigo FROM lotes_producto WHERE estado = 'registrado'").all()
  .forEach((l) => notificarAlmacen.run(USUARIO_ALMACEN, `Lote ${l.codigo} envasado: falta recibirlo en almacén.`, `/almacen/lotes/${l.id}`));
db.prepare("SELECT id, codigo FROM pedidos WHERE estado = 'pendiente'").all().forEach((p) => {
  [USUARIO_ALMACEN, USUARIO_DESPACHO].forEach((u) => notificarAlmacen.run(u, `Nuevo pedido ${p.codigo} por despachar.`, `/pedidos/${p.id}`));
});

console.log("Listo. Datos de ejemplo cargados:");
console.log(`- ${trabajadores.length} trabajadores (1 inactivo), ${Object.keys(puestosAsignados).length} con puesto en el proceso`);
console.log(`- ${cuentas.length} cuentas de usuario. Contraseña inicial = CI del trabajador:`);
cuentas.forEach(([idTrabajador, usuario, rol]) => {
  console.log(`    ${usuario.padEnd(11)} ${rol.padEnd(10)} clave: ${trabajadores[idTrabajador - 1][2]}`);
});
console.log(`- ${turnos.length} turnos, ${feriados.length} feriados y ${asignaciones.length} asignaciones de turno`);
console.log(`- ${totalAsistencia} marcaciones de asistencia y ${totalAusencias} ausencias (últimas dos semanas)`);
console.log(`- ${tiposPermiso.length} tipos de permiso y ${solicitudes.length} solicitudes en distintos estados del flujo`);
console.log(`- ${capacitaciones.length} capacitaciones (finalizadas, en curso, programadas y una cancelada)`);
console.log(`- ${plantillas.length} plantillas de evaluación, 2 períodos (uno cerrado) y ${evaluaciones.length} evaluaciones`);
console.log(`- Recepción: ${proveedores.length} proveedores, ${cisternas.length} cisternas, 4 tanques y ${totalIngresos} ingresos de leche (${pendientes.length} pendientes)`);
console.log(`- Almacén y despacho: ${productos.length} productos, ${clientes.length} clientes, ${totalLotesPT} lotes de producto terminado, ${totalPedidos} pedidos (${totalDespachos} despachados)`);
console.log(`- ${comunicados.length} comunicados, ${encuestas.length} encuestas y ${sugerencias.length} sugerencias (códigos anónimos de ejemplo: DEMO2026, SUGE7K4P)`);
