// Detalle de un período de evaluación: avance, asignación de evaluaciones, cambio de evaluador y cierre.
// RRHH administra; Gerencia consulta.
import { Fragment, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { obtenerPeriodo, asignarEvaluaciones, cerrarPeriodo, reasignarEvaluador, quitarEvaluacion, listarPlantillas } from "../../api/evaluaciones";
import { listarTrabajadores } from "../../api/trabajadores";
import { NOMBRES_ROL } from "../../roles";
import { claseCategoria, rangoFechas } from "../../formato";

const ROLES_EVALUADORES = ["supervisor", "rrhh", "gerencia"];

function PanelAsignar({ candidatos, plantillas, idPlantillaSugerida, alConfirmar, alCerrar }) {
  const [elegidos, setElegidos] = useState([]);
  const [idPlantilla, setIdPlantilla] = useState(String(idPlantillaSugerida));
  const alternar = (id) => setElegidos(elegidos.includes(id) ? elegidos.filter((e) => e !== id) : [...elegidos, id]);

  return (
    <div className="panel-agregar">
      <div className="encabezado-pagina">
        <strong>Asignar evaluaciones</strong>
        <label className="casilla">Plantilla
          <select value={idPlantilla} onChange={(e) => setIdPlantilla(e.target.value)}>
            {plantillas.filter((p) => p.activa).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
      </div>
      <p className="ayuda">El evaluador será el supervisor directo de cada trabajador; si no tiene, deberá asignarlo después.</p>
      <div className="barra-acciones">
        <button className="boton-enlace" onClick={() => setElegidos(candidatos.map((c) => c.id))}>Seleccionar todos</button>
        <button className="boton-enlace" onClick={() => setElegidos([])}>Ninguno</button>
      </div>
      <ul className="lista-casillas">
        {candidatos.map((t) => (
          <li key={t.id}>
            <label className="casilla">
              <input type="checkbox" checked={elegidos.includes(t.id)} onChange={() => alternar(t.id)} />
              {t.apellido}, {t.nombre} <span className="ayuda">· {t.cargo || "Sin cargo"} · {t.nombre_supervisor ? `supervisor: ${t.nombre_supervisor}` : "sin supervisor"}</span>
            </label>
          </li>
        ))}
        {candidatos.length === 0 && <li className="ayuda">Todos los trabajadores activos ya tienen evaluación en este período.</li>}
      </ul>
      <div className="barra-acciones">
        <button className="boton-primario" disabled={elegidos.length === 0} onClick={() => alConfirmar(elegidos, idPlantilla)}>Asignar ({elegidos.length})</button>
        <button onClick={alCerrar}>Cerrar</button>
      </div>
    </div>
  );
}

export default function DetallePeriodo() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const esRRHH = usuario.rol === "rrhh";
  const [periodo, setPeriodo] = useState(null);
  const [trabajadores, setTrabajadores] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [asignando, setAsignando] = useState(false);
  const [reasignando, setReasignando] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    obtenerPeriodo(id).then(setPeriodo).catch((err) => setMensaje(err.message));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!esRRHH) return;
    listarTrabajadores({ estado: "activo" }).then(setTrabajadores).catch(() => {});
    listarPlantillas().then(setPlantillas).catch(() => {});
  }, [esRRHH]);

  function ejecutar(promesa, texto, alTerminar) {
    setMensaje("");
    setAviso("");
    promesa.then((r) => { setAviso(typeof texto === "function" ? texto(r) : texto); alTerminar?.(); cargar(); }).catch((err) => setMensaje(err.message));
  }

  if (!periodo) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const abierto = periodo.estado === "abierto";
  const yaEvaluados = new Set(periodo.evaluaciones.map((e) => e.id_trabajador));
  const candidatos = trabajadores.filter((t) => !yaEvaluados.has(t.id));
  const evaluadores = trabajadores.filter((t) => t.id_usuario && t.cuenta_activa && ROLES_EVALUADORES.includes(t.rol));

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Período {periodo.nombre}</h2>
          <p className="subtitulo">
            {rangoFechas(periodo.fecha_inicio, periodo.fecha_fin)} · plantilla sugerida: {periodo.plantilla}{" "}
            <span className={`insignia ${abierto ? "insignia-pendiente" : "insignia-inactivo"}`}>{periodo.estado}</span>
          </p>
        </div>
        <div className="barra-acciones">
          <Link to="/evaluaciones/gestion">Volver</Link>
          {esRRHH && abierto && !asignando && <button className="boton-primario" onClick={() => setAsignando(true)}>Asignar evaluaciones</button>}
          {esRRHH && abierto && (
            <button onClick={() => {
              const faltan = periodo.total - periodo.completadas;
              const texto = faltan > 0 ? `Quedan ${faltan} evaluación(es) sin completar y no podrán completarse. ¿Cerrar igual?` : "¿Cerrar el período? Las evaluaciones ya no podrán modificarse.";
              if (confirm(texto)) ejecutar(cerrarPeriodo(id), "Período cerrado");
            }}>Cerrar período</button>
          )}
        </div>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      <div className="tarjetas">
        <div className="tarjeta"><span className="tarjeta-valor">{periodo.completadas}/{periodo.total}</span><span className="tarjeta-etiqueta">Completadas</span></div>
        <div className="tarjeta"><span className="tarjeta-valor">{periodo.leidas}</span><span className="tarjeta-etiqueta">Leídas por el trabajador</span></div>
        <div className="tarjeta"><span className="tarjeta-valor">{periodo.promedio ?? "—"}</span><span className="tarjeta-etiqueta">Puntaje promedio</span></div>
        <div className="tarjeta"><span className="tarjeta-valor">{periodo.sin_evaluador}</span><span className="tarjeta-etiqueta">Sin evaluador</span></div>
      </div>

      {asignando && (
        <PanelAsignar
          candidatos={candidatos}
          plantillas={plantillas}
          idPlantillaSugerida={periodo.id_plantilla}
          alCerrar={() => setAsignando(false)}
          alConfirmar={(ids, idPlantilla) => ejecutar(
            asignarEvaluaciones(id, ids, idPlantilla),
            (r) => `${r.asignadas} evaluación(es) asignada(s)${r.sin_evaluador_nuevas ? `; ${r.sin_evaluador_nuevas} sin evaluador: asígnelo en la tabla` : ""}`,
            () => setAsignando(false)
          )}
        />
      )}

      <div className="tabla-contenedor">
        <table>
          <thead><tr><th>Trabajador</th><th>Área</th><th>Plantilla</th><th>Evaluador</th><th>Estado</th><th>Puntaje</th><th></th></tr></thead>
          <tbody>
            {periodo.evaluaciones.map((e) => (
              <Fragment key={e.id}>
                <tr>
                  <td>{e.apellido}, {e.nombre}</td>
                  <td>{e.area || "—"}</td>
                  <td>{e.plantilla}</td>
                  <td>{e.evaluador ? `${e.evaluador} (${NOMBRES_ROL[e.rol_evaluador]})` : <span className="texto-alerta">Sin asignar</span>}</td>
                  <td>
                    {e.estado === "completada" ? <span className="insignia insignia-activo">Completada</span> : <span className="insignia insignia-pendiente">Pendiente</span>}
                    {e.estado === "completada" && <div className="ayuda">{e.fecha_lectura ? "Leída" : "Sin leer"}</div>}
                  </td>
                  <td>{e.puntaje_final ? <span className={`insignia ${claseCategoria(e.categoria)}`}>{e.puntaje_final}</span> : "—"}</td>
                  <td><div className="barra-acciones">
                    <Link to={`/evaluaciones/${e.id}`}>Ver</Link>
                    {esRRHH && abierto && e.estado === "pendiente" && (
                      <>
                        <button className="boton-enlace" onClick={() => setReasignando(reasignando === e.id ? null : e.id)}>{e.evaluador ? "Cambiar evaluador" : "Asignar evaluador"}</button>
                        <button className="boton-enlace texto-peligro" onClick={() => confirm(`¿Quitar la evaluación de ${e.nombre} ${e.apellido}?`) && ejecutar(quitarEvaluacion(e.id), "Evaluación quitada")}>Quitar</button>
                      </>
                    )}
                  </div></td>
                </tr>
                {reasignando === e.id && (
                  <tr className="fila-edicion">
                    <td colSpan={7}>
                      <div className="barra-acciones">
                        <span>Nuevo evaluador:</span>
                        <select defaultValue="" onChange={(ev) => ev.target.value && ejecutar(reasignarEvaluador(e.id, Number(ev.target.value)), "Evaluador asignado; se le notificó", () => setReasignando(null))} aria-label="Evaluador">
                          <option value="">— Seleccione —</option>
                          {evaluadores.filter((t) => t.id !== e.id_trabajador).map((t) => (
                            <option key={t.id_usuario} value={t.id_usuario}>{t.apellido}, {t.nombre} ({NOMBRES_ROL[t.rol]})</option>
                          ))}
                        </select>
                        <button onClick={() => setReasignando(null)}>Cancelar</button>
                        {e.evaluador && <span className="ayuda">Las calificaciones parciales del evaluador anterior se descartan.</span>}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {periodo.evaluaciones.length === 0 && <tr><td colSpan={7} className="vacio">Todavía no se asignaron evaluaciones.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
