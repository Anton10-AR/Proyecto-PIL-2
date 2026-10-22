// Capacitaciones: historial propio (con resultados y certificados) y listado general.
// RRHH crea capacitaciones; el resto consulta. Cada capacitación abre su detalle.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { listarCapacitaciones, misCapacitaciones } from "../../api/capacitaciones";
import { verArchivo } from "../../api/solicitudes";
import { ESTADOS_CAPACITACION, INSCRIPCION_CAPACITACION, RESULTADOS_CAPACITACION, rangoFechas } from "../../formato";

const VISTAS = [
  { id: "proximas", texto: "Programadas y en curso" },
  { id: "finalizadas", texto: "Finalizadas y canceladas" },
  { id: "todas", texto: "Todas" }
];

function Insignia({ mapa, clave }) {
  const info = mapa[clave];
  return info ? <span className={`insignia ${info.clase}`}>{info.texto}</span> : "—";
}

export default function ListaCapacitaciones() {
  const { usuario } = useAuth();
  const [mias, setMias] = useState([]);
  const [vista, setVista] = useState("proximas");
  const [buscar, setBuscar] = useState("");
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    misCapacitaciones().then(setMias).catch((err) => setMensaje(err.message));
  }, []);

  useEffect(() => {
    listarCapacitaciones({ vista, buscar }).then(setCapacitaciones).catch((err) => setMensaje(err.message));
  }, [vista, buscar]);

  const horasAprobadas = mias.filter((m) => m.resultado === "aprobado").reduce((total, m) => total + m.horas, 0);

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Capacitación</h2>
        {usuario.rol === "rrhh" && <Link to="/capacitaciones/nueva" className="boton-primario">Nueva capacitación</Link>}
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      <section>
        <h3>Mi historial de capacitación</h3>
        <p className="ayuda">{mias.filter((m) => m.resultado === "aprobado").length} capacitación(es) aprobada(s) · {horasAprobadas} hora(s) acreditada(s)</p>
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Capacitación</th><th>Fechas</th><th>Horas</th><th>Inscripción</th><th>Asistencia</th><th>Nota</th><th>Resultado</th><th>Certificado</th></tr></thead>
            <tbody>
              {mias.map((m) => (
                <tr key={m.id}>
                  <td><Link to={`/capacitaciones/${m.id_capacitacion}`}>{m.titulo}</Link></td>
                  <td>{rangoFechas(m.fecha_inicio, m.fecha_fin)}</td>
                  <td>{m.horas}</td>
                  <td>{m.estado === "cancelada" ? <Insignia mapa={ESTADOS_CAPACITACION} clave="cancelada" /> : <Insignia mapa={INSCRIPCION_CAPACITACION} clave={m.estado_inscripcion} />}</td>
                  <td>{m.asistencia_pct ?? "—"}{m.asistencia_pct !== null ? "%" : ""}</td>
                  <td>{m.nota ?? "—"}</td>
                  <td>{m.resultado ? <Insignia mapa={RESULTADOS_CAPACITACION} clave={m.resultado} /> : "Pendiente"}</td>
                  <td>
                    {m.id_archivo_certificado
                      ? <button className="boton-enlace" onClick={() => verArchivo(m.id_archivo_certificado).catch((err) => setMensaje(err.message))}>Ver</button>
                      : "—"}
                  </td>
                </tr>
              ))}
              {mias.length === 0 && <tr><td colSpan={8} className="vacio">Todavía no participó en capacitaciones.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Capacitaciones de la empresa</h3>
        <div className="pestanas" role="tablist">
          {VISTAS.map((v) => (
            <button key={v.id} role="tab" aria-selected={vista === v.id} className={vista === v.id ? "activa" : ""} onClick={() => setVista(v.id)}>
              {v.texto}
            </button>
          ))}
        </div>
        <div className="busqueda filtros">
          <input placeholder="Buscar por título, instructor o descripción..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Capacitación</th><th>Fechas</th><th>Horas</th><th>Instructor</th><th>Inscritos</th><th>Estado</th></tr></thead>
            <tbody>
              {capacitaciones.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/capacitaciones/${c.id}`}>{c.titulo}</Link>
                    {c.mi_inscripcion && c.mi_inscripcion !== "rechazado" && <span className="etiqueta-mia">Participo</span>}
                  </td>
                  <td>{rangoFechas(c.fecha_inicio, c.fecha_fin)}</td>
                  <td>{c.horas}</td>
                  <td>{c.instructor || "—"}</td>
                  <td>{c.inscritos}{c.cupo ? ` / ${c.cupo}` : ""}{c.propuestos > 0 && usuario.rol === "rrhh" ? ` (+${c.propuestos} propuesto/s)` : ""}</td>
                  <td><Insignia mapa={ESTADOS_CAPACITACION} clave={c.estado_actual} /></td>
                </tr>
              ))}
              {capacitaciones.length === 0 && <tr><td colSpan={6} className="vacio">No hay capacitaciones para mostrar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
