// Productos y clientes. Los consultan todos los puestos de almacén y despacho; los productos (vida útil, litros
// por unidad) los mantiene la supervisión de producción y los clientes, atención de pedidos.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import { obtenerCatalogosAlmacen, crearProducto, actualizarProducto, crearCliente, actualizarCliente } from "../../api/almacen";
import { TIPOS_CLIENTE, decimal } from "../../formato";

const PESTANAS = [["productos", "Productos"], ["clientes", "Clientes"]];
const PRODUCTO_VACIO = { codigo: "", nombre: "", presentacion: "", litros_por_unidad: "", vida_util_dias: "" };
const CLIENTE_VACIO = { codigo: "", nombre: "", tipo: "distribuidor", ciudad: "", direccion: "", telefono: "" };

function EditorProducto({ producto, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState({ litros_por_unidad: producto.litros_por_unidad, vida_util_dias: producto.vida_util_dias });
  return (
    <tr className="fila-edicion">
      <td>{producto.codigo}</td>
      <td colSpan={5}>
        <form onSubmit={(e) => { e.preventDefault(); alGuardar({ litros_por_unidad: Number(datos.litros_por_unidad), vida_util_dias: Number(datos.vida_util_dias) }); }} className="busqueda filtros">
          <label className="casilla">Litros por unidad <input type="number" step="any" min="0.001" value={datos.litros_por_unidad} onChange={(e) => setDatos({ ...datos, litros_por_unidad: e.target.value })} required /></label>
          <label className="casilla">Vida útil (días) <input type="number" step="1" min="1" value={datos.vida_util_dias} onChange={(e) => setDatos({ ...datos, vida_util_dias: e.target.value })} required /></label>
          <button type="submit" className="boton-primario">Guardar</button>
          <button type="button" onClick={alCancelar}>Cancelar</button>
          <small className="ayuda">La nueva vida útil se aplica a los lotes que se registren desde ahora.</small>
        </form>
      </td>
    </tr>
  );
}

export default function CatalogosAlmacen() {
  const { usuario } = useAuth();
  const permisos = usuario.permisos_almacen;
  const [pestana, setPestana] = useState("productos");
  const [catalogos, setCatalogos] = useState(null);
  const [editando, setEditando] = useState(null);
  const [nuevoProducto, setNuevoProducto] = useState(PRODUCTO_VACIO);
  const [nuevoCliente, setNuevoCliente] = useState(CLIENTE_VACIO);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    obtenerCatalogosAlmacen().then(setCatalogos).catch((err) => setMensaje(err.message));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function ejecutar(promesa, texto, alTerminar) {
    setMensaje("");
    setAviso("");
    promesa.then(() => { setAviso(texto); alTerminar?.(); cargar(); }).catch((err) => setMensaje(err.message));
  }

  if (!catalogos) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const cambiarProducto = (e) => setNuevoProducto({ ...nuevoProducto, [e.target.name]: e.target.value });
  const cambiarCliente = (e) => setNuevoCliente({ ...nuevoCliente, [e.target.name]: e.target.value });

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Productos y clientes</h2>
          <p className="subtitulo">Los productos los mantiene la supervisión de producción; los clientes, atención de pedidos. Sin precios: el sistema registra qué lote llegó a qué cliente.</p>
        </div>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      <div className="pestanas" role="tablist">
        {PESTANAS.map(([clave, texto]) => (
          <button key={clave} role="tab" aria-selected={pestana === clave} className={pestana === clave ? "activa" : ""} onClick={() => setPestana(clave)}>{texto}</button>
        ))}
      </div>

      {pestana === "productos" && (
        <>
          {permisos.productos && (
            <form className="busqueda filtros" onSubmit={(e) => {
              e.preventDefault();
              ejecutar(crearProducto({ ...nuevoProducto, litros_por_unidad: Number(nuevoProducto.litros_por_unidad), vida_util_dias: Number(nuevoProducto.vida_util_dias) }),
                "Producto registrado", () => setNuevoProducto(PRODUCTO_VACIO));
            }}>
              <input name="codigo" placeholder="Código *" value={nuevoProducto.codigo} onChange={cambiarProducto} required aria-label="Código" />
              <input name="nombre" placeholder="Nombre *" value={nuevoProducto.nombre} onChange={cambiarProducto} required aria-label="Nombre" />
              <input name="presentacion" placeholder="Presentación * (ej.: Caja 1 L)" value={nuevoProducto.presentacion} onChange={cambiarProducto} required aria-label="Presentación" />
              <input name="litros_por_unidad" type="number" step="any" min="0.001" placeholder="Litros por unidad *" value={nuevoProducto.litros_por_unidad} onChange={cambiarProducto} required aria-label="Litros por unidad" />
              <input name="vida_util_dias" type="number" step="1" min="1" placeholder="Vida útil (días) *" value={nuevoProducto.vida_util_dias} onChange={cambiarProducto} required aria-label="Vida útil en días" />
              <button type="submit" className="boton-primario">Agregar producto</button>
            </form>
          )}
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Código</th><th>Nombre</th><th>Presentación</th><th>Litros por unidad</th><th>Vida útil</th><th>Estado</th>{permisos.productos && <th></th>}</tr></thead>
              <tbody>
                {catalogos.productos.map((p) => editando === p.id ? (
                  <EditorProducto key={p.id} producto={p} alCancelar={() => setEditando(null)}
                    alGuardar={(d) => ejecutar(actualizarProducto(p.id, d), "Producto actualizado", () => setEditando(null))} />
                ) : (
                  <tr key={p.id}>
                    <td>{p.codigo}</td><td>{p.nombre}</td><td>{p.presentacion}</td><td>{decimal(p.litros_por_unidad)} L</td><td>{p.vida_util_dias} días</td>
                    <td><span className={`insignia ${p.activo ? "insignia-activo" : "insignia-inactivo"}`}>{p.activo ? "Activo" : "Inactivo"}</span></td>
                    {permisos.productos && (
                      <td className="barra-acciones">
                        <button className="boton-enlace" onClick={() => setEditando(p.id)}>Modificar</button>
                        <button className="boton-enlace" onClick={() => ejecutar(actualizarProducto(p.id, { activo: !p.activo }), p.activo ? "Producto desactivado" : "Producto activado")}>{p.activo ? "Desactivar" : "Activar"}</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pestana === "clientes" && (
        <>
          {permisos.clientes && (
            <form className="busqueda filtros" onSubmit={(e) => {
              e.preventDefault();
              ejecutar(crearCliente(nuevoCliente), "Cliente registrado", () => setNuevoCliente(CLIENTE_VACIO));
            }}>
              <input name="codigo" placeholder="Código *" value={nuevoCliente.codigo} onChange={cambiarCliente} required aria-label="Código" />
              <input name="nombre" placeholder="Nombre *" value={nuevoCliente.nombre} onChange={cambiarCliente} required aria-label="Nombre" />
              <select name="tipo" value={nuevoCliente.tipo} onChange={cambiarCliente} aria-label="Tipo de cliente">
                {Object.entries(TIPOS_CLIENTE).map(([clave, texto]) => <option key={clave} value={clave}>{texto}</option>)}
              </select>
              <input name="ciudad" placeholder="Ciudad" value={nuevoCliente.ciudad} onChange={cambiarCliente} aria-label="Ciudad" />
              <input name="direccion" placeholder="Dirección" value={nuevoCliente.direccion} onChange={cambiarCliente} aria-label="Dirección" />
              <input name="telefono" placeholder="Teléfono" value={nuevoCliente.telefono} onChange={cambiarCliente} aria-label="Teléfono" />
              <button type="submit" className="boton-primario">Agregar cliente</button>
            </form>
          )}
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Ciudad</th><th>Dirección</th><th>Teléfono</th><th>Estado</th>{permisos.clientes && <th></th>}</tr></thead>
              <tbody>
                {catalogos.clientes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.codigo}</td><td>{c.nombre}</td><td>{TIPOS_CLIENTE[c.tipo]}</td><td>{c.ciudad || "—"}</td><td>{c.direccion || "—"}</td><td>{c.telefono || "—"}</td>
                    <td><span className={`insignia ${c.activo ? "insignia-activo" : "insignia-inactivo"}`}>{c.activo ? "Activo" : "Inactivo"}</span></td>
                    {permisos.clientes && <td><button className="boton-enlace" onClick={() => ejecutar(actualizarCliente(c.id, { activo: !c.activo }), c.activo ? "Cliente desactivado" : "Cliente activado")}>{c.activo ? "Desactivar" : "Activar"}</button></td>}
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
