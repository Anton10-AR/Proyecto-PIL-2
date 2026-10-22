// Trazabilidad: a partir de un código de lote (LR-...) o de ingreso (ING-...) reconstruye el recorrido de la
// leche: proveedor y cisterna -> análisis -> decisión -> tanque y descarga, con responsables y correcciones.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { buscarTrazabilidad } from "../../api/recepcion";
import { ESTADOS_INGRESO, SUGERENCIAS, decimal, fechaHora, miles } from "../../formato";

export default function Trazabilidad() {
  const [parametros, setParametros] = useSearchParams();
  const codigoUrl = parametros.get("codigo") || "";
  const [codigo, setCodigo] = useState(codigoUrl);
  // Respuesta de la última búsqueda: { codigo, datos, error }
  const [respuesta, setRespuesta] = useState(null);
  const buscando = Boolean(codigoUrl) && respuesta?.codigo !== codigoUrl;
  const resultado = respuesta?.codigo === codigoUrl ? respuesta.datos : null;
  const mensaje = respuesta?.codigo === codigoUrl ? respuesta.error : "";

  useEffect(() => {
    if (!codigoUrl) return;
    let vigente = true;
    buscarTrazabilidad(codigoUrl)
      .then((datos) => { if (vigente) setRespuesta({ codigo: codigoUrl, datos, error: "" }); })
      .catch((err) => { if (vigente) setRespuesta({ codigo: codigoUrl, datos: null, error: err.message }); });
    return () => { vigente = false; };
  }, [codigoUrl]);

  function buscar(e) {
    e.preventDefault();
    if (codigo.trim()) setParametros({ codigo: codigo.trim().toUpperCase() });
  }

  const r = resultado;
  const dia = r?.fecha_hora_llegada.slice(0, 10);

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Trazabilidad de lotes</h2>
          <p className="subtitulo">Proveedor → ingreso → lote de recepción → tanque (documento, sección 6.2)</p>
        </div>
      </div>

      <form onSubmit={buscar} className="busqueda filtros">
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código de lote (LR-AAAAMMDD-NN) o de ingreso (ING-...)" aria-label="Código" />
        <button type="submit" className="boton-primario" disabled={buscando}>Rastrear</button>
      </form>
      {mensaje && <p className="error">{mensaje}</p>}
      {buscando && <p className="cargando">Buscando...</p>}

      {r && !buscando && (
        <>
          <section className="bloque">
            <h3>
              {r.codigo_lote ? `Lote ${r.codigo_lote}` : `Ingreso ${r.codigo}`}{" "}
              <span className={`insignia ${ESTADOS_INGRESO[r.estado].clase}`}>{ESTADOS_INGRESO[r.estado].texto}</span>
            </h3>
            <ol className="linea-tiempo">
              <li>
                <strong>Origen y llegada · {fechaHora(r.fecha_hora_llegada)}</strong>
                {r.proveedor} ({r.codigo_proveedor}) · {r.centro_acopio || "sin centro de acopio"}<br />
                Cisterna {r.placa}{r.transportista ? ` (${r.transportista})` : ""} · {miles(r.volumen_l)} L a {decimal(r.temperatura_c)} °C<br />
                <small>Registró: {r.operador} · ingreso {r.codigo}</small>
              </li>
              <li className={r.sugerencia === "rechazar" ? "linea-rechazo" : ""}>
                <strong>Análisis {r.codigo_muestra ? `· muestra ${r.codigo_muestra}` : ""}{r.fecha_hora_analisis ? ` · ${fechaHora(r.fecha_hora_analisis, dia)}` : ""}</strong>
                {r.sugerencia ? (
                  <>
                    Acidez {decimal(r.acidez)} % · densidad {decimal(r.densidad)} g/ml · grasa {decimal(r.grasa)} % · alcohol {r.alcohol} · antibióticos {r.antibioticos}<br />
                    Sugerencia: <span className={`insignia ${SUGERENCIAS[r.sugerencia].clase}`}>{SUGERENCIAS[r.sugerencia].texto}</span>
                    {r.observaciones.length > 0 && (
                      <ul className="lista-observaciones">
                        {r.observaciones.map((o) => <li key={o.codigo} className="fuera-norma">{o.nombre}: {decimal(o.valor)} (límite {o.limite})</li>)}
                      </ul>
                    )}
                    <small>Analizó: {r.analista}</small>
                  </>
                ) : <span className="ayuda">Pendiente</span>}
              </li>
              <li className={r.estado === "rechazado" ? "linea-rechazo" : ""}>
                <strong>Decisión{r.fecha_hora_decision ? ` · ${fechaHora(r.fecha_hora_decision, dia)}` : ""}</strong>
                {r.resultado ? (
                  <>
                    {ESTADOS_INGRESO[r.resultado].texto}{r.tanque ? ` → tanque ${r.tanque}` : ""}{r.codigo_lote ? ` · lote ${r.codigo_lote}` : ""}
                    {!r.coincide_sugerencia && " · se apartó de la sugerencia del sistema"}<br />
                    {r.motivo && <>Motivo: {r.motivo}<br /></>}
                    <small>Decidió: {r.supervisor}</small>
                  </>
                ) : <span className="ayuda">Pendiente</span>}
              </li>
              {r.resultado && r.resultado !== "rechazado" && (
                <li>
                  <strong>Descarga a tanque{r.fecha_hora_descarga ? ` · ${fechaHora(r.fecha_hora_descarga, dia)}` : ""}</strong>
                  {r.fecha_hora_descarga ? <>Tanque {r.tanque}<br /><small>Descargó: {r.operador_descarga}</small></> : <span className="ayuda">Pendiente</span>}
                </li>
              )}
              <li>
                <strong>Lote de producción, producto terminado y despacho</strong>
                <span className="ayuda">En esta versión se registran fuera del sistema; su vínculo con el lote de recepción es una fase futura.</span>
              </li>
            </ol>
            <p><Link to={`/recepcion/ingresos/${r.id}`}>Ver el detalle completo del ingreso</Link></p>
          </section>

          {r.bitacora.length > 0 && (
            <section className="bloque">
              <h3>Correcciones registradas</h3>
              <ul className="lista-simple">
                {r.bitacora.map((b) => (
                  <li key={b.id}>{fechaHora(b.fecha)} · {b.campo}: {decimal(b.valor_anterior)} → {decimal(b.valor_nuevo)} · {b.motivo} ({b.usuario})</li>
                ))}
              </ul>
            </section>
          )}

          <section className="bloque">
            <h3>Otros ingresos de {r.proveedor} (30 días previos)</h3>
            <div className="tabla-contenedor">
              <table>
                <thead><tr><th>Ingreso</th><th>Llegada</th><th>Volumen</th><th>Sugerencia</th><th>Estado</th></tr></thead>
                <tbody>
                  {r.historial_proveedor.map((h) => (
                    <tr key={h.codigo}>
                      <td><Link to={`/recepcion/trazabilidad?codigo=${h.codigo}`}>{h.codigo}</Link></td>
                      <td>{fechaHora(h.fecha_hora_llegada)}</td>
                      <td>{miles(h.volumen_l)} L</td>
                      <td>{h.sugerencia ? <span className={`insignia ${SUGERENCIAS[h.sugerencia].clase}`}>{SUGERENCIAS[h.sugerencia].texto}</span> : "—"}</td>
                      <td><span className={`insignia ${ESTADOS_INGRESO[h.estado].clase}`}>{ESTADOS_INGRESO[h.estado].texto}</span></td>
                    </tr>
                  ))}
                  {r.historial_proveedor.length === 0 && <tr><td colSpan={5} className="vacio">Sin otros ingresos en ese período.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
