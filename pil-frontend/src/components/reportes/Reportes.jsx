// Indicadores de personal (soporte organizacional del proceso) con el alcance del rol (empresa, equipo o propio).
// La evaluación del desempeño queda para versiones futuras: no se muestra aquí.
// RRHH y Gerencia además exportan los reportes a Excel, CSV o PDF.
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import { obtenerIndicadores, exportarReporte } from "../../api/reportes";
import { obtenerOpcionesPersonal } from "../../api/trabajadores";
import { GraficoAsistenciaDiaria, GraficoBarrasHorizontales } from "./GraficosReportes";
import { fechaCorta, hoy } from "../../formato";

function dosDigitos(n) {
  return String(n).padStart(2, "0");
}

function formatear(f) {
  return `${f.getFullYear()}-${dosDigitos(f.getMonth() + 1)}-${dosDigitos(f.getDate())}`;
}

// Rangos rápidos
function rango(clave) {
  const h = new Date();
  const a = h.getFullYear();
  const m = h.getMonth();
  if (clave === "mes") return { desde: formatear(new Date(a, m, 1)), hasta: formatear(new Date(a, m + 1, 0)) };
  if (clave === "anterior") return { desde: formatear(new Date(a, m - 1, 1)), hasta: formatear(new Date(a, m, 0)) };
  if (clave === "trimestre") return { desde: formatear(new Date(a, m - 2, 1)), hasta: formatear(new Date(a, m + 1, 0)) };
  return { desde: `${a}-01-01`, hasta: `${a}-12-31` };
}

const RANGOS = [
  { clave: "mes", texto: "Este mes" }, { clave: "anterior", texto: "Mes anterior" },
  { clave: "trimestre", texto: "Últimos 3 meses" }, { clave: "anio", texto: "Este año" }
];

const ALCANCES = { empresa: "Toda la empresa", equipo: "Su equipo", propio: "Sus propios datos" };

const REPORTES = [
  { tipo: "informe", texto: "Informe completo (indicadores y tablas)", formatos: ["pdf", "xlsx"] },
  { tipo: "asistencia", texto: "Asistencia por trabajador", formatos: ["xlsx", "csv", "pdf"] },
  { tipo: "areas", texto: "Asistencia por área", formatos: ["xlsx", "csv", "pdf"] },
  { tipo: "solicitudes", texto: "Solicitudes de permisos y vacaciones", formatos: ["xlsx", "csv", "pdf"] },
  { tipo: "capacitacion", texto: "Resultados de capacitación", formatos: ["xlsx", "csv", "pdf"] },
  { tipo: "personal", texto: "Personal activo", formatos: ["xlsx", "csv", "pdf"] }
];

function Indicador({ valor, sufijo = "", etiqueta, detalle }) {
  return (
    <div className="tarjeta tarjeta-indicador">
      <span className="tarjeta-valor">{valor === null || valor === undefined ? "—" : `${valor}${sufijo}`}</span>
      <span className="tarjeta-etiqueta">{etiqueta}</span>
      {detalle && <span className="tarjeta-detalle">{detalle}</span>}
    </div>
  );
}

function PanelExportar({ filtros, setMensaje }) {
  const [descargando, setDescargando] = useState(null);
  function descargar(tipo, formato) {
    setMensaje("");
    setDescargando(`${tipo}.${formato}`);
    exportarReporte(tipo, formato, filtros).catch((err) => setMensaje(err.message)).finally(() => setDescargando(null));
  }
  return (
    <section className="panel-grafico">
      <h3>Exportar reportes</h3>
      <p className="ayuda">Se exportan con el período y el área elegidos arriba.</p>
      <ul className="lista-exportar">
        {REPORTES.map((r) => (
          <li key={r.tipo}>
            <span>{r.texto}</span>
            <span className="barra-acciones">
              {r.formatos.map((f) => (
                <button key={f} disabled={descargando !== null} onClick={() => descargar(r.tipo, f)}>
                  {descargando === `${r.tipo}.${f}` ? "Generando..." : f.toUpperCase()}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Reportes() {
  const { usuario } = useAuth();
  const puedeExportar = usuario.rol === "rrhh" || usuario.rol === "gerencia";
  const [filtros, setFiltros] = useState({ ...rango("mes"), area: "" });
  const [areas, setAreas] = useState([]);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (usuario.rol !== "trabajador") obtenerOpcionesPersonal().then((o) => setAreas(o.areas)).catch(() => {});
  }, [usuario.rol]);

  useEffect(() => {
    if (!filtros.desde || !filtros.hasta) return;
    let vigente = true;
    obtenerIndicadores(filtros)
      .then((d) => { if (vigente) { setDatos(d); setMensaje(""); } })
      .catch((err) => { if (vigente) setMensaje(err.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [filtros]);

  const rangoActivo = useMemo(() => RANGOS.find((r) => {
    const v = rango(r.clave);
    return v.desde === filtros.desde && v.hasta === filtros.hasta;
  })?.clave, [filtros]);

  if (cargando && !datos) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Calculando indicadores...</p>;

  const a = datos.asistencia;
  const r = a.resumen;
  const s = datos.solicitudes;
  const c = datos.capacitacion;
  const esPropio = datos.alcance === "propio";

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Indicadores de personal</h2>
          <p className="subtitulo">Alcance: {ALCANCES[datos.alcance]} · {fechaCorta(datos.filtros.desde)} al {fechaCorta(datos.filtros.hasta)}</p>
        </div>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      <div className="barra-filtros">
        <div className="segmentado" role="group" aria-label="Período">
          {RANGOS.map((op) => (
            <button key={op.clave} className={rangoActivo === op.clave ? "activo" : ""} onClick={() => setFiltros({ ...filtros, ...rango(op.clave) })}>{op.texto}</button>
          ))}
        </div>
        <label className="casilla">Desde <input type="date" value={filtros.desde} max={filtros.hasta} onChange={(ev) => setFiltros({ ...filtros, desde: ev.target.value })} /></label>
        <label className="casilla">Hasta <input type="date" value={filtros.hasta} min={filtros.desde} onChange={(ev) => setFiltros({ ...filtros, hasta: ev.target.value })} /></label>
        {areas.length > 1 && (
          <select value={filtros.area} onChange={(ev) => setFiltros({ ...filtros, area: ev.target.value })} aria-label="Área">
            <option value="">Todas las áreas</option>
            {areas.map((ar) => <option key={ar} value={ar}>{ar}</option>)}
          </select>
        )}
      </div>
      {a.desde_efectivo && a.desde_efectivo > datos.filtros.desde && (
        <p className="ayuda">La asistencia se cuenta desde el {fechaCorta(a.desde_efectivo)}, fecha de inicio de registros del sistema.</p>
      )}
      {datos.filtros.hasta > hoy() && <p className="ayuda">Los días futuros no se cuentan; el día de hoy solo si ya tiene marcación o ausencia.</p>}

      <div className="tarjetas tarjetas-indicadores">
        <Indicador valor={r.tasa_asistencia} sufijo="%" etiqueta="Tasa de asistencia" detalle={`${r.asistidos} de ${r.programados} días programados`} />
        <Indicador valor={r.tasa_ausentismo} sufijo="%" etiqueta="Tasa de ausentismo" detalle={`${r.ausencias} ausencias (${r.justificadas} justificadas)${r.sin_registro ? ` · ${r.sin_registro} sin registro` : ""}`} />
        <Indicador valor={c.cumplimiento} sufijo="%" etiqueta="Cumplimiento de capacitación" detalle={`${c.aprobados} aprobados de ${c.inscritos} inscritos`} />
        <Indicador valor={s.tiempo_promedio_horas} sufijo=" h" etiqueta="Tiempo promedio de aprobación" detalle={`${s.total} solicitudes en el período`} />
        {!esPropio && <Indicador valor={datos.personal.activos} etiqueta="Personal activo" detalle={`${r.retrasos} retrasos · puntualidad ${r.tasa_puntualidad ?? "—"}%`} />}
      </div>

      <GraficoAsistenciaDiaria serie={a.serie_diaria} />

      {!esPropio && a.por_area.length > 0 && (
        <GraficoBarrasHorizontales
          titulo="Tasa de asistencia por área" descripcion="Días asistidos sobre días programados."
          datos={a.por_area} clave="tasa_asistencia" etiqueta="area" nombre="Asistencia" sufijo="%" maximo={100}
          columnasTabla={[
            { clave: "area", titulo: "Área" }, { clave: "trabajadores", titulo: "Trabajadores" }, { clave: "programados", titulo: "Programados" },
            { clave: "asistidos", titulo: "Asistidos" }, { clave: "ausencias", titulo: "Ausencias" }, { clave: "retrasos", titulo: "Retrasos" },
            { clave: "tasa_asistencia", titulo: "Asistencia %" }, { clave: "tasa_ausentismo", titulo: "Ausentismo %" }
          ]}
        />
      )}

      <div className="grilla-paneles">
        <section className="panel-grafico">
          <h3>Solicitudes</h3>
          <table>
            <tbody>
              <tr><td>Pendientes</td><td>{s.por_estado.pendiente}</td></tr>
              <tr><td>Aprobadas</td><td>{s.por_estado.aprobado} ({s.dias_aprobados} días hábiles)</td></tr>
              <tr><td>Rechazadas</td><td>{s.por_estado.rechazado}</td></tr>
              <tr><td>Canceladas</td><td>{s.por_estado.cancelado}</td></tr>
            </tbody>
          </table>
          <h4>Tiempo promedio por etapa</h4>
          <table>
            <tbody>
              <tr><td>Supervisor</td><td>{s.tiempo_por_etapa.supervisor ?? "—"} h</td></tr>
              <tr><td>RRHH (después del supervisor)</td><td>{s.tiempo_por_etapa.rrhh ?? "—"} h</td></tr>
              <tr><td>Gerencia (un paso)</td><td>{s.tiempo_por_etapa.gerencia ?? "—"} h</td></tr>
            </tbody>
          </table>
        </section>

      </div>

      {c.por_capacitacion.length > 0 && (
        <GraficoBarrasHorizontales
          titulo="Cumplimiento por capacitación" descripcion="Aprobados sobre inscritos, capacitaciones finalizadas en el período."
          datos={c.por_capacitacion.map((x) => ({ ...x, nombre_corto: x.titulo.length > 22 ? `${x.titulo.slice(0, 21)}…` : x.titulo }))}
          clave="cumplimiento" etiqueta="nombre_corto" nombre="Cumplimiento" sufijo="%" maximo={100}
          columnasTabla={[
            { clave: "titulo", titulo: "Capacitación" }, { clave: "fecha_fin", titulo: "Finalizó" }, { clave: "horas", titulo: "Horas" },
            { clave: "inscritos", titulo: "Inscritos" }, { clave: "aprobados", titulo: "Aprobados" }, { clave: "cumplimiento", titulo: "Cumplimiento %" }
          ]}
        />
      )}

      {!esPropio && (
        <section className="panel-grafico">
          <h3>Asistencia por trabajador</h3>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Trabajador</th><th>Área</th><th>Programados</th><th>Asistidos</th><th>Ausencias</th><th>Sin registro</th><th>Retrasos</th><th>Asistencia</th></tr></thead>
              <tbody>
                {a.por_trabajador.map((t) => (
                  <tr key={t.id}>
                    <td>{t.trabajador}</td><td>{t.area}</td><td>{t.programados}</td><td>{t.asistidos}</td><td>{t.ausencias}</td><td>{t.sin_registro}</td>
                    <td>{t.retrasos}</td>
                    <td className={t.tasa_asistencia !== null && t.tasa_asistencia < 90 ? "texto-alerta" : ""}>{t.tasa_asistencia ?? "—"}{t.tasa_asistencia !== null ? "%" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {puedeExportar && <PanelExportar filtros={filtros} setMensaje={setMensaje} />}
    </div>
  );
}
