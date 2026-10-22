// Reglas puras de la evaluación del desempeño (sin base de datos, con pruebas):
// cada criterio tiene un peso entero (%), los pesos de una plantilla suman 100,
// cada criterio se califica de 1 a 5 y el puntaje final es el promedio ponderado (escala 1 a 5).

const PUNTAJE_MINIMO = 1;
const PUNTAJE_MAXIMO = 5;

// Valida la lista de criterios de una plantilla. Devuelve un mensaje de error o null.
function errorCriterios(criterios) {
  if (!Array.isArray(criterios) || criterios.length === 0) return "La plantilla necesita al menos un criterio";
  const nombres = new Set();
  for (const c of criterios) {
    const nombre = String(c.nombre || "").trim();
    if (!nombre) return "Todos los criterios necesitan un nombre";
    if (nombres.has(nombre.toLowerCase())) return `El criterio "${nombre}" está repetido`;
    nombres.add(nombre.toLowerCase());
    const peso = Number(c.peso);
    if (!Number.isInteger(peso) || peso < 1 || peso > 100) return `El peso de "${nombre}" debe ser un entero de 1 a 100`;
  }
  const total = criterios.reduce((suma, c) => suma + Number(c.peso), 0);
  return total === 100 ? null : `Los pesos deben sumar 100 (suman ${total})`;
}

function esPuntajeValido(puntaje) {
  return Number.isInteger(puntaje) && puntaje >= PUNTAJE_MINIMO && puntaje <= PUNTAJE_MAXIMO;
}

// Promedio ponderado con 2 decimales. calificaciones: { [id_criterio]: puntaje }.
// Devuelve null si falta calificar algún criterio.
function calcularPuntaje(criterios, calificaciones) {
  let suma = 0;
  for (const c of criterios) {
    const puntaje = calificaciones[c.id];
    if (!esPuntajeValido(puntaje)) return null;
    suma += puntaje * c.peso;
  }
  return Math.round((suma / 100) * 100) / 100;
}

// Categoría para mostrar según el puntaje final
function categoriaPuntaje(puntaje) {
  if (puntaje === null || puntaje === undefined) return null;
  if (puntaje >= 4.5) return "Sobresaliente";
  if (puntaje >= 3.5) return "Bueno";
  if (puntaje >= 2.5) return "Aceptable";
  return "Necesita mejorar";
}

module.exports = { PUNTAJE_MINIMO, PUNTAJE_MAXIMO, errorCriterios, esPuntajeValido, calcularPuntaje, categoriaPuntaje };
