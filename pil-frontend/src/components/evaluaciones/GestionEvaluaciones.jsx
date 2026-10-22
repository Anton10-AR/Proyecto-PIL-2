// Gestión de la evaluación del desempeño: períodos y plantillas. RRHH administra; Gerencia consulta.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import { listarPeriodos, crearPeriodo, listarPlantillas, crearPlantilla, actualizarPlantilla } from "../../api/evaluaciones";
import { rangoFechas } from "../../formato";

const PLANTILLA_VACIA = { nombre: "", descripcion: "", criterios: [{ nombre: "", descripcion: "", peso: "" }] };

function FormularioPlantilla({ inicial, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState(inicial);
  const soloDatos = inicial.en_uso;
  const total = datos.criterios.reduce((suma, c) => suma + (Number(c.peso) || 0), 0);

  const cambiarCriterio = (i, campo, valor) =>
    setDatos({ ...datos, criterios: datos.criterios.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)) });

  function enviar(e) {
    e.preventDefault();
    const cuerpo = { nombre: datos.nombre, descripcion: datos.descripcion };
    if (!soloDatos) cuerpo.criterios = datos.criterios.map((c) => ({ ...c, peso: Number(c.peso) }));
    alGuardar(cuerpo);
  }

  return (
    <form className="formulario-grilla" onSubmit={enviar}>
      <fieldset>
        <legend>{inicial.id ? `Editar plantilla "${inicial.nombre}"` : "Nueva plantilla"}</legend>
        <label>Nombre *<input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} required /></label>
        <label className="campo-ancho">Descripción<input value={datos.descripcion || ""} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} /></label>
        <div className="ancho-completo">
          <span className="etiqueta-campo">Criterios (escala 1 a 5; los pesos deben sumar 100)</span>
          {soloDatos && <p className="aviso">Esta plantilla ya se usó en evaluaciones: sus criterios no pueden cambiarse.</p>}
          <table className="tabla-criterios">
            <thead><tr><th>Criterio</th><th>Descripción</th><th>Peso (%)</th>{!soloDatos && <th></th>}</tr></thead>
            <tbody>
              {datos.criterios.map((c, i) => (
                <tr key={i}>
                  <td><input value={c.nombre} onChange={(e) => cambiarCriterio(i, "nombre", e.target.value)} disabled={soloDatos} required aria-label="Criterio" /></td>
                  <td><input value={c.descripcion || ""} onChange={(e) => cambiarCriterio(i, "descripcion", e.target.value)} disabled={soloDatos} aria-label="Descripción del criterio" /></td>
                  <td><input type="number" min="1" max="100" value={c.peso} onChange={(e) => cambiarCriterio(i, "peso", e.target.value)} disabled={soloDatos} required aria-label="Peso" /></td>
                  {!soloDatos && (
                    <td>
                      <button type="button" className="boton-enlace texto-peligro" disabled={datos.criterios.length === 1}
                        onClick={() => setDatos({ ...datos, criterios: datos.criterios.filter((_, j) => j !== i) })}>Quitar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="barra-acciones">
            {!soloDatos && (
              <button type="button" onClick={() => setDatos({ ...datos, criterios: [...datos.criterios, { nombre: "", descripcion: "", peso: "" }] })}>
                Agregar criterio
              </button>
            )}
            <span className={total === 100 ? "texto-ok" : "texto-alerta"}>Suma de pesos: {total}%</span>
          </div>
        </div>
        <div className="barra-acciones ancho-completo">
          <button type="submit" className="boton-primario" disabled={!soloDatos && total !== 100}>Guardar</button>
          <button type="button" onClick={alCancelar}>Cancelar</button>
        </div>
      </fieldset>
    </form>
  );
}

export default function GestionEvaluaciones() {
  const { usuario } = useAuth();
  const esRRHH = usuario.rol === "rrhh";
  const [pestana, setPestana] = useState("periodos");
  const [periodos, setPeriodos] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [nuevoPeriodo, setNuevoPeriodo] = useState(null);
  const [formPlantilla, setFormPlantilla] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    listarPeriodos().then(setPeriodos).catch((err) => setMensaje(err.message));
    listarPlantillas().then(setPlantillas).catch((err) => setMensaje(err.message));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function ejecutar(promesa, texto, alTerminar) {
    setMensaje("");
    setAviso("");
    promesa.then(() => { setAviso(texto); alTerminar?.(); cargar(); }).catch((err) => setMensaje(err.message));
  }

  return (
    <div>
      <h2>Gestión de evaluaciones</h2>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}
      <div className="pestanas" role="tablist">
        <button role="tab" aria-selected={pestana === "periodos"} className={pestana === "periodos" ? "activa" : ""} onClick={() => setPestana("periodos")}>Períodos</button>
        <button role="tab" aria-selected={pestana === "plantillas"} className={pestana === "plantillas" ? "activa" : ""} onClick={() => setPestana("plantillas")}>Plantillas</button>
      </div>

      {pestana === "periodos" && (
        <section>
          <div className="encabezado-pagina">
            <p className="ayuda">Al cerrar un período, sus evaluaciones ya no se pueden modificar.</p>
            {esRRHH && !nuevoPeriodo && (
              <button className="boton-primario" onClick={() => setNuevoPeriodo({ nombre: "", id_plantilla: "", fecha_inicio: "", fecha_fin: "" })}>Nuevo período</button>
            )}
          </div>
          {nuevoPeriodo && (
            <form className="formulario-grilla" onSubmit={(e) => { e.preventDefault(); ejecutar(crearPeriodo(nuevoPeriodo), "Período creado; ahora asigne las evaluaciones", () => setNuevoPeriodo(null)); }}>
              <fieldset>
                <legend>Nuevo período</legend>
                <label>Nombre *<input value={nuevoPeriodo.nombre} onChange={(e) => setNuevoPeriodo({ ...nuevoPeriodo, nombre: e.target.value })} placeholder="Ej.: 2027-S1" required /></label>
                <label>Plantilla sugerida *
                  <select value={nuevoPeriodo.id_plantilla} onChange={(e) => setNuevoPeriodo({ ...nuevoPeriodo, id_plantilla: e.target.value })} required>
                    <option value="">— Seleccione —</option>
                    {plantillas.filter((p) => p.activa).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </label>
                <label>Desde *<input type="date" value={nuevoPeriodo.fecha_inicio} onChange={(e) => setNuevoPeriodo({ ...nuevoPeriodo, fecha_inicio: e.target.value })} required /></label>
                <label>Hasta *<input type="date" min={nuevoPeriodo.fecha_inicio} value={nuevoPeriodo.fecha_fin} onChange={(e) => setNuevoPeriodo({ ...nuevoPeriodo, fecha_fin: e.target.value })} required /></label>
                <div className="barra-acciones ancho-completo">
                  <button type="submit" className="boton-primario">Crear período</button>
                  <button type="button" onClick={() => setNuevoPeriodo(null)}>Cancelar</button>
                </div>
              </fieldset>
            </form>
          )}
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Período</th><th>Fechas</th><th>Plantilla sugerida</th><th>Avance</th><th>Leídas</th><th>Promedio</th><th>Estado</th></tr></thead>
              <tbody>
                {periodos.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/evaluaciones/periodos/${p.id}`}>{p.nombre}</Link></td>
                    <td>{rangoFechas(p.fecha_inicio, p.fecha_fin)}</td>
                    <td>{p.plantilla}</td>
                    <td>
                      <div className="barra-fondo barra-avance"><div className="barra-relleno" style={{ width: `${p.total ? (p.completadas / p.total) * 100 : 0}%`, background: "var(--ok-borde)" }} /></div>
                      <span className="ayuda">{p.completadas} de {p.total} completadas{p.sin_evaluador > 0 ? ` · ${p.sin_evaluador} sin evaluador` : ""}</span>
                    </td>
                    <td>{p.leidas}</td>
                    <td>{p.promedio ?? "—"}</td>
                    <td><span className={`insignia ${p.estado === "abierto" ? "insignia-pendiente" : "insignia-inactivo"}`}>{p.estado}</span></td>
                  </tr>
                ))}
                {periodos.length === 0 && <tr><td colSpan={7} className="vacio">No hay períodos de evaluación.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pestana === "plantillas" && (
        <section>
          <div className="encabezado-pagina">
            <p className="ayuda">Cada criterio se califica de 1 a 5; el puntaje final es el promedio ponderado por los pesos.</p>
            {esRRHH && !formPlantilla && <button className="boton-primario" onClick={() => setFormPlantilla(PLANTILLA_VACIA)}>Nueva plantilla</button>}
          </div>
          {formPlantilla && (
            <FormularioPlantilla
              key={formPlantilla.id || "nueva"}
              inicial={formPlantilla}
              alCancelar={() => setFormPlantilla(null)}
              alGuardar={(datos) => ejecutar(
                formPlantilla.id ? actualizarPlantilla(formPlantilla.id, datos) : crearPlantilla(datos),
                formPlantilla.id ? "Plantilla actualizada" : "Plantilla creada",
                () => setFormPlantilla(null)
              )}
            />
          )}
          <div className="plantillas">
            {plantillas.map((p) => (
              <div key={p.id} className="tarjeta-plantilla">
                <div className="encabezado-pagina">
                  <div>
                    <strong>{p.nombre}</strong> {!p.activa && <span className="insignia insignia-inactivo">inactiva</span>}
                    {p.descripcion && <div className="ayuda">{p.descripcion}</div>}
                  </div>
                  {esRRHH && (
                    <div className="barra-acciones">
                      <button className="boton-enlace" onClick={() => setFormPlantilla(p)}>Editar</button>
                      <button className="boton-enlace" onClick={() => ejecutar(actualizarPlantilla(p.id, { activa: !p.activa }), p.activa ? "Plantilla desactivada" : "Plantilla activada")}>
                        {p.activa ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  )}
                </div>
                <ul className="lista-criterios">
                  {p.criterios.map((c) => <li key={c.id}><span>{c.nombre}</span><strong>{c.peso}%</strong></li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
