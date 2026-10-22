// Cliente HTTP común: agrega el token de sesión y unifica el manejo de errores.
// Todas las funciones de src/api/* pasan por peticion().
const BASE_URL = "http://localhost:3000/api";
const CLAVE_TOKEN = "pil_token";

// Se emite cuando el backend rechaza el token (sesión vencida o cerrada en otro lado)
export const EVENTO_SESION_EXPIRADA = "pil:sesion-expirada";

export function obtenerToken() {
  try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; }
}

export function guardarToken(token) {
  try { localStorage.setItem(CLAVE_TOKEN, token); } catch { /* sin almacenamiento: la sesión dura lo que la pestaña */ }
}

export function borrarToken() {
  try { localStorage.removeItem(CLAVE_TOKEN); } catch { /* nada que borrar */ }
}

// cuerpo: objeto (se envía como JSON) o FormData (subida de archivos; el navegador pone el Content-Type)
async function enviar(ruta, { metodo = "GET", cuerpo } = {}) {
  const headers = {};
  const token = obtenerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const esFormulario = cuerpo instanceof FormData;
  if (cuerpo !== undefined && !esFormulario) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : esFormulario ? cuerpo : JSON.stringify(cuerpo)
  });

  if (res.status === 401 && token) {
    borrarToken();
    window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
  }
  if (!res.ok) {
    const datos = await res.json().catch(() => ({}));
    throw new Error(datos.error || "Error en la solicitud");
  }
  return res;
}

export async function peticion(ruta, opciones) {
  const res = await enviar(ruta, opciones);
  return res.json().catch(() => ({}));
}

// Descarga un archivo protegido (requiere el token, así que no sirve un <a href> directo)
// y lo muestra en una pestaña nueva. La pestaña se abre antes de esperar la descarga para que
// el navegador no la bloquee como ventana emergente (debe abrirse dentro del clic del usuario).
export async function abrirArchivo(ruta) {
  const ventana = window.open("", "_blank");
  try {
    const res = await enviar(ruta);
    const url = URL.createObjectURL(await res.blob());
    if (ventana) ventana.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    ventana?.close();
    throw err;
  }
}

// Descarga un archivo protegido y lo guarda con el nombre que indique el servidor
export async function descargarArchivo(ruta, nombrePorDefecto = "descarga") {
  const res = await enviar(ruta);
  const disposicion = res.headers.get("Content-Disposition") || "";
  const nombre = disposicion.match(/filename="?([^"]+)"?/)?.[1] || nombrePorDefecto;
  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Arma "?a=1&b=2" omitiendo los valores vacíos
export function consulta(parametros = {}) {
  const params = new URLSearchParams();
  Object.entries(parametros).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") params.set(clave, valor);
  });
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}
