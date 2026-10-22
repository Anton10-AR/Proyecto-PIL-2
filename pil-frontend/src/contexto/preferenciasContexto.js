import { createContext } from "react";

// Valor: { preferencias, cambiarPreferencia, restablecer, tema } (tema = "claro" u "oscuro", ya resuelto)
export const PreferenciasContexto = createContext(null);
