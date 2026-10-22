# Decisiones de implementación para validar — Sistema de RR.HH. PIL Andina

6 de octubre de 2026

> Copia en el repositorio del documento compartido con el subgrupo de análisis. Las validaciones se registran en el documento compartido; al aplicar los cambios se actualiza también esta copia.

## Propósito

El sistema ya implementa los 6 módulos y los 4 roles del documento *10-02-Proyecto_RRHH_PIL_Andina*. Para hacerlo, el equipo de desarrollo tomó **15 decisiones** que el documento no definía; necesitamos que el subgrupo de análisis las confirme o las corrija.

Cómo responder: marque cada decisión en la columna **Validación** de la tabla resumen y deje un comentario sobre la decisión que quiera cambiar, indicando el valor o la regla correcta. Las decisiones de prioridad **Alta** afectan cálculos o normativa y conviene revisarlas primero.

## Resumen

Tres decisiones tienen prioridad alta porque afectan cálculos que ven los trabajadores: el saldo de vacaciones (D1), los límites de los permisos (D4) y cómo se cuentan los días sin registro (D8).

| # | Decisión | Módulo | Prioridad | Validación |
| --- | --- | --- | --- | --- |
| D1 | Días de vacación según años de servicio cumplidos | Permisos y vacaciones | Alta | Pendiente |
| D2 | Fechas permitidas para pedir vacaciones y permisos | Permisos y vacaciones | Media | Pendiente |
| D3 | Sin supervisor activo, la solicitud va a Gerencia | Permisos y vacaciones | Media | Pendiente |
| D4 | Valores de los tipos de permiso | Permisos y vacaciones | Alta | Pendiente |
| D5 | Solicitudes, marcaciones y ausencias se excluyen | Permisos y vacaciones | Baja | Pendiente |
| D6 | Ausencias solo en días laborables del turno | Asistencia | Media | Pendiente |
| D7 | Fecha de inicio de registros para los indicadores | Reportes | Media | Pendiente |
| D8 | Días sin marcación ni ausencia se informan aparte | Reportes | Alta | Pendiente |
| D9 | El supervisor propone participantes; RRHH confirma | Capacitación | Media | Pendiente |
| D10 | Cada evaluación guarda su propia plantilla | Evaluación | Baja | Pendiente |
| D11 | Umbrales de las categorías del puntaje | Evaluación | Media | Pendiente |
| D12 | Quién puede evaluar y cuándo se ve la evaluación | Evaluación | Baja | Pendiente |
| D13 | Código de seguimiento para sugerencias anónimas | Clima y comunicación | Baja | Pendiente |
| D14 | Solo RRHH responde sugerencias | Clima y comunicación | Baja | Pendiente |
| D15 | Mínimo de 3 respuestas para mostrar resultados | Clima y comunicación | Media | Pendiente |

## Permisos y vacaciones

### D1. Días de vacación según años de servicio

El saldo se calcula por **años cumplidos** desde la fecha de ingreso, interpretando la Ley General del Trabajo así:

| Años cumplidos | Días hábiles por gestión |
| --- | --- |
| Menos de 1 | 0 |
| 1 a 4 | 15 |
| 5 a 9 | 20 |
| 10 o más | 30 |

La gestión va de aniversario a aniversario. Las solicitudes pendientes reservan días y los días no usados no se acumulan.

**Pregunta:** ¿el tramo "de 1 a 5 años" de la ley incluye el quinto año en 15 días, o desde el quinto año ya corresponden 20?

### D2. Fechas permitidas

- Las vacaciones solo se piden desde hoy en adelante.
- Un permiso se puede pedir hasta **30 días después** de ocurrido (por ejemplo, un permiso médico con certificado).
- Una solicitud abarca como máximo 120 días corridos.

**Pregunta:** ¿es razonable el plazo de 30 días para permisos retroactivos?

### D3. Solicitudes sin supervisor activo

Si el supervisor directo está dado de baja o no tiene una cuenta habilitada, la solicitud va a **Gerencia** en un solo paso, igual que las del personal de RRHH. Así ninguna solicitud queda sin alguien que pueda decidirla.

### D4. Valores de los tipos de permiso

El documento pide tipos de permiso con reglas propias, pero no define los valores. Cargamos estos ejemplos, que RRHH puede cambiar desde Configuración:

| Tipo | Máximo por solicitud | Límite anual | Respaldo | Con goce |
| --- | --- | --- | --- | --- |
| Médico | 3 días | Sin límite | Obligatorio | Sí |
| Personal | 1 día | 3 días | No | No |
| Duelo | 3 días | Sin límite | Obligatorio | Sí |
| Matrimonio | 3 días | Sin límite | Obligatorio | Sí |
| Maternidad | 90 días | Sin límite | Obligatorio | Sí |
| Paternidad | 3 días | Sin límite | Obligatorio | Sí |
| Estudios | 1 día | 5 días | Obligatorio | Sí |

**Pregunta:** ¿cuáles son los tipos y valores reales que aplica PIL Andina según la normativa y su reglamento interno?

### D5. Solicitudes, marcaciones y ausencias se excluyen

Un día con una vacación o un permiso aprobado no admite marcación de asistencia ni registro de ausencia. Tampoco se puede pedir una solicitud para días que ya tienen marcación o ausencia.

## Asistencia e indicadores

### D6. Ausencias solo en días laborables

RRHH solo puede registrar una ausencia en un día laborable del turno del trabajador, que no sea feriado y que no tenga marcación. Una marcación y una ausencia del mismo día se excluyen.

### D7. Fecha de inicio de registros

Los indicadores no cuentan como programados los días anteriores a la puesta en marcha del sistema. Sin esta fecha, un reporte anual mostraba 4,2 % de asistencia porque los meses previos no tenían marcaciones. RRHH la ajusta en Configuración.

### D8. Días sin registro

Como las ausencias las registra RRHH a mano, un día programado sin marcación ni ausencia **no se cuenta como ausencia**: se informa aparte como "sin registro". Además, el día de hoy solo cuenta si ya tiene marcación o ausencia, y los días futuros no cuentan.

Efecto: la tasa de ausentismo puede quedar baja si RRHH no registra las ausencias a tiempo.

**Pregunta:** ¿los días sin registro deberían contarse automáticamente como ausencias injustificadas pasado cierto plazo (por ejemplo, 2 días)?

## Capacitación y evaluación del desempeño

### D9. El supervisor propone, RRHH confirma

El supervisor no inscribe directamente: **propone** a miembros de su equipo antes de que empiece la capacitación, y RRHH confirma o descarta cada propuesta respetando el cupo. Lo interpretamos así de la opción "RRHH gestiona, el supervisor propone".

**Pregunta:** ¿el supervisor debería poder inscribir sin confirmación de RRHH?

### D10. Plantilla por evaluación

Cada evaluación guarda su propia plantilla; la del período es solo la sugerida al asignar. Así, en un mismo período el personal de planta y el administrativo se evalúan con criterios distintos.

### D11. Categorías del puntaje

El puntaje final (escala 1 a 5) se traduce en una categoría con estos umbrales, que definimos nosotros:

| Puntaje | Categoría |
| --- | --- |
| 4,5 a 5 | Sobresaliente |
| 3,5 a 4,49 | Bueno |
| 2,5 a 3,49 | Aceptable |
| Menos de 2,5 | Necesita mejorar |

**Pregunta:** ¿estos umbrales y nombres coinciden con los que usa RRHH de PIL Andina?

### D12. Quién evalúa y cuándo se ve

- Solo pueden ser evaluadores los usuarios con rol de supervisor, RRHH o Gerencia. Por defecto evalúa el supervisor directo.
- El trabajador ve su evaluación recién cuando el evaluador la completa. Nadie ve su propia evaluación pendiente, ni siquiera RRHH o Gerencia.

## Clima y comunicación

### D13. Código de seguimiento para sugerencias anónimas

Una sugerencia anónima no guarda autor, área ni hora, solo la fecha. Para que quien la envió pueda ver el estado y la respuesta, el sistema le muestra **una sola vez** un código de seguimiento de 8 caracteres. Si lo pierde, no hay forma de recuperarlo.

### D14. Solo RRHH responde sugerencias

RRHH cambia el estado (recibida, en revisión, atendida) y responde; para marcarla como atendida hace falta una respuesta. Gerencia solo consulta.

**Pregunta:** ¿Gerencia también debería poder responder?

### D15. Mínimo de respuestas en las encuestas

- Los resultados de un grupo (toda la empresa o un área) solo se muestran con **3 o más respuestas**.
- Las respuestas de texto se muestran en orden alfabético, no en el orden de llegada.
- El sistema registra *que* una persona respondió (para evitar duplicados), pero no *qué* respondió: ambas cosas se guardan por separado y no pueden relacionarse.

**Pregunta:** en áreas chicas, ¿conviene subir el mínimo a 5 para proteger mejor el anonimato?

## Ya acordado con el equipo de desarrollo

Estas decisiones se tomaron antes de implementar y no requieren validación; se listan como referencia.

| Módulo | Decisión |
| --- | --- |
| General | 4 roles; login con usuario y contraseña; RRHH crea las cuentas; la contraseña inicial es el CI y se cambia en el primer ingreso |
| Personal | Cada rol ve según jerarquía; el historial es de actividad, sin registro de cambios |
| Asistencia | Turnos fijos asignados por RRHH, sin turnos nocturnos; tolerancia de retraso global (10 min); el trabajador marca su asistencia; RRHH registra ausencias |
| Permisos y vacaciones | Supervisor y luego RRHH; Gerencia aprueba en un paso al personal de RRHH; cancelación mientras esté pendiente; días hábiles según turno y feriados |
| Capacitación | Capacitaciones independientes, sin catálogo de cursos; resultado con asistencia, nota y estado |
| Evaluación | Plantillas con pesos, escala 1 a 5, períodos con cierre, plan de mejora con seguimiento |
| Clima y comunicación | Encuestas anónimas; sugerencias con anonimato opcional; notificaciones solo dentro de la app |
| Reportes | Dashboard y exportación a Excel, CSV y PDF; respaldo manual y automático diario |

## Próximos pasos

- [ ] El subgrupo de análisis marca cada decisión en la tabla resumen y comenta las que deban cambiar.
- [ ] El equipo de desarrollo aplica los cambios marcados como "Cambiar".
- [ ] Revisión conjunta del sistema con los usuarios de prueba.

El código está en la rama `main` del repositorio `Anton10-AR/Proyecto-PIL`. Las instrucciones para levantarlo y los usuarios de prueba de cada rol están en el README de la raíz.
