import { useEffect, useState } from "react";
import { PreferenciasContexto } from "./preferenciasContexto";
import {
  PREFERENCIAS_INICIALES, aplicarPreferencias, escucharSistema, guardarPreferencias, leerPreferencias, temaResuelto
} from "../preferencias";

export default function PreferenciasProvider({ children }) {
  const [preferencias, setPreferencias] = useState(leerPreferencias);
  // Se incrementa cuando cambia el tema del sistema, para recalcular "según el equipo"
  const [, setCambiosSistema] = useState(0);

  useEffect(() => {
    aplicarPreferencias(preferencias);
    guardarPreferencias(preferencias);
  }, [preferencias]);

  useEffect(() => escucharSistema(() => {
    aplicarPreferencias(leerPreferencias());
    setCambiosSistema((n) => n + 1);
  }), []);

  function cambiarPreferencia(clave, valor) {
    setPreferencias((actuales) => ({ ...actuales, [clave]: valor }));
  }

  function restablecer() {
    setPreferencias({ ...PREFERENCIAS_INICIALES });
  }

  const valor = { preferencias, cambiarPreferencia, restablecer, tema: temaResuelto(preferencias.tema) };
  return <PreferenciasContexto.Provider value={valor}>{children}</PreferenciasContexto.Provider>;
}
