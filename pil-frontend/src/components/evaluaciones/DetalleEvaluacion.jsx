// Detalle de una evaluación del desempeño.
// - Evaluador con el período abierto: califica 1 a 5 cada criterio, escribe la retroalimentación,
//   guarda un borrador o la completa (el trabajador recién la ve al completarla).
// - Evaluado: la lee y confirma la lectura.
// - Plan de mejora: el evaluador (período abierto) o RRHH agregan acciones; el responsable actualiza su avance.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import {
  obtenerEvaluacion, guardarEvaluacion, confirmarLectura, agregarAccion, actualizarAccion, eliminarAccion
} from "../../api/evaluaciones";
import { listarCapacitaciones } from "../../api/capacitaciones";
import { ESCALA_EVALUACION, ESTADOS_ACCION, claseCategoria, fechaCorta } from "../../formato";

// Mismo cálculo que el backend (utils/evaluacion.js), solo como vista previa
function puntajePrevio(criterios, calificaciones) {
  if (criterios.some((c) => !calificaciones[c.id]?.puntaje)) return null;
  const suma = criterios.reduce((total, c) => total + calificaciones[c.id].puntaje * c.peso, 0);
  return Math.round((suma / 100) * 100) / 100;
}

function Insignia({ info }) {
  return info ? <span className={`insignia ${info.clase}`}>{info.texto}</span> : null;
}

function PlanDeMejora({ evaluacion, usuario, alCambiar, setMensaje }) {
  const [nueva, setNueva] = useState(null);
  const [capacitaciones, setCapacitaciones] = useState([]);
  const gestiona = evaluacion.puede_gestionar_acciones;

  useEffect(() => {
    if (gestiona) listarCapacitaciones({ vista: "todas" }).then(setCapacitaciones).catch(() => {});
  }, [gestiona]);

  function ejecutar(promesa, alTerminar) {
    setMensaje("");
    promesa.then(() => { alTerminar?.(); alCambiar(); }).catch((err) => setMensaje(err.message));
  }

  const puedeActualizarEstado = (a) => gestiona || a.id_responsable === usuario.id_trabajador || evaluacion.id_evaluador === usuario.id;

  return (
    <section>
      <div className="encabezado-pagina">
        <h3>Plan de mejora</h3>
        {gestiona && !nueva && <button className="boton-primario" onClick={() => setNueva({ descripcion: "", fecha_limite: "", id_capacitacion: "" })}>Agregar acción</button>}
      </div>
      {nueva && (
        <form
          className="formulario-grilla"
          onSubmit={(e) => { e.preventDefault(); ejecutar(agregarAccion(evaluacion.id, { ...nueva, id_capacitacion: nueva.id_capacitacion || null }), () => setNueva(null)); }}
        >
          <fieldset>
            <legend>Nueva acción de mejora</legend>
            <label className="ancho-completo">Acción *<input value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} required /></label>
            <label>Fecha límite *<input type="date" value={nueva.fecha_limite} onChange={(e) => setNueva({ ...nueva, fecha_limite: e.target.value })} required /></label>
            <label>Capacitación vinculada
              <select value={nueva.id_capacitacion} onChange={(e) => setNueva({ ...nueva, id_capacitacion: e.target.value })}>
                <option value="">— Ninguna —</option>
                {capacitaciones.filter((c) => c.estado !== "cancelada").map((c) => <option key={c.id} value={c.id}>{c.titulo} ({c.fecha_inicio})</option>)}
              </select>
            </label>
            <p className="ayuda ancho-completo">El responsable será {evaluacion.nombre} {evaluacion.apellido}.</p>
            <div className="barra-acciones ancho-completo">
              <button type="submit" className="boton-primario">Agregar</button>
              <button type="button" onClick={() => setNueva(null)}>Cancelar</button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="tabla-contenedor">
        <table>
          <thead><tr><th>Acción</th><th>Responsable</th><th>Fecha límite</th><th>Capacitación</th><th>Avance</th>{gestiona && <th></th>}</tr></thead>
          <tbody>
            {evaluacion.acciones.map((a) => (
              <tr key={a.id}>
                <td>{a.descripcion}</td>
                <td>{a.responsable}</td>
                <td>{fechaCorta(a.fecha_limite)}</td>
                <td>{a.id_capacitacion ? <Link to={`/capacitaciones/${a.id_capacitacion}`}>{a.capacitacion}</Link> : "—"}</td>
                <td>
                  {puedeActualizarEstado(a) ? (
                    <select value={a.estado} onChange={(e) => ejecutar(actualizarAccion(a.id, { estado: e.target.value }))} aria-label="Avance">
                      {Object.entries(ESTADOS_ACCION).map(([clave, { texto }]) => <option key={clave} value={clave}>{texto}</option>)}
                    </select>
                  ) : <Insignia info={ESTADOS_ACCION[a.estado]} />}
                </td>
                {gestiona && (
                  <td><button className="boton-enlace texto-peligro" onClick={() => confirm("¿Eliminar esta acción?") && ejecutar(eliminarAccion(a.id))}>Eliminar</button></td>
                )}
              </tr>
            ))}
            {evaluacion.acciones.length === 0 && <tr><td colSpan={gestiona ? 6 : 5} className="vacio">Sin acciones de mejora.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DetalleEvaluacion() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [evaluacion, setEvaluacion] = useState(null);
  const [calificaciones, setCalificaciones] = useState({});
  const [retroalimentacion, setRetroalimentacion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    obtenerEvaluacion(id)
      .then((e) => {
        setEvaluacion(e);
        setCalificaciones(e.calificaciones);
        setRetroalimentacion(e.retroalimentacion || "");
      })
      .catch((err) => setMensaje(err.message));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const previo = useMemo(
    () => (evaluacion ? puntajePrevio(evaluacion.criterios, calificaciones) : null),
    [evaluacion, calificaciones]
  );

  function calificar(idCriterio, campo, valor) {
    setCalificaciones({ ...calificaciones, [idCriterio]: { ...calificaciones[idCriterio], [campo]: valor } });
  }

  function guardar(completar) {
    setMensaje("");
    setAviso("");
    setGuardando(true);
    const lista = Object.entries(calificaciones)
      .filter(([, c]) => c?.puntaje)
      .map(([idCriterio, c]) => ({ id_criterio: Number(idCriterio), puntaje: c.puntaje, observacion: c.observacion || null }));
    guardarEvaluacion(id, { calificaciones: lista, retroalimentacion, completar })
      .then((e) => { setAviso(e.estado === "completada" ? "Evaluación guardada y disponible para el trabajador" : "Borrador guardado"); cargar(); })
      .catch((err) => setMensaje(err.message))
      .finally(() => setGuardando(false));
  }

  if (!evaluacion) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const e = evaluacion;
  const editable = e.puede_editar;
  const esPropia = e.id_trabajador === usuario.id_trabajador;

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Evaluación de {e.nombre} {e.apellido}</h2>
          <p className="subtitulo">
            Período {e.periodo} ({e.estado_periodo}) · {e.plantilla} · Evaluador: {e.evaluador || "sin asignar"}
          </p>
        </div>
        <Link to={esPropia ? "/evaluaciones" : "/evaluaciones/asignadas"}>Volver</Link>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      <div className="resumen-evaluacion">
        <div className="tarjeta">
          <span className="tarjeta-valor">{e.puntaje_final ?? previo ?? "—"}</span>
          <span className="tarjeta-etiqueta">{e.puntaje_final !== null ? "Puntaje final (1 a 5)" : "Vista previa del puntaje"}</span>
        </div>
        {e.categoria && <span className={`insignia insignia-grande ${claseCategoria(e.categoria)}`}>{e.categoria}</span>}
        <div className="ayuda">
          {e.estado === "completada" ? `Completada el ${e.fecha_completada}` : "Pendiente"}
          {e.fecha_lectura ? ` · Leída por el trabajador el ${e.fecha_lectura}` : e.estado === "completada" ? " · Aún no leída por el trabajador" : ""}
        </div>
      </div>
      {editable && e.estado === "completada" && (
        <p className="aviso">Ya está completada y el trabajador puede verla. Puede corregirla mientras el período siga abierto.</p>
      )}

      <section>
        <h3>Criterios</h3>
        <div className="criterios">
          {e.criterios.map((c) => {
            const actual = calificaciones[c.id] || {};
            return (
              <div key={c.id} className="criterio">
                <div className="criterio-encabezado">
                  <strong>{c.nombre}</strong> <span className="ayuda">· peso {c.peso}%</span>
                  {c.descripcion && <div className="ayuda">{c.descripcion}</div>}
                </div>
                <div className="escala" role="radiogroup" aria-label={c.nombre}>
                  {[1, 2, 3, 4, 5].map((valor) => (
                    <label key={valor} className={`escala-opcion${actual.puntaje === valor ? " seleccionada" : ""}${editable ? "" : " solo-lectura"}`}>
                      <input
                        type="radio"
                        name={`criterio-${c.id}`}
                        value={valor}
                        checked={actual.puntaje === valor}
                        disabled={!editable}
                        onChange={() => calificar(c.id, "puntaje", valor)}
                      />
                      <span className="escala-valor">{valor}</span>
                      <span className="escala-texto">{ESCALA_EVALUACION[valor]}</span>
                    </label>
                  ))}
                </div>
                {editable ? (
                  <input className="criterio-observacion" placeholder="Observación (opcional)" value={actual.observacion || ""} onChange={(ev) => calificar(c.id, "observacion", ev.target.value)} />
                ) : actual.observacion && <p className="ayuda">Observación: {actual.observacion}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3>Retroalimentación</h3>
        {editable ? (
          <textarea className="area-texto" rows={4} value={retroalimentacion} onChange={(ev) => setRetroalimentacion(ev.target.value)} placeholder="Fortalezas, aspectos a mejorar y acuerdos" />
        ) : <p className="texto-largo">{e.retroalimentacion || "—"}</p>}
        {editable && (
          <div className="barra-acciones">
            {e.estado === "pendiente" && <button disabled={guardando} onClick={() => guardar(false)}>Guardar borrador</button>}
            <button className="boton-primario" disabled={guardando} onClick={() => guardar(true)}>
              {e.estado === "pendiente" ? "Completar evaluación" : "Guardar cambios"}
            </button>
          </div>
        )}
        {e.puede_confirmar_lectura && (
          <div className="barra-acciones">
            <button className="boton-primario" onClick={() => confirmarLectura(id).then(() => { setAviso("Lectura confirmada"); cargar(); }).catch((err) => setMensaje(err.message))}>
              Confirmar que leí mi evaluación
            </button>
          </div>
        )}
      </section>

      <PlanDeMejora evaluacion={e} usuario={usuario} alCambiar={cargar} setMensaje={setMensaje} />
    </div>
  );
}
