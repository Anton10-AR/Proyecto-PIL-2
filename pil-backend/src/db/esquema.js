// Esquema de la base de datos: única fuente de verdad de las tablas.
// Cada fase del plan agrega aquí las tablas de su módulo.
// Las fechas que ve el usuario se guardan en hora local (datetime('now', 'localtime'));
// solo sesiones.expira usa UTC, y se compara siempre contra datetime('now').

// Orden de creación (respeta las FK). El seed las borra en orden inverso.
const TABLAS = [
  "etapas_proceso",
  "puestos_proceso",
  "trabajadores",
  "usuarios",
  "sesiones",
  "configuracion",
  "archivos",
  "notificaciones",
  "turnos",
  "asignaciones_turno",
  "feriados",
  "asistencia",
  "ausencias",
  "tipos_permiso",
  "solicitudes",
  "aprobaciones_solicitud",
  "capacitaciones",
  "participantes_capacitacion",
  "plantillas_evaluacion",
  "criterios_evaluacion",
  "periodos_evaluacion",
  "evaluaciones",
  "calificaciones",
  "acciones_mejora",
  "encuestas",
  "encuesta_areas",
  "preguntas_encuesta",
  "encuesta_respondida",
  "envios_encuesta",
  "respuestas_encuesta",
  "sugerencias",
  "comunicados",
  "comunicado_areas",
  "proveedores",
  "cisternas",
  "tanques",
  "parametros_calidad",
  "ingresos_leche",
  "analisis_leche",
  "decisiones_leche",
  "bitacora_recepcion"
];

function crearEsquema(db) {
  db.exec(`
    -- Diseño organizacional del proceso: las 7 etapas de la leche líquida y los puestos de cada una.
    -- Un puesto crítico es el que, si queda vacío, detiene la etapa o compromete la inocuidad.
    -- id_etapa NULL = puesto transversal (supervisión de producción, mantenimiento, jefatura).
    CREATE TABLE IF NOT EXISTS etapas_proceso (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT
    );

    -- codigo es fijo y lo usa el backend para los permisos del módulo de Recepción (utils/puestos.js)
    CREATE TABLE IF NOT EXISTS puestos_proceso (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      id_etapa INTEGER,
      critico INTEGER NOT NULL DEFAULT 0 CHECK (critico IN (0, 1)),
      cobertura_minima INTEGER NOT NULL DEFAULT 0 CHECK (cobertura_minima >= 0),
      competencia_requerida TEXT,
      CHECK (critico = 0 OR cobertura_minima > 0),
      FOREIGN KEY (id_etapa) REFERENCES etapas_proceso(id)
    );

    CREATE TABLE IF NOT EXISTS trabajadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      ci TEXT NOT NULL UNIQUE,
      fecha_nacimiento TEXT,
      telefono TEXT,
      direccion TEXT,
      correo TEXT,
      cargo TEXT,
      area TEXT,
      fecha_ingreso TEXT,
      tipo_contrato TEXT,
      id_supervisor INTEGER,
      id_puesto INTEGER,
      estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
      FOREIGN KEY (id_supervisor) REFERENCES trabajadores(id),
      FOREIGN KEY (id_puesto) REFERENCES puestos_proceso(id)
    );

    -- Cuenta de acceso: todo usuario es un trabajador (relación 1 a 1)
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_trabajador INTEGER NOT NULL UNIQUE,
      usuario TEXT NOT NULL UNIQUE,
      hash_clave TEXT NOT NULL,
      sal TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('trabajador', 'supervisor', 'rrhh', 'gerencia')),
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
      debe_cambiar_clave INTEGER NOT NULL DEFAULT 1 CHECK (debe_cambiar_clave IN (0, 1)),
      FOREIGN KEY (id_trabajador) REFERENCES trabajadores(id)
    );

    -- Se guarda el hash SHA-256 del token, nunca el token en claro
    CREATE TABLE IF NOT EXISTS sesiones (
      hash_token TEXT PRIMARY KEY,
      id_usuario INTEGER NOT NULL,
      expira TEXT NOT NULL,
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS archivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_original TEXT NOT NULL,
      ruta TEXT NOT NULL,
      mime TEXT NOT NULL,
      tamano INTEGER NOT NULL,
      id_subido_por INTEGER NOT NULL,
      fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (id_subido_por) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      enlace TEXT,
      leida INTEGER NOT NULL DEFAULT 0 CHECK (leida IN (0, 1)),
      fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
    );
    CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(id_usuario, leida);

    -- Turnos fijos definidos por RRHH. Sin turnos nocturnos: fin siempre después del inicio.
    -- dias_laborables: días ISO separados por coma (1 = lunes ... 7 = domingo), ej. "1,2,3,4,5"
    CREATE TABLE IF NOT EXISTS turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      dias_laborables TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
      CHECK (hora_fin > hora_inicio)
    );

    -- Historial de turnos de cada trabajador. La asignación vigente es la de fecha_hasta NULL.
    CREATE TABLE IF NOT EXISTS asignaciones_turno (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_trabajador INTEGER NOT NULL,
      id_turno INTEGER NOT NULL,
      fecha_desde TEXT NOT NULL,
      fecha_hasta TEXT,
      id_asignado_por INTEGER,
      CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde),
      FOREIGN KEY (id_trabajador) REFERENCES trabajadores(id),
      FOREIGN KEY (id_turno) REFERENCES turnos(id),
      FOREIGN KEY (id_asignado_por) REFERENCES usuarios(id)
    );
    -- Un solo turno vigente (abierto) por trabajador
    CREATE UNIQUE INDEX IF NOT EXISTS idx_asignacion_abierta
      ON asignaciones_turno(id_trabajador) WHERE fecha_hasta IS NULL;

    CREATE TABLE IF NOT EXISTS feriados (
      fecha TEXT PRIMARY KEY,
      descripcion TEXT NOT NULL
    );

    -- Una marcación por trabajador y día. id_turno NULL = marcación fuera de turno
    -- (sin turno, día no laborable o feriado): en ese caso minutos_retraso también es NULL.
    CREATE TABLE IF NOT EXISTS asistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_trabajador INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      hora_entrada TEXT NOT NULL,
      hora_salida TEXT,
      id_turno INTEGER,
      minutos_retraso INTEGER CHECK (minutos_retraso IS NULL OR minutos_retraso >= 0),
      horas_trabajadas REAL,
      observacion TEXT,
      id_corregido_por INTEGER,
      fecha_correccion TEXT,
      UNIQUE (id_trabajador, fecha),
      CHECK (hora_salida IS NULL OR hora_salida > hora_entrada),
      FOREIGN KEY (id_trabajador) REFERENCES trabajadores(id),
      FOREIGN KEY (id_turno) REFERENCES turnos(id),
      FOREIGN KEY (id_corregido_por) REFERENCES usuarios(id)
    );

    -- Ausencias registradas manualmente por RRHH
    CREATE TABLE IF NOT EXISTS ausencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_trabajador INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      justificada INTEGER NOT NULL DEFAULT 0 CHECK (justificada IN (0, 1)),
      motivo TEXT,
      id_registrado_por INTEGER NOT NULL,
      fecha_registro TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE (id_trabajador, fecha),
      FOREIGN KEY (id_trabajador) REFERENCES trabajadores(id),
      FOREIGN KEY (id_registrado_por) REFERENCES usuarios(id)
    );

    -- Catálogo de tipos de permiso (RRHH lo mantiene). limite_anual_dias NULL = sin límite anual;
    -- el límite se cuenta por año calendario sobre los días hábiles de solicitudes activas.
    CREATE TABLE IF NOT EXISTS tipos_permiso (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT,
      dias_max_solicitud INTEGER NOT NULL CHECK (dias_max_solicitud > 0),
      limite_anual_dias INTEGER CHECK (limite_anual_dias IS NULL OR limite_anual_dias > 0),
      requiere_respaldo INTEGER NOT NULL DEFAULT 0 CHECK (requiere_respaldo IN (0, 1)),
      con_goce INTEGER NOT NULL DEFAULT 1 CHECK (con_goce IN (0, 1)),
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    -- Solicitudes de permiso o vacación. Flujo de estados:
    --   pendiente_supervisor -> pendiente_rrhh -> aprobado   (trabajador con supervisor)
    --   pendiente_gerencia -> aprobado                        (personal de RRHH, Gerencia o sin supervisor)
    --   cualquier pendiente -> rechazado | cancelado (cancela el propio trabajador)
    -- gestion_inicio: para vacaciones, gestión (año de servicio) de la que se descuentan los días.
    CREATE TABLE IF NOT EXISTS solicitudes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_trabajador INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('permiso', 'vacacion')),
      id_tipo_permiso INTEGER,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      dias_habiles INTEGER NOT NULL CHECK (dias_habiles > 0),
      gestion_inicio TEXT,
      motivo TEXT,
      estado TEXT NOT NULL CHECK (estado IN
        ('pendiente_supervisor', 'pendiente_rrhh', 'pendiente_gerencia', 'aprobado', 'rechazado', 'cancelado')),
      id_archivo_respaldo INTEGER,
      fecha_solicitud TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      fecha_resolucion TEXT,
      CHECK (fecha_fin >= fecha_inicio),
      CHECK ((tipo = 'permiso' AND id_tipo_permiso IS NOT NULL) OR (tipo = 'vacacion' AND id_tipo_permiso IS NULL)),
      FOREIGN KEY (id_trabajador) REFERENCES trabajadores(id),
      FOREIGN KEY (id_tipo_permiso) REFERENCES tipos_permiso(id),
      FOREIGN KEY (id_archivo_respaldo) REFERENCES archivos(id)
    );
    CREATE INDEX IF NOT EXISTS idx_solicitudes_trabajador ON solicitudes(id_trabajador, estado);

    -- Cada decisión tomada sobre una solicitud (de aquí sale el tiempo por etapa)
    CREATE TABLE IF NOT EXISTS aprobaciones_solicitud (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_solicitud INTEGER NOT NULL,
      etapa TEXT NOT NULL CHECK (etapa IN ('supervisor', 'rrhh', 'gerencia')),
      id_aprobador INTEGER NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('aprobado', 'rechazado')),
      comentario TEXT,
      fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE (id_solicitud, etapa),
      FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id),
      FOREIGN KEY (id_aprobador) REFERENCES usuarios(id)
    );

    -- Capacitaciones (registros independientes, sin catálogo de cursos). Estado guardado:
    -- programada | finalizada | cancelada. "En curso" se deriva: programada y hoy entre las fechas.
    CREATE TABLE IF NOT EXISTS capacitaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      instructor TEXT,
      lugar TEXT,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      horas REAL NOT NULL CHECK (horas > 0),
      cupo INTEGER CHECK (cupo IS NULL OR cupo > 0),
      estado TEXT NOT NULL DEFAULT 'programada' CHECK (estado IN ('programada', 'finalizada', 'cancelada')),
      id_creado_por INTEGER NOT NULL,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      CHECK (fecha_fin >= fecha_inicio),
      FOREIGN KEY (id_creado_por) REFERENCES usuarios(id)
    );

    -- Participantes: el supervisor propone (propuesto) y RRHH confirma (inscrito) o descarta (rechazado);
    -- RRHH también inscribe directamente. El resultado solo se registra para inscritos, y el
    -- certificado solo para quien aprobó.
    CREATE TABLE IF NOT EXISTS participantes_capacitacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_capacitacion INTEGER NOT NULL,
      id_trabajador INTEGER NOT NULL,
      estado_inscripcion TEXT NOT NULL CHECK (estado_inscripcion IN ('propuesto', 'inscrito', 'rechazado')),
      id_registrado_por INTEGER NOT NULL,
      fecha_registro TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      asistencia_pct INTEGER CHECK (asistencia_pct IS NULL OR asistencia_pct BETWEEN 0 AND 100),
      nota REAL CHECK (nota IS NULL OR nota BETWEEN 0 AND 100),
      resultado TEXT CHECK (resultado IS NULL OR resultado IN ('aprobado', 'reprobado', 'no_asistio')),
      observacion TEXT,
      id_archivo_certificado INTEGER,
      UNIQUE (id_capacitacion, id_trabajador),
      CHECK (resultado IS NULL OR estado_inscripcion = 'inscrito'),
      CHECK (id_archivo_certificado IS NULL OR resultado = 'aprobado'),
      FOREIGN KEY (id_capacitacion) REFERENCES capacitaciones(id),
      FOREIGN KEY (id_trabajador) REFERENCES trabajadores(id),
      FOREIGN KEY (id_registrado_por) REFERENCES usuarios(id),
      FOREIGN KEY (id_archivo_certificado) REFERENCES archivos(id)
    );

    -- Plantillas de evaluación (RRHH). Los pesos de sus criterios suman 100 (se valida en el backend).
    -- Una plantilla ya usada en alguna evaluación no permite cambiar sus criterios.
    CREATE TABLE IF NOT EXISTS plantillas_evaluacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT,
      activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS criterios_evaluacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_plantilla INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      peso INTEGER NOT NULL CHECK (peso BETWEEN 1 AND 100),
      orden INTEGER NOT NULL DEFAULT 0,
      UNIQUE (id_plantilla, nombre),
      FOREIGN KEY (id_plantilla) REFERENCES plantillas_evaluacion(id)
    );

    -- Períodos de evaluación. Cerrado = ya no se editan sus evaluaciones.
    -- id_plantilla es la plantilla sugerida al asignar; cada evaluación guarda la suya.
    CREATE TABLE IF NOT EXISTS periodos_evaluacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      id_plantilla INTEGER NOT NULL,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
      id_creado_por INTEGER NOT NULL,
      fecha_cierre TEXT,
      CHECK (fecha_fin >= fecha_inicio),
      FOREIGN KEY (id_plantilla) REFERENCES plantillas_evaluacion(id),
      FOREIGN KEY (id_creado_por) REFERENCES usuarios(id)
    );

    -- Una evaluación por trabajador y período. id_evaluador es una cuenta (usuarios.id); queda en NULL
    -- si el trabajador no tiene supervisor con cuenta y RRHH aún no asignó a nadie.
    CREATE TABLE IF NOT EXISTS evaluaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_periodo INTEGER NOT NULL,
      id_trabajador INTEGER NOT NULL,
      id_plantilla INTEGER NOT NULL,
      id_evaluador INTEGER,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completada')),
      puntaje_final REAL CHECK (puntaje_final IS NULL OR puntaje_final BETWEEN 1 AND 5),
      retroalimentacion TEXT,
      fecha_asignacion TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      fecha_completada TEXT,
      fecha_lectura TEXT,
      UNIQUE (id_periodo, id_trabajador),
      CHECK (estado = 'pendiente' OR puntaje_final IS NOT NULL),
      CHECK (fecha_lectura IS NULL OR estado = 'completada'),
      FOREIGN KEY (id_periodo) REFERENCES periodos_evaluacion(id),
      FOREIGN KEY (id_trabajador) REFERENCES trabajadores(id),
      FOREIGN KEY (id_plantilla) REFERENCES plantillas_evaluacion(id),
      FOREIGN KEY (id_evaluador) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS calificaciones (
      id_evaluacion INTEGER NOT NULL,
      id_criterio INTEGER NOT NULL,
      puntaje INTEGER NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
      observacion TEXT,
      PRIMARY KEY (id_evaluacion, id_criterio),
      FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id),
      FOREIGN KEY (id_criterio) REFERENCES criterios_evaluacion(id)
    );

    -- Plan de mejora: acciones con responsable, fecha límite y seguimiento; pueden vincularse a una capacitación
    CREATE TABLE IF NOT EXISTS acciones_mejora (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_evaluacion INTEGER NOT NULL,
      descripcion TEXT NOT NULL,
      id_responsable INTEGER NOT NULL,
      fecha_limite TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_progreso', 'completada')),
      id_capacitacion INTEGER,
      fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id),
      FOREIGN KEY (id_responsable) REFERENCES trabajadores(id),
      FOREIGN KEY (id_capacitacion) REFERENCES capacitaciones(id)
    );

    -- Encuestas de clima (RRHH). borrador -> publicada; abierta/cerrada se deriva de las fechas.
    CREATE TABLE IF NOT EXISTS encuestas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      fecha_apertura TEXT NOT NULL,
      fecha_cierre TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicada')),
      id_creado_por INTEGER NOT NULL,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      CHECK (fecha_cierre >= fecha_apertura),
      FOREIGN KEY (id_creado_por) REFERENCES usuarios(id)
    );

    -- Áreas destinatarias; sin filas = toda la empresa
    CREATE TABLE IF NOT EXISTS encuesta_areas (
      id_encuesta INTEGER NOT NULL,
      area TEXT NOT NULL,
      PRIMARY KEY (id_encuesta, area),
      FOREIGN KEY (id_encuesta) REFERENCES encuestas(id)
    );

    -- tipo: escala (1 a 5), opcion (única, opciones en JSON) o texto libre
    CREATE TABLE IF NOT EXISTS preguntas_encuesta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_encuesta INTEGER NOT NULL,
      texto TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('escala', 'opcion', 'texto')),
      opciones TEXT,
      obligatoria INTEGER NOT NULL DEFAULT 1 CHECK (obligatoria IN (0, 1)),
      orden INTEGER NOT NULL DEFAULT 0,
      CHECK ((tipo = 'opcion') = (opciones IS NOT NULL)),
      FOREIGN KEY (id_encuesta) REFERENCES encuestas(id)
    );

    -- ANONIMATO: quién respondió y qué respondió se guardan en tablas separadas, sin fechas ni
    -- autoincrementales. Las tres tablas son WITHOUT ROWID (ordenadas por su clave): el orden de
    -- inserción no queda registrado, así que no se puede emparejar un envío con quien respondió.
    CREATE TABLE IF NOT EXISTS encuesta_respondida (
      id_encuesta INTEGER NOT NULL,
      id_trabajador INTEGER NOT NULL,
      PRIMARY KEY (id_encuesta, id_trabajador),
      FOREIGN KEY (id_encuesta) REFERENCES encuestas(id),
      FOREIGN KEY (id_trabajador) REFERENCES trabajadores(id)
    ) WITHOUT ROWID;

    -- Un envío = un cuestionario respondido. id es un UUID aleatorio; area es la del trabajador al
    -- responder (los resultados por área solo se muestran con 3 o más envíos).
    CREATE TABLE IF NOT EXISTS envios_encuesta (
      id TEXT PRIMARY KEY,
      id_encuesta INTEGER NOT NULL,
      area TEXT,
      FOREIGN KEY (id_encuesta) REFERENCES encuestas(id)
    ) WITHOUT ROWID;

    CREATE TABLE IF NOT EXISTS respuestas_encuesta (
      id_envio TEXT NOT NULL,
      id_pregunta INTEGER NOT NULL,
      valor_numero INTEGER,
      valor_texto TEXT,
      PRIMARY KEY (id_envio, id_pregunta),
      FOREIGN KEY (id_envio) REFERENCES envios_encuesta(id),
      FOREIGN KEY (id_pregunta) REFERENCES preguntas_encuesta(id)
    ) WITHOUT ROWID;

    -- Buzón de sugerencias. Anónima: id_trabajador NULL y un código de seguimiento para que
    -- quien la envió consulte el estado. Solo se guarda la fecha (sin hora) para no facilitar
    -- identificar al autor.
    CREATE TABLE IF NOT EXISTS sugerencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_trabajador INTEGER,
      codigo_seguimiento TEXT UNIQUE,
      categoria TEXT NOT NULL CHECK (categoria IN ('condiciones', 'procesos', 'seguridad', 'bienestar', 'comunicacion', 'otro')),
      texto TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'recibida' CHECK (estado IN ('recibida', 'en_revision', 'atendida')),
      respuesta TEXT,
      id_respondido_por INTEGER,
      fecha TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      fecha_respuesta TEXT,
      CHECK ((id_trabajador IS NULL) = (codigo_seguimiento IS NOT NULL)),
      CHECK (estado <> 'atendida' OR respuesta IS NOT NULL),
      FOREIGN KEY (id_trabajador) REFERENCES trabajadores(id),
      FOREIGN KEY (id_respondido_por) REFERENCES usuarios(id)
    );

    -- Comunicados internos (RRHH y Gerencia). Sin filas en comunicado_areas = toda la empresa.
    CREATE TABLE IF NOT EXISTS comunicados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      contenido TEXT NOT NULL,
      importante INTEGER NOT NULL DEFAULT 0 CHECK (importante IN (0, 1)),
      id_autor INTEGER NOT NULL,
      fecha_publicacion TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (id_autor) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS comunicado_areas (
      id_comunicado INTEGER NOT NULL,
      area TEXT NOT NULL,
      PRIMARY KEY (id_comunicado, area),
      FOREIGN KEY (id_comunicado) REFERENCES comunicados(id)
    );

    -- ===== Recepción y control de calidad de leche cruda (etapa 2, punto crítico del proceso) =====
    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      centro_acopio TEXT,
      telefono TEXT,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS cisternas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placa TEXT NOT NULL UNIQUE,
      capacidad_l INTEGER NOT NULL CHECK (capacidad_l > 0),
      transportista TEXT,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS tanques (
      codigo TEXT PRIMARY KEY,
      capacidad_l INTEGER NOT NULL CHECK (capacidad_l > 0),
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    -- Parámetros de aceptación, configurables solo por el supervisor de calidad (cada cambio va a la bitácora).
    -- tipo rango: minimo y/o maximo; tipo cualitativo: el resultado debe ser valor_aceptable.
    -- critico = 1: si no se cumple, el sistema sugiere rechazar; si no, sugiere derivar.
    CREATE TABLE IF NOT EXISTS parametros_calidad (
      codigo TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      unidad TEXT,
      tipo TEXT NOT NULL CHECK (tipo IN ('rango', 'cualitativo')),
      minimo REAL,
      maximo REAL,
      valor_aceptable TEXT,
      critico INTEGER NOT NULL DEFAULT 0 CHECK (critico IN (0, 1)),
      orden INTEGER NOT NULL DEFAULT 0,
      id_actualizado_por INTEGER,
      fecha_actualizacion TEXT,
      CHECK (tipo = 'cualitativo' OR minimo IS NOT NULL OR maximo IS NOT NULL),
      CHECK (tipo = 'rango' OR valor_aceptable IS NOT NULL),
      CHECK (minimo IS NULL OR maximo IS NULL OR maximo >= minimo),
      FOREIGN KEY (id_actualizado_por) REFERENCES usuarios(id)
    );

    -- Un ingreso = una cisterna recibida. estado avanza: en_analisis -> por_decidir -> aceptado | derivado | rechazado.
    -- id_operador es el trabajador responsable (puesto operador de recepción).
    CREATE TABLE IF NOT EXISTS ingresos_leche (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      fecha_hora_llegada TEXT NOT NULL,
      id_proveedor INTEGER NOT NULL,
      id_cisterna INTEGER NOT NULL,
      volumen_l REAL NOT NULL CHECK (volumen_l > 0),
      temperatura_c REAL NOT NULL CHECK (temperatura_c BETWEEN -5 AND 50),
      observacion TEXT,
      estado TEXT NOT NULL DEFAULT 'en_analisis'
        CHECK (estado IN ('en_analisis', 'por_decidir', 'aceptado', 'derivado', 'rechazado')),
      id_operador INTEGER NOT NULL,
      id_registrado_por INTEGER NOT NULL,
      fecha_hora_descarga TEXT,
      id_operador_descarga INTEGER,
      CHECK (fecha_hora_descarga IS NULL OR estado IN ('aceptado', 'derivado')),
      FOREIGN KEY (id_proveedor) REFERENCES proveedores(id),
      FOREIGN KEY (id_cisterna) REFERENCES cisternas(id),
      FOREIGN KEY (id_operador) REFERENCES trabajadores(id),
      FOREIGN KEY (id_registrado_por) REFERENCES usuarios(id),
      FOREIGN KEY (id_operador_descarga) REFERENCES trabajadores(id)
    );
    CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos_leche(fecha_hora_llegada);

    -- Análisis de la muestra (uno por ingreso). sugerencia y observaciones (JSON) son la evaluación del
    -- sistema contra los parámetros vigentes en ese momento: quedan guardadas aunque los parámetros cambien.
    CREATE TABLE IF NOT EXISTS analisis_leche (
      id_ingreso INTEGER PRIMARY KEY,
      codigo_muestra TEXT NOT NULL UNIQUE,
      acidez REAL NOT NULL CHECK (acidez BETWEEN 0 AND 1),
      densidad REAL NOT NULL CHECK (densidad BETWEEN 1 AND 1.1),
      grasa REAL NOT NULL CHECK (grasa BETWEEN 0 AND 15),
      alcohol TEXT NOT NULL CHECK (alcohol IN ('negativo', 'positivo')),
      antibioticos TEXT NOT NULL CHECK (antibioticos IN ('ausencia', 'presencia')),
      sugerencia TEXT NOT NULL CHECK (sugerencia IN ('aceptar', 'derivar', 'rechazar')),
      observaciones TEXT NOT NULL DEFAULT '[]',
      fecha_hora TEXT NOT NULL,
      id_analista INTEGER NOT NULL,
      FOREIGN KEY (id_ingreso) REFERENCES ingresos_leche(id),
      FOREIGN KEY (id_analista) REFERENCES trabajadores(id)
    );

    -- Decisión del supervisor de calidad (una por ingreso, no se modifica). El lote de recepción se
    -- genera para la leche aceptada o derivada, que se descarga en un tanque.
    CREATE TABLE IF NOT EXISTS decisiones_leche (
      id_ingreso INTEGER PRIMARY KEY,
      resultado TEXT NOT NULL CHECK (resultado IN ('aceptado', 'derivado', 'rechazado')),
      coincide_sugerencia INTEGER NOT NULL CHECK (coincide_sugerencia IN (0, 1)),
      motivo TEXT,
      tanque TEXT,
      codigo_lote TEXT UNIQUE,
      fecha_hora TEXT NOT NULL,
      id_supervisor INTEGER NOT NULL,
      CHECK ((resultado = 'rechazado') = (tanque IS NULL)),
      CHECK ((resultado = 'rechazado') = (codigo_lote IS NULL)),
      CHECK (resultado = 'aceptado' AND coincide_sugerencia = 1 OR motivo IS NOT NULL),
      FOREIGN KEY (id_ingreso) REFERENCES ingresos_leche(id),
      FOREIGN KEY (tanque) REFERENCES tanques(codigo),
      FOREIGN KEY (id_supervisor) REFERENCES trabajadores(id)
    );

    -- Bitácora de correcciones y cambios de parámetros: nada crítico se modifica sin dejar rastro
    CREATE TABLE IF NOT EXISTS bitacora_recepcion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entidad TEXT NOT NULL CHECK (entidad IN ('ingreso', 'analisis', 'parametro')),
      id_registro TEXT NOT NULL,
      campo TEXT NOT NULL,
      valor_anterior TEXT,
      valor_nuevo TEXT,
      motivo TEXT NOT NULL,
      id_usuario INTEGER NOT NULL,
      fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
    );
    CREATE INDEX IF NOT EXISTS idx_bitacora_registro ON bitacora_recepcion(entidad, id_registro);
  `);

  // Valores de configuración por defecto (no pisa los que ya existan)
  const insertarConfig = db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)");
  insertarConfig.run("tolerancia_minutos", "10");
  // Desde cuándo se registra asistencia en el sistema (los indicadores no cuentan días anteriores)
  insertarConfig.run("inicio_registros", new Date().toLocaleDateString("sv-SE"));
  // Días de la semana en que opera la planta (ISO, 1 = lunes): define los días en que se exige cobertura de puestos críticos
  insertarConfig.run("dias_operacion_planta", "1,2,3,4,5,6");

  // Catálogo fijo del proceso (documento, secciones 5 y 7.3). No pisa lo que ya exista.
  const insertarEtapa = db.prepare("INSERT OR IGNORE INTO etapas_proceso (id, nombre, descripcion) VALUES (?, ?, ?)");
  ETAPAS.forEach((e) => insertarEtapa.run(...e));
  const insertarPuesto = db.prepare(`
    INSERT OR IGNORE INTO puestos_proceso (codigo, nombre, id_etapa, critico, cobertura_minima, competencia_requerida)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  PUESTOS.forEach((p) => insertarPuesto.run(...p));

  // Parámetros de recepción de referencia (sección 5.3): el supervisor de calidad confirma los vigentes
  const insertarParametro = db.prepare(`
    INSERT OR IGNORE INTO parametros_calidad (codigo, nombre, unidad, tipo, minimo, maximo, valor_aceptable, critico, orden)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  PARAMETROS.forEach((p, i) => insertarParametro.run(...p, i));
}

// [id, nombre, descripcion]
const ETAPAS = [
  [1, "Acopio y transporte", "Leche de productores, control inicial y transporte en cisterna"],
  [2, "Recepción y laboratorio", "Identificación, medición, muestreo, análisis y decisión de aceptación"],
  [3, "Clarificación y filtración", "Retiro de impurezas físicas"],
  [4, "Estandarización y homogeneización", "Ajuste de materia grasa y distribución uniforme"],
  [5, "Tratamiento térmico", "Pasteurización o UHT según producto"],
  [6, "Enfriamiento y envasado", "Llenado, sellado y codificación de lote"],
  [7, "Almacenamiento y despacho", "Conservación, preparación de pedidos y distribución"]
];

// [codigo, nombre, id_etapa (null = transversal), critico, cobertura_minima por día, competencia requerida]
const PUESTOS = [
  ["coordinador_acopio", "Coordinador de acopio", 1, 0, 0, "Planificación de rutas y guía de acopio"],
  ["conductor_cisterna", "Conductor de cisterna", 1, 0, 0, "Higiene y conservación en frío; guía de acopio"],
  ["operador_recepcion", "Operador de recepción", 2, 1, 1, "Identificación de cisternas, muestreo y uso del sistema"],
  ["analista_laboratorio", "Analista de laboratorio", 2, 1, 1, "Ensayos de plataforma: acidez, densidad, alcohol y antibióticos"],
  ["supervisor_calidad", "Supervisor de calidad", 2, 1, 1, "Criterios de aceptación y procedimiento de rechazo"],
  ["operador_clarificacion", "Operador de clarificación", 3, 1, 1, "Operación de clarificadora y filtros, limpieza y seguridad"],
  ["operador_estandarizacion", "Operador de estandarización", 4, 1, 1, "Ajuste de grasa, homogeneizador y dosificación"],
  ["operador_termico", "Operador térmico", 5, 1, 1, "Control de temperatura y tiempo; entrega de turno"],
  ["operario_envasado", "Operario de envasado", 6, 1, 1, "BPM, sellado y codificación de lote"],
  ["inspector_linea", "Inspector de línea", 6, 0, 0, "Inspección de sellado y codificación"],
  ["encargado_almacen", "Encargado de almacén", 7, 1, 1, "Control de lotes y rotación FEFO"],
  ["auxiliar_despacho", "Auxiliar de despacho", 7, 0, 0, "Preparación de pedidos por lote"],
  ["supervisor_produccion", "Supervisor de producción", null, 0, 0, "Liberación de leche a proceso y control de etapas 3 a 6"],
  ["tecnico_mantenimiento", "Técnico de mantenimiento", null, 0, 0, "Mantenimiento preventivo de equipos"],
  ["jefatura_planta", "Jefatura de planta", null, 0, 0, "Dirección de planta y rastreo de lotes"]
];

// [codigo, nombre, unidad, tipo, minimo, maximo, valor_aceptable, critico]
const PARAMETROS = [
  ["temperatura", "Temperatura de llegada", "°C", "rango", null, 10, null, 0],
  ["acidez", "Acidez (ácido láctico)", "%", "rango", 0.13, 0.17, null, 0],
  ["densidad", "Densidad", "g/ml", "rango", 1.030, 1.033, null, 0],
  ["grasa", "Materia grasa", "%", "rango", 3.0, null, null, 0],
  ["alcohol", "Prueba de alcohol", null, "cualitativo", null, null, "negativo", 1],
  ["antibioticos", "Residuos de antibióticos", null, "cualitativo", null, null, "ausencia", 1]
];

module.exports = { TABLAS, crearEsquema, ETAPAS, PUESTOS, PARAMETROS };
