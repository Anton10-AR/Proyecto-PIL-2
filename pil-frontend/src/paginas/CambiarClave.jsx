import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexto/useAuth";
import { cambiarClave } from "../api/auth";

export default function CambiarClave() {
  const { usuario, marcarClaveCambiada } = useAuth();
  const [formulario, setFormulario] = useState({ actual: "", nueva: "", confirmacion: "" });
  const [mensaje, setMensaje] = useState("");
  const [exito, setExito] = useState("");
  const navegar = useNavigate();
  const obligatorio = usuario.debe_cambiar_clave;

  function manejarCambio(e) {
    setFormulario({ ...formulario, [e.target.name]: e.target.value });
  }

  function manejarEnviar(e) {
    e.preventDefault();
    setMensaje("");
    setExito("");
    if (formulario.nueva !== formulario.confirmacion) {
      setMensaje("La confirmación no coincide con la nueva contraseña");
      return;
    }
    cambiarClave(formulario.actual, formulario.nueva)
      .then(() => {
        setFormulario({ actual: "", nueva: "", confirmacion: "" });
        if (obligatorio) {
          marcarClaveCambiada();
          navegar("/", { replace: true });
        } else {
          setExito("Contraseña actualizada");
        }
      })
      .catch((err) => setMensaje(err.message));
  }

  return (
    <div className="pagina-angosta">
      <h2>Cambiar contraseña</h2>
      {obligatorio && (
        <p className="aviso">Es su primer ingreso: debe reemplazar la contraseña inicial antes de continuar.</p>
      )}
      {mensaje && <p className="error">{mensaje}</p>}
      {exito && <p className="exito">{exito}</p>}

      <form onSubmit={manejarEnviar} className="formulario formulario-vertical">
        <label>
          Contraseña actual
          <input type="password" name="actual" value={formulario.actual} onChange={manejarCambio} autoComplete="current-password" required />
        </label>
        <label>
          Nueva contraseña
          <input type="password" name="nueva" value={formulario.nueva} onChange={manejarCambio} autoComplete="new-password" required />
        </label>
        <label>
          Confirmar nueva contraseña
          <input type="password" name="confirmacion" value={formulario.confirmacion} onChange={manejarCambio} autoComplete="new-password" required />
        </label>
        <small className="ayuda">Mínimo 8 caracteres, con letras y números.</small>
        <button type="submit" className="boton-primario">Guardar contraseña</button>
      </form>
    </div>
  );
}
