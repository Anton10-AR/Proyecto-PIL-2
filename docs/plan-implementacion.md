# Plan de implementación — Sistema RR.HH. PIL Andina v2

Basado en el documento `10-02-Proyecto_RRHH_PIL_Andina.docx` del subgrupo de análisis y en las decisiones acordadas con el equipo de desarrollo.

## 1. Decisiones de alcance

### Generales
- 6 módulos: Personal; Asistencia, turnos, horarios, permisos y vacaciones; Capacitación; Evaluación del desempeño; Clima y comunicación interna; Reportes e indicadores.
- 4 roles: Trabajador, Supervisor, RRHH, Gerencia.
- Login real: contraseña con hash, sesión con token, rutas del backend protegidas por rol.
- Todo usuario es un trabajador (cuenta ligada a un registro de `trabajadores`). RRHH crea la cuenta al registrar al trabajador; la contraseña inicial es el CI y se exige cambiarla en el primer ingreso.
- Se pueden subir archivos PDF e imágenes (hasta 5 MB), descargables según el rol.

### M1. Gestión del personal
- Ficha con historial de actividad: asistencia, solicitudes, capacitaciones y evaluaciones (no hay auditoría de cambios).
- Visibilidad: Trabajador ve su ficha; Supervisor, la suya y la de su equipo directo; RRHH ve todo y edita; Gerencia ve todo en solo lectura.
- Búsqueda por texto libre más filtros de área, cargo y estado laboral.

### M2. Asistencia, turnos, permisos y vacaciones
- Turnos fijos definidos por RRHH (hora de inicio y fin, días laborables), asignados con fecha de vigencia. Sin rotaciones ni turnos nocturnos.
- Tolerancia de retraso global (10 min inicial), medida contra el inicio del turno asignado.
- El trabajador marca su entrada y salida con la hora del servidor; RRHH puede corregir. Marcar sin turno o en día no laborable se permite como "fuera de turno", sin retraso.
- Ausencias registradas manualmente por RRHH, como justificadas o injustificadas.
- Aprobación: supervisor directo → RRHH. Las solicitudes del personal de RRHH y de quienes no tienen supervisor las aprueba Gerencia en un paso; las de un gerente, otro gerente. Nadie aprueba su propia solicitud.
- El trabajador puede cancelar mientras RRHH (o Gerencia) no haya aprobado.
- Saldo de vacaciones según la Ley General del Trabajo: 15, 20 o 30 días hábiles (1–5, 5–10 y más de 10 años). La gestión corre por año de servicio desde `fecha_ingreso`; con menos de 1 año el saldo es 0; las solicitudes pendientes reservan días; los días no usados no se acumulan.
- Días hábiles = días laborables del turno, excluyendo feriados (tabla mantenida por RRHH).
- Catálogo de tipos de permiso editable por RRHH: días máximos por solicitud, límite anual opcional (por año calendario), si requiere respaldo y si es con goce de haber.
- Calendario mensual de vacaciones y permisos aprobados, filtrable por área.

### M3. Capacitación y desarrollo
- Capacitaciones como registros independientes (sin catálogo de cursos).
- Resultado por participante: asistencia, nota opcional de 0 a 100 y estado (aprobado, reprobado, no asistió); certificado adjunto si aprobó.
- RRHH gestiona; el supervisor propone o inscribe a su equipo; el trabajador consulta; Gerencia consulta.

### M4. Evaluación del desempeño
- Plantillas de RRHH con criterios ponderados (los pesos suman 100) y escala de 1 a 5; el resultado es el promedio ponderado.
- RRHH asigna evaluadores (por defecto, el supervisor directo). Sin autoevaluación.
- Períodos con apertura y cierre; al cerrarse, las evaluaciones no se editan.
- Retroalimentación en texto y plan de mejora con acciones (responsable, fecha límite, estado) que pueden vincularse a una capacitación. El trabajador confirma la lectura.

### M5. Clima organizacional y comunicación interna
- Encuestas anónimas: solo se registra que el trabajador respondió. Los resultados por área se muestran solo con 3 o más respuestas. Preguntas de escala 1–5, opción única y texto libre; con fechas de apertura y cierre y destinatarios por área.
- Buzón de sugerencias con anonimato opcional, categoría, estados (recibida, en revisión, atendida) y respuesta de RRHH.
- RRHH y Gerencia publican comunicados (a todos o por área). Notificaciones solo dentro de la aplicación.

### M6. Reportes e indicadores
- Días programados = días laborables del turno − feriados − días con vacación o permiso aprobados.
- Tasa de asistencia y de ausentismo sobre los días programados.
- Cumplimiento de capacitación = participantes aprobados / inscritos.
- Tiempo promedio de aprobación, desde la creación hasta la resolución final, en horas, con desglose por etapa.
- Evaluación promedio.
- Dashboard con gráficos filtrable por período y área; exportación a Excel, CSV y PDF.

### Requerimientos no funcionales
- RNF04: una marcación por trabajador y día; `fecha_fin >= fecha_inicio`; sin solicitudes activas solapadas; salida posterior a la entrada; un solo turno vigente por trabajador; CI y usuario únicos; CHECK en todos los estados.
- RNF06: respaldo manual descargable por RRHH (base de datos y adjuntos) y copia automática diaria que conserva las últimas 7. Sin restauración desde la aplicación.

## 2. Decisiones técnicas

| Necesidad | Solución |
|---|---|
| Hash de contraseñas | `node:crypto` (`scrypt` + sal) |
| Sesión | Token aleatorio en la tabla `sesiones` (se guarda su hash SHA-256), `Authorization: Bearer`, vencimiento de 8 h |
| Archivos | `multer` |
| Excel / PDF / ZIP | `exceljs` / `pdfkit` / `archiver` |
| Copia de la BD | `VACUUM INTO` |
| Navegación | `react-router` |
| Gráficos | `recharts` |
| Pruebas | `node --test`, solo para reglas de negocio |

La base de datos se recrea desde cero con `npm run seed`, que carga un usuario de prueba por rol. Los datos anteriores se descartan.

## 3. Matriz de permisos

| Módulo | Trabajador | Supervisor | RRHH | Gerencia |
|---|---|---|---|---|
| Personal | Su ficha | Su ficha y su equipo | Todo y edita; crea cuentas | Todo, solo lectura |
| Turnos, feriados, tipos de permiso, tolerancia | Ve su turno | Ve los de su equipo | Administra | Lectura |
| Asistencia | Marca la suya y la consulta | Consulta la de su equipo | Todo, corrige y registra ausencias | Lectura |
| Solicitudes | Crea, cancela y consulta las suyas | Las suyas, más el paso de supervisor de su equipo | Las suyas, más el paso de RRHH | Las suyas, más la aprobación única |
| Calendario | El suyo | Su equipo | Todo | Todo |
| Capacitación | Su historial y las disponibles | Propone a su equipo | Gestiona | Lectura |
| Evaluación | Las suyas, confirma lectura | Evalúa las asignadas | Plantillas, períodos, asignación | Lectura |
| Encuestas | Responde | Responde | Crea y ve resultados | Ve resultados |
| Sugerencias | Envía y ve las suyas | Envía y ve las suyas | Gestiona y responde | Lectura |
| Comunicados | Lee | Lee | Publica | Publica |
| Reportes | Sus indicadores | Su equipo | Empresa y exporta | Empresa y exporta |
| Respaldos | — | — | Manual y descarga | — |

El "equipo" de un supervisor son sus subordinados directos (`id_supervisor`).

## 4. Fases

Cada fase deja el sistema funcionando y termina en un commit en la rama `implementacion-v2`. El esquema de la base de datos crece en cada fase con las tablas de su módulo.

| Fase | Contenido |
|---|---|
| 0. Base | Usuarios, sesiones, login, middleware de roles, helper de visibilidad, notificaciones con campana, React Router y layout con menú por rol. Seed con un usuario por rol. |
| 1. Personal (M1) | Visibilidad por rol, filtros, creación de cuentas por RRHH, ficha con historial |
| 2. Asistencia (M2a) | Turnos y asignaciones, feriados, tolerancia, marcación propia, correcciones, ausencias |
| 3. Solicitudes (M2b) | Tipos de permiso, flujo de aprobación, saldo de vacaciones, respaldos adjuntos, calendario |
| 4. Capacitación (M3) | Capacitaciones, inscripción, resultados, certificados |
| 5. Evaluación (M4) | Plantillas, períodos, asignación, calificación, acciones de mejora |
| 6. Clima y comunicación (M5) | Encuestas anónimas, sugerencias, comunicados |
| 7. Reportes y respaldos (M6, RNF06) | Indicadores, dashboard, exportación, respaldos |
| 8. Cierre | Seed completo, actualización de `CLAUDE.md` y `README.md`, recorrido con cada rol |

## 5. Estado final y decisiones tomadas durante la implementación

Las 9 fases están completas en la rama `implementacion-v2` (un commit por fase).

| Fase | Commit |
|---|---|
| 0. Base | `1125f6e` |
| 1. Personal | `341f413` |
| 2. Asistencia | `7788c0e` |
| 3. Solicitudes | `1784bae` |
| 4. Capacitación | `e6c112c` |
| 5. Evaluación | `e2878aa` |
| 6. Clima y comunicación | `558d7a8` |
| 7. Reportes y respaldos | `2c81490` |
| 8. Cierre | este commit |

Decisiones no previstas en la sección 1 (conviene validarlas con el subgrupo de análisis). El detalle, con las preguntas para el subgrupo, está en [`decisiones-para-validar.md`](decisiones-para-validar.md):

- **Esquema:** crece por fase en lugar de definirse completo en la Fase 0.
- **Ausencias:** solo se registran en días laborables del turno, y una ausencia y una marcación del mismo día se excluyen mutuamente.
- **Vacaciones (LGT):** años cumplidos 1–4 → 15 días, 5–9 → 20, 10 o más → 30. Las vacaciones se piden desde hoy en adelante; los permisos, hasta 30 días después de ocurridos.
- **Supervisor sin cuenta activa:** si el supervisor directo no tiene una cuenta habilitada, la solicitud va a Gerencia para que no quede trabada.
- **Capacitación:** el supervisor *propone* participantes y RRHH confirma o descarta.
- **Evaluación:** cada evaluación guarda su propia plantilla (la del período es solo la sugerida). Categorías: 4,5 o más Sobresaliente; 3,5 Bueno; 2,5 Aceptable; menos, Necesita mejorar. Pueden evaluar los roles supervisor, RRHH y Gerencia.
- **Sugerencias anónimas:** tienen un código de seguimiento para que el autor vea la respuesta. Solo RRHH responde.
- **Indicadores:** la configuración `inicio_registros` evita contar días anteriores a la puesta en marcha del sistema. El día de hoy solo cuenta si ya tiene marcación o ausencia, y los días programados sin registro se informan aparte.
