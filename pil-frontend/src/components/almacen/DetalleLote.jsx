// Detalle de un lote de producto terminado: de qué leche sale (lotes de recepción), su recepción en almacén,
// los movimientos de stock (a qué pedidos y clientes fue) y las devoluciones. Envasado y almacén son puestos
// distintos: quien registró el lote no lo recibe.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { obtenerLote, recibirLote, ajustarLote } from "../../api/almacen";
import { SITUACIONES_LOTE, TIPOS_MOVIMIENTO, fechaCorta, fechaHora, miles } from "../../formato";

function FormularioRecepcion({ lote, alGuardar, guardando }) {
  const [unidades, setUnidades] = useState(String(lote.unidades));
  const [observacion, setObservacion] = useState("");
  const faltan = unidades !== "" && Number(unidades) < lote.unidades;
  return (
    <form onSubmit={(e) => { e.preventDefault(); alGuardar({ unidades_recibidas: Number(unidades), observacion }); }} className="formulario-grilla">
      <fieldset>
        <legend>Recibir en almacén</legend>
        <label>Unidades recibidas *
          <input type="number" min="0" max={lote.unidades} step="1" value={unidades} onChange={(e) => setUnidades(e.target.value)} required />
          <small className="ayuda">Envasadas: {miles(lote.unidades)}</small>
        </label>
        <label className="ancho-completo">Observación {faltan ? "*" : "(opcional)"}
          <input value={observacion} onChange={(e) => setObservacion(e.target.value)} required={faltan}
            placeholder={faltan ? "Explique por qué faltan unidades (ej.: cajas aplastadas en el traslado)" : "Ej.: ubicado en cámara 2"} />
        </label>
        {faltan && <p className="aviso ancho-completo">Faltan {miles(lote.unidades - Number(unidades))} unidades: se avisará a quien registró el lote.</p>}
        <div className="barra-acciones ancho-completo">
          <button type="submit" className="boton-primario" disabled={guardando}>Confirmar recepción</button>
        </div>
      </fieldset>
    </form>
  );
}

function FormularioAjuste({ lote, alGuardar, alCancelar, guardando }) {
  const [datos, setDatos] = useState({ cantidad: "", motivo: lote.situacion === "vencido" ? "Baja por vencimiento" : "" });
  return (
    <form onSubmit={(e) => { e.preventDefault(); alGuardar({ cantidad: Number(datos.cantidad), motivo: datos.motivo }); }} className="formulario-grilla">
      <fieldset>
        <legend>Ajustar stock</legend>
        <label>Cantidad *
          <input type="number" step="1" min={-lote.stock} value={datos.cantidad} onChange={(e) => setDatos({ ...datos, cantidad: e.target.value })} required
            placeholder={lote.situacion === "vencido" ? String(-lote.stock) : "Negativa para bajas"} />
          <small className="ayuda">Stock actual: {miles(lote.stock)}</small>
        </label>
        <label className="ancho-completo">Motivo *
          <input value={datos.motivo} onChange={(e) => setDatos({ ...datos, motivo: e.target.value })} required placeholder="Ej.: merma al estibar, conteo físico" />
        </label>
        <div className="barra-acciones ancho-completo">
          <button type="submit" className="boton-primario" disabled={guardando}>Registrar ajuste</button>
          <button type="button" onClick={alCancelar}>Cancelar</button>
        </div>
      </fieldset>
    </form>
  );
}

export default function DetalleLote() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const permisos = usuario.permisos_almacen;
  const veRecepcion = usuario.permisos_recepcion?.consultar;
  const [lote, setLote] = useState(null);
  const [ajustando, setAjustando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    obtenerLote(id).then(setLote).catch((err) => setMensaje(err.message));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  function ejecutar(promesa, textoExito) {
    setMensaje("");
    setAviso("");
    setGuardando(true);
    promesa
      .then(() => { setAviso(textoExito); setAjustando(false); cargar(); })
      .catch((err) => setMensaje(err.message))
      .finally(() => setGuardando(false));
  }

  if (!lote) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const situacion = SITUACIONES_LOTE[lote.situacion];
  const recibido = lote.estado === "en_almacen";
  const despachos = lote.movimientos.filter((m) => m.tipo === "despacho");
  const devuelto = lote.devoluciones.reduce((s, d) => s + d.cantidad, 0);
  const propio = lote.id_responsable === usuario.id_trabajador;

  const pasos = [
    { titulo: "1. Envasado", estado: "hecho", detalle: `${fechaHora(lote.fecha_hora_registro)} · ${lote.responsable}` },
    {
      titulo: "2. Recepción en almacén", estado: recibido ? "hecho" : "actual",
      detalle: recibido ? `${fechaHora(lote.fecha_hora_recepcion)} · ${lote.receptor}` : "Esperando al encargado de almacén"
    },
    {
      titulo: "3. Despacho", estado: despachos.length ? "hecho" : recibido ? "actual" : "espera",
      detalle: despachos.length ? `${miles(lote.despachado)} unidades en ${despachos.length} pedido(s)` : recibido ? "Sin despachos todavía" : "—"
    }
  ];

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>{lote.codigo} <span className={`insignia insignia-grande ${situacion.clase}`}>{situacion.texto}</span></h2>
          <p className="subtitulo">{lote.producto} · {lote.presentacion} · elaborado el {fechaCorta(lote.fecha_elaboracion)}</p>
        </div>
        <div className="barra-acciones">
          <Link to={`/recepcion/trazabilidad?codigo=${lote.codigo}`}>Trazabilidad del lote</Link>
          <Link to="/almacen/lotes">Volver a lotes</Link>
        </div>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      <ol className="pasos">
        {pasos.map((p) => <li key={p.titulo} className={`paso paso-${p.estado}`}><strong>{p.titulo}</strong><span>{p.detalle}</span></li>)}
      </ol>

      <section className="bloque">
        <h3>Datos del lote</h3>
        <dl className="datos">
          <div className="dato"><dt>Producto</dt><dd>{lote.codigo_producto} · {lote.producto}</dd></div>
          <div className="dato"><dt>Envasadas</dt><dd>{miles(lote.unidades)} unidades ({miles(Math.round(lote.unidades * lote.litros_por_unidad))} L)</dd></div>
          <div className="dato"><dt>Vencimiento</dt><dd className={lote.situacion === "vencido" ? "fuera-norma" : ""}>{fechaCorta(lote.fecha_vencimiento)}</dd></div>
          <div className="dato"><dt>Stock actual</dt><dd>{recibido ? miles(lote.stock) : "—"}</dd></div>
          <div className="dato"><dt>Despachado</dt><dd>{miles(lote.despachado)}</dd></div>
          <div className="dato"><dt>Devuelto por clientes</dt><dd>{miles(devuelto)}</dd></div>
          <div className="dato"><dt>Registró</dt><dd>{lote.responsable}</dd></div>
          <div className="dato"><dt>Observación</dt><dd>{lote.observacion || "—"}</dd></div>
        </dl>
      </section>

      <section className="bloque">
        <h3>Leche de origen</h3>
        <p className="ayuda">Lotes de recepción de los que sale este lote: permiten rastrear hacia atrás hasta el proveedor y su análisis.</p>
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Lote de recepción</th><th>Ingreso</th><th>Proveedor</th><th>Volumen</th><th>Tanque</th><th>Llegada</th></tr></thead>
            <tbody>
              {lote.origen.map((o) => (
                <tr key={o.id}>
                  <td>{veRecepcion ? <Link to={`/recepcion/trazabilidad?codigo=${o.codigo_lote}`}>{o.codigo_lote}</Link> : o.codigo_lote}</td>
                  <td>{veRecepcion ? <Link to={`/recepcion/ingresos/${o.id}`}>{o.codigo}</Link> : o.codigo}</td>
                  <td>{o.codigo_proveedor} · {o.proveedor}</td>
                  <td>{miles(o.volumen_l)} L</td>
                  <td>{o.tanque}</td>
                  <td>{fechaHora(o.fecha_hora_llegada)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`bloque${!recibido && permisos.recibir && !propio ? " bloque-accion" : ""}`}>
        <div className="encabezado-pagina">
          <h3>Almacén</h3>
          {recibido && permisos.recibir && !ajustando && lote.stock > 0 && <button className="boton-enlace" onClick={() => setAjustando(true)}>Ajustar stock</button>}
        </div>
        {recibido && (
          <dl className="datos">
            <div className="dato"><dt>Recibió</dt><dd>{lote.receptor} · {fechaHora(lote.fecha_hora_recepcion)}</dd></div>
            <div className="dato"><dt>Unidades recibidas</dt><dd className={lote.unidades_recibidas < lote.unidades ? "fuera-norma" : ""}>{miles(lote.unidades_recibidas)} de {miles(lote.unidades)}</dd></div>
            <div className="dato"><dt>Observación</dt><dd>{lote.observacion_recepcion || "—"}</dd></div>
          </dl>
        )}
        {!recibido && !permisos.recibir && <p className="ayuda">Esperando que el encargado de almacén lo reciba.</p>}
        {!recibido && permisos.recibir && propio && <p className="ayuda">Usted registró este lote en envasado: lo debe recibir otra persona.</p>}
        {!recibido && permisos.recibir && !propio && (
          <FormularioRecepcion lote={lote} guardando={guardando}
            alGuardar={(d) => ejecutar(recibirLote(lote.id, d), "Lote recibido: ya forma parte del inventario")} />
        )}
        {ajustando && (
          <FormularioAjuste lote={lote} guardando={guardando} alCancelar={() => setAjustando(false)}
            alGuardar={(d) => ejecutar(ajustarLote(lote.id, d), "Ajuste registrado en el kardex")} />
        )}
      </section>

      {recibido && (
        <section className="bloque">
          <h3>Movimientos</h3>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Pedido · cliente / motivo</th><th>Responsable</th></tr></thead>
              <tbody>
                {lote.movimientos.map((m) => (
                  <tr key={m.id}>
                    <td>{fechaHora(m.fecha_hora)}</td>
                    <td><span className={`insignia ${TIPOS_MOVIMIENTO[m.tipo].clase}`}>{TIPOS_MOVIMIENTO[m.tipo].texto}</span></td>
                    <td>{m.cantidad > 0 ? "+" : ""}{miles(m.cantidad)}</td>
                    <td>{m.id_pedido ? <Link to={`/pedidos/${m.id_pedido}`}>{m.codigo_pedido} · {m.cliente}</Link> : m.motivo || "Recepción en almacén"}</td>
                    <td>{m.trabajador}</td>
                  </tr>
                ))}
                {lote.movimientos.length === 0 && <tr><td colSpan={5} className="vacio">Sin movimientos.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {lote.devoluciones.length > 0 && (
        <section className="bloque">
          <h3>Devoluciones de clientes</h3>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Fecha</th><th>Pedido</th><th>Cliente</th><th>Cantidad</th><th>Motivo</th><th>Registró</th></tr></thead>
              <tbody>
                {lote.devoluciones.map((d) => (
                  <tr key={d.id}>
                    <td>{fechaHora(d.fecha_hora)}</td>
                    <td><Link to={`/pedidos/${d.id_pedido}`}>{d.codigo_pedido}</Link></td>
                    <td>{d.cliente}</td>
                    <td>{miles(d.cantidad)}</td>
                    <td>{d.motivo}</td>
                    <td>{d.trabajador}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
