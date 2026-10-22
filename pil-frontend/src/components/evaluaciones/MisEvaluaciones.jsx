// Evaluaciones propias ya completadas y acciones de mejora de las que el usuario es responsable
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { listarEvaluaciones, misAcciones, actualizarAccion } from "../../api/evaluaciones";
import { ESTADOS_ACCION, claseCategoria, fechaCorta, hoy } from "../../formato";

export default function MisEvaluaciones() {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(() => {
    listarEvaluaciones({ alcance: "mias" }).then(setEvaluaciones).catch((err) => setMensaje(err.message));
    misAcciones().then(setAcciones).catch((err) => setMensaje(err.message));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function cambiarEstado(accion, estado) {
    setMensaje("");
    actualizarAccion(accion.id, { estado }).then(cargar).catch((err) => setMensaje(err.message));
  }

  const sinLeer = evaluaciones.filter((e) => !e.fecha_lectura).length;

  return (
    <div>
      <h2>Mis evaluaciones</h2>
      {mensaje && <p className="error">{mensaje}</p>}
      {sinLeer > 0 && <p className="aviso">Tiene {sinLeer} evaluación(es) sin leer. Ábrala y confirme la lectura.</p>}

      <section>
        <h3>Evaluaciones del desempeño</h3>
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Período</th><th>Evaluador</th><th>Puntaje</th><th>Resultado</th><th>Lectura</th><th></th></tr></thead>
            <tbody>
              {evaluaciones.map((e) => (
                <tr key={e.id}>
                  <td>{e.periodo}</td>
                  <td>{e.evaluador || "—"}</td>
                  <td><strong>{e.puntaje_final}</strong> / 5</td>
                  <td><span className={`insignia ${claseCategoria(e.categoria)}`}>{e.categoria}</span></td>
                  <td>{e.fecha_lectura ? `Leída el ${e.fecha_lectura.slice(0, 10)}` : <span className="texto-alerta">Sin leer</span>}</td>
                  <td><Link to={`/evaluaciones/${e.id}`}>Ver evaluación</Link></td>
                </tr>
              ))}
              {evaluaciones.length === 0 && <tr><td colSpan={6} className="vacio">Todavía no tiene evaluaciones completadas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Mis acciones de mejora</h3>
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Acción</th><th>Período</th><th>Fecha límite</th><th>Capacitación</th><th>Avance</th></tr></thead>
            <tbody>
              {acciones.map((a) => (
                <tr key={a.id}>
                  <td>{a.descripcion}</td>
                  <td>{a.periodo}</td>
                  <td className={a.estado !== "completada" && a.fecha_limite < hoy() ? "texto-alerta" : ""}>
                    {fechaCorta(a.fecha_limite)}{a.estado !== "completada" && a.fecha_limite < hoy() ? " (vencida)" : ""}
                  </td>
                  <td>{a.id_capacitacion ? <Link to={`/capacitaciones/${a.id_capacitacion}`}>{a.capacitacion}</Link> : "—"}</td>
                  <td>
                    <select value={a.estado} onChange={(e) => cambiarEstado(a, e.target.value)} aria-label="Avance">
                      {Object.entries(ESTADOS_ACCION).map(([clave, { texto }]) => <option key={clave} value={clave}>{texto}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {acciones.length === 0 && <tr><td colSpan={5} className="vacio">No tiene acciones de mejora asignadas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
