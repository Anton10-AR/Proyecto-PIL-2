// Alta y edición de encuestas (RRHH, solo en borrador): fechas, destinatarios y preguntas
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { crearEncuesta, actualizarEncuesta, obtenerEncuesta } from "../../api/comunicacion";
import { obtenerOpcionesPersonal } from "../../api/trabajadores";

const PREGUNTA_VACIA = { texto: "", tipo: "escala", opciones: ["", ""], obligatoria: true };
const TIPOS = { escala: "Escala 1 a 5 (de acuerdo / en desacuerdo)", opcion: "Opción única", texto: "Texto libre" };

export default function FormularioEncuesta() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ titulo: "", descripcion: "", fecha_apertura: "", fecha_cierre: "", areas: [], preguntas: [PREGUNTA_VACIA] });
  const [areasDisponibles, setAreasDisponibles] = useState([]);
  const [cargado, setCargado] = useState(!editando);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    obtenerOpcionesPersonal().then((o) => setAreasDisponibles(o.areas)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editando) return;
    obtenerEncuesta(id)
      .then((e) => {
        setDatos({
          titulo: e.titulo, descripcion: e.descripcion || "", fecha_apertura: e.fecha_apertura, fecha_cierre: e.fecha_cierre, areas: e.areas,
          preguntas: e.preguntas.map((p) => ({ texto: p.texto, tipo: p.tipo, opciones: p.opciones || ["", ""], obligatoria: Boolean(p.obligatoria) }))
        });
        setCargado(true);
      })
      .catch((err) => setMensaje(err.message));
  }, [id, editando]);

  const cambiarPregunta = (i, cambios) => setDatos({ ...datos, preguntas: datos.preguntas.map((p, j) => (j === i ? { ...p, ...cambios } : p)) });
  const moverPregunta = (i, delta) => {
    const lista = [...datos.preguntas];
    [lista[i], lista[i + delta]] = [lista[i + delta], lista[i]];
    setDatos({ ...datos, preguntas: lista });
  };
  const alternarArea = (a) => setDatos({ ...datos, areas: datos.areas.includes(a) ? datos.areas.filter((x) => x !== a) : [...datos.areas, a] });

  function enviar(e) {
    e.preventDefault();
    setMensaje("");
    const cuerpo = {
      ...datos,
      preguntas: datos.preguntas.map((p) => ({ ...p, opciones: p.tipo === "opcion" ? p.opciones : undefined }))
    };
    (editando ? actualizarEncuesta(id, cuerpo) : crearEncuesta(cuerpo))
      .then(() => navegar("/encuestas"))
      .catch((err) => setMensaje(err.message));
  }

  if (!cargado) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>{editando ? "Editar encuesta" : "Nueva encuesta"}</h2>
        <Link to="/encuestas">Volver</Link>
      </div>
      <p className="ayuda">Se guarda como borrador; publíquela desde el listado cuando esté lista (después ya no se puede modificar).</p>
      {mensaje && <p className="error">{mensaje}</p>}

      <form onSubmit={enviar} className="formulario-grilla">
        <fieldset>
          <legend>Datos generales</legend>
          <label className="ancho-completo">Título *<input value={datos.titulo} onChange={(e) => setDatos({ ...datos, titulo: e.target.value })} required /></label>
          <label className="ancho-completo">Descripción<input value={datos.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} /></label>
          <label>Apertura *<input type="date" value={datos.fecha_apertura} onChange={(e) => setDatos({ ...datos, fecha_apertura: e.target.value })} required /></label>
          <label>Cierre *<input type="date" min={datos.fecha_apertura} value={datos.fecha_cierre} onChange={(e) => setDatos({ ...datos, fecha_cierre: e.target.value })} required /></label>
          <div className="ancho-completo">
            <span className="etiqueta-campo">Destinatarios</span>
            <div className="dias-semana">
              {areasDisponibles.map((a) => <label key={a} className="casilla"><input type="checkbox" checked={datos.areas.includes(a)} onChange={() => alternarArea(a)} /> {a}</label>)}
            </div>
            <small className="ayuda">{datos.areas.length ? `Solo para: ${datos.areas.join(", ")}` : "Sin áreas seleccionadas: toda la empresa"}</small>
          </div>
        </fieldset>

        {datos.preguntas.map((p, i) => (
          <fieldset key={i}>
            <legend>Pregunta {i + 1}</legend>
            <label className="ancho-completo">Texto *<input value={p.texto} onChange={(e) => cambiarPregunta(i, { texto: e.target.value })} required /></label>
            <label>Tipo
              <select value={p.tipo} onChange={(e) => cambiarPregunta(i, { tipo: e.target.value })}>
                {Object.entries(TIPOS).map(([clave, texto]) => <option key={clave} value={clave}>{texto}</option>)}
              </select>
            </label>
            <label className="casilla casilla-formulario"><input type="checkbox" checked={p.obligatoria} onChange={(e) => cambiarPregunta(i, { obligatoria: e.target.checked })} /> Obligatoria</label>
            {p.tipo === "opcion" && (
              <div className="ancho-completo">
                <span className="etiqueta-campo">Opciones (al menos dos)</span>
                {p.opciones.map((o, k) => (
                  <div key={k} className="barra-acciones fila-opcion">
                    <input value={o} onChange={(e) => cambiarPregunta(i, { opciones: p.opciones.map((x, m) => (m === k ? e.target.value : x)) })} aria-label={`Opción ${k + 1}`} />
                    {p.opciones.length > 2 && <button type="button" className="boton-enlace texto-peligro" onClick={() => cambiarPregunta(i, { opciones: p.opciones.filter((_, m) => m !== k) })}>Quitar</button>}
                  </div>
                ))}
                <button type="button" className="boton-enlace" onClick={() => cambiarPregunta(i, { opciones: [...p.opciones, ""] })}>Agregar opción</button>
              </div>
            )}
            <div className="barra-acciones ancho-completo">
              <button type="button" disabled={i === 0} onClick={() => moverPregunta(i, -1)}>Subir</button>
              <button type="button" disabled={i === datos.preguntas.length - 1} onClick={() => moverPregunta(i, 1)}>Bajar</button>
              <button type="button" disabled={datos.preguntas.length === 1} onClick={() => setDatos({ ...datos, preguntas: datos.preguntas.filter((_, j) => j !== i) })}>Quitar pregunta</button>
            </div>
          </fieldset>
        ))}
        <div className="barra-acciones">
          <button type="button" onClick={() => setDatos({ ...datos, preguntas: [...datos.preguntas, PREGUNTA_VACIA] })}>Agregar pregunta</button>
          <button type="submit" className="boton-primario">Guardar borrador</button>
        </div>
      </form>
    </div>
  );
}
