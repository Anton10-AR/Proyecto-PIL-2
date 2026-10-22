// Bandeja de aprobación (solicitudes que esperan una decisión del usuario) y consulta de las
// solicitudes de los trabajadores visibles (supervisor: su equipo; RRHH y Gerencia: todos).
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import { listarSolicitudes } from "../../api/solicitudes";
import { listarTrabajadores } from "../../api/trabajadores";
import TablaSolicitudes from "./TablaSolicitudes";
import { ESTADOS_SOLICITUD } from "../../formato";

const AYUDA_ETAPA = {
  supervisor: "Como supervisor, decide la primera etapa de las solicitudes de su equipo; después pasan a RRHH.",
  rrhh: "RRHH decide la segunda etapa, después de la aprobación del supervisor.",
  gerencia: "Gerencia decide en un solo paso las solicitudes del personal de RRHH, de quienes no tienen supervisor y de otros gerentes."
};

export default function BandejaSolicitudes() {
  const { usuario } = useAuth();
  const [pestana, setPestana] = useState("bandeja");
  const [pendientes, setPendientes] = useState([]);
  const [todas, setTodas] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [filtros, setFiltros] = useState({ estado: "", tipo: "", trabajador: "" });
  const [mensaje, setMensaje] = useState("");

  const cargarPendientes = useCallback(() => {
    listarSolicitudes({ alcance: "bandeja" }).then(setPendientes).catch((err) => setMensaje(err.message));
  }, []);

  const cargarTodas = useCallback(() => {
    listarSolicitudes({ alcance: "todas", ...filtros }).then(setTodas).catch((err) => setMensaje(err.message));
  }, [filtros]);

  useEffect(() => { cargarPendientes(); }, [cargarPendientes]);
  useEffect(() => { cargarTodas(); }, [cargarTodas]);
  useEffect(() => {
    listarTrabajadores({ estado: "" }).then(setTrabajadores).catch(() => {});
  }, []);

  function alCambiar() {
    cargarPendientes();
    cargarTodas();
  }

  const cambiarFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });
  const ayuda = AYUDA_ETAPA[usuario.rol] || AYUDA_ETAPA.supervisor;

  return (
    <div>
      <h2>Aprobación de solicitudes</h2>
      {mensaje && <p className="error">{mensaje}</p>}

      <div className="pestanas" role="tablist">
        <button role="tab" aria-selected={pestana === "bandeja"} className={pestana === "bandeja" ? "activa" : ""} onClick={() => setPestana("bandeja")}>
          Por decidir ({pendientes.length})
        </button>
        <button role="tab" aria-selected={pestana === "todas"} className={pestana === "todas" ? "activa" : ""} onClick={() => setPestana("todas")}>
          {usuario.rol === "supervisor" ? "Solicitudes del equipo" : "Todas las solicitudes"}
        </button>
      </div>

      {pestana === "bandeja" && (
        <>
          <p className="ayuda">{ayuda}</p>
          <TablaSolicitudes solicitudes={pendientes} mostrarTrabajador alCambiar={alCambiar} textoVacio="No hay solicitudes esperando su decisión." />
        </>
      )}

      {pestana === "todas" && (
        <>
          <div className="busqueda filtros">
            <select name="trabajador" value={filtros.trabajador} onChange={cambiarFiltro} aria-label="Trabajador">
              <option value="">Todos los trabajadores</option>
              {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.apellido}, {t.nombre}</option>)}
            </select>
            <select name="tipo" value={filtros.tipo} onChange={cambiarFiltro} aria-label="Tipo">
              <option value="">Permisos y vacaciones</option>
              <option value="vacacion">Vacaciones</option>
              <option value="permiso">Permisos</option>
            </select>
            <select name="estado" value={filtros.estado} onChange={cambiarFiltro} aria-label="Estado">
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendientes (cualquier etapa)</option>
              {Object.entries(ESTADOS_SOLICITUD).map(([clave, { texto }]) => <option key={clave} value={clave}>{texto}</option>)}
            </select>
          </div>
          <TablaSolicitudes solicitudes={todas} mostrarTrabajador alCambiar={alCambiar} textoVacio="No hay solicitudes para los filtros elegidos." />
        </>
      )}
    </div>
  );
}
