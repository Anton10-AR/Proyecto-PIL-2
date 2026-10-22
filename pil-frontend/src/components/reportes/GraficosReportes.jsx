// Gráficos del dashboard (recharts). Paleta categórica de referencia validada con el validador de dataviz
// (azul, naranja, aqua en ese orden; aqua no llega a 3:1 de contraste, por eso cada gráfico tiene
// vista de tabla y leyenda). Una sola serie = un solo color (slot 1).
// recharts recibe colores literales (no variables CSS), así que cada tema tiene su juego de colores.
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fechaCorta } from "../../formato";
import { usePreferencias } from "../../contexto/usePreferencias";

const COLORES = {
  claro: {
    series: { asistidos: "#2a78d6", ausencias: "#eb6834", sin_registro: "#1baf7a" },
    secundaria: "#52514e", grilla: "#e8e7e3", separador: "#ffffff", cursor: "rgba(31,111,178,0.08)"
  },
  oscuro: {
    series: { asistidos: "#3987e5", ausencias: "#d95926", sin_registro: "#199e70" },
    secundaria: "#b4b8bf", grilla: "#2c3038", separador: "#1c1f24", cursor: "rgba(124,179,245,0.1)"
  }
};

function useColores() {
  const { tema, preferencias } = usePreferencias();
  const base = COLORES[tema];
  if (!preferencias.contraste) return base;
  // Alto contraste: ejes y etiquetas en el color del texto
  const tinta = tema === "oscuro" ? "#ffffff" : "#000000";
  return { ...base, secundaria: tinta, grilla: tema === "oscuro" ? "#666666" : "#999999", separador: tema === "oscuro" ? "#000000" : "#ffffff" };
}

function ejeComun(c) {
  return { tick: { fill: c.secundaria, fontSize: 12 }, axisLine: { stroke: c.grilla }, tickLine: false };
}

function CajaTooltip({ active, payload, label, formatoEtiqueta, sufijo = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-grafico">
      <strong>{formatoEtiqueta ? formatoEtiqueta(label) : label}</strong>
      {payload.map((p) => (
        <div key={p.dataKey} className="tooltip-fila">
          <span className="tooltip-muestra" style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{p.value}{sufijo}</strong>
        </div>
      ))}
    </div>
  );
}

// Encabezado de gráfico con alternancia gráfico/tabla
function Panel({ titulo, descripcion, tabla, children }) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <section className="panel-grafico">
      <div className="encabezado-pagina">
        <div>
          <h3>{titulo}</h3>
          {descripcion && <p className="ayuda">{descripcion}</p>}
        </div>
        <button className="boton-enlace" onClick={() => setVerTabla(!verTabla)}>{verTabla ? "Ver gráfico" : "Ver tabla"}</button>
      </div>
      {verTabla ? tabla : children}
    </section>
  );
}

export function GraficoAsistenciaDiaria({ serie }) {
  const c = useColores();
  const datos = serie.filter((d) => d.programados > 0);
  const tabla = (
    <div className="tabla-contenedor">
      <table>
        <thead><tr><th>Fecha</th><th>Programados</th><th>Asistidos</th><th>Ausencias</th><th>Sin registro</th></tr></thead>
        <tbody>
          {datos.map((d) => <tr key={d.fecha}><td>{fechaCorta(d.fecha)}</td><td>{d.programados}</td><td>{d.asistidos}</td><td>{d.ausencias}</td><td>{d.sin_registro}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
  return (
    <Panel titulo="Asistencia diaria" descripcion="Trabajadores con jornada programada por día, según lo registrado." tabla={tabla}>
      {datos.length === 0 ? <p className="vacio">No hay días programados en el período.</p> : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={datos} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={c.grilla} />
            <XAxis dataKey="fecha" tickFormatter={(f) => f.slice(8)} {...ejeComun(c)} />
            <YAxis allowDecimals={false} {...ejeComun(c)} />
            <Tooltip content={<CajaTooltip formatoEtiqueta={fechaCorta} />} cursor={{ fill: c.cursor }} />
            {/* El texto de la leyenda va en tinta de texto; el color de la serie solo en el marcador */}
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(valor) => <span style={{ color: c.secundaria }}>{valor}</span>} />
            <Bar dataKey="asistidos" name="Asistidos" stackId="dia" fill={c.series.asistidos} stroke={c.separador} strokeWidth={1} />
            <Bar dataKey="ausencias" name="Ausencias" stackId="dia" fill={c.series.ausencias} stroke={c.separador} strokeWidth={1} />
            <Bar dataKey="sin_registro" name="Sin registro" stackId="dia" fill={c.series.sin_registro} stroke={c.separador} strokeWidth={1} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

// Barras horizontales de una sola serie (ej. tasa de asistencia por área)
export function GraficoBarrasHorizontales({ titulo, descripcion, datos, clave, etiqueta, nombre, sufijo = "", maximo, columnasTabla }) {
  const c = useColores();
  const validos = datos.filter((d) => d[clave] !== null && d[clave] !== undefined);
  const tabla = (
    <div className="tabla-contenedor">
      <table>
        <thead><tr>{columnasTabla.map((c) => <th key={c.clave}>{c.titulo}</th>)}</tr></thead>
        <tbody>{datos.map((d) => <tr key={d[etiqueta]}>{columnasTabla.map((c) => <td key={c.clave}>{d[c.clave] ?? "—"}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  return (
    <Panel titulo={titulo} descripcion={descripcion} tabla={tabla}>
      {validos.length === 0 ? <p className="vacio">Sin datos en el período.</p> : (
        <ResponsiveContainer width="100%" height={Math.max(120, validos.length * 44 + 40)}>
          <BarChart data={validos} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid horizontal={false} stroke={c.grilla} />
            <XAxis type="number" domain={[0, maximo || "auto"]} {...ejeComun(c)} />
            <YAxis type="category" dataKey={etiqueta} width={130} {...ejeComun(c)} />
            <Tooltip content={<CajaTooltip sufijo={sufijo} />} cursor={{ fill: c.cursor }} />
            <Bar dataKey={clave} name={nombre} fill={c.series.asistidos} radius={[0, 4, 4, 0]}
              label={{ position: "right", fill: c.secundaria, fontSize: 12, formatter: (v) => `${v}${sufijo}` }} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
