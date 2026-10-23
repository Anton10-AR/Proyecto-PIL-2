// Indicadores de la etapa 7 (documento, sección 5): despachos con lote registrado y devoluciones, más
// cumplimiento de FEFO, entregas a tiempo, faltantes al recibir y mermas; por cliente y por producto.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { obtenerIndicadoresAlmacen } from "../../api/almacen";
import { TIPOS_CLIENTE, fechaCorta, hoy, miles, sumarDias } from "../../formato";

function Indicador({ valor, sufijo = "", etiqueta, detalle }) {
  return (
    <div className="tarjeta tarjeta-indicador">
      <span className="tarjeta-valor">{valor === null || valor === undefined ? "—" : `${valor}${sufijo}`}</span>
      <span className="tarjeta-etiqueta">{etiqueta}</span>
      {detalle && <span className="tarjeta-detalle">{detalle}</span>}
    </div>
  );
}

const pct = (parte, total) => (total ? `${Math.round((parte / total) * 10000) / 100} %` : "—");

export default function IndicadoresAlmacen() {
  const [filtros, setFiltros] = useState({ desde: sumarDias(hoy(), -29), hasta: hoy() });
  const [datos, setDatos] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    obtenerIndicadoresAlmacen(filtros).then((d) => { setDatos(d); setMensaje(""); }).catch((err) => setMensaje(err.message));
  }, [filtros]);

  const cambiar = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Indicadores de despacho</h2>
          <p className="subtitulo">Etapa 7 · almacenamiento y despacho{datos ? ` · ${fechaCorta(datos.desde)} al ${fechaCorta(datos.hasta)}` : ""}</p>
        </div>
      </div>
      <div className="busqueda filtros">
        <label className="casilla">Desde <input type="date" name="desde" value={filtros.desde} max={filtros.hasta} onChange={cambiar} /></label>
        <label className="casilla">Hasta <input type="date" name="hasta" value={filtros.hasta} min={filtros.desde} onChange={cambiar} /></label>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      {datos && (
        <>
          <div className="tarjetas tarjetas-indicadores">
            <Indicador valor={datos.pct_con_lote} sufijo="%" etiqueta="Despachos con lote registrado" detalle={`${datos.despachos} despachos · ${miles(datos.unidades_despachadas)} unidades`} />
            <Indicador valor={datos.pct_fefo} sufijo="%" etiqueta="Despachos según FEFO" detalle="El resto se apartó con motivo" />
            <Indicador valor={datos.pct_a_tiempo} sufijo="%" etiqueta="Despachados hasta la fecha de entrega" />
            <Indicador valor={datos.pct_devolucion} sufijo="%" etiqueta="Unidades devueltas" detalle={`${miles(datos.unidades_devueltas)} unidades`} />
            <Indicador valor={datos.pct_faltante_recepcion} sufijo="%" etiqueta="Faltante al recibir en almacén" detalle="Envasado frente a recibido" />
            <Indicador valor={datos.pct_merma} sufijo="%" etiqueta="Mermas y bajas" detalle={`${miles(datos.unidades_baja)} unidades`} />
          </div>
          {(datos.pedidos_pendientes > 0) && (
            <p className={datos.pedidos_atrasados ? "aviso" : "ayuda"}>
              Hoy hay {datos.pedidos_pendientes} pedido(s) pendiente(s){datos.pedidos_atrasados ? `, ${datos.pedidos_atrasados} con la entrega atrasada` : ""}. <Link to="/pedidos">Ver pedidos</Link>
            </p>
          )}
          <p className="ayuda">
            Que cada despacho quede con su lote es lo que permite rastrear un retiro de producto hasta el cliente: el sistema no deja despachar sin indicar los lotes.
          </p>

          <h3>Por cliente</h3>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Cliente</th><th>Tipo</th><th>Despachos</th><th>Unidades</th><th>Según FEFO</th><th>Devueltas</th></tr></thead>
              <tbody>
                {datos.por_cliente.map((c) => (
                  <tr key={c.id}>
                    <td>{c.cliente}</td><td>{TIPOS_CLIENTE[c.tipo]}</td><td>{c.despachos}</td><td>{miles(c.unidades)}</td>
                    <td className={c.fefo < c.despachos ? "fuera-norma" : ""}>{pct(c.fefo, c.despachos)}</td>
                    <td className={c.devuelto ? "fuera-norma" : ""}>{miles(c.devuelto)}</td>
                  </tr>
                ))}
                {datos.por_cliente.length === 0 && <tr><td colSpan={6} className="vacio">Sin despachos en el período.</td></tr>}
              </tbody>
            </table>
          </div>

          <h3>Por producto</h3>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Producto</th><th>Despachado</th><th>Devuelto</th><th>Mermas y bajas</th></tr></thead>
              <tbody>
                {datos.por_producto.map((p) => (
                  <tr key={p.id}>
                    <td>{p.codigo} · {p.nombre}</td><td>{miles(p.despachado)}</td>
                    <td className={p.devuelto ? "fuera-norma" : ""}>{miles(p.devuelto)} ({pct(p.devuelto, p.despachado)})</td>
                    <td>{miles(p.baja)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
