# Sistema de RR.HH. PIL Andina — Backend

API REST con **Node.js + Express 5** y **SQLite nativo** (`node:sqlite`, sin ORM ni compiladores).

## Requisitos

- Node.js **22.5 o superior**. Node puede mostrar el aviso `ExperimentalWarning: SQLite is an experimental feature`; es normal.

## Comandos

```bash
npm install
npm start          # API en http://localhost:3000 (o PORT=xxxx npm start)
npm run seed       # recrea el esquema y carga datos de ejemplo (BORRA lo existente)
npm test           # pruebas de reglas de negocio con node --test
```

Variables de entorno opcionales:

| Variable | Uso |
|----------|-----|
| `PORT` | Puerto de la API (por defecto 3000) |
| `RESPALDO_AUTOMATICO=0` | Desactiva el respaldo automático diario (útil en pruebas) |

## Datos y archivos

| Ruta | Contenido |
|------|-----------|
| `pil_rrhh.db` | Base de datos SQLite (se crea sola al arrancar) |
| `uploads/` | Archivos adjuntos: respaldos de permisos y certificados |
| `respaldos/` | ZIP de respaldos manuales y automáticos |

Las tres rutas están ignoradas por git. Después de cambiar el esquema (`src/db/esquema.js`) hay que correr `npm run seed`, porque `CREATE TABLE IF NOT EXISTS` no modifica tablas ya existentes.

## Estructura

```
src/
├── server.js            # monta las rutas; /api/auth es pública, el resto exige sesión
├── seed.js              # datos de ejemplo (fechas relativas a hoy)
├── db/
│   ├── database.js      # conexión DatabaseSync
│   └── esquema.js       # única fuente del esquema (crearEsquema, TABLAS)
├── middleware/auth.js   # autenticar (token Bearer) y permitirRoles(...)
├── routes/              # una ruta por módulo, con SQL inline
└── utils/               # lógica compartida; las funciones puras tienen pruebas en test/
```

## Seguridad

- Contraseñas con `scrypt` y sal (`node:crypto`). Sesiones con token aleatorio; la base guarda solo su hash SHA-256 y vencen a las 8 h.
- La contraseña inicial es el CI y se exige cambiarla en el primer ingreso.
- La visibilidad por rol se aplica en el backend (`utils/visibilidad.js`): RRHH y Gerencia ven a todos, el supervisor a su equipo directo y el trabajador solo a sí mismo.

## Referencia de la API

Todas las rutas, salvo `POST /api/auth/login`, requieren la cabecera `Authorization: Bearer <token>`. Entre paréntesis se indican los roles restringidos; sin indicación, la ruta está abierta a todos con el alcance de su visibilidad.

| Recurso | Rutas principales |
|---------|-------------------|
| `/api/auth` | `POST /login`, `POST /logout`, `GET /yo`, `PUT /clave` |
| `/api/notificaciones` | `GET /`, `PUT /leidas`, `PUT /:id/leida` |
| `/api/trabajadores` | `GET /`, `GET /opciones`, `GET /:id` (ficha con historial); `POST`, `PUT /:id`, `DELETE /:id`, `POST\|PUT /:id/cuenta`, `POST /:id/cuenta/restablecer-clave` (RRHH) |
| `/api/turnos` | `GET /`, `GET /vigentes`, `GET /asignaciones`; `POST`, `PUT /:id`, `POST /asignaciones` (RRHH) |
| `/api/feriados`, `/api/configuracion` | `GET`; altas, bajas y cambios (RRHH) |
| `/api/asistencia` | `GET /`, `GET /hoy`, `POST /entrada`, `POST /salida`; `POST /` y `PUT /:id` (RRHH, con observación) |
| `/api/ausencias` | `GET /`; `POST`, `PUT /:id`, `DELETE /:id` (RRHH) |
| `/api/tipos-permiso` | `GET /`; `POST`, `PUT /:id` (RRHH) |
| `/api/solicitudes` | `GET /?alcance=mias\|bandeja\|todas`, `GET /saldo`, `GET /calcular`, `GET /calendario`, `GET /:id`, `POST /`, `POST /:id/decision`, `POST /:id/cancelar` |
| `/api/archivos` | `POST /` (multipart, campo `archivo`), `GET /:id` |
| `/api/capacitaciones` | `GET /`, `GET /mias`, `GET /:id`; `POST`, `PUT /:id`, `/cancelar`, `/finalizar`, `/participantes/:idp/resultado` (RRHH); `POST\|DELETE /:id/participantes` (RRHH y supervisor) |
| `/api/evaluaciones` | `/plantillas` y `/periodos` (RRHH; Gerencia consulta), `GET /?alcance=mias\|asignadas\|todas`, `GET\|PUT /:id`, `POST /:id/lectura`, `POST /:id/acciones`, `PUT\|DELETE /acciones/:id`, `GET /acciones/mias` |
| `/api/encuestas` | `GET /`, `GET /:id`, `POST /:id/responder`; `POST`, `PUT`, `DELETE`, `/publicar` (RRHH); `GET /:id/resultados` (RRHH y Gerencia) |
| `/api/sugerencias` | `POST /`, `GET /?alcance=mias\|todas`, `GET /seguimiento/:codigo`; `PUT /:id` (RRHH) |
| `/api/comunicados` | `GET /`; `POST`, `DELETE /:id` (RRHH y Gerencia) |
| `/api/reportes` | `GET /indicadores`; `GET /exportar/:tipo?formato=csv\|xlsx\|pdf` (RRHH y Gerencia) |
| `/api/respaldos` | `GET /`, `POST /`, `GET /:nombre` (RRHH) |

Las reglas de negocio de cada módulo se describen en el [`CLAUDE.md`](../CLAUDE.md) de la raíz y en [`docs/plan-implementacion.md`](../docs/plan-implementacion.md).
