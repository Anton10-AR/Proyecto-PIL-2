// Lotes de producto terminado: los que esperan recepción en almacén y el historial con filtros.
// Envasado registra el lote; el encargado de almacén lo recibe (paso que se resalta para su puesto).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { listarLotes, obtenerCatalogosAlmacen } from "../../api/almacen";
import { SITUACIONES_LOTE, fechaCorta, fechaHora, hoy, miles, sumarDias } from "../../formato";

function TablaLotes({ lotes, puedeRecibir, vacio }) {
  return (
    <div className="tabla-contenedor">
      <table>
        <thead>
          <tr>
            <th>Lote</th><th>Producto</th><th>Elaboración</th><th>Vencimiento</th><th>Envasadas</th><th>Stock</th>
            <th>Situación</th><th>Lotes de recepción</th><th></th>
          </tr>
        </thead>
        <tbody>
          {lotes.map((l) => {
            const recibir = l.estado === "registrado" && puedeRecibir;
            const situacion = SITUACIONES_LOTE[l.situacion];
            return (
              <tr key={l.id} className={recibir ? "fila-seleccionada" : ""}>
                <td><Link to={`/almacen/lotes/${l.id}`}>{l.codigo}</Link></td>
                <td>{l.producto} <small className="ayuda">{l.presentacion}</small></td>
                <td>{fechaCorta(l.fecha_elaboracion)}</td>
                <td>{fechaCorta(l.fecha_vencimiento)}</td>
                <td>{miles(l.unidades)}</td>
                <td>{l.estado === "registrado" ? "—" : miles(l.stock)}</td>
                <td><span className={`insignia ${situacion.clase}`}>{situacion.texto}</span></td>
                <td>{l.lotes_recepcion}</td>
                <td>{recibir ? <Link to={`/almacen/lotes/${l.id}`} className="boton-primario">Recibir</Link> : <Link to={`/almacen/lotes/${l.id}`}>Ver</Link>}</td>
              </tr>
            );
          })}
          {lotes.length === 0 && <tr><td colSpan={9} className="vacio">{vacio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function LotesProducto() {
  const { usuario } = useAuth();
  const permisos = usuario.permisos_almacen;
  const [porRecibir, setPorRecibir] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [productos, setProductos] = useState([]);
  const [filtros, setFiltros] = useState({ desde: sumarDias(hoy(), -13), hasta: hoy(), id_producto: "", buscar: "" });
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    obtenerCatalogosAlmacen().then((c) => setProductos(c.productos)).catch((err) => setMensaje(err.message));
    listarLotes({ estado: "registrado" }).then(setPorRecibir).catch((err) => setMensaje(err.message));
  }, []);

  const cargarHistorial = useCallback(() => {
    listarLotes(filtros).then(setHistorial).catch((err) => setMensaje(err.message));
  }, [filtros]);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const cambiarFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });
  const ultimo = porRecibir[0];

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Lotes de producto terminado</h2>
          <p className="subtitulo">Etapas 6 y 7 · envasado registra el lote con su leche de origen y el almacén lo recibe</p>
        </div>
        {permisos.envasar && <Link to="/almacen/lotes/nuevo" className="boton-primario">Registrar lote envasado</Link>}
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      <section>
        <h3>Por recibir en almacén ({porRecibir.length})</h3>
        {ultimo && <p className="ayuda">El más reciente se registró el {fechaHora(ultimo.fecha_hora_registro)} ({ultimo.responsable}).</p>}
        <TablaLotes lotes={porRecibir} puedeRecibir={permisos.recibir} vacio="No hay lotes esperando recepción." />
      </section>

      <section>
        <h3>Historial</h3>
        <div className="busqueda filtros">
          <input name="buscar" placeholder="Código de lote (LP- o LR-) o producto..." value={filtros.buscar} onChange={cambiarFiltro} />
          <label className="casilla">Elaborados desde <input type="date" name="desde" value={filtros.desde} max={filtros.hasta} onChange={cambiarFiltro} /></label>
          <label className="casilla">Hasta <input type="date" name="hasta" value={filtros.hasta} min={filtros.desde} onChange={cambiarFiltro} /></label>
          <select name="id_producto" value={filtros.id_producto} onChange={cambiarFiltro} aria-label="Producto">
            <option value="">Todos los productos</option>
            {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <p className="ayuda">{historial.length} lotes · {miles(historial.reduce((s, l) => s + l.unidades, 0))} unidades envasadas en el período.</p>
        <TablaLotes lotes={historial} puedeRecibir={permisos.recibir} vacio="No hay lotes para los filtros elegidos." />
      </section>
    </div>
  );
}
