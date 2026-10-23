// Registro de un lote de producto terminado (envasado, etapa 6): producto, unidades y los lotes de recepción
// de los que sale la leche. Es el eslabón lote de recepción -> lote de producto terminado de la trazabilidad.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { obtenerCatalogosAlmacen, listarOrigenes, registrarLote } from "../../api/almacen";
import { fechaCorta, fechaHora, hoy, miles, sumarDias } from "../../formato";

export default function FormularioLote() {
  const navegar = useNavigate();
  const [productos, setProductos] = useState(null);
  const [origenes, setOrigenes] = useState([]);
  const [formulario, setFormulario] = useState({ id_producto: "", unidades: "", fecha_elaboracion: hoy(), observacion: "" });
  const [elegidos, setElegidos] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerCatalogosAlmacen().then((c) => setProductos(c.productos.filter((p) => p.activo))).catch((err) => setMensaje(err.message));
  }, []);

  // Los orígenes válidos dependen de la fecha de elaboración (leche descargada en los 2 días previos)
  useEffect(() => {
    listarOrigenes(formulario.fecha_elaboracion).then(setOrigenes).catch((err) => setMensaje(err.message));
  }, [formulario.fecha_elaboracion]);

  if (!productos) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const producto = productos.find((p) => String(p.id) === formulario.id_producto);
  const vigentes = elegidos.filter((id) => origenes.some((o) => o.id === id));
  const litrosOrigen = origenes.filter((o) => vigentes.includes(o.id)).reduce((s, o) => s + o.volumen_l, 0);
  const litrosLote = producto && formulario.unidades ? Number(formulario.unidades) * producto.litros_por_unidad : 0;
  const excede = litrosLote > 0 && vigentes.length > 0 && litrosLote > litrosOrigen;

  const cambiar = (e) => setFormulario({ ...formulario, [e.target.name]: e.target.value });
  const alternar = (id) => setElegidos(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]);

  function enviar(e) {
    e.preventDefault();
    setMensaje("");
    setGuardando(true);
    registrarLote({ ...formulario, unidades: Number(formulario.unidades), origen: vigentes })
      .then((lote) => navegar(`/almacen/lotes/${lote.id}`))
      .catch((err) => setMensaje(err.message))
      .finally(() => setGuardando(false));
  }

  return (
    <div className="pagina-angosta">
      <div className="encabezado-pagina">
        <h2>Registrar lote envasado</h2>
        <Link to="/almacen/lotes">Volver</Link>
      </div>
      <p className="ayuda">Al guardar, el sistema genera el código LP-, calcula el vencimiento y avisa al encargado de almacén que hay un lote por recibir.</p>
      {mensaje && <p className="error">{mensaje}</p>}

      <form onSubmit={enviar} className="formulario-grilla">
        <fieldset>
          <legend>Producto</legend>
          <label>Producto *
            <select name="id_producto" value={formulario.id_producto} onChange={cambiar} required>
              <option value="">— Seleccione —</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre} ({p.presentacion})</option>)}
            </select>
          </label>
          <label>Unidades envasadas *
            <input type="number" name="unidades" min="1" step="1" value={formulario.unidades} onChange={cambiar} required />
            {producto && litrosLote > 0 && <small className="ayuda">Equivale a {miles(Math.round(litrosLote))} L</small>}
          </label>
          <label>Fecha de elaboración *
            <input type="date" name="fecha_elaboracion" value={formulario.fecha_elaboracion} min={sumarDias(hoy(), -2)} max={hoy()} onChange={cambiar} required />
            {producto && <small className="ayuda">Vence el {fechaCorta(sumarDias(formulario.fecha_elaboracion, producto.vida_util_dias))} ({producto.vida_util_dias} días)</small>}
          </label>
          <label className="ancho-completo">Observación
            <input name="observacion" value={formulario.observacion} onChange={cambiar} placeholder="Ej.: línea 2, cambio de bobina a mitad del lote" />
          </label>
        </fieldset>

        <fieldset>
          <legend>Leche de origen (lotes de recepción) *</legend>
          <p className="ayuda ancho-completo">
            Solo leche aceptada y descargada en los 2 días previos a la elaboración. La leche derivada va a otras líneas de producto.
          </p>
          <div className="tabla-contenedor ancho-completo">
            <table>
              <thead><tr><th></th><th>Lote de recepción</th><th>Ingreso</th><th>Proveedor</th><th>Volumen</th><th>Tanque</th><th>Descarga</th><th>Ya usado en</th></tr></thead>
              <tbody>
                {origenes.map((o) => (
                  <tr key={o.id} className={vigentes.includes(o.id) ? "fila-seleccionada" : ""}>
                    <td><input type="checkbox" checked={vigentes.includes(o.id)} onChange={() => alternar(o.id)} aria-label={`Usar ${o.codigo_lote}`} /></td>
                    <td>{o.codigo_lote}</td>
                    <td>{o.codigo}</td>
                    <td>{o.proveedor}</td>
                    <td>{miles(o.volumen_l)} L</td>
                    <td>{o.tanque}</td>
                    <td>{fechaHora(o.fecha_hora_descarga)}</td>
                    <td>{o.usado_en || "—"}</td>
                  </tr>
                ))}
                {origenes.length === 0 && <tr><td colSpan={8} className="vacio">No hay leche aceptada y descargada en el plazo.</td></tr>}
              </tbody>
            </table>
          </div>
          {vigentes.length > 0 && <p className="ayuda ancho-completo">Leche de origen elegida: {miles(litrosOrigen)} L.</p>}
          {excede && (
            <p className="aviso ancho-completo">
              El lote equivale a {miles(Math.round(litrosLote))} L y la leche de origen suma {miles(litrosOrigen)} L: agregue lotes de recepción o revise las unidades.
            </p>
          )}
        </fieldset>

        <div className="barra-acciones">
          <button type="submit" className="boton-primario" disabled={guardando || vigentes.length === 0 || excede}>Registrar lote</button>
          <Link to="/almacen/lotes">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
