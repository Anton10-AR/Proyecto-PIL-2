// Exige sesión iniciada y, opcionalmente, uno de los roles indicados o que acceso(usuario) sea verdadero
// (los módulos del proceso dependen del puesto del usuario, no de su rol)
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../contexto/useAuth";

export default function RutaProtegida({ roles, acceso, children }) {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();

  if (cargando) return <p className="cargando">Cargando...</p>;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  if (usuario.debe_cambiar_clave && ubicacion.pathname !== "/cambiar-clave") {
    return <Navigate to="/cambiar-clave" replace />;
  }
  if ((acceso && !acceso(usuario)) || (!acceso && roles && !roles.includes(usuario.rol))) {
    return <p className="error">No tiene permiso para ver esta sección.</p>;
  }
  return children;
}
