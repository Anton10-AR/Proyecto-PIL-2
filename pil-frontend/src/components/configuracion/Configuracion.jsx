// Configuración general: tolerancia de retraso y feriados. RRHH edita; Gerencia solo consulta.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import { obtenerConfiguracion, guardarConfiguracion, listarFeriados, crearFeriado, eliminarFeriado } from "../../api/configuracion";
import { fechaCorta, hoy } from "../../formato";
import TiposPermiso from "./TiposPermiso";
import Respaldos from "./Respaldos";

export default function Configuracion() {
  const { usuario } = useAuth();
  const esRRHH = usuario.rol === "rrhh";
  const [tolerancia, setTolerancia] = useState("");
  const [inicioRegistros, setInicioRegistros] = useState("");
  const [anio, setAnio] = useState(Number(hoy().slice(0, 4)));
  const [feriados, setFeriados] = useState([]);
  const [nuevo, setNuevo] = useState({ fecha: "", descripcion: "" });
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    obtenerConfiguracion()
      .then((c) => { setTolerancia(c.tolerancia_minutos ?? ""); setInicioRegistros(c.inicio_registros ?? ""); })
      .catch((err) => setMensaje(err.message));
  }, []);

  const cargarFeriados = useCallback(() => {
    listarFeriados(anio).then(setFeriados).catch((err) => setMensaje(err.message));
  }, [anio]);

  useEffect(() => { cargarFeriados(); }, [cargarFeriados]);

  function ejecutar(promesa, textoExito, alTerminar) {
    setMensaje("");
    setAviso("");
    promesa
      .then((r) => { setAviso(textoExito); alTerminar?.(r); })
      .catch((err) => setMensaje(err.message));
  }

  return (
    <div>
      <h2>Configuración</h2>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      <section>
        <h3>Tolerancia de retraso</h3>
        <p className="ayuda">Minutos después del inicio del turno en que la entrada todavía no cuenta como retraso. Aplica a toda la empresa y a las marcaciones nuevas o corregidas.</p>
        <form
          className="formulario"
          onSubmit={(e) => { e.preventDefault(); ejecutar(guardarConfiguracion("tolerancia_minutos", Number(tolerancia)), "Tolerancia actualizada"); }}
        >
          <input type="number" min="0" max="120" value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} disabled={!esRRHH} aria-label="Minutos de tolerancia" required />
          <span>minutos</span>
          {esRRHH && <button type="submit">Guardar</button>}
        </form>
      </section>

      <section>
        <h3>Inicio de registros de asistencia</h3>
        <p className="ayuda">Primer día en que se registró asistencia en el sistema. Los indicadores no cuentan como programados los días anteriores.</p>
        <form
          className="formulario"
          onSubmit={(e) => { e.preventDefault(); ejecutar(guardarConfiguracion("inicio_registros", inicioRegistros), "Fecha de inicio de registros actualizada"); }}
        >
          <input type="date" value={inicioRegistros} onChange={(e) => setInicioRegistros(e.target.value)} disabled={!esRRHH} aria-label="Inicio de registros" required />
          {esRRHH && <button type="submit">Guardar</button>}
        </form>
      </section>

      <section>
        <div className="encabezado-pagina">
          <h3>Feriados</h3>
          <div className="barra-acciones">
            <button onClick={() => setAnio(anio - 1)} aria-label="Año anterior">‹</button>
            <strong>{anio}</strong>
            <button onClick={() => setAnio(anio + 1)} aria-label="Año siguiente">›</button>
          </div>
        </div>
        <p className="ayuda">Los feriados no cuentan como días laborables: no se esperan marcaciones ni se descuentan de las vacaciones.</p>

        {esRRHH && (
          <form
            className="formulario"
            onSubmit={(e) => {
              e.preventDefault();
              ejecutar(crearFeriado(nuevo), "Feriado agregado", () => {
                setNuevo({ fecha: "", descripcion: "" });
                setAnio(Number(nuevo.fecha.slice(0, 4)));
                cargarFeriados();
              });
            }}
          >
            <input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} required aria-label="Fecha" />
            <input value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} placeholder="Descripción" required aria-label="Descripción" />
            <button type="submit">Agregar feriado</button>
          </form>
        )}

        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Fecha</th><th>Descripción</th>{esRRHH && <th></th>}</tr></thead>
            <tbody>
              {feriados.map((f) => (
                <tr key={f.fecha}>
                  <td>{fechaCorta(f.fecha)}</td>
                  <td>{f.descripcion}</td>
                  {esRRHH && (
                    <td>
                      <button
                        className="boton-enlace texto-peligro"
                        onClick={() => confirm(`¿Eliminar el feriado "${f.descripcion}"?`) && ejecutar(eliminarFeriado(f.fecha), "Feriado eliminado", cargarFeriados)}
                      >
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {feriados.length === 0 && <tr><td colSpan={esRRHH ? 3 : 2} className="vacio">No hay feriados registrados en {anio}.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <TiposPermiso esRRHH={esRRHH} setMensaje={setMensaje} setAviso={setAviso} />

      {esRRHH && <Respaldos setMensaje={setMensaje} setAviso={setAviso} />}
    </div>
  );
}
