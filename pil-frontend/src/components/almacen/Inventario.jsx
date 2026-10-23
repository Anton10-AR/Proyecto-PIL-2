// Inventario de producto terminado (etapa 7): stock por producto y por lote, con lo que vence primero arriba,
// y el kardex de movimientos. El stock es la suma de los movimientos de cada lote.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { obtenerInventario, listarMovimientos } from "../../api/almacen";
import { SITUACIONES_LOTE, TIPOS_MOVIMIENTO, fechaCorta, fechaHora, hoy, miles, sumarDias } from "../../formato";

const PESTANAS = [["resumen", "Stock por producto"], ["movimientos", "Movimientos"]];

function Insignia({ mapa, clave }) {
  const s = mapa[clave];
  return <span className={`insignia ${s.clase}`}>{s.texto}</span>;
}

function Kardex() {
  const [filtros, setFiltros] = useState({ desde: sumarDias(hoy(), -6), hasta: hoy(), tipo: "" });
  const [movimientos, setMovimientos] = useState([]);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    listarMovimientos(filtros).then(setMovimientos).catch((err) => setMensaje(err.message));
  }, [filtros]);

  const cambiar = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });
  return (
    <>
      {mensaje && <p className="error">{mensaje}</p>}
      <div className="busqueda filtros">
        <label className="casilla">Desde <input type="date" name="desde" value={filtros.desde} max={filtros.hasta} onChange={cambiar} /></label>
        <label className="casilla">Hasta <input type="date" name="hasta" value={filtros.hasta} min={filtros.desde} onChange={cambiar} /></label>
        <select name="tipo" value={filtros.tipo} onChange={cambiar} aria-label="Tipo de movimiento">
          <option value="">Todos los movimientos</option>
          {Object.entries(TIPOS_MOVIMIENTO).map(([clave, t]) => <option key={clave} value={clave}>{t.texto}</option>)}
        </select>
      </div>
      <div className="tabla-contenedor">
        <table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Lote</th><th>Producto</th><th>Cantidad</th><th>Pedido / motivo</th><th>Responsable</th></tr></thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.id}>
                <td>{fechaHora(m.fecha_hora)}</td>
                <td><Insignia mapa={TIPOS_MOVIMIENTO} clave={m.tipo} /></td>
                <td><Link to={`/almacen/lotes/${m.id_lote_producto}`}>{m.codigo_lote}</Link></td>
                <td>{m.producto}</td>
                <td className={m.cantidad < 0 ? "fuera-norma" : ""}>{m.cantidad > 0 ? "+" : ""}{miles(m.cantidad)}</td>
                <td>{m.id_pedido ? <Link to={`/pedidos/${m.id_pedido}`}>{m.codigo_pedido} · {m.cliente}</Link> : m.motivo || "Recepción en almacén"}</td>
                <td>{m.trabajador}</td>
              </tr>
            ))}
            {movimientos.length === 0 && <tr><td colSpan={7} className="vacio">No hay movimientos para los filtros elegidos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Inventario() {
  const { usuario } = useAuth();
  const permisos = usuario.permisos_almacen;
  const [pestana, setPestana] = useState("resumen");
  const [inventario, setInventario] = useState(null);
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(() => {
    obtenerInventario().then(setInventario).catch((err) => setMensaje(err.message));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (!inventario) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const lotes = inventario.productos.flatMap((p) => p.lotes.map((l) => ({ ...l, presentacion: p.presentacion })));
  const vencidos = lotes.filter((l) => l.situacion === "vencido");
  const faltantes = inventario.productos.filter((p) => p.disponible < 0);

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Inventario de producto terminado</h2>
          <p className="subtitulo">Etapa 7 del proceso · stock al {fechaCorta(inventario.fecha)} · sale primero lo que vence primero (FEFO)</p>
        </div>
        <div className="barra-acciones">
          {permisos.envasar && <Link to="/almacen/lotes/nuevo" className="boton-primario">Registrar lote envasado</Link>}
          {permisos.pedir && <Link to="/pedidos/nuevo" className="boton-primario">Nuevo pedido</Link>}
        </div>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      <div className="pestanas" role="tablist">
        {PESTANAS.map(([clave, texto]) => (
          <button key={clave} role="tab" aria-selected={pestana === clave} className={pestana === clave ? "activa" : ""} onClick={() => setPestana(clave)}>{texto}</button>
        ))}
      </div>

      {pestana === "movimientos" && <Kardex />}

      {pestana === "resumen" && (
        <>
          {vencidos.map((l) => (
            <p key={l.id} className="error">
              El lote <Link to={`/almacen/lotes/${l.id}`}>{l.codigo}</Link> ({l.producto}) venció el {fechaCorta(l.fecha_vencimiento)} con {miles(l.stock)} unidades:
              {" "}{permisos.recibir ? "regístrelo como baja." : "el encargado de almacén debe darlo de baja."}
            </p>
          ))}
          {faltantes.map((p) => (
            <p key={p.id} className="aviso">
              Los pedidos pendientes de {p.nombre} suman {miles(p.comprometido)} unidades y hoy se pueden despachar {miles(p.despachable)}.
            </p>
          ))}

          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Producto</th><th>En almacén</th><th>Despachable hoy</th><th>Por vencer</th><th>Vencido</th>
                  <th>Por recibir</th><th>En pedidos pendientes</th><th>Disponible</th>
                </tr>
              </thead>
              <tbody>
                {inventario.productos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.codigo} · {p.nombre} <small className="ayuda">{p.presentacion} · vida útil {p.vida_util_dias} días</small></td>
                    <td>{miles(p.stock)}</td>
                    <td>{miles(p.despachable)}</td>
                    <td className={p.por_vencer ? "fuera-norma" : ""}>{miles(p.por_vencer)}</td>
                    <td className={p.vencido ? "fuera-norma" : ""}>{miles(p.vencido)}</td>
                    <td>{miles(p.por_recibir)}</td>
                    <td>{miles(p.comprometido)}</td>
                    <td className={p.disponible < 0 ? "fuera-norma" : ""}><strong>{miles(p.disponible)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ayuda">
            Disponible = despachable hoy − unidades de pedidos pendientes. "Por vencer" = le queda un cuarto de su vida útil o menos.
          </p>

          <h3>Lotes en almacén y por recibir</h3>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Lote</th><th>Producto</th><th>Elaboración</th><th>Vencimiento</th><th>Stock</th><th>Situación</th><th>Lotes de recepción</th></tr></thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id}>
                    <td><Link to={`/almacen/lotes/${l.id}`}>{l.codigo}</Link></td>
                    <td>{l.producto}</td>
                    <td>{fechaCorta(l.fecha_elaboracion)}</td>
                    <td>{fechaCorta(l.fecha_vencimiento)}</td>
                    <td>{l.estado === "registrado" ? `${miles(l.unidades)} envasadas` : miles(l.stock)}</td>
                    <td><Insignia mapa={SITUACIONES_LOTE} clave={l.situacion} /></td>
                    <td>{l.lotes_recepcion}</td>
                  </tr>
                ))}
                {lotes.length === 0 && <tr><td colSpan={7} className="vacio">No hay producto terminado en almacén.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
