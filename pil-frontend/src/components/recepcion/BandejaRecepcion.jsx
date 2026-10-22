// Recepción de leche cruda: ingresos pendientes (esperando análisis o decisión) e historial con filtros.
// Las acciones disponibles dependen del puesto del usuario en el proceso.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { listarIngresos, obtenerCatalogos } from "../../api/recepcion";
import { ESTADOS_INGRESO, SUGERENCIAS, fechaHora, hoy, miles } from "../../formato";

function restarDias(fecha, dias) {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(a, m - 1, d - dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

// Qué le toca hacer al usuario con este ingreso (para resaltarlo en la tabla)
function accionPara(ingreso, permisos) {
  if (ingreso.estado === "en_analisis" && permisos.analizar) return "Analizar";
  if (ingreso.estado === "por_decidir" && permisos.decidir) return "Decidir";
  if (["aceptado", "derivado"].includes(ingreso.estado) && !ingreso.fecha_hora_descarga && permisos.registrar) return "Registrar descarga";
  return null;
}

function TablaIngresos({ ingresos, permisos, vacio, referencia }) {
  return (
    <div className="tabla-contenedor">
      <table>
        <thead>
          <tr>
            <th>Ingreso</th><th>Llegada</th><th>Proveedor</th><th>Cisterna</th><th>Volumen</th><th>Temp.</th>
            <th>Sugerencia</th><th>Estado</th><th>Lote</th><th></th>
          </tr>
        </thead>
        <tbody>
          {ingresos.map((i) => {
            const accion = accionPara(i, permisos);
            const estado = ESTADOS_INGRESO[i.estado];
            return (
              <tr key={i.id} className={accion ? "fila-seleccionada" : ""}>
                <td><Link to={`/recepcion/ingresos/${i.id}`}>{i.codigo}</Link></td>
                <td>{fechaHora(i.fecha_hora_llegada, referencia)}</td>
                <td>{i.proveedor}</td>
                <td>{i.placa}</td>
                <td>{miles(i.volumen_l)} L</td>
                <td>{String(i.temperatura_c).replace(".", ",")} °C</td>
                <td>{i.sugerencia ? <span className={`insignia ${SUGERENCIAS[i.sugerencia].clase}`}>{SUGERENCIAS[i.sugerencia].texto}</span> : "—"}</td>
                <td><span className={`insignia ${estado.clase}`}>{estado.texto}</span></td>
                <td>{i.codigo_lote || "—"}</td>
                <td>{accion ? <Link to={`/recepcion/ingresos/${i.id}`} className="boton-primario">{accion}</Link> : <Link to={`/recepcion/ingresos/${i.id}`}>Ver</Link>}</td>
              </tr>
            );
          })}
          {ingresos.length === 0 && <tr><td colSpan={10} className="vacio">{vacio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function BandejaRecepcion() {
  const { usuario } = useAuth();
  const permisos = usuario.permisos_recepcion;
  const [pendientes, setPendientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [filtros, setFiltros] = useState({ desde: restarDias(hoy(), 6), hasta: hoy(), estado: "", id_proveedor: "", buscar: "" });
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    obtenerCatalogos().then((c) => setProveedores(c.proveedores)).catch((err) => setMensaje(err.message));
    listarIngresos({ estado: "pendientes" }).then(setPendientes).catch((err) => setMensaje(err.message));
  }, []);

  const cargarHistorial = useCallback(() => {
    listarIngresos(filtros).then(setHistorial).catch((err) => setMensaje(err.message));
  }, [filtros]);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const cambiarFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });
  const litros = historial.reduce((suma, i) => suma + i.volumen_l, 0);

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Recepción de leche cruda</h2>
          <p className="subtitulo">Etapa 2 del proceso · el operador registra, el laboratorio analiza y el supervisor de calidad decide</p>
        </div>
        {permisos.registrar && <Link to="/recepcion/nuevo" className="boton-primario">Registrar ingreso</Link>}
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      <section>
        <h3>En curso ({pendientes.length})</h3>
        <TablaIngresos ingresos={pendientes} permisos={permisos} referencia={hoy()} vacio="No hay ingresos esperando análisis ni decisión." />
      </section>

      <section>
        <h3>Historial</h3>
        <div className="busqueda filtros">
          <input name="buscar" placeholder="Código de ingreso o lote, proveedor o placa..." value={filtros.buscar} onChange={cambiarFiltro} />
          <label className="casilla">Desde <input type="date" name="desde" value={filtros.desde} max={filtros.hasta} onChange={cambiarFiltro} /></label>
          <label className="casilla">Hasta <input type="date" name="hasta" value={filtros.hasta} min={filtros.desde} onChange={cambiarFiltro} /></label>
          <select name="estado" value={filtros.estado} onChange={cambiarFiltro} aria-label="Estado">
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS_INGRESO).map(([clave, e]) => <option key={clave} value={clave}>{e.texto}</option>)}
          </select>
          <select name="id_proveedor" value={filtros.id_proveedor} onChange={cambiarFiltro} aria-label="Proveedor">
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <p className="ayuda">{historial.length} ingresos · {miles(litros)} L recibidos en el período.</p>
        <TablaIngresos ingresos={historial} permisos={permisos} referencia={null} vacio="No hay ingresos para los filtros elegidos." />
      </section>
    </div>
  );
}
