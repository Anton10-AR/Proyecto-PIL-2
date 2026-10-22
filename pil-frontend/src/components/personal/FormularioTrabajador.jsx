// Alta y edición de trabajadores (solo RRHH). En el alta también se crea la cuenta:
// la contraseña inicial es el CI y el trabajador debe cambiarla en su primer ingreso.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { crearTrabajador, actualizarTrabajador, obtenerTrabajador, obtenerOpcionesPersonal } from "../../api/trabajadores";
import { NOMBRES_ROL, ROLES } from "../../roles";

const VACIO = {
  nombre: "", apellido: "", ci: "", fecha_nacimiento: "", telefono: "", direccion: "", correo: "",
  cargo: "", area: "", fecha_ingreso: "", tipo_contrato: "", id_supervisor: "", id_puesto: "",
  usuario: "", rol: "trabajador"
};

const TIPOS_CONTRATO = ["Indefinido", "Plazo fijo", "Eventual", "Consultoría"];

// "María José", "Pérez" -> "mperez"
function sugerirUsuario(nombre, apellido) {
  const limpiar = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const primerApellido = apellido.trim().split(/\s+/)[0] || "";
  return limpiar(nombre.trim().charAt(0)) + limpiar(primerApellido);
}

export default function FormularioTrabajador() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const [formulario, setFormulario] = useState(VACIO);
  const [usuarioEditado, setUsuarioEditado] = useState(false);
  const [opciones, setOpciones] = useState({ areas: [], cargos: [], supervisores: [], puestos: [] });
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  // En edición no se muestra el formulario hasta tener los datos, para que la carga no pise lo escrito
  const [cargado, setCargado] = useState(!editando);

  useEffect(() => {
    obtenerOpcionesPersonal().then(setOpciones).catch((err) => setMensaje(err.message));
  }, []);

  useEffect(() => {
    if (!editando) return;
    obtenerTrabajador(id)
      .then((t) => {
        const datos = {};
        Object.keys(VACIO).forEach((campo) => { datos[campo] = t[campo] ?? ""; });
        setFormulario(datos);
        setCargado(true);
      })
      .catch((err) => setMensaje(err.message));
  }, [id, editando]);

  function manejarCambio(e) {
    const { name, value } = e.target;
    const nuevo = { ...formulario, [name]: value };
    if (name === "usuario") setUsuarioEditado(true);
    if (!editando && !usuarioEditado && (name === "nombre" || name === "apellido")) {
      nuevo.usuario = sugerirUsuario(nuevo.nombre, nuevo.apellido);
    }
    setFormulario(nuevo);
  }

  function manejarEnviar(e) {
    e.preventDefault();
    setMensaje("");
    setGuardando(true);
    const datos = { ...formulario, id_supervisor: formulario.id_supervisor || null, id_puesto: formulario.id_puesto || null };
    if (editando) {
      delete datos.usuario;
      delete datos.rol;
    }
    const accion = editando ? actualizarTrabajador(id, datos) : crearTrabajador(datos);
    accion
      .then((t) => navegar(`/personal/${t.id}`))
      .catch((err) => setMensaje(err.message))
      .finally(() => setGuardando(false));
  }

  if (!cargado) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const supervisores = opciones.supervisores.filter((s) => String(s.id) !== String(id));

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>{editando ? "Editar trabajador" : "Registrar trabajador"}</h2>
        <Link to={editando ? `/personal/${id}` : "/personal"}>Volver</Link>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}

      <form onSubmit={manejarEnviar} className="formulario-grilla">
        <fieldset>
          <legend>Datos personales</legend>
          <label>Nombre *<input name="nombre" value={formulario.nombre} onChange={manejarCambio} required /></label>
          <label>Apellido *<input name="apellido" value={formulario.apellido} onChange={manejarCambio} required /></label>
          <label>CI *<input name="ci" value={formulario.ci} onChange={manejarCambio} required disabled={editando} /></label>
          <label>Fecha de nacimiento<input type="date" name="fecha_nacimiento" value={formulario.fecha_nacimiento} onChange={manejarCambio} /></label>
          <label>Teléfono<input name="telefono" value={formulario.telefono} onChange={manejarCambio} /></label>
          <label>Correo<input type="email" name="correo" value={formulario.correo} onChange={manejarCambio} /></label>
          <label className="ancho-completo">Dirección<input name="direccion" value={formulario.direccion} onChange={manejarCambio} /></label>
        </fieldset>

        <fieldset>
          <legend>Datos laborales</legend>
          <label>Cargo<input name="cargo" list="lista-cargos" value={formulario.cargo} onChange={manejarCambio} /></label>
          <label>Área<input name="area" list="lista-areas" value={formulario.area} onChange={manejarCambio} /></label>
          <label>Fecha de ingreso<input type="date" name="fecha_ingreso" value={formulario.fecha_ingreso} onChange={manejarCambio} /></label>
          <label>Tipo de contrato
            <select name="tipo_contrato" value={formulario.tipo_contrato} onChange={manejarCambio}>
              <option value="">— Sin especificar —</option>
              {TIPOS_CONTRATO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
              {formulario.tipo_contrato && !TIPOS_CONTRATO.includes(formulario.tipo_contrato) && (
                <option value={formulario.tipo_contrato}>{formulario.tipo_contrato}</option>
              )}
            </select>
          </label>
          <label>Supervisor
            <select name="id_supervisor" value={formulario.id_supervisor} onChange={manejarCambio}>
              <option value="">— Sin supervisor —</option>
              {supervisores.map((s) => (
                <option key={s.id} value={s.id}>{s.apellido}, {s.nombre}{s.cargo ? ` (${s.cargo})` : ""}</option>
              ))}
            </select>
          </label>
          <label>Puesto en el proceso
            <select name="id_puesto" value={formulario.id_puesto} onChange={manejarCambio}>
              <option value="">— No ocupa un puesto en el proceso —</option>
              {opciones.puestos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id_etapa ? `Etapa ${p.id_etapa} · ` : "Transversal · "}{p.nombre}{p.critico ? " (crítico)" : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="ayuda ancho-completo">El puesto define qué puede hacer la persona en Recepción y calidad y si cuenta para la cobertura de puestos críticos.</p>
          <datalist id="lista-cargos">{opciones.cargos.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id="lista-areas">{opciones.areas.map((a) => <option key={a} value={a} />)}</datalist>
        </fieldset>

        {!editando && (
          <fieldset>
            <legend>Cuenta de acceso</legend>
            <label>Usuario *<input name="usuario" value={formulario.usuario} onChange={manejarCambio} required pattern="[a-z0-9._]{3,30}" title="3 a 30 caracteres: minúsculas, números, punto o guion bajo" /></label>
            <label>Rol *
              <select name="rol" value={formulario.rol} onChange={manejarCambio}>
                {ROLES.map((r) => <option key={r} value={r}>{NOMBRES_ROL[r]}</option>)}
              </select>
            </label>
            <p className="ayuda ancho-completo">La contraseña inicial será el CI; se pedirá cambiarla en el primer ingreso.</p>
          </fieldset>
        )}

        <div className="acciones-formulario">
          <button type="submit" className="boton-primario" disabled={guardando}>
            {editando ? "Guardar cambios" : "Registrar trabajador"}
          </button>
        </div>
      </form>
    </div>
  );
}
