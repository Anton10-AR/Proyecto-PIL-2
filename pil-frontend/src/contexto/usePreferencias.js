import { useContext } from "react";
import { PreferenciasContexto } from "./preferenciasContexto";

export function usePreferencias() {
  const valor = useContext(PreferenciasContexto);
  if (!valor) throw new Error("usePreferencias debe usarse dentro de <PreferenciasProvider>");
  return valor;
}
