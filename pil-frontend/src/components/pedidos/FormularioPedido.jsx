// Registro de un pedido (atención de pedidos): cliente, fecha de entrega y productos con cantidades, sin precios.
// Muestra lo disponible hoy como referencia: si no alcanza, el pedido se registra igual y espera stock.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { obtenerCatalogosAlmacen, obtenerInventario } from "../../api/almacen";
import { registrarPedido } from "../../api/pedidos";
import { TIPOS_CLIENTE, hoy, miles, sumarDias } from "../../formato";

const ITEM_VACIO = { id_producto: "", cantidad: "" };

export default function FormularioPedido() {
  const navegar = useNavigate();
  const [catalogos, setCatalogos] = useState(null);
  const [disponible, setDisponible] = useState({});
  const [formulario, setFormulario] = useState({ id_cliente: "", fecha_entrega: hoy(), observacion: "" });
  const [items, setItems] = useState([ITEM_VACIO]);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerCatalogosAlmacen().then(setCatalogos).catch((err) => setMensaje(err.message));
    obtenerInventario()
      .then((inv) => setDisponible(Object.fromEntries(inv.productos.map((p) => [p.id, p.disponible]))))
      .catch((err) => setMensaje(err.message));
  }, []);

  if (!catalogos) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const productos = catalogos.productos.filter((p) => p.activo);
  const cliente = catalogos.clientes.find((c) => String(c.id) === formulario.id_cliente);
  const cambiar = (e) => setFormulario({ ...formulario, [e.target.name]: e.target.value });
  const cambiarItem = (i, campo, valor) => setItems(items.map((item, j) => (j === i ? { ...item, [campo]: valor } : item)));
  const elegidos = items.map((i) => i.id_producto).filter(Boolean);

  function enviar(e) {
    e.preventDefault();
    setMensaje("");
    setGuardando(true);
    registrarPedido({
      ...formulario,
      items: items.filter((i) => i.id_producto).map((i) => ({ id_producto: Number(i.id_producto), cantidad: Number(i.cantidad) }))
    })
      .then((pedido) => navegar(`/pedidos/${pedido.id}`, { state: { advertencias: pedido.advertencias } }))
      .catch((err) => setMensaje(err.message))
      .finally(() => setGuardando(false));
  }

  return (
    <div className="pagina-angosta">
      <div className="encabezado-pagina">
        <h2>Nuevo pedido</h2>
        <Link to="/pedidos">Volver</Link>
      </div>
      <p className="ayuda">Al guardar, el sistema avisa al almacén que hay un pedido por despachar. El pedido se despacha completo.</p>
      {mensaje && <p className="error">{mensaje}</p>}

      <form onSubmit={enviar} className="formulario-grilla">
        <fieldset>
          <legend>Cliente y entrega</legend>
          <label>Cliente *
            <select name="id_cliente" value={formulario.id_cliente} onChange={cambiar} required>
              <option value="">— Seleccione —</option>
              {catalogos.clientes.filter((c) => c.activo).map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
            </select>
            {cliente && <small className="ayuda">{TIPOS_CLIENTE[cliente.tipo]}{cliente.ciudad ? ` · ${cliente.ciudad}` : ""}</small>}
          </label>
          <label>Fecha de entrega *
            <input type="date" name="fecha_entrega" value={formulario.fecha_entrega} min={hoy()} max={sumarDias(hoy(), 30)} onChange={cambiar} required />
          </label>
          <label className="ancho-completo">Observación
            <input name="observacion" value={formulario.observacion} onChange={cambiar} placeholder="Ej.: entregar en el almacén municipal" />
          </label>
        </fieldset>

        <fieldset>
          <legend>Productos</legend>
          {items.map((item, i) => {
            const falta = item.id_producto && item.cantidad && Number(item.cantidad) > (disponible[item.id_producto] ?? 0);
            return (
              <div key={i} className="ancho-completo busqueda filtros">
                <select value={item.id_producto} onChange={(e) => cambiarItem(i, "id_producto", e.target.value)} required aria-label={`Producto ${i + 1}`}>
                  <option value="">— Producto —</option>
                  {productos.filter((p) => !elegidos.includes(String(p.id)) || String(p.id) === item.id_producto).map((p) => (
                    <option key={p.id} value={p.id}>{p.codigo} · {p.nombre} ({p.presentacion})</option>
                  ))}
                </select>
                <input type="number" min="1" step="1" placeholder="Cantidad *" value={item.cantidad} onChange={(e) => cambiarItem(i, "cantidad", e.target.value)} required aria-label={`Cantidad ${i + 1}`} />
                {item.id_producto && <small className={falta ? "fuera-norma" : "ayuda"}>Disponible hoy: {miles(disponible[item.id_producto] ?? 0)}</small>}
                {items.length > 1 && <button type="button" className="boton-enlace" onClick={() => setItems(items.filter((_, j) => j !== i))}>Quitar</button>}
              </div>
            );
          })}
          {items.length < productos.length && (
            <div className="ancho-completo">
              <button type="button" className="boton-enlace" onClick={() => setItems([...items, ITEM_VACIO])}>+ Agregar producto</button>
            </div>
          )}
          <p className="ayuda ancho-completo">Disponible hoy = lo que se puede despachar menos lo comprometido en otros pedidos pendientes.</p>
        </fieldset>

        <div className="barra-acciones">
          <button type="submit" className="boton-primario" disabled={guardando}>Registrar pedido</button>
          <Link to="/pedidos">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
