// Panel del proceso: cobertura de puestos críticos por etapa en un día (hoy o uno futuro, para planificar)
// e indicadores del período. Es donde la asistencia, los turnos, las solicitudes y la capacitación de RRHH
// se leen en términos del proceso productivo.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { obtenerCobertura, obtenerIndicadoresCobertura } from "../../api/proceso";
import { obtenerIndicadoresCalidad } from "../../api/recepcion";
import { ESTADOS_COBERTURA, SITUACIONES, fechaCorta, hoy, miles } from "../../formato";

function Indicador({ valor, sufijo = "", etiqueta, detalle }) {
  return (
    <div className="tarjeta tarjeta-indicador">
      <span className="tarjeta-valor">{valor === null || valor === undefined ? "—" : `${valor}${sufijo}`}</span>
      <span className="tarjeta-etiqueta">{etiqueta}</span>
      {detalle && <span className="tarjeta-detalle">{detalle}</span>}
    </div>
  );
}

function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(a, m - 1, d + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

export default function PanelProceso() {
  const { usuario } = useAuth();
  const [fecha, setFecha] = useState(hoy());
  const [cobertura, setCobertura] = useState(null);
  const [indicadores, setIndicadores] = useState(null);
  const [calidad, setCalidad] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let vigente = true;
    obtenerCobertura(fecha).then((c) => { if (vigente) setCobertura(c); }).catch((err) => setMensaje(err.message));
    return () => { vigente = false; };
  }, [fecha]);

  useEffect(() => {
    obtenerIndicadoresCobertura().then(setIndicadores).catch((err) => setMensaje(err.message));
    if (usuario.permisos_recepcion?.consultar) {
      obtenerIndicadoresCalidad({ desde: sumarDias(hoy(), -6), hasta: hoy() }).then(setCalidad).catch(() => {});
    }
  }, [usuario.permisos_recepcion]);

  const etapas = cobertura ? Object.values(cobertura.puestos.reduce((grupos, p) => {
    (grupos[p.id_etapa] ||= { id: p.id_etapa, nombre: p.etapa, puestos: [] }).puestos.push(p);
    return grupos;
  }, {})) : [];
  const futuro = fecha > hoy();

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Panel del proceso</h2>
          <p className="subtitulo">Cobertura de puestos críticos por etapa (documento, sección 7.3)</p>
        </div>
        <div className="barra-acciones">
          <button onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="Día anterior">‹</button>
          <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Fecha" />
          <button onClick={() => setFecha(sumarDias(fecha, 1))} aria-label="Día siguiente">›</button>
          {fecha !== hoy() && <button onClick={() => setFecha(hoy())}>Hoy</button>}
        </div>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      {cobertura && (
        <section>
          <h3>{fechaCorta(fecha)}{fecha === hoy() ? " (hoy)" : ""}</h3>
          {!cobertura.opera && <p className="aviso">La planta no opera este día (domingo o feriado): no se exige cobertura.</p>}
          {futuro && cobertura.opera && <p className="ayuda">Día futuro: se muestra lo planificado según turnos y solicitudes. «En riesgo» = solo se cubre si no se aprueban solicitudes pendientes.</p>}
          <div className="etapas-cobertura">
            {etapas.map((etapa) => etapa.puestos.map((p) => (
              <article key={p.id} className={`etapa-tarjeta etapa-${p.estado}`}>
                <h4>Etapa {etapa.id} · {etapa.nombre}</h4>
                <div className="encabezado-pagina">
                  <span className="puesto-nombre">{p.puesto}</span>
                  <span className={`insignia ${ESTADOS_COBERTURA[p.estado].clase}`}>{ESTADOS_COBERTURA[p.estado].texto}</span>
                </div>
                <small className="ayuda">Mínimo por día: {p.cobertura_minima} · {p.competencia_requerida}</small>
                <ul>
                  {p.personas.map((persona) => (
                    <li key={persona.id}>
                      <span><Link to={`/personal/${persona.id}`}>{persona.nombre}</Link>{!persona.capacitacion_vigente && <span className="texto-alerta" title="Sin capacitación aprobada en los últimos 12 meses"> ⚠</span>}</span>
                      <span>{SITUACIONES[persona.situacion]}{persona.turno && persona.situacion !== "no_programado" ? ` · ${persona.turno}` : ""}</span>
                    </li>
                  ))}
                  {p.personas.length === 0 && <li><span className="texto-peligro">Nadie ocupa este puesto</span></li>}
                </ul>
              </article>
            )))}
          </div>
          <p className="ayuda">⚠ = sin capacitación aprobada en los últimos 12 meses. Los días de operación y la cobertura mínima se definen en el diseño organizacional del proceso.</p>
        </section>
      )}

      {indicadores && (
        <section>
          <h3>Indicadores del período</h3>
          <p className="ayuda">{fechaCorta(indicadores.desde)} al {fechaCorta(indicadores.hasta)} (desde el inicio de registros del sistema)</p>
          <div className="tarjetas tarjetas-indicadores">
            <Indicador valor={indicadores.pct_cobertura} sufijo="%" etiqueta="Cobertura de puestos críticos"
              detalle={`${indicadores.dias_puesto_cubiertos} de ${indicadores.dias_puesto_requeridos} días-puesto cubiertos`} />
            <Indicador valor={indicadores.pct_capacitacion_vigente} sufijo="%" etiqueta="Capacitación vigente en puestos críticos"
              detalle={`${indicadores.personas_capacitacion_vigente} de ${indicadores.personas_puestos_criticos} personas`} />
            {calidad && <Indicador valor={calidad.pct_rechazo} sufijo="%" etiqueta="Leche rechazada (7 días)" detalle={`${miles(calidad.litros_recibidos)} L recibidos`} />}
            {calidad && <Indicador valor={calidad.tiempo_recepcion_min} sufijo=" min" etiqueta="Tiempo de recepción (7 días)" detalle="De la llegada a la decisión" />}
          </div>
          {indicadores.descubiertos.length > 0 && (
            <div className="tabla-contenedor">
              <table>
                <thead><tr><th>Día</th><th>Etapa</th><th>Puesto crítico sin cobertura</th></tr></thead>
                <tbody>
                  {indicadores.descubiertos.map((d) => (
                    <tr key={`${d.fecha}-${d.puesto}`}>
                      <td><button className="boton-enlace" onClick={() => setFecha(d.fecha)}>{fechaCorta(d.fecha)}</button></td>
                      <td>{d.etapa}</td><td>{d.puesto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {calidad && <p><Link to="/recepcion/indicadores">Ver los indicadores de calidad de la recepción</Link></p>}
        </section>
      )}
    </div>
  );
}
