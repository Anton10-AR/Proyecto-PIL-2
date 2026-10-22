// Reglas puras del módulo de Recepción y calidad (sin base de datos, con pruebas en test/recepcion.test.js):
// evaluación de una muestra contra los parámetros vigentes, códigos correlativos e indicadores.

const RESULTADO_DE_SUGERENCIA = { aceptar: "aceptado", derivar: "derivado", rechazar: "rechazado" };

function formatoNumero(n) {
  return String(n).replace(".", ",");
}

// Texto legible del límite de un parámetro: "≤ 10 °C", "0,13 – 0,17 %", "≥ 3 %", "negativo"
function describirLimite(parametro) {
  if (parametro.tipo === "cualitativo") return parametro.valor_aceptable;
  const unidad = parametro.unidad ? ` ${parametro.unidad}` : "";
  const { minimo, maximo } = parametro;
  if (minimo !== null && minimo !== undefined && maximo !== null && maximo !== undefined) {
    return `${formatoNumero(minimo)} – ${formatoNumero(maximo)}${unidad}`;
  }
  if (maximo !== null && maximo !== undefined) return `≤ ${formatoNumero(maximo)}${unidad}`;
  return `≥ ${formatoNumero(minimo)}${unidad}`;
}

function cumpleParametro(parametro, valor) {
  if (parametro.tipo === "cualitativo") return valor === parametro.valor_aceptable;
  const numero = Number(valor);
  if (parametro.minimo !== null && parametro.minimo !== undefined && numero < parametro.minimo) return false;
  if (parametro.maximo !== null && parametro.maximo !== undefined && numero > parametro.maximo) return false;
  return true;
}

// valores: { temperatura, acidez, densidad, grasa, alcohol, antibioticos }
// Devuelve la sugerencia del sistema y los parámetros que no se cumplen:
// - algún parámetro crítico fuera de norma -> rechazar
// - solo parámetros no críticos fuera de norma -> derivar
// - todo dentro de norma -> aceptar
// La sugerencia no decide: la decisión la confirma siempre el supervisor de calidad.
function evaluarMuestra(valores, parametros) {
  const observaciones = parametros
    .filter((p) => valores[p.codigo] !== undefined && valores[p.codigo] !== null)
    .filter((p) => !cumpleParametro(p, valores[p.codigo]))
    .map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      valor: valores[p.codigo],
      limite: describirLimite(p),
      critico: Boolean(p.critico)
    }));

  let sugerencia = "aceptar";
  if (observaciones.some((o) => o.critico)) sugerencia = "rechazar";
  else if (observaciones.length) sugerencia = "derivar";
  return { sugerencia, observaciones };
}

// Código correlativo por día: ("LR", "2026-10-21", 3) -> "LR-20261021-03"
function codigoCorrelativo(prefijo, fecha, numero) {
  return `${prefijo}-${fecha.replaceAll("-", "")}-${String(numero).padStart(2, "0")}`;
}

// Minutos entre dos "YYYY-MM-DD HH:MM[:SS]" (hora local)
function minutosEntre(desde, hasta) {
  const aFecha = (texto) => {
    const [f, h] = texto.split(" ");
    const [a, m, d] = f.split("-").map(Number);
    const [hh, mm] = h.split(":").map(Number);
    return new Date(a, m - 1, d, hh, mm);
  };
  return Math.round((aFecha(hasta) - aFecha(desde)) / 60000);
}

const redondear = (n, decimales = 1) => Math.round(n * 10 ** decimales) / 10 ** decimales;
const porcentaje = (parte, total) => (total ? redondear((parte / total) * 100) : null);

// Indicadores de calidad (documento, sección 10.1) a partir de las filas de ingresos del período.
// Cada fila: { volumen_l, estado, sugerencia, fecha_hora_llegada, fecha_hora_decision }
function calcularIndicadoresCalidad(ingresos) {
  const decididos = ingresos.filter((i) => ["aceptado", "derivado", "rechazado"].includes(i.estado));
  const analizados = ingresos.filter((i) => i.sugerencia);
  const litros = (filas) => filas.reduce((suma, i) => suma + i.volumen_l, 0);
  const litrosDecididos = litros(decididos);
  const litrosRechazados = litros(decididos.filter((i) => i.estado === "rechazado"));
  const tiempos = decididos.map((i) => minutosEntre(i.fecha_hora_llegada, i.fecha_hora_decision));

  return {
    ingresos: ingresos.length,
    pendientes: ingresos.length - decididos.length,
    litros_recibidos: litros(ingresos),
    litros_aceptados: litros(decididos.filter((i) => i.estado === "aceptado")),
    litros_derivados: litros(decididos.filter((i) => i.estado === "derivado")),
    litros_rechazados: litrosRechazados,
    // Porcentaje de leche rechazada = litros rechazados ÷ litros con decisión × 100
    pct_rechazo: porcentaje(litrosRechazados, litrosDecididos),
    // Conformidad = ingresos con todos los parámetros en norma ÷ ingresos analizados × 100
    pct_conformidad: porcentaje(analizados.filter((i) => i.sugerencia === "aceptar").length, analizados.length),
    // Tiempo de recepción = promedio de minutos entre la llegada y la decisión
    tiempo_recepcion_min: tiempos.length ? redondear(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : null,
    // Ingresos con registro completo (análisis y decisión) ÷ ingresos registrados × 100
    pct_registros_completos: porcentaje(decididos.length, ingresos.length)
  };
}

module.exports = {
  RESULTADO_DE_SUGERENCIA, describirLimite, cumpleParametro, evaluarMuestra, codigoCorrelativo, minutosEntre,
  calcularIndicadoresCalidad, porcentaje, redondear
};
