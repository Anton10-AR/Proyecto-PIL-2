// Calendario mensual de vacaciones y permisos aprobados (cada rol ve según su visibilidad),
// filtrable por área para ver cuánta gente falta a la vez.
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import { obtenerCalendario } from "../../api/solicitudes";
import { listarFeriados } from "../../api/configuracion";
import { obtenerOpcionesPersonal } from "../../api/trabajadores";
import { hoy, mesActual, rangoFechas, textoTipoSolicitud } from "../../formato";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function dosDigitos(n) {
  return String(n).padStart(2, "0");
}

function moverMes(mes, delta) {
  const [a, m] = mes.split("-").map(Number);
  const f = new Date(a, m - 1 + delta, 1);
  return `${f.getFullYear()}-${dosDigitos(f.getMonth() + 1)}`;
}

// Celdas del mes empezando en lunes (null = relleno antes del día 1)
function celdasDelMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  const primerDia = new Date(a, m - 1, 1).getDay();
  const relleno = (primerDia + 6) % 7;
  const diasDelMes = new Date(a, m, 0).getDate();
  const celdas = Array(relleno).fill(null);
  for (let d = 1; d <= diasDelMes; d++) celdas.push(`${mes}-${dosDigitos(d)}`);
  return celdas;
}

export default function Calendario() {
  const { usuario } = useAuth();
  const [mes, setMes] = useState(mesActual());
  const [area, setArea] = useState("");
  const [areas, setAreas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const veOtros = usuario.rol !== "trabajador";

  useEffect(() => {
    if (veOtros) obtenerOpcionesPersonal().then((o) => setAreas(o.areas)).catch(() => {});
  }, [veOtros]);

  useEffect(() => {
    obtenerCalendario(mes, area).then(setEventos).catch((err) => setMensaje(err.message));
  }, [mes, area]);

  const anio = mes.slice(0, 4);
  useEffect(() => {
    listarFeriados(anio).then(setFeriados).catch(() => {});
  }, [anio]);

  const celdas = useMemo(() => celdasDelMes(mes), [mes]);
  const hoyTexto = hoy();
  const eventosDelDia = (fecha) => eventos.filter((e) => e.fecha_inicio <= fecha && fecha <= e.fecha_fin);
  const feriadoDelDia = (fecha) => feriados.find((f) => f.fecha === fecha);
  const [a, m] = mes.split("-").map(Number);

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Calendario de ausencias programadas</h2>
        <div className="barra-acciones">
          <button onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior">‹</button>
          <strong className="titulo-mes">{NOMBRES_MES[m - 1]} {a}</strong>
          <button onClick={() => setMes(moverMes(mes, 1))} aria-label="Mes siguiente">›</button>
          {mes !== mesActual() && <button onClick={() => setMes(mesActual())}>Hoy</button>}
        </div>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      <div className="busqueda filtros">
        {veOtros && areas.length > 1 && (
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área">
            <option value="">Todas las áreas</option>
            {areas.map((ar) => <option key={ar} value={ar}>{ar}</option>)}
          </select>
        )}
        <span className="leyenda"><span className="evento evento-vacacion">Vacación</span> <span className="evento evento-permiso">Permiso</span> <span className="evento evento-feriado">Feriado</span></span>
      </div>
      <p className="ayuda">Solo se muestran solicitudes aprobadas{usuario.rol === "trabajador" ? " propias" : usuario.rol === "supervisor" ? " de su equipo" : ""}.</p>

      <div className="calendario" role="grid" aria-label={`Calendario de ${NOMBRES_MES[m - 1]} ${a}`}>
        {DIAS_SEMANA.map((d) => <div key={d} className="calendario-cabecera" role="columnheader">{d}</div>)}
        {celdas.map((fecha, i) => {
          if (!fecha) return <div key={`r${i}`} className="calendario-dia calendario-vacio" />;
          const delDia = eventosDelDia(fecha);
          const feriado = feriadoDelDia(fecha);
          return (
            <div key={fecha} role="gridcell" className={`calendario-dia${fecha === hoyTexto ? " calendario-hoy" : ""}`}>
              <span className="calendario-numero">{Number(fecha.slice(8))}</span>
              {feriado && <span className="evento evento-feriado" title={feriado.descripcion}>{feriado.descripcion}</span>}
              {delDia.slice(0, 3).map((e) => (
                <span key={e.id} className={`evento evento-${e.tipo}`} title={`${e.nombre} ${e.apellido}: ${textoTipoSolicitud(e)}`}>
                  {e.nombre} {e.apellido.charAt(0)}.
                </span>
              ))}
              {delDia.length > 3 && <span className="evento-mas">+{delDia.length - 3} más</span>}
            </div>
          );
        })}
      </div>

      <section>
        <h3>Detalle del mes ({eventos.length})</h3>
        <ul className="lista-simple">
          {eventos.map((e) => (
            <li key={e.id}>
              <strong>{e.apellido}, {e.nombre}</strong> ({e.area || "sin área"}) — {textoTipoSolicitud(e)}: {rangoFechas(e.fecha_inicio, e.fecha_fin)}, {e.dias_habiles} día(s) hábil(es)
            </li>
          ))}
          {eventos.length === 0 && <li>No hay vacaciones ni permisos aprobados en este mes.</li>}
        </ul>
      </section>
    </div>
  );
}
