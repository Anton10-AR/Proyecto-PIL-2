// Detalle de una capacitación: datos, participantes y acciones según el rol.
// RRHH: editar, cancelar, finalizar, inscribir, resolver propuestas, registrar resultados y certificados.
// Supervisor: proponer a miembros de su equipo y retirar sus propuestas. Los demás consultan.
import { Fragment, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import {
  obtenerCapacitacion, cancelarCapacitacion, finalizarCapacitacion, agregarParticipantes,
  resolverPropuesta, quitarParticipante, registrarResultado
} from "../../api/capacitaciones";
import { listarTrabajadores } from "../../api/trabajadores";
import { subirArchivo, verArchivo } from "../../api/solicitudes";
import { ESTADOS_CAPACITACION, INSCRIPCION_CAPACITACION, RESULTADOS_CAPACITACION, rangoFechas } from "../../formato";

function Insignia({ mapa, clave }) {
  const info = mapa[clave];
  return info ? <span className={`insignia ${info.clase}`}>{info.texto}</span> : null;
}

// Lista de trabajadores con casillas para inscribir (RRHH) o proponer (supervisor)
function PanelAgregar({ candidatos, esPropuesta, alConfirmar, alCerrar }) {
  const [filtro, setFiltro] = useState("");
  const [elegidos, setElegidos] = useState([]);
  const visibles = candidatos.filter((t) =>
    `${t.nombre} ${t.apellido} ${t.area || ""} ${t.cargo || ""}`.toLowerCase().includes(filtro.toLowerCase())
  );
  const alternar = (id) => setElegidos(elegidos.includes(id) ? elegidos.filter((e) => e !== id) : [...elegidos, id]);

  return (
    <div className="panel-agregar">
      <div className="encabezado-pagina">
        <strong>{esPropuesta ? "Proponer miembros de su equipo" : "Inscribir participantes"}</strong>
        <input placeholder="Filtrar por nombre, área o cargo" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar" />
      </div>
      {esPropuesta && <p className="ayuda">RRHH confirmará o descartará cada propuesta.</p>}
      <ul className="lista-casillas">
        {visibles.map((t) => (
          <li key={t.id}>
            <label className="casilla">
              <input type="checkbox" checked={elegidos.includes(t.id)} onChange={() => alternar(t.id)} />
              {t.apellido}, {t.nombre} <span className="ayuda">· {t.cargo || "Sin cargo"} · {t.area || "Sin área"}</span>
            </label>
          </li>
        ))}
        {visibles.length === 0 && <li className="ayuda">No hay trabajadores disponibles.</li>}
      </ul>
      <div className="barra-acciones">
        <button className="boton-primario" disabled={elegidos.length === 0} onClick={() => alConfirmar(elegidos)}>
          {esPropuesta ? "Proponer" : "Inscribir"} seleccionados ({elegidos.length})
        </button>
        <button onClick={alCerrar}>Cerrar</button>
      </div>
    </div>
  );
}

// Edición en línea del resultado de un participante (RRHH)
function FilaResultado({ participante, columnas, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState({
    resultado: participante.resultado || "aprobado",
    asistencia_pct: participante.asistencia_pct ?? 100,
    nota: participante.nota ?? "",
    observacion: participante.observacion || ""
  });
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });
  const noAsistio = datos.resultado === "no_asistio";

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      const cuerpo = { ...datos, asistencia_pct: noAsistio ? 0 : datos.asistencia_pct };
      if (archivo && datos.resultado === "aprobado") cuerpo.id_archivo_certificado = (await subirArchivo(archivo)).id;
      await alGuardar(cuerpo);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <tr className="fila-edicion">
      <td colSpan={columnas}>
        <div className="formulario-resultado">
          <strong>{participante.apellido}, {participante.nombre}</strong>
          {error && <p className="error campo-ancho">{error}</p>}
          <label>Resultado
            <select name="resultado" value={datos.resultado} onChange={cambiar}>
              {Object.entries(RESULTADOS_CAPACITACION).map(([clave, { texto }]) => <option key={clave} value={clave}>{texto}</option>)}
            </select>
          </label>
          <label>Asistencia (%)
            <input type="number" min="0" max="100" name="asistencia_pct" value={noAsistio ? 0 : datos.asistencia_pct} onChange={cambiar} disabled={noAsistio} />
          </label>
          <label>Nota (0–100)
            <input type="number" min="0" max="100" step="0.5" name="nota" value={noAsistio ? "" : datos.nota} onChange={cambiar} disabled={noAsistio} placeholder="Opcional" />
          </label>
          <label className="campo-ancho">Observación<input name="observacion" value={datos.observacion} onChange={cambiar} /></label>
          {datos.resultado === "aprobado" && (
            <label className="campo-ancho">
              Certificado {participante.certificado_nombre ? `(actual: ${participante.certificado_nombre}; elija otro para reemplazarlo)` : "(opcional)"}
              <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setArchivo(e.target.files[0] || null)} />
            </label>
          )}
          <div className="barra-acciones">
            <button className="boton-primario" disabled={guardando} onClick={guardar}>Guardar resultado</button>
            <button onClick={alCancelar}>Cancelar</button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function DetalleCapacitacion() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [capacitacion, setCapacitacion] = useState(null);
  const [trabajadores, setTrabajadores] = useState([]);
  const [agregando, setAgregando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    obtenerCapacitacion(id).then(setCapacitacion).catch((err) => setMensaje(err.message));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (usuario.rol === "rrhh" || usuario.rol === "supervisor") {
      listarTrabajadores({ estado: "activo" }).then(setTrabajadores).catch(() => {});
    }
  }, [usuario.rol]);

  function ejecutar(promesa, texto, alTerminar) {
    setMensaje("");
    setAviso("");
    return promesa
      .then(() => { setAviso(texto); alTerminar?.(); cargar(); })
      .catch((err) => setMensaje(err.message));
  }

  if (!capacitacion) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const c = capacitacion;
  const esRRHH = c.puede_administrar;
  const programada = c.estado === "programada";
  const yaParticipan = new Set(c.participantes.filter((p) => p.estado_inscripcion !== "rechazado").map((p) => p.id_trabajador));
  // RRHH: cualquier activo; supervisor: su equipo directo (sin él mismo)
  const candidatos = trabajadores.filter((t) =>
    !yaParticipan.has(t.id) && (esRRHH || t.id_supervisor === usuario.id_trabajador)
  );
  const conAcciones = esRRHH || usuario.rol === "supervisor";
  const columnas = conAcciones ? 8 : 7;

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>{c.titulo}</h2>
          <p className="subtitulo">{rangoFechas(c.fecha_inicio, c.fecha_fin)} · {c.horas} h <Insignia mapa={ESTADOS_CAPACITACION} clave={c.estado_actual} /></p>
        </div>
        <div className="barra-acciones">
          <Link to="/capacitaciones">Volver</Link>
          {esRRHH && programada && <Link to={`/capacitaciones/${id}/editar`} className="boton-primario">Editar</Link>}
          {esRRHH && programada && c.estado_actual !== "programada" && (
            <button onClick={() => ejecutar(finalizarCapacitacion(id), "Capacitación finalizada")}>Finalizar</button>
          )}
          {esRRHH && programada && (
            <button onClick={() => confirm("¿Cancelar la capacitación? Se avisará a los inscritos.") && ejecutar(cancelarCapacitacion(id), "Capacitación cancelada")}>
              Cancelar capacitación
            </button>
          )}
        </div>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      <dl className="datos">
        <div className="dato"><dt>Instructor</dt><dd>{c.instructor || "—"}</dd></div>
        <div className="dato"><dt>Lugar</dt><dd>{c.lugar || "—"}</dd></div>
        <div className="dato"><dt>Inscritos</dt><dd>{c.inscritos}{c.cupo ? ` de ${c.cupo}` : " (sin límite de cupo)"}</dd></div>
        <div className="dato"><dt>Aprobados</dt><dd>{c.aprobados}</dd></div>
        <div className="dato ancho-completo"><dt>Descripción</dt><dd>{c.descripcion || "—"}</dd></div>
      </dl>
      {esRRHH && c.estado_actual === "por_cerrar" && (
        <p className="aviso">La capacitación ya terminó: registre los resultados que faltan y finalícela.</p>
      )}

      <section>
        <div className="encabezado-pagina">
          <h3>Participantes</h3>
          {!agregando && (c.puede_inscribir || c.puede_proponer) && (
            <button className="boton-primario" onClick={() => setAgregando(true)}>{c.puede_inscribir ? "Inscribir participantes" : "Proponer participantes"}</button>
          )}
        </div>
        {!c.ve_todos && (
          <p className="ayuda">{usuario.rol === "supervisor" ? "Se muestran solo los participantes de su equipo." : "Se muestra solo su participación."}</p>
        )}
        {agregando && (
          <PanelAgregar
            candidatos={candidatos}
            esPropuesta={!c.puede_inscribir}
            alCerrar={() => setAgregando(false)}
            alConfirmar={(ids) => ejecutar(agregarParticipantes(id, ids), c.puede_inscribir ? "Participantes inscritos; se les notificó" : "Propuesta enviada a RRHH", () => setAgregando(false))}
          />
        )}

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr><th>Trabajador</th><th>Área</th><th>Inscripción</th><th>Asistencia</th><th>Nota</th><th>Resultado</th><th>Certificado</th>{conAcciones && <th></th>}</tr>
            </thead>
            <tbody>
              {c.participantes.map((p) => (
                <Fragment key={p.id}>
                  <tr>
                    <td>{p.apellido}, {p.nombre}</td>
                    <td>{p.area || "—"}</td>
                    <td>
                      <Insignia mapa={INSCRIPCION_CAPACITACION} clave={p.estado_inscripcion} />
                      {p.rol_registrado_por === "supervisor" && <div className="ayuda">Propuesto por {p.registrado_por}</div>}
                    </td>
                    <td>{p.asistencia_pct !== null ? `${p.asistencia_pct}%` : "—"}</td>
                    <td>{p.nota ?? "—"}</td>
                    <td>{p.resultado ? <Insignia mapa={RESULTADOS_CAPACITACION} clave={p.resultado} /> : "—"}</td>
                    <td>
                      {p.id_archivo_certificado
                        ? <button className="boton-enlace" onClick={() => verArchivo(p.id_archivo_certificado).catch((err) => setMensaje(err.message))}>Ver</button>
                        : "—"}
                    </td>
                    {esRRHH && (
                      <td><div className="barra-acciones">
                        {programada && p.estado_inscripcion === "propuesto" && (
                          <>
                            <button className="boton-enlace" onClick={() => ejecutar(resolverPropuesta(id, p.id, "inscrito"), "Propuesta confirmada")}>Confirmar</button>
                            <button className="boton-enlace" onClick={() => ejecutar(resolverPropuesta(id, p.id, "rechazado"), "Propuesta descartada")}>Descartar</button>
                          </>
                        )}
                        {c.puede_registrar_resultados && p.estado_inscripcion === "inscrito" && editando !== p.id && (
                          <button className="boton-enlace" onClick={() => setEditando(p.id)}>{p.resultado ? "Corregir resultado" : "Registrar resultado"}</button>
                        )}
                        {programada && p.estado_inscripcion === "inscrito" && !p.resultado && (
                          <button className="boton-enlace texto-peligro" onClick={() => confirm(`¿Quitar a ${p.nombre} ${p.apellido}?`) && ejecutar(quitarParticipante(id, p.id), "Participante quitado")}>Quitar</button>
                        )}
                      </div></td>
                    )}
                    {usuario.rol === "supervisor" && (
                      <td>
                        {programada && p.estado_inscripcion === "propuesto" && (
                          <button className="boton-enlace" onClick={() => ejecutar(quitarParticipante(id, p.id), "Propuesta retirada")}>Retirar</button>
                        )}
                      </td>
                    )}
                  </tr>
                  {editando === p.id && (
                    <FilaResultado
                      participante={p}
                      columnas={columnas}
                      alCancelar={() => setEditando(null)}
                      alGuardar={(datos) => ejecutar(registrarResultado(id, p.id, datos), "Resultado registrado", () => setEditando(null))}
                    />
                  )}
                </Fragment>
              ))}
              {c.participantes.length === 0 && <tr><td colSpan={columnas} className="vacio">Sin participantes.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
