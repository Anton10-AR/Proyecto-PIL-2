import { useContext } from "react";
import { AuthContexto } from "./authContexto";

export function useAuth() {
  const valor = useContext(AuthContexto);
  if (!valor) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return valor;
}
