// Encuestas de clima: las dirigidas al usuario (para responder) y, para RRHH y Gerencia, la gestión.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { listarEncuestas, publicarEncuesta, eliminarEncuesta } from "../../api/comunicacion";
import { ESTADOS_ENCUESTA, rangoFechas } from "../../formato";

function Insignia({ estado }) {
  const info = ESTADOS_ENCUESTA[estado];
  return <span className={`insignia ${info.clase}`}>{info.texto}</span>;
}

export default function Encuestas() {
  const { usuario } = useAuth();
  const gestiona = usuario.rol === "rrhh" || usuario.rol === "gerencia";
  const esRRHH = usuario.rol === "rrhh";
  const [pestana, setPestana] = useState("mias");
  const [mias, setMias] = useState([]);
  const [todas, setTodas] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    listarEncuestas().then(setMias).catch((err) => setMensaje(err.message));
    if (gestiona) listarEncuestas({ alcance: "gestion" }).then(setTodas).catch((err) => setMensaje(err.message));
  }, [gestiona]);

  useEffect(() => { cargar(); }, [cargar]);

  function ejecutar(promesa, texto) {
    setMensaje("");
    setAviso("");
    promesa.then(() => { setAviso(texto); cargar(); }).catch((err) => setMensaje(err.message));
  }

  const pendientes = mias.filter((e) => e.estado_actual === "abierta" && !e.respondida);

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Encuestas de clima</h2>
        {esRRHH && <Link to="/encuestas/nueva" className="boton-primario">Nueva encuesta</Link>}
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      {gestiona && (
        <div className="pestanas" role="tablist">
          <button role="tab" aria-selected={pestana === "mias"} className={pestana === "mias" ? "activa" : ""} onClick={() => setPestana("mias")}>Para responder ({pendientes.length})</button>
          <button role="tab" aria-selected={pestana === "gestion"} className={pestana === "gestion" ? "activa" : ""} onClick={() => setPestana("gestion")}>Gestión y resultados</button>
        </div>
      )}

      {pestana === "mias" && (
        <>
          <p className="ayuda">Las encuestas son anónimas: el sistema solo registra que usted respondió, no qué respondió.</p>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Encuesta</th><th>Disponible</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {mias.map((e) => (
                  <tr key={e.id}>
                    <td>{e.titulo}{e.descripcion && <div className="ayuda">{e.descripcion}</div>}</td>
                    <td>{rangoFechas(e.fecha_apertura, e.fecha_cierre)}</td>
                    <td>{e.respondida ? <span className="insignia insignia-activo">Respondida</span> : <Insignia estado={e.estado_actual} />}</td>
                    <td>{e.estado_actual === "abierta" && !e.respondida && <Link to={`/encuestas/${e.id}`} className="boton-primario">Responder</Link>}</td>
                  </tr>
                ))}
                {mias.length === 0 && <tr><td colSpan={4} className="vacio">No hay encuestas dirigidas a usted.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pestana === "gestion" && gestiona && (
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Encuesta</th><th>Fechas</th><th>Destinatarios</th><th>Respuestas</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {todas.map((e) => (
                <tr key={e.id}>
                  <td>{e.titulo}<div className="ayuda">{e.preguntas_total} pregunta(s)</div></td>
                  <td>{rangoFechas(e.fecha_apertura, e.fecha_cierre)}</td>
                  <td>{e.areas.length ? e.areas.join(", ") : "Toda la empresa"} ({e.destinatarios})</td>
                  <td>{e.estado === "borrador" ? "—" : `${e.respuestas} (${e.destinatarios ? Math.round((e.respuestas / e.destinatarios) * 100) : 0}%)`}</td>
                  <td><Insignia estado={e.estado_actual} /></td>
                  <td><div className="barra-acciones">
                    {e.estado === "publicada" && <Link to={`/encuestas/${e.id}/resultados`}>Resultados</Link>}
                    {esRRHH && e.estado === "borrador" && (
                      <>
                        <Link to={`/encuestas/${e.id}/editar`}>Editar</Link>
                        <button className="boton-enlace" onClick={() => confirm("¿Publicar la encuesta? Ya no podrá modificarse y se avisará a los destinatarios.") && ejecutar(publicarEncuesta(e.id), "Encuesta publicada")}>Publicar</button>
                        <button className="boton-enlace texto-peligro" onClick={() => confirm("¿Eliminar el borrador?") && ejecutar(eliminarEncuesta(e.id), "Borrador eliminado")}>Eliminar</button>
                      </>
                    )}
                  </div></td>
                </tr>
              ))}
              {todas.length === 0 && <tr><td colSpan={6} className="vacio">No hay encuestas.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
