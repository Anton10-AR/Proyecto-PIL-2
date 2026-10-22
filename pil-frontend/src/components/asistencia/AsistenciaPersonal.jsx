// Consulta de asistencia de los trabajadores visibles (supervisor: su equipo; RRHH y Gerencia: todos).
// RRHH además corrige marcaciones y registra las que faltan (siempre con una observación).
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import { listarTrabajadores, obtenerOpcionesPersonal } from "../../api/trabajadores";
import { consultarAsistencia, corregirAsistencia, registrarAsistenciaManual } from "../../api/asistencia";
import { fechaCorta, hoy, mesActual, textoRetraso } from "../../formato";

const MANUAL_VACIO = { id_trabajador: "", fecha: "", hora_entrada: "", hora_salida: "", observacion: "" };

function FilaEditable({ registro, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState({
    hora_entrada: registro.hora_entrada,
    hora_salida: registro.hora_salida || "",
    observacion: registro.observacion || ""
  });
  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });

  return (
    <tr className="fila-edicion">
      <td>{registro.apellido}, {registro.nombre}</td>
      <td>{fechaCorta(registro.fecha)}</td>
      <td>{registro.turno || "—"}</td>
      <td><input type="time" name="hora_entrada" value={datos.hora_entrada} onChange={cambiar} aria-label="Entrada" /></td>
      <td><input type="time" name="hora_salida" value={datos.hora_salida} onChange={cambiar} aria-label="Salida" /></td>
      <td colSpan={2}>
        <input name="observacion" value={datos.observacion} onChange={cambiar} placeholder="Motivo de la corrección (obligatorio)" aria-label="Observación" />
      </td>
      <td><div className="barra-acciones">
        <button onClick={() => alGuardar(registro.id, { ...datos, hora_salida: datos.hora_salida || null })}>Guardar</button>
        <button onClick={alCancelar}>Cancelar</button>
      </div></td>
    </tr>
  );
}

export default function AsistenciaPersonal() {
  const { usuario } = useAuth();
  const esRRHH = usuario.rol === "rrhh";
  const [trabajadores, setTrabajadores] = useState([]);
  const [areas, setAreas] = useState([]);
  const [filtros, setFiltros] = useState({ trabajador: "", mes: mesActual(), area: "", solo_retrasos: false });
  const [registros, setRegistros] = useState([]);
  const [editando, setEditando] = useState(null);
  const [manual, setManual] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    listarTrabajadores({ estado: "" }).then(setTrabajadores).catch((err) => setMensaje(err.message));
    obtenerOpcionesPersonal().then((o) => setAreas(o.areas)).catch(() => {});
  }, []);

  const cargar = useCallback(() => {
    consultarAsistencia(filtros).then(setRegistros).catch((err) => setMensaje(err.message));
  }, [filtros]);

  useEffect(() => { cargar(); }, [cargar]);

  function cambiarFiltro(e) {
    const { name, value, type, checked } = e.target;
    setFiltros({ ...filtros, [name]: type === "checkbox" ? checked : value });
  }

  function guardarCorreccion(id, datos) {
    setMensaje("");
    setAviso("");
    corregirAsistencia(id, datos)
      .then(() => { setEditando(null); setAviso("Marcación corregida"); cargar(); })
      .catch((err) => setMensaje(err.message));
  }

  function guardarManual(e) {
    e.preventDefault();
    setMensaje("");
    setAviso("");
    registrarAsistenciaManual({ ...manual, hora_salida: manual.hora_salida || null })
      .then(() => { setManual(null); setAviso("Marcación registrada"); cargar(); })
      .catch((err) => setMensaje(err.message));
  }

  const totalRetrasos = registros.filter((r) => r.minutos_retraso > 0).length;
  const columnas = esRRHH ? 8 : 7;

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Asistencia del {usuario.rol === "supervisor" ? "equipo" : "personal"}</h2>
        {esRRHH && !manual && (
          <button className="boton-primario" onClick={() => setManual({ ...MANUAL_VACIO, fecha: hoy() })}>Registrar marcación manual</button>
        )}
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      {manual && (
        <form onSubmit={guardarManual} className="formulario-grilla">
          <fieldset>
            <legend>Marcación manual</legend>
            <label>Trabajador *
              <select value={manual.id_trabajador} onChange={(e) => setManual({ ...manual, id_trabajador: e.target.value })} required>
                <option value="">— Seleccione —</option>
                {trabajadores.filter((t) => t.estado === "activo").map((t) => (
                  <option key={t.id} value={t.id}>{t.apellido}, {t.nombre}</option>
                ))}
              </select>
            </label>
            <label>Fecha *<input type="date" max={hoy()} value={manual.fecha} onChange={(e) => setManual({ ...manual, fecha: e.target.value })} required /></label>
            <label>Entrada *<input type="time" value={manual.hora_entrada} onChange={(e) => setManual({ ...manual, hora_entrada: e.target.value })} required /></label>
            <label>Salida<input type="time" value={manual.hora_salida} onChange={(e) => setManual({ ...manual, hora_salida: e.target.value })} /></label>
            <label className="ancho-completo">Observación *
              <input value={manual.observacion} onChange={(e) => setManual({ ...manual, observacion: e.target.value })} placeholder="Ej.: olvidó marcar, verificado con el supervisor" required />
            </label>
            <div className="barra-acciones ancho-completo">
              <button type="submit" className="boton-primario">Registrar</button>
              <button type="button" onClick={() => setManual(null)}>Cancelar</button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="busqueda filtros">
        <select name="trabajador" value={filtros.trabajador} onChange={cambiarFiltro} aria-label="Trabajador">
          <option value="">Todos los trabajadores</option>
          {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.apellido}, {t.nombre}</option>)}
        </select>
        {areas.length > 1 && (
          <select name="area" value={filtros.area} onChange={cambiarFiltro} aria-label="Área">
            <option value="">Todas las áreas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <input type="month" name="mes" value={filtros.mes} onChange={cambiarFiltro} aria-label="Mes" />
        <label className="casilla">
          <input type="checkbox" name="solo_retrasos" checked={filtros.solo_retrasos} onChange={cambiarFiltro} /> Solo retrasos
        </label>
      </div>
      <p className="ayuda">{registros.length} marcaciones · {totalRetrasos} con retraso</p>

      <div className="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Trabajador</th><th>Fecha</th><th>Turno</th><th>Entrada</th><th>Salida</th><th>Retraso</th><th>Horas</th>
              {esRRHH && <th></th>}
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => editando === r.id ? (
              <FilaEditable key={r.id} registro={r} alGuardar={guardarCorreccion} alCancelar={() => setEditando(null)} />
            ) : (
              <tr key={r.id}>
                <td>{r.apellido}, {r.nombre}</td>
                <td>{fechaCorta(r.fecha)}</td>
                <td>{r.turno || "—"}</td>
                <td>{r.hora_entrada}</td>
                <td>{r.hora_salida || "—"}</td>
                <td className={r.minutos_retraso > 0 ? "texto-alerta" : ""}>{textoRetraso(r.minutos_retraso)}</td>
                <td title={r.observacion ? `Corregido: ${r.observacion}` : undefined}>
                  {r.horas_trabajadas ?? "—"}{r.observacion && <span className="marca-correccion" aria-label="Corregido por RRHH"> ✎</span>}
                </td>
                {esRRHH && <td><button className="boton-enlace" onClick={() => setEditando(r.id)}>Corregir</button></td>}
              </tr>
            ))}
            {registros.length === 0 && <tr><td colSpan={columnas} className="vacio">Sin marcaciones para los filtros elegidos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
