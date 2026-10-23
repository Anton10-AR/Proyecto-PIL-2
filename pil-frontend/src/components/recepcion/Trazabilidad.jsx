// Trazabilidad de la cadena completa (documento, sección 6.2): proveedor -> ingreso -> lote de recepción ->
// tanque -> lote de producto terminado -> pedido y cliente. Desde la leche (LR-, ING-) rastrea hacia adelante
// hasta los clientes; desde el producto terminado (LP-) rastrea hacia atrás hasta los proveedores.
// Recepción consulta los códigos de leche y almacén los de producto terminado, según el puesto.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { buscarTrazabilidad } from "../../api/recepcion";
import { buscarTrazabilidadLote } from "../../api/almacen";
import { ESTADOS_INGRESO, SITUACIONES_LOTE, SUGERENCIAS, decimal, fechaCorta, fechaHora, miles } from "../../formato";

const esProducto = (codigo) => codigo.startsWith("LP-");

// Pedidos y clientes que recibieron producto de los lotes indicados
function TablaDespachos({ filas, veAlmacen, conLote }) {
  return (
    <div className="tabla-contenedor">
      <table>
        <thead>
          <tr>{conLote && <th>Lote de producto</th>}<th>Pedido</th><th>Cliente</th><th>Ciudad</th><th>Despacho</th><th>Unidades</th><th>Devueltas</th></tr>
        </thead>
        <tbody>
          {filas.map((d) => (
            <tr key={`${d.codigo_lote || ""}-${d.id_pedido}`}>
              {conLote && <td>{veAlmacen ? <Link to={`/almacen/lotes/${d.id_lote}`}>{d.codigo_lote}</Link> : d.codigo_lote}</td>}
              <td>{veAlmacen ? <Link to={`/pedidos/${d.id_pedido}`}>{d.codigo_pedido}</Link> : d.codigo_pedido}</td>
              <td>{d.cliente}</td>
              <td>{d.ciudad || "—"}</td>
              <td>{fechaHora(d.fecha_hora)}{d.coincide_fefo ? "" : " · fuera de FEFO"}</td>
              <td>{miles(d.cantidad)}</td>
              <td className={d.devuelto ? "fuera-norma" : ""}>{miles(d.devuelto)}</td>
            </tr>
          ))}
          {filas.length === 0 && <tr><td colSpan={conLote ? 7 : 6} className="vacio">Todavía no se despachó.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TrazabilidadLeche({ r, veAlmacen }) {
  const dia = r.fecha_hora_llegada.slice(0, 10);
  const despachos = r.destino.flatMap((l) => l.despachos.map((d) => ({ ...d, id_lote: l.id, codigo_lote: l.codigo })));
  const clientes = new Set(despachos.map((d) => d.cliente));
  return (
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
          {r.resultado && r.resultado !== "rechazado" && (
            <li>
              <strong>Producto terminado</strong>
              {r.destino.length ? r.destino.map((l) => (
                <span key={l.id}>
                  {veAlmacen ? <Link to={`/almacen/lotes/${l.id}`}>{l.codigo}</Link> : l.codigo} · {l.producto} ({l.presentacion}) ·
                  {" "}{miles(l.unidades)} unidades · vence {fechaCorta(l.fecha_vencimiento)}<br />
                </span>
              )) : (
                <span className="ayuda">
                  {r.resultado === "derivado" ? "Leche derivada: va a otras líneas de producto, fuera de la leche líquida." : "Todavía no se usó en ningún lote de producto terminado."}
                </span>
              )}
            </li>
          )}
          {r.destino.length > 0 && (
            <li>
              <strong>Despacho a clientes</strong>
              {despachos.length ? `${miles(despachos.reduce((s, d) => s + d.cantidad, 0))} unidades a ${clientes.size} cliente(s) en ${despachos.length} despacho(s)` : <span className="ayuda">Todavía no se despachó.</span>}
            </li>
          )}
        </ol>
        <p><Link to={`/recepcion/ingresos/${r.id}`}>Ver el detalle completo del ingreso</Link></p>
      </section>

      {despachos.length > 0 && (
        <section className="bloque">
          <h3>Clientes que recibieron producto de esta leche</h3>
          <p className="ayuda">Si hubiera que retirar producto del mercado, estos son los pedidos a revisar.</p>
          <TablaDespachos filas={despachos} veAlmacen={veAlmacen} conLote />
        </section>
      )}

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
  );
}

function TrazabilidadProducto({ r, veRecepcion }) {
  const situacion = SITUACIONES_LOTE[r.situacion];
  const despachado = r.despachos.reduce((s, d) => s + d.cantidad, 0);
  return (
    <>
      <section className="bloque">
        <h3>Lote {r.codigo} <span className={`insignia ${situacion.clase}`}>{situacion.texto}</span></h3>
        <ol className="linea-tiempo">
          <li>
            <strong>Leche de origen</strong>
            {r.origen.map((o) => (
              <span key={o.id}>
                {veRecepcion ? <Link to={`/recepcion/trazabilidad?codigo=${o.codigo_lote}`}>{o.codigo_lote}</Link> : o.codigo_lote} · {o.proveedor} ({o.codigo_proveedor})
                {" "}· {miles(o.volumen_l)} L · llegó {fechaHora(o.fecha_hora_llegada)} · tanque {o.tanque} · sugerencia {SUGERENCIAS[o.sugerencia].texto.toLowerCase()}<br />
              </span>
            ))}
          </li>
          <li>
            <strong>Envasado · {fechaHora(r.fecha_hora_registro)}</strong>
            {r.producto} ({r.presentacion}) · {miles(r.unidades)} unidades · vence {fechaCorta(r.fecha_vencimiento)}<br />
            <small>Registró: {r.responsable}</small>
          </li>
          <li>
            <strong>Recepción en almacén{r.fecha_hora_recepcion ? ` · ${fechaHora(r.fecha_hora_recepcion)}` : ""}</strong>
            {r.estado === "en_almacen" ? (
              <>
                {miles(r.unidades_recibidas)} de {miles(r.unidades)} unidades{r.observacion_recepcion ? ` · ${r.observacion_recepcion}` : ""}<br />
                <small>Recibió: {r.receptor}</small>
              </>
            ) : <span className="ayuda">Pendiente</span>}
          </li>
          <li>
            <strong>Despacho a clientes</strong>
            {r.despachos.length ? `${miles(despachado)} unidades en ${r.despachos.length} pedido(s) · stock actual ${miles(r.stock)}` : <span className="ayuda">Todavía no se despachó.</span>}
          </li>
        </ol>
        <p><Link to={`/almacen/lotes/${r.id}`}>Ver el detalle completo del lote</Link></p>
      </section>

      <section className="bloque">
        <h3>Pedidos y clientes</h3>
        <TablaDespachos filas={r.despachos} veAlmacen />
      </section>

      {r.devoluciones.length > 0 && (
        <section className="bloque">
          <h3>Devoluciones</h3>
          <ul className="lista-simple">
            {r.devoluciones.map((d) => (
              <li key={d.id}>{fechaHora(d.fecha_hora)} · {d.codigo_pedido} ({d.cliente}) · {miles(d.cantidad)} unidades · {d.motivo}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function Trazabilidad() {
  const { usuario } = useAuth();
  const veRecepcion = Boolean(usuario.permisos_recepcion?.consultar);
  const veAlmacen = Boolean(usuario.permisos_almacen?.consultar);
  const [parametros, setParametros] = useSearchParams();
  const codigoUrl = parametros.get("codigo") || "";
  const [codigo, setCodigo] = useState(codigoUrl);
  // Respuesta de la última búsqueda: { codigo, datos, error }
  const [respuesta, setRespuesta] = useState(null);
  const sinPermiso = codigoUrl && (esProducto(codigoUrl) ? !veAlmacen : !veRecepcion);
  const buscando = Boolean(codigoUrl) && !sinPermiso && respuesta?.codigo !== codigoUrl;
  const resultado = respuesta?.codigo === codigoUrl ? respuesta.datos : null;
  const mensaje = sinPermiso
    ? (esProducto(codigoUrl)
      ? "Su puesto rastrea desde la leche: ingrese un lote de recepción (LR-) o un ingreso (ING-)."
      : "Su puesto rastrea desde el producto terminado: ingrese un lote de producto (LP-).")
    : respuesta?.codigo === codigoUrl ? respuesta.error : "";

  useEffect(() => {
    if (!codigoUrl || sinPermiso) return;
    let vigente = true;
    (esProducto(codigoUrl) ? buscarTrazabilidadLote(codigoUrl) : buscarTrazabilidad(codigoUrl))
      .then((datos) => { if (vigente) setRespuesta({ codigo: codigoUrl, datos, error: "" }); })
      .catch((err) => { if (vigente) setRespuesta({ codigo: codigoUrl, datos: null, error: err.message }); });
    return () => { vigente = false; };
  }, [codigoUrl, sinPermiso]);

  function buscar(e) {
    e.preventDefault();
    if (codigo.trim()) setParametros({ codigo: codigo.trim().toUpperCase() });
  }

  const ejemplos = [veRecepcion && "lote de recepción (LR-AAAAMMDD-NN), ingreso (ING-...)", veAlmacen && "lote de producto terminado (LP-...)"].filter(Boolean);

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Trazabilidad de lotes</h2>
          <p className="subtitulo">Proveedor → ingreso → lote de recepción → tanque → lote de producto terminado → pedido y cliente (documento, sección 6.2)</p>
        </div>
      </div>

      <form onSubmit={buscar} className="busqueda filtros">
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={`Código de ${ejemplos.join(" o ")}`} aria-label="Código" />
        <button type="submit" className="boton-primario" disabled={buscando}>Rastrear</button>
      </form>
      {mensaje && <p className="error">{mensaje}</p>}
      {buscando && <p className="cargando">Buscando...</p>}

      {resultado && !buscando && (esProducto(codigoUrl)
        ? <TrazabilidadProducto r={resultado} veRecepcion={veRecepcion} />
        : <TrazabilidadLeche r={resultado} veAlmacen={veAlmacen} />)}
    </div>
  );
}
