import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../contexto/useAuth";

export default function Login() {
  const { usuario, iniciarSesion } = useAuth();
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const navegar = useNavigate();
  const ubicacion = useLocation();

  if (usuario) return <Navigate to="/" replace />;

  function manejarEnviar(e) {
    e.preventDefault();
    setMensaje("");
    setEnviando(true);
    iniciarSesion(nombreUsuario.trim(), clave)
      .then((datos) => {
        const destino = datos.debe_cambiar_clave ? "/cambiar-clave" : (ubicacion.state?.desde || "/");
        navegar(destino, { replace: true });
      })
      .catch((err) => setMensaje(err.message))
      .finally(() => setEnviando(false));
  }

  return (
    <div className="pantalla-login">
      <form className="tarjeta-login" onSubmit={manejarEnviar}>
        <img src="/logo-pil.png" alt="" className="login-logo" />
        <h1>RR.HH. — PIL Andina</h1>
        <p className="subtitulo">Ingrese con su usuario y contraseña</p>
        {mensaje && <p className="error">{mensaje}</p>}

        <label>
          Usuario
          <input value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>
          Contraseña
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
        </label>
        <button type="submit" className="boton-primario" disabled={enviando}>
          {enviando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
