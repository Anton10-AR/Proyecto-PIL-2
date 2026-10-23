// Pedidos y despacho (etapa 7): pedidos pendientes de despacho e historial con filtros.
// Atención de pedidos los registra; el almacén los despacha (acción que se resalta para su puesto).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { listarPedidos } from "../../api/pedidos";
import { obtenerCatalogosAlmacen } from "../../api/almacen";
import { ESTADOS_PEDIDO, fechaCorta, hoy, miles, sumarDias } from "../../formato";

function TablaPedidos({ pedidos, puedeDespachar, vacio }) {
  return (
    <div className="tabla-contenedor">
      <table>
        <thead>
          <tr><th>Pedido</th><th>Cliente</th><th>Entrega</th><th>Productos</th><th>Unidades</th><th>Estado</th><th>Despacho</th><th></th></tr>
        </thead>
        <tbody>
          {pedidos.map((p) => {
            const despachar = p.estado === "pendiente" && puedeDespachar;
            const estado = ESTADOS_PEDIDO[p.estado];
            return (
              <tr key={p.id} className={despachar ? "fila-seleccionada" : ""}>
                <td><Link to={`/pedidos/${p.id}`}>{p.codigo}</Link></td>
                <td>{p.cliente}</td>
                <td className={p.atrasado ? "fuera-norma" : ""}>{fechaCorta(p.fecha_entrega)}{p.atrasado ? " (atrasado)" : ""}</td>
                <td>{p.resumen}</td>
                <td>{miles(p.unidades)}</td>
                <td>
                  <span className={`insignia ${estado.clase}`}>{estado.texto}</span>
                  {p.devuelto > 0 && <span className="insignia insignia-injustificada insignia-chica">devolución</span>}
                </td>
                <td>
                  {p.estado === "despachado"
                    ? (p.coincide_fefo ? "FEFO" : <span className="fuera-norma">Fuera de FEFO</span>)
                    : "—"}
                </td>
                <td>{despachar ? <Link to={`/pedidos/${p.id}`} className="boton-primario">Despachar</Link> : <Link to={`/pedidos/${p.id}`}>Ver</Link>}</td>
              </tr>
            );
          })}
          {pedidos.length === 0 && <tr><td colSpan={8} className="vacio">{vacio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function ListaPedidos() {
  const { usuario } = useAuth();
  const permisos = usuario.permisos_almacen;
  const [pendientes, setPendientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [filtros, setFiltros] = useState({ desde: sumarDias(hoy(), -13), hasta: hoy(), estado: "", id_cliente: "", buscar: "" });
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    obtenerCatalogosAlmacen().then((c) => setClientes(c.clientes)).catch((err) => setMensaje(err.message));
    listarPedidos({ estado: "pendiente" }).then(setPendientes).catch((err) => setMensaje(err.message));
  }, []);

  const cargarHistorial = useCallback(() => {
    listarPedidos(filtros).then(setHistorial).catch((err) => setMensaje(err.message));
  }, [filtros]);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const cambiarFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });
  const despachados = historial.filter((p) => p.estado === "despachado");
  const fueraFefo = despachados.filter((p) => !p.coincide_fefo).length;

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Pedidos y despacho</h2>
          <p className="subtitulo">Etapa 7 · atención de pedidos registra, el almacén despacha por lote (sale primero lo que vence primero)</p>
        </div>
        {permisos.pedir && <Link to="/pedidos/nuevo" className="boton-primario">Nuevo pedido</Link>}
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      <section>
        <h3>Por despachar ({pendientes.length})</h3>
        <TablaPedidos pedidos={pendientes} puedeDespachar={permisos.despachar} vacio="No hay pedidos pendientes." />
      </section>

      <section>
        <h3>Historial</h3>
        <div className="busqueda filtros">
          <input name="buscar" placeholder="Código de pedido o cliente..." value={filtros.buscar} onChange={cambiarFiltro} />
          <label className="casilla">Entrega desde <input type="date" name="desde" value={filtros.desde} max={filtros.hasta} onChange={cambiarFiltro} /></label>
          <label className="casilla">Hasta <input type="date" name="hasta" value={filtros.hasta} min={filtros.desde} onChange={cambiarFiltro} /></label>
          <select name="estado" value={filtros.estado} onChange={cambiarFiltro} aria-label="Estado">
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS_PEDIDO).map(([clave, e]) => <option key={clave} value={clave}>{e.texto}</option>)}
          </select>
          <select name="id_cliente" value={filtros.id_cliente} onChange={cambiarFiltro} aria-label="Cliente">
            <option value="">Todos los clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <p className="ayuda">
          {historial.length} pedidos · {despachados.length} despachados{despachados.length ? `, ${fueraFefo} fuera de FEFO (con motivo)` : ""}.
        </p>
        <TablaPedidos pedidos={historial} puedeDespachar={permisos.despachar} vacio="No hay pedidos para los filtros elegidos." />
      </section>
    </div>
  );
}
