// Servidor principal de la API REST del prototipo PIL Andina: proceso productivo (recepción y calidad,
// cobertura de puestos críticos) y su soporte organizacional de RRHH
const express = require("express");
const cors = require("cors");

require("./db/database"); // crea las tablas si no existen

const { autenticar, permitirRoles } = require("./middleware/auth");
const authRouter = require("./routes/auth");
const notificacionesRouter = require("./routes/notificaciones");
const trabajadoresRouter = require("./routes/trabajadores");
const asistenciaRouter = require("./routes/asistencia");
const ausenciasRouter = require("./routes/ausencias");
const turnosRouter = require("./routes/turnos");
const feriadosRouter = require("./routes/feriados");
const configuracionRouter = require("./routes/configuracion");
const tiposPermisoRouter = require("./routes/tiposPermiso");
const { router: archivosRouter } = require("./routes/archivos");
const capacitacionesRouter = require("./routes/capacitaciones");
const evaluacionesRouter = require("./routes/evaluaciones");
const encuestasRouter = require("./routes/encuestas");
const sugerenciasRouter = require("./routes/sugerencias");
const comunicadosRouter = require("./routes/comunicados");
const respaldosRouter = require("./routes/respaldos");
const { programarRespaldoDiario } = require("./utils/respaldos");
const solicitudesRouter = require("./routes/solicitudes");
const reportesRouter = require("./routes/reportes");
const recepcionRouter = require("./routes/recepcion");
const procesoRouter = require("./routes/proceso");
const almacenRouter = require("./routes/almacen");

const app = express();
const PORT = process.env.PORT || 3000;

// Content-Disposition expuesto para que el frontend lea el nombre de los archivos que descarga
app.use(cors({ exposedHeaders: ["Content-Disposition"] }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ mensaje: "API del prototipo PIL Andina funcionando" });
});

// Rutas públicas (login) y de sesión: cada una aplica autenticar() donde corresponde
app.use("/api/auth", authRouter);

// A partir de aquí todas las rutas exigen una sesión válida
app.use("/api", autenticar);

app.use("/api/notificaciones", notificacionesRouter);
// Proceso productivo: permisos según el puesto del trabajador en el proceso (utils/puestos.js)
app.use("/api/proceso", procesoRouter);
app.use("/api/recepcion", recepcionRouter);
app.use("/api/almacen", almacenRouter);
app.use("/api/trabajadores", trabajadoresRouter);
app.use("/api/asistencia", asistenciaRouter);
app.use("/api/ausencias", ausenciasRouter);
app.use("/api/turnos", turnosRouter);
app.use("/api/feriados", feriadosRouter);
app.use("/api/configuracion", configuracionRouter);
app.use("/api/tipos-permiso", tiposPermisoRouter);
app.use("/api/archivos", archivosRouter);
app.use("/api/capacitaciones", capacitacionesRouter);
app.use("/api/evaluaciones", evaluacionesRouter);
app.use("/api/encuestas", encuestasRouter);
app.use("/api/sugerencias", sugerenciasRouter);
app.use("/api/comunicados", comunicadosRouter);
app.use("/api/solicitudes", solicitudesRouter);
// Reportes: cada rol ve su alcance (empresa, equipo o propio); exportar es solo de RRHH y Gerencia
app.use("/api/reportes", reportesRouter);
app.use("/api/respaldos", permitirRoles("rrhh"), respaldosRouter);

// Errores no controlados: se registran en consola y se responde JSON (el frontend siempre espera JSON).
// Debe ir DESPUÉS de todas las rutas: Express solo pasa a este manejador los errores de las rutas anteriores.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  // Cuerpo JSON mal formado: es un error del cliente, no del servidor
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la solicitud no es un JSON válido" });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
  // Copia automática diaria (se puede desactivar con RESPALDO_AUTOMATICO=0, útil en pruebas)
  if (process.env.RESPALDO_AUTOMATICO !== "0") programarRespaldoDiario();
});
