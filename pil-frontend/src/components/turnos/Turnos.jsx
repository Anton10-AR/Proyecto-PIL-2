// Turnos: catálogo (RRHH lo administra) y turno vigente de cada trabajador, con asignación e historial
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import { listarTurnos, crearTurno, actualizarTurno, listarTurnosVigentes, listarAsignaciones, asignarTurno } from "../../api/turnos";
import { NOMBRES_DIA_ISO, fechaCorta, hoy } from "../../formato";

const TURNO_VACIO = { nombre: "", hora_inicio: "", hora_fin: "", dias_laborables: [1, 2, 3, 4, 5] };

function FormularioTurno({ inicial, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState(inicial);

  function alternarDia(dia) {
    const dias = datos.dias_laborables.includes(dia)
      ? datos.dias_laborables.filter((d) => d !== dia)
      : [...datos.dias_laborables, dia];
    setDatos({ ...datos, dias_laborables: dias });
  }

  return (
    <form className="formulario-grilla" onSubmit={(e) => { e.preventDefault(); alGuardar(datos); }}>
      <fieldset>
        <legend>{inicial.id ? `Editar turno ${inicial.nombre}` : "Nuevo turno"}</legend>
        <label>Nombre *<input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} required /></label>
        <label>Hora de inicio *<input type="time" value={datos.hora_inicio} onChange={(e) => setDatos({ ...datos, hora_inicio: e.target.value })} required /></label>
        <label>Hora de fin *<input type="time" value={datos.hora_fin} onChange={(e) => setDatos({ ...datos, hora_fin: e.target.value })} required /></label>
        <div className="ancho-completo">
          <span className="etiqueta-campo">Días laborables *</span>
          <div className="dias-semana">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <label key={d} className="casilla">
                <input type="checkbox" checked={datos.dias_laborables.includes(d)} onChange={() => alternarDia(d)} />
                {NOMBRES_DIA_ISO[d]}
              </label>
            ))}
          </div>
        </div>
        <p className="ayuda ancho-completo">Los turnos empiezan y terminan el mismo día (no hay turnos nocturnos).</p>
        <div className="barra-acciones ancho-completo">
          <button type="submit" className="boton-primario">Guardar</button>
          <button type="button" onClick={alCancelar}>Cancelar</button>
        </div>
      </fieldset>
    </form>
  );
}

function FilaAsignar({ fila, turnos, alAsignar, alCancelar }) {
  const [idTurno, setIdTurno] = useState("");
  const [desde, setDesde] = useState(hoy());
  return (
    <div className="barra-acciones">
      <select value={idTurno} onChange={(e) => setIdTurno(e.target.value)} aria-label="Turno">
        <option value="">— Turno —</option>
        {turnos.filter((t) => t.activo && t.id !== fila.id_turno).map((t) => (
          <option key={t.id} value={t.id}>{t.nombre} ({t.hora_inicio}–{t.hora_fin})</option>
        ))}
      </select>
      <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
      <button disabled={!idTurno} onClick={() => alAsignar({ id_trabajador: fila.id_trabajador, id_turno: Number(idTurno), fecha_desde: desde })}>
        Asignar
      </button>
      <button onClick={alCancelar}>Cancelar</button>
    </div>
  );
}

export default function Turnos() {
  const { usuario } = useAuth();
  const esRRHH = usuario.rol === "rrhh";
  const [turnos, setTurnos] = useState([]);
  const [vigentes, setVigentes] = useState([]);
  const [formulario, setFormulario] = useState(null);
  const [asignando, setAsignando] = useState(null);
  const [historial, setHistorial] = useState({ id: null, filas: [] });
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    listarTurnos().then(setTurnos).catch((err) => setMensaje(err.message));
    listarTurnosVigentes().then(setVigentes).catch((err) => setMensaje(err.message));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function ejecutar(promesa, textoExito, alTerminar) {
    setMensaje("");
    setAviso("");
    promesa
      .then(() => { setAviso(textoExito); alTerminar?.(); cargar(); })
      .catch((err) => setMensaje(err.message));
  }

  function guardarTurno(datos) {
    const accion = datos.id ? actualizarTurno(datos.id, datos) : crearTurno(datos);
    ejecutar(accion, datos.id ? "Turno actualizado" : "Turno creado", () => setFormulario(null));
  }

  function verHistorial(idTrabajador) {
    if (historial.id === idTrabajador) return setHistorial({ id: null, filas: [] });
    listarAsignaciones(idTrabajador)
      .then((filas) => setHistorial({ id: idTrabajador, filas }))
      .catch((err) => setMensaje(err.message));
  }

  return (
    <div>
      <h2>Turnos</h2>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      <section>
        <div className="encabezado-pagina">
          <h3>Catálogo de turnos</h3>
          {esRRHH && !formulario && <button className="boton-primario" onClick={() => setFormulario(TURNO_VACIO)}>Nuevo turno</button>}
        </div>
        {formulario && (
          <FormularioTurno key={formulario.id || "nuevo"} inicial={formulario} alGuardar={guardarTurno} alCancelar={() => setFormulario(null)} />
        )}
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr><th>Turno</th><th>Horario</th><th>Días</th><th>Trabajadores</th><th>Estado</th>{esRRHH && <th></th>}</tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id}>
                  <td>{t.nombre}</td>
                  <td>{t.hora_inicio} – {t.hora_fin}</td>
                  <td>{t.dias_texto}</td>
                  <td>{t.asignados}</td>
                  <td><span className={`insignia insignia-${t.activo ? "activo" : "inactivo"}`}>{t.activo ? "activo" : "inactivo"}</span></td>
                  {esRRHH && (
                    <td><div className="barra-acciones">
                      <button className="boton-enlace" onClick={() => setFormulario({ ...t, dias_laborables: t.dias_laborables.split(",").map(Number) })}>Editar</button>
                      <button className="boton-enlace" onClick={() => ejecutar(actualizarTurno(t.id, { activo: !t.activo }), t.activo ? "Turno desactivado" : "Turno activado")}>
                        {t.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Turno vigente por trabajador</h3>
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr><th>Trabajador</th><th>Área</th><th>Turno</th><th>Horario</th><th>Desde</th><th></th></tr>
            </thead>
            <tbody>
              {vigentes.map((v) => (
                <FilaVigente
                  key={v.id_trabajador}
                  v={v}
                  esRRHH={esRRHH}
                  turnos={turnos}
                  asignando={asignando === v.id_trabajador}
                  historial={historial.id === v.id_trabajador ? historial.filas : null}
                  alVerHistorial={() => verHistorial(v.id_trabajador)}
                  alIniciarAsignacion={() => setAsignando(v.id_trabajador)}
                  alCancelarAsignacion={() => setAsignando(null)}
                  alAsignar={(datos) => ejecutar(asignarTurno(datos), "Turno asignado; se notificó al trabajador", () => {
                    setAsignando(null);
                    setHistorial({ id: null, filas: [] });
                  })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FilaVigente({ v, esRRHH, turnos, asignando, historial, alVerHistorial, alIniciarAsignacion, alCancelarAsignacion, alAsignar }) {
  return (
    <>
      <tr>
        <td>{v.apellido}, {v.nombre}</td>
        <td>{v.area || "—"}</td>
        <td>
          {v.turno || <span className="texto-alerta">Sin turno</span>}
          {v.programada && <div className="ayuda">Desde el {fechaCorta(v.programada.fecha_desde)}: {v.programada.turno}</div>}
        </td>
        <td>{v.turno ? `${v.hora_inicio} – ${v.hora_fin} · ${v.dias_texto}` : "—"}</td>
        <td>{v.fecha_desde ? fechaCorta(v.fecha_desde) : "—"}</td>
        <td><div className="barra-acciones">
          <button className="boton-enlace" onClick={alVerHistorial}>{historial ? "Ocultar historial" : "Historial"}</button>
          {esRRHH && !asignando && <button className="boton-enlace" onClick={alIniciarAsignacion}>Cambiar turno</button>}
        </div></td>
      </tr>
      {asignando && (
        <tr className="fila-edicion">
          <td colSpan={6}><FilaAsignar fila={v} turnos={turnos} alAsignar={alAsignar} alCancelar={alCancelarAsignacion} /></td>
        </tr>
      )}
      {historial && (
        <tr className="fila-detalle">
          <td colSpan={6}>
            <ul className="lista-simple">
              {historial.map((a) => (
                <li key={a.id}>
                  {a.turno} ({a.hora_inicio}–{a.hora_fin}, {a.dias_texto}): {fechaCorta(a.fecha_desde)} → {a.fecha_hasta ? fechaCorta(a.fecha_hasta) : "vigente"}
                </li>
              ))}
              {historial.length === 0 && <li>Sin asignaciones.</li>}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
