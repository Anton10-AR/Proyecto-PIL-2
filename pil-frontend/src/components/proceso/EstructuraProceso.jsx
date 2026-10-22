// Estructura del proceso: las 7 etapas con sus puestos (críticos y no críticos) y cuántas personas ocupan
// cada uno, más la matriz de responsabilidades de la recepción (documento, secciones 5, 7.3 y 7.4).
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { obtenerEtapas } from "../../api/proceso";
import { NOMBRES_DIA_ISO } from "../../formato";

// Matriz RACI de la recepción (documento, sección 7.4). Los permisos del módulo de Recepción la aplican:
// cada acción solo la puede registrar el puesto marcado con R.
const RACI = {
  columnas: ["Op. recepción", "Analista", "Sup. calidad", "Sup. producción", "Jefatura"],
  filas: [
    ["Registrar ingreso de cisterna", "R", "", "A", "", ""],
    ["Tomar e identificar la muestra", "R", "I", "A", "", ""],
    ["Analizar y registrar resultados", "", "R", "A", "", ""],
    ["Decidir aceptación o rechazo", "I", "C", "A/R", "I", "I"],
    ["Asignar tanque y código de lote", "I", "", "A/R", "I", ""],
    ["Descargar a tanque", "R", "", "I", "I", ""],
    ["Modificar parámetros de calidad", "", "C", "A/R", "", "I"],
    ["Rastrear un lote ante reclamo", "I", "C", "R", "C", "A"]
  ]
};

export default function EstructuraProceso() {
  const [datos, setDatos] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    obtenerEtapas().then(setDatos).catch((err) => setMensaje(err.message));
  }, []);

  if (!datos) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>Etapas y puestos del proceso</h2>
          <p className="subtitulo">Producción de leche líquida: la estructura de planta sigue las 7 etapas del proceso</p>
        </div>
        <Link to="/personal">Ver personal por etapa</Link>
      </div>

      <div className="cadena">
        {datos.etapas.map((e) => (
          <section key={e.id} className={`cadena-etapa${e.id === 2 ? " cadena-etapa-destacada" : ""}`}>
            <span className="cadena-numero">ETAPA {e.id}{e.id === 2 ? " · PUNTO CRÍTICO" : ""}</span>
            <h4>{e.nombre}</h4>
            <ul>
              {e.puestos.map((p) => (
                <li key={p.id}>
                  {p.nombre}{p.critico && <span className="insignia insignia-pendiente insignia-chica">crítico · mín. {p.cobertura_minima}</span>}
                  <br /><small className={p.critico && p.personas <= p.cobertura_minima ? "texto-alerta" : "ayuda"}>
                    {p.personas} persona(s){p.critico && p.personas <= p.cobertura_minima ? " · sin reemplazo" : ""}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="bloque">
        <h3>Puestos transversales</h3>
        <ul className="lista-simple">
          {datos.transversales.map((p) => <li key={p.id}>{p.nombre} · {p.personas} persona(s) · {p.competencia_requerida}</li>)}
        </ul>
        <p className="ayuda">
          La planta opera: {datos.dias_operacion.map((d) => NOMBRES_DIA_ISO[d]).join(", ")}. Un puesto crítico «sin reemplazo» tiene
          a lo sumo las personas mínimas: si alguien falta o sale de vacaciones, la etapa queda descubierta.
        </p>
      </section>

      <section className="bloque">
        <h3>Matriz de responsabilidades de la recepción (RACI)</h3>
        <p className="ayuda"><strong>R</strong> = realiza · <strong>A</strong> = aprueba y rinde cuentas · <strong>C</strong> = es consultado · <strong>I</strong> = es informado.
          El sistema aplica esta matriz: cada acción de Recepción solo la registra el puesto responsable, y quien analiza una muestra no puede decidir sobre ella.</p>
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Actividad</th>{RACI.columnas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {RACI.filas.map(([actividad, ...valores]) => (
                <tr key={actividad}><td>{actividad}</td>{valores.map((v, i) => <td key={i}><strong>{v}</strong></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
