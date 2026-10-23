# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repositorio

Prototipo académico (materia Diseño Organizacional y RRHH, SIS303, USFX) del **proceso productivo de leche líquida de PIL Andina**: recepción y control de calidad de leche cruda (punto crítico), producto terminado, almacén y despacho de pedidos por lote (etapas 6 y 7), cobertura de puestos críticos por etapa y, como soporte organizacional, los módulos de RRHH. Dos paquetes npm independientes sin workspace compartido: `pil-backend` (API) y `pil-frontend` (SPA). Parte del código de RRHH viene de `Proyecto-PIL` (versión anterior, solo RRHH).

**Enfoque (no perderlo):** el docente pidió que el proyecto se oriente al proceso industrial, no solo a RRHH. El "módulo de ventas" que pidió el equipo se resolvió como **pedidos y despacho** de la etapa 7, sin precios ni facturación (eso sería un ERP, fuera de alcance). El documento del proyecto es `docs/PIL-ANDINA-final-v3.docx` (secciones clave: 5 etapas, 6.1 flujo de recepción, 6.2 trazabilidad hasta el cliente, 7 diseño organizacional y matrices RACI, 9 alcance del prototipo). El v3 incorpora el módulo de almacén y despacho (cambios listados en `docs/actualizacion-documento-almacen.md`); `PIL-ANDINA-final-v2.docx` queda como versión anterior. El docente evalúa el enfoque organizacional; el código debe funcionar.

## Comandos

### Backend (`pil-backend/`)
```bash
npm install
npm start               # arranca la API en http://localhost:3000 (RESPALDO_AUTOMATICO=0 desactiva el respaldo diario)
npm run seed            # recrea el esquema desde cero y carga datos de ejemplo (imprime los usuarios de prueba)
npm test                # node --test: pruebas de reglas de negocio en test/
```
- Requiere Node.js v22.5+ (usa el módulo nativo `node:sqlite`, sin dependencias de compilación).
- No hay linter configurado en el backend.
- Usuarios de prueba (contraseña inicial = CI; la tabla completa está en el README de la raíz). Recepción: `mtorrez`/`scondori` (operador de recepción), `dflores`/`rchoque` (analista), `lmamani` (supervisor de calidad, rol supervisor). RRHH: `efernandez` (rrhh), `jsalinas` (gerencia), `arojas` (supervisora de producción), `pramos` (tiene permiso hoy: etapa 3 descubierta), `mlopez` (operaria de envasado, cambio de clave obligatorio). Almacén y despacho: `raguilar` (encargado de almacén), `gtorrico` (atención de pedidos), `wcruz` (auxiliar de despacho); para envasar sin cambiar clave, `arojas` (supervisión de producción). El seed usa fechas relativas a hoy, así que los datos de ejemplo siguen siendo coherentes cualquier día que se corra.
- La base de datos vive en `pil-backend/pil_rrhh.db` (SQLite, se crea sola al arrancar).

### Frontend (`pil-frontend/`)
```bash
npm install
npm run dev       # Vite dev server, http://localhost:5173
npm run build     # build de producción
npm run lint      # oxlint
npm run preview   # sirve el build
```
- El frontend asume que el backend ya está corriendo en `http://localhost:3000` (URL hardcodeada en `src/api/cliente.js`, sin variables de entorno).
- No hay test runner configurado en el frontend. Las pruebas de navegador usadas durante el desarrollo (Playwright con el Chrome instalado) no forman parte del repositorio.

## Arquitectura

Dos ejes de permisos:
- **Rol** (`usuarios.rol`: trabajador, supervisor, rrhh, gerencia): módulos de RRHH, con `permitirRoles()` y `utils/visibilidad.js`.
- **Puesto en el proceso** (`trabajadores.id_puesto` → `puestos_proceso.codigo`): módulos de Recepción y de Almacén y despacho, con `permitirAccion(accion, matriz)` de `utils/puestos.js`. Cada matriz es una RACI aplicada:
  - `PUESTOS_POR_ACCION` (recepción, matriz por defecto): registrar (operador de recepción y supervisor de calidad), analizar (solo analista), decidir y administrar parámetros (solo supervisor de calidad), consultar (puestos de recepción, supervisión de producción, jefatura y el rol gerencia). Quien analizó una muestra no puede decidir sobre ella.
  - `PUESTOS_ALMACEN`: envasar (operario de envasado y supervisión de producción), recibir y ajustar stock (encargado de almacén), pedir (ejecutivo de atención de pedidos), despachar (encargado de almacén y auxiliar de despacho), devolver (encargado de almacén), productos (supervisión de producción), clientes (atención de pedidos), consultar (puestos de etapas 6 y 7, supervisión de producción, supervisor de calidad, jefatura y el rol gerencia). Quien registró un lote no lo recibe y quien registró un pedido no lo despacha.
  - `/auth/yo` devuelve `puesto`, `permisos_recepcion`, `permisos_almacen` y `ve_proceso` para que el frontend arme el menú.

Evaluación del desempeño y Clima/Comunicación están fuera del alcance (versiones futuras): sus rutas del backend y sus componentes siguen en el repo, pero el frontend no los enruta. `docs/plan-implementacion.md` describe la versión anterior (solo RRHH) y sigue valiendo para los módulos de RRHH.

### Proceso productivo (lo nuevo de esta versión)
- Catálogo fijo en `db/esquema.js` (`ETAPAS`, `PUESTOS`, `PARAMETROS`, insertados con `INSERT OR IGNORE` en `crearEsquema`): 7 `etapas_proceso`, 16 `puestos_proceso` (crítico + `cobertura_minima` por día) y 6 `parametros_calidad`. `configuracion.dias_operacion_planta` (ISO, por defecto lunes a sábado) define los días en que se exige cobertura.
- Recepción (`routes/recepcion.js`, reglas puras con pruebas en `utils/recepcion.js`): `ingresos_leche` (estado `en_analisis → por_decidir → aceptado | derivado | rechazado`), `analisis_leche` (1 por ingreso; guarda `sugerencia` y `observaciones` JSON evaluadas con los parámetros vigentes en ese momento), `decisiones_leche` (1 por ingreso, no se modifica; genera `codigo_lote` LR-AAAAMMDD-NN para aceptado/derivado), descarga en `ingresos_leche.fecha_hora_descarga`. Regla de sugerencia (`evaluarMuestra`): algún parámetro crítico fuera de norma → rechazar; solo no críticos → derivar; todo en norma → aceptar. Motivo obligatorio si no se acepta o si la decisión se aparta de la sugerencia.
- Correcciones de ingreso y análisis solo antes de la decisión, con motivo; cada campo cambiado va a `bitacora_recepcion` (también los cambios de parámetros). Cambiar la temperatura de un ingreso analizado recalcula la sugerencia.
- Cobertura (`utils/cobertura.js`, `routes/proceso.js`): por puesto crítico y fecha, la situación de cada persona (presente, programado, vacación, permiso, ausente, sin registro, en riesgo por solicitud pendiente) sale de `jornadaDelDia`, `solicitudAprobadaEn`, `asistencia` y `ausencias`. Estados: cubierto, por_confirmar (hoy), planificado (futuro), en_riesgo, descubierto, sin_operacion. `indicadoresCobertura` = días-puesto cubiertos ÷ requeridos desde `inicio_registros`; capacitación vigente = capacitación aprobada en los últimos 365 días. `impactoSolicitud` lista los días en que aprobar una solicitud dejaría el puesto crítico bajo su mínimo (se muestra en `DetalleSolicitud`).
- Notificaciones por puesto: `notificarPuestos()` (nuevo ingreso → analistas; análisis → supervisor de calidad; rechazo → coordinador de acopio y jefatura; lote envasado → encargado de almacén; pedido nuevo o cancelado → almacén y auxiliar de despacho; devolución → supervisor de calidad y jefatura).
- Almacén y despacho (`routes/almacen.js` en `/api/almacen`, `routes/pedidos.js` en `/api/pedidos`; reglas puras con pruebas en `utils/inventario.js`): sin precios ni facturación.
  - `lotes_producto` (`LP-AAAAMMDD-NN`, estado `registrado → en_almacen`): envasado lo registra con sus lotes de recepción de origen (`lote_producto_origen`: solo leche aceptada y descargada en los 2 días previos, y el lote no puede superar sus litros); el encargado de almacén lo recibe confirmando unidades (si faltan, observación obligatoria). Vencimiento = elaboración + `productos.vida_util_dias`; "por vencer" = queda ≤ 25 % de la vida útil.
  - Stock = suma de `movimientos_inventario` (ingreso +, despacho −, ajuste ± con motivo); no se guarda aparte.
  - `pedidos` (`PED-…`, `pendiente → despachado | cancelado`) con `pedido_items` (solo cantidades). Se despacha completo en un `despachos` por pedido: el sistema propone lotes por FEFO (`proponerFEFO`); otros lotes se validan con `errorAsignacion` y, si no coinciden con la propuesta, exigen motivo (`coincide_fefo = 0`). Sin stock suficiente, el pedido sigue pendiente.
  - `devoluciones` por lote despachado, con motivo; no vuelven al stock.
  - Trazabilidad hacia adelante en `utils/trazabilidad.js`: `/recepcion/trazabilidad` (LR-, ING-) incluye `destino` (lotes de producto y clientes) y `/almacen/trazabilidad` (LP-) rastrea hacia atrás. La pantalla es una sola y elige el endpoint por el prefijo.
  - Indicadores de la etapa 7 (`calcularIndicadoresDespacho`, `/almacen/indicadores`): despachos con lote, FEFO, a tiempo, devoluciones, faltantes y mermas, con 2 decimales.
- Los códigos correlativos por día (ING-, LR-, LP-, PED-) salen de `siguienteCodigo()` en `utils/codigos.js`.

### Backend: Express + node:sqlite, sin capa de modelos
- `src/server.js` monta `/api/auth` (público) y luego aplica `autenticar` a todo `/api/*` antes de los demás routers.
- `src/db/esquema.js` es la única fuente de esquema (`crearEsquema(db)` y la lista `TABLAS`); `src/db/database.js` abre la conexión con `DatabaseSync` (API nativa de Node, no better-sqlite3 ni un ORM), la aplica y exporta la instancia `db` directamente — los routers llaman `db.prepare(...).get/all/run(...)` sin capa de repositorio/modelo intermedia. Como `CREATE TABLE IF NOT EXISTS` no altera tablas existentes, tras cambiar el esquema hay que correr `npm run seed`, que borra y recrea todas las tablas de `TABLAS`.
- Autenticación (`src/middleware/auth.js`): token opaco `Bearer`, del que solo se guarda el hash SHA-256 en `sesiones` (vence a las 8 h). `autenticar` deja en `req.usuario` la cuenta junto con los datos del trabajador, y bloquea con 403 `CAMBIAR_CLAVE` todo excepto `/api/auth/*` mientras `debe_cambiar_clave = 1`. `permitirRoles(...)` restringe por rol. Las contraseñas usan `scrypt` de `node:crypto` (`src/utils/claves.js`).
- Visibilidad por rol: `src/utils/visibilidad.js` (`idsVisibles`, `puedeVerTrabajador`, `filtroVisibilidad`). RRHH y Gerencia ven todo, el supervisor ve a sí mismo y a su equipo directo (`id_supervisor`), y el trabajador solo a sí mismo. Las rutas deben filtrar con este helper, no con lógica propia.
- Notificaciones: `src/utils/notificar.js` (`notificarTrabajador`, `notificarRol`, `notificarUsuario`). Los módulos lo llaman cuando ocurre algo que el usuario debe saber.
- Cada archivo en `src/routes/` es autocontenido: valida el body a mano, consulta SQL inline, y devuelve JSON. Solo la lógica compartida entre módulos va a `src/utils/`.
- Reportes (`routes/reportes.js`): son una vista agregada, sin tabla propia.
  - `utils/indicadores.js` calcula los 5 indicadores del documento para un rango y área, con el alcance del rol (empresa, equipo o propio, vía `idsVisibles`).
  - **Días programados** = laborables del turno − feriados − días con solicitud aprobada. No cuentan los días anteriores a `configuracion.inicio_registros`, ni los futuros; el día de hoy solo cuenta si ya tiene marcación o ausencia. Los días programados sin marcación ni ausencia se informan como "sin registro".
  - Exportan solo RRHH y Gerencia (`/reportes/exportar/:tipo?formato=csv|xlsx|pdf`): `utils/exportar.js` genera Excel con exceljs y PDF con pdfkit, y el CSV usa `;` con BOM (`utils/estadistica.js`). CORS expone `Content-Disposition` para que el frontend use el nombre de archivo del servidor.
- Respaldos (`utils/respaldos.js` y `routes/respaldos.js`, solo RRHH): ZIP con `VACUUM INTO` de la base, `uploads/` y un LEEME, guardado en `pil-backend/respaldos/` (ignorado por git).
  - Hay uno automático por día, al arrancar y verificado cada hora, y se conservan los últimos 7; los manuales se conservan todos.
  - `RESPALDO_AUTOMATICO=0` desactiva la copia automática (útil en pruebas).
  - No hay restauración desde la app.
- Fechas y horas viajan como strings `YYYY-MM-DD` y `HH:MM` (24 h), en la hora local del servidor (se asume la zona de la empresa, America/La_Paz). Comparar estos strings lexicográficamente es válido. Las utilidades puras están en `src/utils/fechas.js` (`hoyLocal`, `calcularHoras`, `calcularRetraso`, `diaSemana` ISO, etc.) y tienen pruebas. Las marcas de tiempo visibles al usuario se guardan con `datetime('now', 'localtime')`; solo `sesiones.expira` está en UTC.
- Reglas de jornada (`src/utils/jornada.js`): `jornadaDelDia(idTrabajador, fecha)` devuelve el turno vigente (de `asignaciones_turno`), si es feriado y si el día es laborable. El retraso se mide contra `turno.hora_inicio`: dentro de la tolerancia global (`configuracion.tolerancia_minutos`) vale 0, y pasada la tolerancia cuentan todos los minutos. Si el día no es laborable, la marcación queda "fuera de turno" (`id_turno` y `minutos_retraso` en NULL). No hay turnos que crucen la medianoche.
- Asistencia: el trabajador marca su propia entrada y salida con la hora del servidor (`POST /asistencia/entrada|salida`). RRHH registra o corrige marcaciones siempre con una `observacion` obligatoria, y registra las ausencias a mano: solo en días laborables y sin marcación ese día. Una marcación y una ausencia del mismo día se excluyen mutuamente.
- Solicitudes (`routes/solicitudes.js` + reglas compartidas en `utils/solicitudes.js`):
  - Las crea solo el propio trabajador. Los días se cuentan en **días hábiles** del turno, sin feriados (`diasHabilesEntre`).
  - Flujo de estados: `pendiente_supervisor → pendiente_rrhh → aprobado`. Las del personal de RRHH, de Gerencia o de quien no tiene un supervisor activo con cuenta habilitada van a `pendiente_gerencia → aprobado`, en un paso (`estadoInicial`). Cualquier pendiente puede pasar a `rechazado` (con comentario obligatorio) o a `cancelado` (solo el propio trabajador).
  - Nadie decide su propia solicitud, y la etapa de RRHH no la puede decidir quien aprobó como supervisor (`motivoNoPuedeDecidir`). Cada decisión queda en `aprobaciones_solicitud`.
  - Vacaciones: derecho según la LGT por año de servicio (`utils/vacaciones.js`, función pura con pruebas). La solicitud guarda su `gestion_inicio`; las pendientes reservan saldo y los días no usados no se acumulan.
  - Permisos: el catálogo `tipos_permiso` define el máximo por solicitud, un límite anual opcional por año calendario y si el respaldo es obligatorio.
  - Un día con una solicitud aprobada bloquea la marcación y el registro de ausencias. A la inversa, no se puede pedir una solicitud sobre días que ya tienen marcación o ausencia.
- Capacitación (`routes/capacitaciones.js`):
  - Las capacitaciones son registros independientes, sin catálogo de cursos. En BD se guardan como `programada`, `finalizada` o `cancelada`. El backend deriva `estado_actual` (`en_curso` o `por_cerrar` según las fechas): no se guarda.
  - Participantes: RRHH inscribe directamente, respetando el cupo. El supervisor solo propone a su equipo directo y antes de que empiece (`propuesto`); RRHH confirma (`inscrito`) o descarta (`rechazado`).
  - Resultados: solo para inscritos y desde la fecha de inicio. Se registra `aprobado`, `reprobado` o `no_asistio` (este último fuerza 0 % de asistencia). El certificado solo se adjunta a los aprobados.
  - Finalizar exige que no haya propuestas pendientes y que todos los inscritos tengan resultado. Los resultados pueden corregirse después de finalizar.
- Evaluación del desempeño (`routes/evaluaciones.js` + reglas puras en `utils/evaluacion.js`, con pruebas):
  - Plantillas con criterios cuyos pesos enteros suman 100. Cada criterio se califica de 1 a 5 y el puntaje final es el promedio ponderado (`calcularPuntaje`). La categoría (`categoriaPuntaje`) va de "Sobresaliente" a "Necesita mejorar". Una plantilla ya usada no permite cambiar sus criterios.
  - Períodos `abierto`/`cerrado`. Al asignar, el evaluador por defecto es la cuenta del supervisor directo (`evaluadorPorDefecto`); si no hay, queda NULL y RRHH lo asigna después. Cada evaluación guarda su `id_plantilla`.
  - El evaluador puede guardar un borrador o completar; completar exige todos los criterios y la retroalimentación. El evaluado solo ve su evaluación una vez completada, y ni RRHH ni Gerencia ven la propia mientras está pendiente.
  - Plan de mejora (`acciones_mejora`): lo gestionan el evaluador, con el período abierto, o RRHH. El responsable puede actualizar el avance.
- Clima y comunicación (`routes/encuestas.js`, `routes/sugerencias.js`, `routes/comunicados.js`):
  - **Anonimato de encuestas:** no se debe romper. Quién respondió (`encuesta_respondida`) y qué respondió (`envios_encuesta` con UUID aleatorio, y `respuestas_encuesta`) están en tablas separadas `WITHOUT ROWID` y sin fechas, para que el orden de inserción no permita emparejarlos. No agregar timestamps, autoincrementales ni columnas que vinculen un envío con un trabajador.
  - Los resultados de un grupo (toda la empresa o un área) se muestran solo con al menos `MINIMO_RESPUESTAS` (3) envíos; las respuestas de texto se ordenan alfabéticamente (`utils/encuestas.js`, con pruebas).
  - Encuestas: `borrador → publicada`. Solo el borrador se edita o elimina. `estado_actual` (`proxima`, `abierta` o `cerrada`) se deriva de las fechas. Sin filas en `encuesta_areas` significa toda la empresa; lo mismo vale para `comunicado_areas`.
  - Sugerencias anónimas: `id_trabajador` NULL y un `codigo_seguimiento` que se muestra una sola vez al enviarla. Solo guardan la fecha, sin hora.
  - `notificarAreas()` (`utils/notificar.js`) avisa a los destinatarios de comunicados y encuestas.
- Archivos (`routes/archivos.js`, con `multer`): PDF o imágenes de hasta 5 MB, guardados en `pil-backend/uploads/` (ignorado por git). Solo los ve quien los subió o quien puede ver al trabajador dueño, según `REFERENCIAS`; cada módulo que adjunte archivos debe agregar ahí su consulta. Para asociar un archivo recién subido se valida con `errorArchivoParaAsociar()`: debe haberlo subido el mismo usuario y no estar en uso. El seed vacía esa carpeta.
- `server.js` termina con un manejador de errores que responde JSON 500: el frontend siempre espera JSON.
- La baja de trabajador es lógica (`estado = 'inactivo'`), nunca se borra la fila — casi todas las tablas tienen FK hacia `trabajadores`. Un trabajador inactivo no puede iniciar sesión (`autenticar` lo verifica).

### Frontend: React 19 + Vite + React Router, sin gestor de estado global
- Rutas con `react-router` (modo declarativo, `BrowserRouter` en `main.jsx`). `src/navegacion.js` define `MENU`: ruta, etiqueta, `roles` permitidos **o** `acceso(usuario)` (módulos del proceso, según `permisos_recepcion`/`permisos_almacen`/`ve_proceso`) y componente; `puedeVer()` decide, y `RutaProtegida` recibe ambos. `App.jsx` genera las rutas a partir de `MENU` y `Layout` arma el menú lateral filtrado por rol. Para agregar una pantalla, se agrega una entrada a `MENU`; las subpáginas (ej. `/personal/:id`) llevan `enMenu: false`. El campo `grupo` define el subtítulo del menú lateral (`menuAgrupado`). Las páginas pesadas (Reportes, que usa recharts) se cargan con `React.lazy`; `Layout` las envuelve en `Suspense`. Los gráficos usan los 3 primeros colores de la paleta categórica de referencia (validados) y siempre ofrecen una vista de tabla. Los componentes de un módulo con varias pantallas van en su propia carpeta (ej. `components/personal/`).
- Identidad visual: los colores son variables CSS en `src/index.css` (paleta "Leche y cielo", con bloques para `data-tema="oscuro"` y `data-contraste="alto"`); `App.css` solo usa `var(--…)`, nunca colores fijos. Las preferencias (`src/preferencias.js`, `contexto/PreferenciasProvider.jsx`, página `/preferencias`) se guardan en localStorage y se aplican como `data-tema`, `data-texto`, `data-contraste`, `data-subrayar` y `data-movimiento` en `<html>`; `index.html` repite esa lógica en un script en línea para evitar el parpadeo. Como todo el CSS usa rem, el tamaño de texto escala la raíz. recharts no acepta variables: los gráficos eligen sus colores con `usePreferencias().tema`. Fuente Atkinson Hyperlegible desde `@fontsource`; logo en `public/logo-pil.png`.
- Menú lateral (`Layout.jsx`): grupos plegables con `aria-expanded`, más el grupo fijo "Mi cuenta" (preferencias y cambio de contraseña). El grupo de la ruta actual se abre solo; los grupos abiertos y el menú contraído se guardan en localStorage (`pil-menu`).
- `RutaProtegida` redirige a `/login` sin sesión, fuerza `/cambiar-clave` si `debe_cambiar_clave`, y valida los roles.
- Sesión: `contexto/AuthProvider.jsx` + `useAuth()`, con `useContext`, sin Redux. El token se guarda en `localStorage`.
- `src/api/` tiene un archivo por módulo. Todos usan `peticion()` de `src/api/cliente.js`, que agrega el token, lanza un `Error` con el mensaje del backend si `res.ok` es falso y emite `EVENTO_SESION_EXPIRADA` ante un 401. Si `cuerpo` es un `FormData` se envía tal cual (para subir archivos). Los archivos protegidos se abren con `abrirArchivo()` o se bajan con `descargarArchivo()`, porque un `<a href>` no lleva el token. Los componentes llaman estas funciones directamente y manejan su propio estado de carga y error con hooks locales.
- `src/paginas/` contiene las pantallas propias del shell (Login, Inicio, CambiarClave); `src/components/` contiene los módulos y piezas comunes (Layout, Campana, RutaProtegida).

## Nomenclatura

El código (variables, campos de BD, mensajes de error, comentarios) está en español porque el dominio y el equipo lo están. Mantener ese idioma al extender rutas, componentes o el esquema — no mezclar con nombres en inglés a mitad de un módulo existente.
