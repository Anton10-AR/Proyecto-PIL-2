// Resultados agregados de una encuesta (RRHH y Gerencia). Por anonimato, un grupo (la empresa o un
// área) solo se muestra si tiene al menos el mínimo de respuestas que indica el backend.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { resultadosEncuesta } from "../../api/comunicacion";
import { rangoFechas } from "../../formato";

const ETIQUETAS = ["Muy en desacuerdo", "En desacuerdo", "Neutral", "De acuerdo", "Muy de acuerdo"];
const COLORES = ["#dc2626", "#f97316", "#9ca3af", "#22c55e", "#15803d"];

function Barra({ etiqueta, valor, total, color }) {
  const porcentaje = total ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="barra-fila">
      <span className="barra-etiqueta">{etiqueta}: {valor} ({porcentaje}%)</span>
      <div className="barra-fondo"><div className="barra-relleno" style={{ width: `${porcentaje}%`, background: color }} /></div>
    </div>
  );
}

export default function ResultadosEncuesta() {
  const { id } = useParams();
  const [area, setArea] = useState("");
  const [datos, setDatos] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    resultadosEncuesta(id, area).then(setDatos).catch((err) => setMensaje(err.message));
  }, [id, area]);

  if (!datos) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const { encuesta, resultados, por_area: porArea, minimo } = datos;

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Resultados: {encuesta.titulo}</h2>
          <p className="subtitulo">
            {rangoFechas(encuesta.fecha_apertura, encuesta.fecha_cierre)} · {encuesta.respuestas} respuesta(s) de {encuesta.destinatarios} destinatario(s)
            ({encuesta.destinatarios ? Math.round((encuesta.respuestas / encuesta.destinatarios) * 100) : 0}% de participación)
          </p>
        </div>
        <Link to="/encuestas">Volver</Link>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      <div className="busqueda filtros">
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área">
          <option value="">Toda la empresa</option>
          {porArea.areas.map((a) => <option key={a.area} value={a.area}>{a.area} ({a.envios})</option>)}
        </select>
        <span className="ayuda">Solo se puede filtrar por áreas con {minimo} o más respuestas.</span>
      </div>

      {!resultados.suficiente ? (
        <p className="aviso">Hay {resultados.total} respuesta(s): se necesitan al menos {minimo} para mostrar resultados sin comprometer el anonimato.</p>
      ) : (
        <div className="criterios">
          {resultados.preguntas.map((p, i) => (
            <section key={p.id} className="criterio">
              <h3>{i + 1}. {p.texto}</h3>
              {p.tipo === "escala" && (
                <>
                  <p>Promedio: <strong>{p.promedio ?? "—"}</strong> / 5 · {p.respondidas} respuesta(s)</p>
                  <div className="barras">
                    {p.distribucion.map((cantidad, v) => <Barra key={v} etiqueta={`${v + 1} · ${ETIQUETAS[v]}`} valor={cantidad} total={p.respondidas} color={COLORES[v]} />)}
                  </div>
                </>
              )}
              {p.tipo === "opcion" && (
                <div className="barras">
                  {p.conteo.map((c) => <Barra key={c.opcion} etiqueta={c.opcion} valor={c.cantidad} total={p.respondidas} color="var(--primario)" />)}
                </div>
              )}
              {p.tipo === "texto" && (
                p.textos.length
                  ? <ul className="lista-textos">{p.textos.map((t, k) => <li key={k}>{t}</li>)}</ul>
                  : <p className="ayuda">Sin respuestas de texto.</p>
              )}
            </section>
          ))}
        </div>
      )}

      {!area && (
        <section>
          <h3>Promedio de las preguntas de escala por área</h3>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Área</th><th>Respuestas</th><th>Promedio (1 a 5)</th></tr></thead>
              <tbody>
                {porArea.areas.map((a) => <tr key={a.area}><td>{a.area}</td><td>{a.envios}</td><td>{a.promedio ?? "—"}</td></tr>)}
                {porArea.envios_otras_areas > 0 && (
                  <tr><td><em>Otras áreas</em></td><td>{porArea.envios_otras_areas}</td><td className="ayuda">No se detallan (menos de {minimo} respuestas por área)</td></tr>
                )}
                {porArea.areas.length === 0 && porArea.envios_otras_areas === 0 && <tr><td colSpan={3} className="vacio">Sin respuestas.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
