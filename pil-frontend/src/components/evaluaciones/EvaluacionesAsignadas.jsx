// Evaluaciones que el usuario debe hacer (o ya hizo) y, para supervisor, RRHH y Gerencia,
// las evaluaciones de los trabajadores que puede ver.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { listarEvaluaciones } from "../../api/evaluaciones";
import { claseCategoria } from "../../formato";

function TablaEvaluaciones({ evaluaciones, mostrarEvaluador, textoVacio }) {
  return (
    <div className="tabla-contenedor">
      <table>
        <thead>
          <tr>
            <th>Trabajador</th><th>Período</th><th>Plantilla</th>{mostrarEvaluador && <th>Evaluador</th>}<th>Estado</th><th>Puntaje</th><th></th>
          </tr>
        </thead>
        <tbody>
          {evaluaciones.map((e) => (
            <tr key={e.id}>
              <td>{e.apellido}, {e.nombre}<div className="ayuda">{e.cargo || "Sin cargo"}</div></td>
              <td>{e.periodo}{e.estado_periodo === "cerrado" && <div className="ayuda">Cerrado</div>}</td>
              <td>{e.plantilla}</td>
              {mostrarEvaluador && <td>{e.evaluador || <span className="texto-alerta">Sin asignar</span>}</td>}
              <td>
                {e.estado === "completada"
                  ? <span className="insignia insignia-activo">Completada</span>
                  : <span className="insignia insignia-pendiente">Pendiente</span>}
                {e.estado === "completada" && <div className="ayuda">{e.fecha_lectura ? "Leída" : "Sin leer"}</div>}
              </td>
              <td>{e.puntaje_final ? <span className={`insignia ${claseCategoria(e.categoria)}`}>{e.puntaje_final} · {e.categoria}</span> : "—"}</td>
              <td><Link to={`/evaluaciones/${e.id}`}>{e.estado === "pendiente" && e.estado_periodo === "abierto" && !mostrarEvaluador ? "Evaluar" : "Ver"}</Link></td>
            </tr>
          ))}
          {evaluaciones.length === 0 && <tr><td colSpan={mostrarEvaluador ? 7 : 6} className="vacio">{textoVacio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function EvaluacionesAsignadas() {
  const { usuario } = useAuth();
  const [pestana, setPestana] = useState("asignadas");
  const [asignadas, setAsignadas] = useState([]);
  const [todas, setTodas] = useState([]);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    listarEvaluaciones({ alcance: "asignadas" }).then(setAsignadas).catch((err) => setMensaje(err.message));
    listarEvaluaciones({ alcance: "todas" }).then(setTodas).catch((err) => setMensaje(err.message));
  }, []);

  const pendientes = asignadas.filter((e) => e.estado === "pendiente" && e.estado_periodo === "abierto");
  const ordenadas = [...pendientes, ...asignadas.filter((e) => !pendientes.includes(e))];

  return (
    <div>
      <h2>Evaluación del desempeño</h2>
      {mensaje && <p className="error">{mensaje}</p>}
      <div className="pestanas" role="tablist">
        <button role="tab" aria-selected={pestana === "asignadas"} className={pestana === "asignadas" ? "activa" : ""} onClick={() => setPestana("asignadas")}>
          A mi cargo ({pendientes.length} pendiente/s)
        </button>
        <button role="tab" aria-selected={pestana === "todas"} className={pestana === "todas" ? "activa" : ""} onClick={() => setPestana("todas")}>
          {usuario.rol === "supervisor" ? "De mi equipo" : "Todas"}
        </button>
      </div>

      {pestana === "asignadas" && (
        <>
          <p className="ayuda">Califique cada criterio de 1 a 5 y escriba la retroalimentación. Puede corregir sus evaluaciones mientras el período esté abierto.</p>
          <TablaEvaluaciones evaluaciones={ordenadas} textoVacio="No tiene evaluaciones asignadas." />
        </>
      )}
      {pestana === "todas" && (
        <TablaEvaluaciones evaluaciones={todas} mostrarEvaluador textoVacio="No hay evaluaciones para mostrar." />
      )}
    </div>
  );
}
