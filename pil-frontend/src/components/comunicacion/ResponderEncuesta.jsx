// Responder una encuesta abierta (una sola vez, de forma anónima)
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { obtenerEncuesta, responderEncuesta } from "../../api/comunicacion";
import { rangoFechas } from "../../formato";

const ESCALA = { 1: "Muy en desacuerdo", 2: "En desacuerdo", 3: "Neutral", 4: "De acuerdo", 5: "Muy de acuerdo" };

export default function ResponderEncuesta() {
  const { id } = useParams();
  const [encuesta, setEncuesta] = useState(null);
  const [valores, setValores] = useState({});
  const [mensaje, setMensaje] = useState("");
  const [enviada, setEnviada] = useState("");

  useEffect(() => {
    obtenerEncuesta(id).then(setEncuesta).catch((err) => setMensaje(err.message));
  }, [id]);

  function enviar(e) {
    e.preventDefault();
    setMensaje("");
    const respuestas = Object.entries(valores).map(([idPregunta, valor]) => ({ id_pregunta: Number(idPregunta), valor }));
    responderEncuesta(id, respuestas).then((r) => setEnviada(r.mensaje)).catch((err) => setMensaje(err.message));
  }

  if (!encuesta) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const cerrada = encuesta.estado_actual !== "abierta";
  if (enviada || encuesta.respondida || cerrada) {
    return (
      <div className="pagina-angosta">
        <h2>{encuesta.titulo}</h2>
        <p className={enviada ? "exito" : "aviso"}>
          {enviada || (encuesta.respondida ? "Ya respondió esta encuesta. ¡Gracias!" : "Esta encuesta no está abierta en este momento.")}
        </p>
        <Link to="/encuestas">Volver a encuestas</Link>
      </div>
    );
  }

  const cambiar = (idPregunta, valor) => setValores({ ...valores, [idPregunta]: valor });

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>{encuesta.titulo}</h2>
          <p className="subtitulo">Disponible: {rangoFechas(encuesta.fecha_apertura, encuesta.fecha_cierre)}</p>
        </div>
        <Link to="/encuestas">Volver</Link>
      </div>
      {encuesta.descripcion && <p>{encuesta.descripcion}</p>}
      <p className="aviso">Esta encuesta es anónima: sus respuestas no quedan vinculadas a su nombre y los resultados se muestran agrupados.</p>
      {mensaje && <p className="error">{mensaje}</p>}

      <form onSubmit={enviar} className="criterios">
        {encuesta.preguntas.map((p, i) => (
          <fieldset key={p.id} className="criterio">
            <legend><strong>{i + 1}. {p.texto}</strong>{p.obligatoria ? " *" : <span className="ayuda"> (opcional)</span>}</legend>
            {p.tipo === "escala" && (
              <div className="escala" role="radiogroup">
                {[1, 2, 3, 4, 5].map((v) => (
                  <label key={v} className={`escala-opcion${valores[p.id] === v ? " seleccionada" : ""}`}>
                    <input type="radio" name={`p${p.id}`} checked={valores[p.id] === v} onChange={() => cambiar(p.id, v)} required={Boolean(p.obligatoria)} />
                    <span className="escala-valor">{v}</span>
                    <span className="escala-texto">{ESCALA[v]}</span>
                  </label>
                ))}
              </div>
            )}
            {p.tipo === "opcion" && (
              <div className="opciones-encuesta">
                {p.opciones.map((o) => (
                  <label key={o} className="casilla">
                    <input type="radio" name={`p${p.id}`} checked={valores[p.id] === o} onChange={() => cambiar(p.id, o)} required={Boolean(p.obligatoria)} /> {o}
                  </label>
                ))}
              </div>
            )}
            {p.tipo === "texto" && (
              <textarea className="area-texto" rows={3} maxLength={2000} value={valores[p.id] || ""} onChange={(e) => cambiar(p.id, e.target.value)} required={Boolean(p.obligatoria)} />
            )}
          </fieldset>
        ))}
        <div className="barra-acciones"><button type="submit" className="boton-primario">Enviar respuestas</button></div>
      </form>
    </div>
  );
}
