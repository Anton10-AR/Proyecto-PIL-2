// Parámetros de aceptación, proveedores y cisternas. Todos los puestos de recepción los consultan;
// solo el supervisor de calidad los modifica, y cada cambio de parámetro exige motivo y queda en la bitácora.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import {
  obtenerCatalogos, actualizarParametro, obtenerBitacoraParametros, crearProveedor, actualizarProveedor, crearCisterna, actualizarCisterna
} from "../../api/recepcion";
import { decimal, fechaHora, miles } from "../../formato";

const PESTANAS = [["parametros", "Parámetros de calidad"], ["proveedores", "Proveedores"], ["cisternas", "Cisternas"]];
const CAMPOS = { minimo: "Mínimo", maximo: "Máximo", critico: "Crítico" };

function EditorParametro({ parametro, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState({ minimo: parametro.minimo ?? "", maximo: parametro.maximo ?? "", critico: parametro.critico, motivo: "" });
  return (
    <tr className="fila-edicion">
      <td>{parametro.nombre}</td>
      <td colSpan={3}>
        <form onSubmit={(e) => { e.preventDefault(); alGuardar(datos); }} className="busqueda filtros">
          {parametro.tipo === "rango" && (
            <>
              <label className="casilla">Mín. <input type="number" step="any" value={datos.minimo} onChange={(e) => setDatos({ ...datos, minimo: e.target.value })} /></label>
              <label className="casilla">Máx. <input type="number" step="any" value={datos.maximo} onChange={(e) => setDatos({ ...datos, maximo: e.target.value })} /></label>
            </>
          )}
          <label className="casilla"><input type="checkbox" checked={datos.critico} onChange={(e) => setDatos({ ...datos, critico: e.target.checked })} /> Crítico</label>
          <input value={datos.motivo} onChange={(e) => setDatos({ ...datos, motivo: e.target.value })} required placeholder="Motivo (norma o instrucción que lo respalda) *" aria-label="Motivo" />
          <button type="submit" className="boton-primario">Guardar</button>
          <button type="button" onClick={alCancelar}>Cancelar</button>
        </form>
      </td>
    </tr>
  );
}

export default function Catalogos() {
  const { usuario } = useAuth();
  const puedeEditar = usuario.permisos_recepcion.administrar;
  const [pestana, setPestana] = useState("parametros");
  const [catalogos, setCatalogos] = useState(null);
  const [bitacora, setBitacora] = useState([]);
  const [editando, setEditando] = useState(null);
  const [nuevoProveedor, setNuevoProveedor] = useState({ codigo: "", nombre: "", centro_acopio: "", telefono: "" });
  const [nuevaCisterna, setNuevaCisterna] = useState({ placa: "", capacidad_l: "", transportista: "" });
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    obtenerCatalogos().then(setCatalogos).catch((err) => setMensaje(err.message));
    obtenerBitacoraParametros().then(setBitacora).catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function ejecutar(promesa, texto, alTerminar) {
    setMensaje("");
    setAviso("");
    promesa.then(() => { setAviso(texto); alTerminar?.(); cargar(); }).catch((err) => setMensaje(err.message));
  }

  if (!catalogos) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Parámetros y proveedores</h2>
          <p className="subtitulo">{puedeEditar ? "Como supervisor de calidad, puede modificar estos datos." : "Solo el supervisor de calidad modifica estos datos."}</p>
        </div>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      <div className="pestanas" role="tablist">
        {PESTANAS.map(([clave, texto]) => (
          <button key={clave} role="tab" aria-selected={pestana === clave} className={pestana === clave ? "activa" : ""} onClick={() => setPestana(clave)}>{texto}</button>
        ))}
      </div>

      {pestana === "parametros" && (
        <>
          <p className="ayuda">
            Si un parámetro <strong>crítico</strong> no se cumple, el sistema sugiere rechazar; si falla uno no crítico, sugiere derivar.
            La decisión siempre la confirma el supervisor de calidad. Valores de referencia del documento técnico: confirmar los vigentes con la norma.
          </p>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Parámetro</th><th>Límite de aceptación</th><th>Tipo</th><th>Última modificación</th>{puedeEditar && <th></th>}</tr></thead>
              <tbody>
                {catalogos.parametros.map((p) => editando === p.codigo ? (
                  <EditorParametro key={p.codigo} parametro={p} alCancelar={() => setEditando(null)}
                    alGuardar={(d) => ejecutar(actualizarParametro(p.codigo, d), "Parámetro actualizado y registrado en la bitácora", () => setEditando(null))} />
                ) : (
                  <tr key={p.codigo}>
                    <td>{p.nombre}</td>
                    <td>{p.limite}</td>
                    <td>{p.critico ? <span className="insignia insignia-injustificada">Crítico · rechazar</span> : <span className="insignia insignia-derivado">No crítico · derivar</span>}</td>
                    <td>{p.fecha_actualizacion ? fechaHora(p.fecha_actualizacion) : "Valor inicial"}</td>
                    {puedeEditar && <td><button className="boton-enlace" onClick={() => setEditando(p.codigo)}>Modificar</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Bitácora de cambios</h3>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Fecha</th><th>Parámetro</th><th>Campo</th><th>Antes</th><th>Después</th><th>Motivo</th><th>Usuario</th></tr></thead>
              <tbody>
                {bitacora.map((b) => (
                  <tr key={b.id}>
                    <td>{fechaHora(b.fecha)}</td><td>{b.parametro || b.id_registro}</td><td>{CAMPOS[b.campo] || b.campo}</td>
                    <td>{b.campo === "critico" ? (b.valor_anterior === "1" ? "Sí" : "No") : decimal(b.valor_anterior)}</td>
                    <td>{b.campo === "critico" ? (b.valor_nuevo === "1" ? "Sí" : "No") : decimal(b.valor_nuevo)}</td>
                    <td>{b.motivo}</td><td>{b.usuario}</td>
                  </tr>
                ))}
                {bitacora.length === 0 && <tr><td colSpan={7} className="vacio">Sin cambios registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pestana === "proveedores" && (
        <>
          {puedeEditar && (
            <form className="busqueda filtros" onSubmit={(e) => {
              e.preventDefault();
              ejecutar(crearProveedor(nuevoProveedor), "Proveedor registrado", () => setNuevoProveedor({ codigo: "", nombre: "", centro_acopio: "", telefono: "" }));
            }}>
              <input placeholder="Código *" value={nuevoProveedor.codigo} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, codigo: e.target.value })} required aria-label="Código" />
              <input placeholder="Nombre *" value={nuevoProveedor.nombre} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, nombre: e.target.value })} required aria-label="Nombre" />
              <input placeholder="Centro de acopio" value={nuevoProveedor.centro_acopio} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, centro_acopio: e.target.value })} aria-label="Centro de acopio" />
              <input placeholder="Teléfono" value={nuevoProveedor.telefono} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, telefono: e.target.value })} aria-label="Teléfono" />
              <button type="submit" className="boton-primario">Agregar proveedor</button>
            </form>
          )}
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Código</th><th>Nombre</th><th>Centro de acopio</th><th>Teléfono</th><th>Estado</th>{puedeEditar && <th></th>}</tr></thead>
              <tbody>
                {catalogos.proveedores.map((p) => (
                  <tr key={p.id}>
                    <td>{p.codigo}</td><td>{p.nombre}</td><td>{p.centro_acopio || "—"}</td><td>{p.telefono || "—"}</td>
                    <td><span className={`insignia ${p.activo ? "insignia-activo" : "insignia-inactivo"}`}>{p.activo ? "Activo" : "Inactivo"}</span></td>
                    {puedeEditar && <td><button className="boton-enlace" onClick={() => ejecutar(actualizarProveedor(p.id, { activo: !p.activo }), p.activo ? "Proveedor desactivado" : "Proveedor activado")}>{p.activo ? "Desactivar" : "Activar"}</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pestana === "cisternas" && (
        <>
          {puedeEditar && (
            <form className="busqueda filtros" onSubmit={(e) => {
              e.preventDefault();
              ejecutar(crearCisterna(nuevaCisterna), "Cisterna registrada", () => setNuevaCisterna({ placa: "", capacidad_l: "", transportista: "" }));
            }}>
              <input placeholder="Placa *" value={nuevaCisterna.placa} onChange={(e) => setNuevaCisterna({ ...nuevaCisterna, placa: e.target.value })} required aria-label="Placa" />
              <input type="number" min="1" placeholder="Capacidad (L) *" value={nuevaCisterna.capacidad_l} onChange={(e) => setNuevaCisterna({ ...nuevaCisterna, capacidad_l: e.target.value })} required aria-label="Capacidad en litros" />
              <input placeholder="Transportista" value={nuevaCisterna.transportista} onChange={(e) => setNuevaCisterna({ ...nuevaCisterna, transportista: e.target.value })} aria-label="Transportista" />
              <button type="submit" className="boton-primario">Agregar cisterna</button>
            </form>
          )}
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Placa</th><th>Capacidad</th><th>Transportista</th><th>Estado</th>{puedeEditar && <th></th>}</tr></thead>
              <tbody>
                {catalogos.cisternas.map((c) => (
                  <tr key={c.id}>
                    <td>{c.placa}</td><td>{miles(c.capacidad_l)} L</td><td>{c.transportista || "—"}</td>
                    <td><span className={`insignia ${c.activo ? "insignia-activo" : "insignia-inactivo"}`}>{c.activo ? "Activa" : "Inactiva"}</span></td>
                    {puedeEditar && <td><button className="boton-enlace" onClick={() => ejecutar(actualizarCisterna(c.id, { activo: !c.activo }), c.activo ? "Cisterna desactivada" : "Cisterna activada")}>{c.activo ? "Desactivar" : "Activar"}</button></td>}
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
