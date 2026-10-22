// Preferencias de apariencia y accesibilidad. Son de cada navegador (localStorage), no de la cuenta,
// y se aplican como atributos data-* en <html>, que index.css usa para cambiar las variables.
// index.html repite esta lógica en un script en línea para evitar el parpadeo al cargar.

export const CLAVE_PREFERENCIAS = "pil-preferencias";

export const PREFERENCIAS_INICIALES = {
  tema: "sistema",       // claro | oscuro | sistema (según el equipo)
  texto: "normal",       // normal | grande | muy-grande
  contraste: false,
  subrayar: true,
  reducirMovimiento: false
};

export function leerPreferencias() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS));
    return { ...PREFERENCIAS_INICIALES, ...(guardadas || {}) };
  } catch {
    return { ...PREFERENCIAS_INICIALES };
  }
}

export function guardarPreferencias(preferencias) {
  try {
    localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(preferencias));
  } catch {
    // Sin almacenamiento (modo privado o bloqueado): las preferencias duran solo esta visita
  }
}

const consultaOscuro = window.matchMedia("(prefers-color-scheme: dark)");
const consultaMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");

// "sistema" se resuelve con la configuración del equipo
export function temaResuelto(tema) {
  if (tema === "sistema") return consultaOscuro.matches ? "oscuro" : "claro";
  return tema;
}

export function aplicarPreferencias(preferencias) {
  const raiz = document.documentElement;
  raiz.dataset.tema = temaResuelto(preferencias.tema);
  raiz.dataset.texto = preferencias.texto;
  raiz.dataset.contraste = preferencias.contraste ? "alto" : "normal";
  raiz.dataset.subrayar = preferencias.subrayar ? "si" : "no";
  raiz.dataset.movimiento = preferencias.reducirMovimiento || consultaMovimiento.matches ? "reducido" : "normal";
}

// Avisa cuando cambia el tema o el movimiento del sistema operativo; devuelve la función para dejar de escuchar
export function escucharSistema(alCambiar) {
  consultaOscuro.addEventListener("change", alCambiar);
  consultaMovimiento.addEventListener("change", alCambiar);
  return () => {
    consultaOscuro.removeEventListener("change", alCambiar);
    consultaMovimiento.removeEventListener("change", alCambiar);
  };
}
