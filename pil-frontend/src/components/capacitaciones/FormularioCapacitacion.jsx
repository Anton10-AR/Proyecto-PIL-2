// Alta y edición de capacitaciones (solo RRHH, y solo mientras esté programada)
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { crearCapacitacion, actualizarCapacitacion, obtenerCapacitacion } from "../../api/capacitaciones";

const VACIO = { titulo: "", descripcion: "", instructor: "", lugar: "", fecha_inicio: "", fecha_fin: "", horas: "", cupo: "" };

export default function FormularioCapacitacion() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const [datos, setDatos] = useState(VACIO);
  const [cargado, setCargado] = useState(!editando);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!editando) return;
    obtenerCapacitacion(id)
      .then((c) => {
        const valores = {};
        Object.keys(VACIO).forEach((campo) => { valores[campo] = c[campo] ?? ""; });
        setDatos(valores);
        setCargado(true);
      })
      .catch((err) => setMensaje(err.message));
  }, [id, editando]);

  function cambiar(e) {
    const { name, value } = e.target;
    const nuevos = { ...datos, [name]: value };
    if (name === "fecha_inicio" && (!datos.fecha_fin || datos.fecha_fin < value)) nuevos.fecha_fin = value;
    setDatos(nuevos);
  }

  function enviar(e) {
    e.preventDefault();
    setMensaje("");
    setGuardando(true);
    const cuerpo = { ...datos, cupo: datos.cupo || null };
    (editando ? actualizarCapacitacion(id, cuerpo) : crearCapacitacion(cuerpo))
      .then((c) => navegar(`/capacitaciones/${c.id}`))
      .catch((err) => setMensaje(err.message))
      .finally(() => setGuardando(false));
  }

  if (!cargado) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>{editando ? "Editar capacitación" : "Nueva capacitación"}</h2>
        <Link to={editando ? `/capacitaciones/${id}` : "/capacitaciones"}>Volver</Link>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      <form onSubmit={enviar} className="formulario-grilla">
        <fieldset>
          <legend>Datos de la capacitación</legend>
          <label className="ancho-completo">Título *<input name="titulo" value={datos.titulo} onChange={cambiar} required /></label>
          <label className="ancho-completo">Descripción<input name="descripcion" value={datos.descripcion} onChange={cambiar} /></label>
          <label>Instructor o entidad<input name="instructor" value={datos.instructor} onChange={cambiar} /></label>
          <label>Lugar<input name="lugar" value={datos.lugar} onChange={cambiar} /></label>
          <label>Desde *<input type="date" name="fecha_inicio" value={datos.fecha_inicio} onChange={cambiar} required /></label>
          <label>Hasta *<input type="date" name="fecha_fin" min={datos.fecha_inicio} value={datos.fecha_fin} onChange={cambiar} required /></label>
          <label>Horas totales *<input type="number" min="0.5" step="0.5" name="horas" value={datos.horas} onChange={cambiar} required /></label>
          <label>Cupo<input type="number" min="1" name="cupo" value={datos.cupo} onChange={cambiar} placeholder="Sin límite" /></label>
        </fieldset>
        <div className="acciones-formulario">
          <button type="submit" className="boton-primario" disabled={guardando}>{editando ? "Guardar cambios" : "Crear capacitación"}</button>
        </div>
      </form>
    </div>
  );
}
