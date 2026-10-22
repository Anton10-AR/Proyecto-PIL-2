// Sesión del usuario: se recupera con el token guardado al cargar la app
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContexto } from "./authContexto";
import * as apiAuth from "../api/auth";
import { obtenerToken, guardarToken, borrarToken, EVENTO_SESION_EXPIRADA } from "../api/cliente";

export default function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(() => !!obtenerToken());

  useEffect(() => {
    if (!obtenerToken()) return;
    apiAuth.obtenerUsuarioActual()
      .then(setUsuario)
      .catch(() => borrarToken())
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    const alExpirar = () => setUsuario(null);
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, []);

  const iniciarSesion = useCallback(async (nombreUsuario, clave) => {
    const { token } = await apiAuth.iniciarSesion(nombreUsuario, clave);
    guardarToken(token);
    const datos = await apiAuth.obtenerUsuarioActual();
    setUsuario(datos);
    return datos;
  }, []);

  const cerrarSesion = useCallback(async () => {
    await apiAuth.cerrarSesion().catch(() => {});
    borrarToken();
    setUsuario(null);
  }, []);

  const marcarClaveCambiada = useCallback(() => {
    setUsuario((actual) => (actual ? { ...actual, debe_cambiar_clave: false } : actual));
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion, marcarClaveCambiada }),
    [usuario, cargando, iniciarSesion, cerrarSesion, marcarClaveCambiada]
  );

  return <AuthContexto.Provider value={valor}>{children}</AuthContexto.Provider>;
}
