import { useEffect, useState } from "react";
import { obtenerResumenReportes } from "../api/reportes";

function Tarjeta({ etiqueta, valor }) {
  return (
    <div className="tarjeta">
      <span className="tarjeta-valor">{valor}</span>
      <span className="tarjeta-etiqueta">{etiqueta}</span>
    </div>
  );
}

function BarraEstado({ etiqueta, valor, total, color }) {
  const porcentaje = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="barra-fila">
      <span className="barra-etiqueta">{etiqueta} ({valor})</span>
      <div className="barra-fondo">
        <div className="barra-relleno" style={{ width: `${porcentaje}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Reportes() {
  const [resumen, setResumen] = useState(null);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [mensaje, setMensaje] = useState("");

  function cargar(mesConsultado = mes) {
    obtenerResumenReportes(mesConsultado)
      .then(setResumen)
      .catch((err) => setMensaje(err.message));
  }

  useEffect(() => { cargar(); }, []);

  if (mensaje) return <p className="error">{mensaje}</p>;
  if (!resumen) return <p>Cargando indicadores...</p>;

  const { personal, asistencia, solicitudes } = resumen;

  return (
    <div>
      <h2>Reportes e Indicadores</h2>

      <div className="busqueda">
        <label>Mes a consultar (asistencia): </label>
        <input type="month" value={mes} onChange={(e) => { setMes(e.target.value); cargar(e.target.value); }} />
      </div>

      <h3>Personal</h3>
      <div className="tarjetas">
        <Tarjeta etiqueta="Trabajadores activos" valor={personal.total_activos} />
      </div>

      <h3>Asistencia — hoy ({resumen.fecha_hoy})</h3>
      <div className="tarjetas">
        <Tarjeta etiqueta="Registrados hoy" valor={asistencia.registrados_hoy} />
        <Tarjeta etiqueta="Ausentes hoy" valor={asistencia.ausentes_hoy} />
      </div>

      <h3>Asistencia — mes {resumen.mes}</h3>
      <div className="tarjetas">
        <Tarjeta etiqueta="Retrasos del mes" valor={asistencia.retrasos_mes} />
        <Tarjeta etiqueta="Promedio de horas/día" valor={asistencia.promedio_horas_mes} />
      </div>

      <h3>Solicitudes por estado (total: {solicitudes.total})</h3>
      <div className="barras">
        <BarraEstado etiqueta="Pendiente" valor={solicitudes.por_estado.pendiente} total={solicitudes.total} color="#f59e0b" />
        <BarraEstado etiqueta="Aprobado" valor={solicitudes.por_estado.aprobado} total={solicitudes.total} color="#16a34a" />
        <BarraEstado etiqueta="Rechazado" valor={solicitudes.por_estado.rechazado} total={solicitudes.total} color="#dc2626" />
        <BarraEstado etiqueta="Cancelado" valor={solicitudes.por_estado.cancelado} total={solicitudes.total} color="#6b7280" />
      </div>
    </div>
  );
}
