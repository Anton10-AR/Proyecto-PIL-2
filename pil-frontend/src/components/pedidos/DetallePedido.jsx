// Detalle de un pedido: registro -> despacho completo por lote -> devoluciones. El sistema propone los lotes
// por FEFO (vence primero, sale primero); quien despacha puede elegir otros indicando el motivo, igual que el
// supervisor de calidad al apartarse de la sugerencia en recepción. Quien registró el pedido no lo despacha.
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { obtenerPedido, despacharPedido, cancelarPedido, registrarDevolucion } from "../../api/pedidos";
import { listarLotes } from "../../api/almacen";
import { ESTADOS_PEDIDO, TIPOS_CLIENTE, fechaCorta, fechaHora, hoy, miles } from "../../formato";

// ¿La elección usa los mismos lotes y cantidades que la propuesta? (misma regla que el backend)
function coincide(propuesta, elegida) {
  const aTexto = (lista) => lista.filter((x) => x.cantidad > 0).map((x) => `${x.id_lote_producto}:${x.cantidad}`).sort().join(",");
  return aTexto(propuesta) === aTexto(elegida);
}

function FormularioDespacho({ pedido, alGuardar, guardando }) {
  const sugerida = pedido.propuesta.flatMap((p) => p.asignacion);
  const [eligiendo, setEligiendo] = useState(false);
  const [lotes, setLotes] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [motivo, setMotivo] = useState("");
  const [vehiculo, setVehiculo] = useState("");
  const [mensaje, setMensaje] = useState("");

  function elegirOtros() {
    setEligiendo(true);
    setCantidades(Object.fromEntries(sugerida.map((a) => [a.id_lote_producto, String(a.cantidad)])));
    Promise.all(pedido.items.map((i) => listarLotes({ con_stock: 1, id_producto: i.id_producto })))
      .then((listas) => setLotes(listas.flat().filter((l) => l.situacion !== "vencido")
        .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento) || a.codigo.localeCompare(b.codigo))))
      .catch((err) => setMensaje(err.message));
  }

  const elegida = Object.entries(cantidades).map(([id, c]) => ({ id_lote_producto: Number(id), cantidad: Number(c) || 0 })).filter((e) => e.cantidad > 0);
  const distinta = eligiendo && !coincide(sugerida, elegida);
  const sumaDe = (idProducto) => lotes.filter((l) => l.id_producto === idProducto).reduce((s, l) => s + (Number(cantidades[l.id]) || 0), 0);

  function enviar(e) {
    e.preventDefault();
    alGuardar(eligiendo ? { lotes: elegida, motivo, vehiculo } : { vehiculo });
  }

  return (
    <form onSubmit={enviar} className="formulario-grilla">
      <fieldset>
        <legend>Despachar el pedido completo</legend>
        {mensaje && <p className="error ancho-completo">{mensaje}</p>}
        {!eligiendo ? (
          <div className="ancho-completo">
            <p>Lotes propuestos por el sistema (vence primero, sale primero):</p>
            <ul>
              {pedido.propuesta.map((p) => (
                <li key={p.id_producto}>
                  <strong>{p.producto}</strong>: {p.asignacion.map((a) => `${a.codigo} × ${miles(a.cantidad)} (vence ${fechaCorta(a.fecha_vencimiento)})`).join(" + ")}
                </li>
              ))}
            </ul>
            <button type="button" className="boton-enlace" onClick={elegirOtros}>Elegir otros lotes</button>
          </div>
        ) : (
          <div className="ancho-completo">
            {pedido.items.map((i) => {
              const suma = sumaDe(i.id_producto);
              return (
                <div key={i.id_producto} className="tabla-contenedor">
                  <table>
                    <caption>{i.producto}: {miles(suma)} de {miles(i.cantidad)} unidades {suma !== i.cantidad && <span className="fuera-norma">(no cubre el pedido)</span>}</caption>
                    <thead><tr><th>Lote</th><th>Vencimiento</th><th>Stock</th><th>Propuesto</th><th>A despachar</th></tr></thead>
                    <tbody>
                      {lotes.filter((l) => l.id_producto === i.id_producto).map((l) => (
                        <tr key={l.id}>
                          <td>{l.codigo}</td>
                          <td>{fechaCorta(l.fecha_vencimiento)}</td>
                          <td>{miles(l.stock)}</td>
                          <td>{miles(sugerida.find((a) => a.id_lote_producto === l.id)?.cantidad || 0)}</td>
                          <td>
                            <input type="number" min="0" max={l.stock} step="1" value={cantidades[l.id] || ""} aria-label={`Unidades del lote ${l.codigo}`}
                              onChange={(e) => setCantidades({ ...cantidades, [l.id]: e.target.value })} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            <button type="button" className="boton-enlace" onClick={() => { setEligiendo(false); setMotivo(""); }}>Volver a la propuesta FEFO</button>
          </div>
        )}
        {distinta && (
          <>
            <p className="aviso ancho-completo">Los lotes elegidos no son los que vencen primero: el despacho quedará marcado como fuera de FEFO, con su motivo.</p>
            <label className="ancho-completo">Motivo *
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} required placeholder="Ej.: el cliente exige al menos 5 días de vida útil" />
            </label>
          </>
        )}
        <label>Vehículo (placa)
          <input value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} placeholder="Ej.: 3310-LMB" />
        </label>
        <div className="barra-acciones ancho-completo">
          <button type="submit" className="boton-primario" disabled={guardando}>Confirmar despacho</button>
        </div>
      </fieldset>
    </form>
  );
}

function FormularioDevolucion({ pedido, alGuardar, alCancelar, guardando }) {
  const conSaldo = pedido.lotes_despachados.filter((l) => l.cantidad > l.devuelto);
  const [datos, setDatos] = useState({ id_lote_producto: conSaldo[0] ? String(conSaldo[0].id_lote_producto) : "", cantidad: "", motivo: "" });
  const lote = conSaldo.find((l) => String(l.id_lote_producto) === datos.id_lote_producto);
  return (
    <form onSubmit={(e) => { e.preventDefault(); alGuardar({ ...datos, id_lote_producto: Number(datos.id_lote_producto), cantidad: Number(datos.cantidad) }); }} className="formulario-grilla">
      <fieldset>
        <legend>Registrar devolución</legend>
        <label>Lote *
          <select value={datos.id_lote_producto} onChange={(e) => setDatos({ ...datos, id_lote_producto: e.target.value })} required>
            {conSaldo.map((l) => <option key={l.id_lote_producto} value={l.id_lote_producto}>{l.codigo} ({l.codigo_producto})</option>)}
          </select>
        </label>
        <label>Cantidad *
          <input type="number" min="1" max={lote ? lote.cantidad - lote.devuelto : undefined} step="1" value={datos.cantidad} onChange={(e) => setDatos({ ...datos, cantidad: e.target.value })} required />
          {lote && <small className="ayuda">Despachadas: {miles(lote.cantidad)} · ya devueltas: {miles(lote.devuelto)}</small>}
        </label>
        <label className="ancho-completo">Motivo *
          <input value={datos.motivo} onChange={(e) => setDatos({ ...datos, motivo: e.target.value })} required placeholder="Ej.: bolsas rotas en el transporte" />
        </label>
        <p className="ayuda ancho-completo">El producto devuelto no vuelve al stock. Se avisa al supervisor de calidad y a la jefatura de planta.</p>
        <div className="barra-acciones ancho-completo">
          <button type="submit" className="boton-primario" disabled={guardando}>Registrar devolución</button>
          <button type="button" onClick={alCancelar}>Cancelar</button>
        </div>
      </fieldset>
    </form>
  );
}

export default function DetallePedido() {
  const { id } = useParams();
  const { state } = useLocation();
  const { usuario } = useAuth();
  const permisos = usuario.permisos_almacen;
  const [pedido, setPedido] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [devolviendo, setDevolviendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    obtenerPedido(id).then(setPedido).catch((err) => setMensaje(err.message));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  function ejecutar(promesa, textoExito) {
    setMensaje("");
    setAviso("");
    setGuardando(true);
    promesa
      .then(() => { setAviso(textoExito); setCancelando(false); setDevolviendo(false); cargar(); })
      .catch((err) => setMensaje(err.message))
      .finally(() => setGuardando(false));
  }

  if (!pedido) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const estado = ESTADOS_PEDIDO[pedido.estado];
  const pendiente = pedido.estado === "pendiente";
  const despachado = pedido.estado === "despachado";
  const faltantes = pendiente ? pedido.propuesta.filter((p) => p.faltante > 0) : [];
  const propio = pedido.id_responsable === usuario.id_trabajador;
  const advertencias = !aviso && state?.advertencias?.length ? state.advertencias : [];
  const puedeDevolver = despachado && permisos.devolver && pedido.lotes_despachados.some((l) => l.cantidad > l.devuelto);

  const pasos = [
    { titulo: "1. Pedido", estado: "hecho", detalle: `${fechaHora(pedido.fecha_hora_registro)} · ${pedido.responsable}` },
    {
      titulo: "2. Despacho",
      estado: despachado ? "hecho" : pedido.estado === "cancelado" ? "rechazo" : "actual",
      detalle: despachado ? `${fechaHora(pedido.fecha_hora_despacho)} · ${pedido.despachador}`
        : pedido.estado === "cancelado" ? "Cancelado" : faltantes.length ? "Esperando stock" : "Esperando al almacén"
    },
    {
      titulo: "3. Devoluciones", estado: pedido.devuelto ? "rechazo" : despachado ? "hecho" : "espera",
      detalle: pedido.devuelto ? `${miles(pedido.devuelto)} unidades devueltas` : despachado ? "Sin devoluciones" : "—"
    }
  ];

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>{pedido.codigo} <span className={`insignia insignia-grande ${estado.clase}`}>{estado.texto}</span></h2>
          <p className="subtitulo">{pedido.cliente} · entrega el {fechaCorta(pedido.fecha_entrega)} · {miles(pedido.unidades)} unidades</p>
        </div>
        <Link to="/pedidos">Volver a pedidos</Link>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}
      {advertencias.map((a) => <p key={a} className="aviso">Pedido registrado. {a}: quedará pendiente hasta que haya stock.</p>)}

      <ol className="pasos">
        {pasos.map((p) => <li key={p.titulo} className={`paso paso-${p.estado}`}><strong>{p.titulo}</strong><span>{p.detalle}</span></li>)}
      </ol>

      <section className="bloque">
        <div className="encabezado-pagina">
          <h3>Datos del pedido</h3>
          {pendiente && permisos.pedir && !cancelando && <button className="boton-enlace" onClick={() => setCancelando(true)}>Cancelar pedido</button>}
        </div>
        <dl className="datos">
          <div className="dato"><dt>Cliente</dt><dd>{pedido.codigo_cliente} · {pedido.cliente}</dd></div>
          <div className="dato"><dt>Tipo</dt><dd>{TIPOS_CLIENTE[pedido.tipo_cliente]}{pedido.ciudad ? ` · ${pedido.ciudad}` : ""}</dd></div>
          <div className="dato"><dt>Entrega</dt><dd className={pedido.atrasado ? "fuera-norma" : ""}>{fechaCorta(pedido.fecha_entrega)}{pedido.atrasado ? " (atrasado)" : ""}</dd></div>
          <div className="dato"><dt>Registró</dt><dd>{pedido.responsable}</dd></div>
          <div className="dato"><dt>Observación</dt><dd>{pedido.observacion || "—"}</dd></div>
          {pedido.estado === "cancelado" && <div className="dato"><dt>Cancelación</dt><dd>{fechaHora(pedido.fecha_hora_cancelacion)} · {pedido.motivo_cancelacion}</dd></div>}
        </dl>
        {cancelando && (
          <form className="busqueda filtros" onSubmit={(e) => { e.preventDefault(); ejecutar(cancelarPedido(pedido.id, motivoCancelacion), "Pedido cancelado: se avisó al almacén"); }}>
            <input value={motivoCancelacion} onChange={(e) => setMotivoCancelacion(e.target.value)} required placeholder="Motivo de la cancelación *" aria-label="Motivo de la cancelación" />
            <button type="submit" className="boton-peligro" disabled={guardando}>Confirmar cancelación</button>
            <button type="button" onClick={() => setCancelando(false)}>Volver</button>
          </form>
        )}
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Producto</th><th>Presentación</th><th>Cantidad</th>{pendiente && <th>Stock para despachar hoy</th>}</tr></thead>
            <tbody>
              {pedido.items.map((i) => {
                const propuesta = pendiente && pedido.propuesta.find((p) => p.id_producto === i.id_producto);
                return (
                  <tr key={i.id_producto}>
                    <td>{i.codigo_producto} · {i.producto}</td><td>{i.presentacion}</td><td>{miles(i.cantidad)}</td>
                    {pendiente && <td className={propuesta.faltante ? "fuera-norma" : ""}>{propuesta.faltante ? `Faltan ${miles(propuesta.faltante)}` : "Alcanza"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {pedido.estado !== "cancelado" && (
        <section className={`bloque${pendiente && permisos.despachar && !propio && !faltantes.length ? " bloque-accion" : ""}`}>
          <h3>Despacho</h3>
          {despachado && (
            <>
              <dl className="datos">
                <div className="dato"><dt>Despachó</dt><dd>{pedido.despachador} · {fechaHora(pedido.fecha_hora_despacho)}</dd></div>
                <div className="dato"><dt>Vehículo</dt><dd>{pedido.vehiculo || "—"}</dd></div>
                <div className="dato"><dt>Lotes</dt><dd>{pedido.coincide_fefo ? "Según FEFO (los que vencen primero)" : <span className="fuera-norma">Fuera de FEFO</span>}</dd></div>
                {!pedido.coincide_fefo && <div className="dato"><dt>Motivo</dt><dd>{pedido.motivo_despacho}</dd></div>}
              </dl>
              <div className="tabla-contenedor">
                <table>
                  <thead><tr><th>Lote</th><th>Producto</th><th>Vencimiento</th><th>Leche de origen</th><th>Despachadas</th><th>Devueltas</th></tr></thead>
                  <tbody>
                    {pedido.lotes_despachados.map((l) => (
                      <tr key={l.id_lote_producto}>
                        <td><Link to={`/almacen/lotes/${l.id_lote_producto}`}>{l.codigo}</Link></td>
                        <td>{l.codigo_producto}</td>
                        <td>{fechaCorta(l.fecha_vencimiento)}</td>
                        <td>{l.lotes_recepcion}</td>
                        <td>{miles(l.cantidad)}</td>
                        <td className={l.devuelto ? "fuera-norma" : ""}>{miles(l.devuelto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {pendiente && faltantes.length > 0 && (
            <p className="aviso">
              No hay stock para despacharlo completo hoy: {faltantes.map((f) => `faltan ${miles(f.faltante)} de ${f.producto}`).join("; ")}.
            </p>
          )}
          {pendiente && !faltantes.length && !permisos.despachar && <p className="ayuda">Esperando que el almacén lo despache.</p>}
          {pendiente && !faltantes.length && permisos.despachar && propio && <p className="ayuda">Usted registró este pedido: lo debe despachar otra persona.</p>}
          {pendiente && !faltantes.length && permisos.despachar && !propio && (
            <FormularioDespacho pedido={pedido} guardando={guardando}
              alGuardar={(d) => ejecutar(despacharPedido(pedido.id, d), "Pedido despachado: se avisó a atención de pedidos")} />
          )}
        </section>
      )}

      {despachado && (pedido.devoluciones.length > 0 || permisos.devolver) && (
        <section className="bloque">
          <div className="encabezado-pagina">
            <h3>Devoluciones</h3>
            {puedeDevolver && !devolviendo && <button className="boton-enlace" onClick={() => setDevolviendo(true)}>Registrar devolución</button>}
          </div>
          {devolviendo && (
            <FormularioDevolucion pedido={pedido} guardando={guardando} alCancelar={() => setDevolviendo(false)}
              alGuardar={(d) => ejecutar(registrarDevolucion(pedido.id, d), "Devolución registrada: se avisó a calidad y jefatura")} />
          )}
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Fecha</th><th>Lote</th><th>Cantidad</th><th>Motivo</th><th>Registró</th></tr></thead>
              <tbody>
                {pedido.devoluciones.map((d) => (
                  <tr key={d.id}>
                    <td>{fechaHora(d.fecha_hora, hoy())}</td>
                    <td><Link to={`/almacen/lotes/${d.id_lote_producto}`}>{d.codigo_lote}</Link></td>
                    <td>{miles(d.cantidad)}</td>
                    <td>{d.motivo}</td>
                    <td>{d.trabajador}</td>
                  </tr>
                ))}
                {pedido.devoluciones.length === 0 && <tr><td colSpan={5} className="vacio">Sin devoluciones.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
