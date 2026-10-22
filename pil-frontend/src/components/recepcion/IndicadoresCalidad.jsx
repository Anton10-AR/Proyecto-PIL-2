// Indicadores de calidad de la recepción (documento, sección 10.1): porcentaje de leche rechazada,
// conformidad por proveedor, tiempo de recepción y registros completos. Cada gráfico tiene vista de tabla.
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { obtenerIndicadoresCalidad } from "../../api/recepcion";
import { GraficoBarrasHorizontales } from "../reportes/GraficosReportes";
import { usePreferencias } from "../../contexto/usePreferencias";
import { fechaCorta, hoy, miles } from "../../formato";

const PERIODOS = [{ dias: 7, texto: "7 días" }, { dias: 14, texto: "14 días" }, { dias: 30, texto: "30 días" }];

// Paleta categórica de referencia (la misma de los reportes de personal) + gris para lo pendiente
const COLORES = {
  claro: { aceptado: "#2a78d6", derivado: "#1baf7a", rechazado: "#eb6834", pendiente: "#a8a6a0", texto: "#52514e", grilla: "#e8e7e3", separador: "#ffffff" },
  oscuro: { aceptado: "#3987e5", derivado: "#199e70", rechazado: "#d95926", pendiente: "#6b7079", texto: "#b4b8bf", grilla: "#2c3038", separador: "#1c1f24" }
};

function restarDias(fecha, dias) {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(a, m - 1, d - dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

function Indicador({ valor, sufijo = "", etiqueta, detalle }) {
  return (
    <div className="tarjeta tarjeta-indicador">
      <span className="tarjeta-valor">{valor === null || valor === undefined ? "—" : `${valor}${sufijo}`}</span>
      <span className="tarjeta-etiqueta">{etiqueta}</span>
      {detalle && <span className="tarjeta-detalle">{detalle}</span>}
    </div>
  );
}

function TooltipLitros({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-grafico">
      <strong>{fechaCorta(label)}</strong>
      {payload.filter((p) => p.value > 0).map((p) => (
        <div key={p.dataKey} className="tooltip-fila">
          <span className="tooltip-muestra" style={{ background: p.color }} />
          <span>{p.name}</span><strong>{miles(p.value)} L</strong>
        </div>
      ))}
    </div>
  );
}

function GraficoLitros({ serie }) {
  const { tema } = usePreferencias();
  const c = COLORES[tema];
  const [verTabla, setVerTabla] = useState(false);
  const datos = serie.filter((d) => d.aceptado + d.derivado + d.rechazado + d.pendiente > 0);
  const eje = { tick: { fill: c.texto, fontSize: 12 }, axisLine: { stroke: c.grilla }, tickLine: false };
  const series = [["aceptado", "Aceptada"], ["derivado", "Derivada"], ["rechazado", "Rechazada"], ["pendiente", "Pendiente"]];
  return (
    <section className="panel-grafico">
      <div className="encabezado-pagina">
        <div>
          <h3>Leche recibida por día</h3>
          <p className="ayuda">Litros según la decisión del supervisor de calidad.</p>
        </div>
        <button className="boton-enlace" onClick={() => setVerTabla(!verTabla)}>{verTabla ? "Ver gráfico" : "Ver tabla"}</button>
      </div>
      {verTabla ? (
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Fecha</th><th>Aceptada</th><th>Derivada</th><th>Rechazada</th><th>Pendiente</th></tr></thead>
            <tbody>{datos.map((d) => <tr key={d.fecha}><td>{fechaCorta(d.fecha)}</td><td>{miles(d.aceptado)}</td><td>{miles(d.derivado)}</td><td>{miles(d.rechazado)}</td><td>{miles(d.pendiente)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : datos.length === 0 ? <p className="vacio">Sin ingresos en el período.</p> : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={c.grilla} />
            <XAxis dataKey="fecha" tickFormatter={(f) => f.slice(8)} {...eje} />
            <YAxis tickFormatter={(v) => `${Math.round(v / 1000)} mil`} {...eje} />
            <Tooltip content={<TooltipLitros />} cursor={{ fill: c.grilla, opacity: 0.5 }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} itemSorter={(item) => series.findIndex(([clave]) => clave === item.dataKey)}
              formatter={(v) => <span style={{ color: c.texto }}>{v}</span>} />
            {series.map(([clave, nombre], i) => (
              <Bar key={clave} dataKey={clave} name={nombre} stackId="dia" fill={c[clave]} stroke={c.separador} strokeWidth={1}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export default function IndicadoresCalidad() {
  const [dias, setDias] = useState(14);
  const [datos, setDatos] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let vigente = true;
    obtenerIndicadoresCalidad({ desde: restarDias(hoy(), dias - 1), hasta: hoy() })
      .then((d) => { if (vigente) setDatos(d); })
      .catch((err) => { if (vigente) setMensaje(err.message); });
    return () => { vigente = false; };
  }, [dias]);

  if (!datos) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Calculando indicadores...</p>;

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Indicadores de calidad de la recepción</h2>
          <p className="subtitulo">{fechaCorta(datos.desde)} al {fechaCorta(datos.hasta)}</p>
        </div>
        <div className="segmentado" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.dias} className={dias === p.dias ? "activo" : ""} onClick={() => setDias(p.dias)}>{p.texto}</button>
          ))}
        </div>
      </div>

      <div className="tarjetas tarjetas-indicadores">
        <Indicador valor={miles(datos.litros_recibidos)} sufijo=" L" etiqueta="Leche recibida" detalle={`${datos.ingresos} ingresos · ${datos.pendientes} en curso`} />
        <Indicador valor={datos.pct_rechazo} sufijo="%" etiqueta="Leche rechazada" detalle={`${miles(datos.litros_rechazados)} L rechazados · ${miles(datos.litros_derivados)} L derivados`} />
        <Indicador valor={datos.pct_conformidad} sufijo="%" etiqueta="Conformidad de parámetros" detalle="Ingresos con todos los parámetros en norma" />
        <Indicador valor={datos.tiempo_recepcion_min} sufijo=" min" etiqueta="Tiempo de recepción" detalle="Promedio desde la llegada hasta la decisión" />
        <Indicador valor={datos.pct_registros_completos} sufijo="%" etiqueta="Registros completos" detalle="Ingresos con análisis y decisión" />
        <Indicador valor={datos.decisiones_distintas_a_sugerencia} etiqueta="Decisiones distintas a la sugerencia" detalle="Siempre con motivo registrado" />
      </div>

      <GraficoLitros serie={datos.serie} />

      <GraficoBarrasHorizontales
        titulo="Conformidad por proveedor" descripcion="Ingresos con todos los parámetros en norma sobre ingresos analizados. Los de menor conformidad, primero."
        datos={datos.por_proveedor.map((p) => ({ ...p, nombre_corto: p.proveedor.length > 22 ? `${p.proveedor.slice(0, 21)}…` : p.proveedor }))}
        clave="pct_conformidad" etiqueta="nombre_corto" nombre="Conformidad" sufijo="%" maximo={100}
        columnasTabla={[
          { clave: "codigo", titulo: "Código" }, { clave: "proveedor", titulo: "Proveedor" }, { clave: "ingresos", titulo: "Ingresos" },
          { clave: "litros_recibidos", titulo: "Litros" }, { clave: "pct_conformidad", titulo: "Conformidad %" },
          { clave: "rechazados", titulo: "Rechazos" }, { clave: "pct_rechazo", titulo: "Leche rechazada %" }
        ]}
      />

      <section className="panel-grafico">
        <h3>Parámetros fuera de norma</h3>
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Parámetro</th><th>Veces</th><th>% de los análisis</th></tr></thead>
            <tbody>
              {datos.parametros_fuera.map((p) => <tr key={p.parametro}><td>{p.parametro}</td><td>{p.veces}</td><td>{p.pct}%</td></tr>)}
              {datos.parametros_fuera.length === 0 && <tr><td colSpan={3} className="vacio">Todos los análisis del período estuvieron en norma.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
