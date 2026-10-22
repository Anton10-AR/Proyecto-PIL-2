// Funciones puras para indicadores y exportaciones (sin base de datos, con pruebas)

// Porcentaje con 1 decimal; null si el denominador es 0 (el indicador no aplica)
function porcentaje(parte, total) {
  if (!total) return null;
  return Math.round((parte / total) * 1000) / 10;
}

function promedio(valores, decimales = 2) {
  const validos = valores.filter((v) => v !== null && v !== undefined);
  if (validos.length === 0) return null;
  const factor = 10 ** decimales;
  return Math.round((validos.reduce((t, v) => t + v, 0) / validos.length) * factor) / factor;
}

// "YYYY-MM-DD HH:MM:SS" (hora local) -> Date
function aFecha(texto) {
  const [fecha, hora = "00:00:00"] = texto.split(" ");
  const [a, m, d] = fecha.split("-").map(Number);
  const [h, mi, s = 0] = hora.split(":").map(Number);
  return new Date(a, m - 1, d, h, mi, s);
}

// Horas transcurridas entre dos marcas de tiempo, con 1 decimal (null si falta alguna)
function horasEntre(inicio, fin) {
  if (!inicio || !fin) return null;
  return Math.round(((aFecha(fin) - aFecha(inicio)) / 3600000) * 10) / 10;
}

// CSV compatible con Excel en configuración regional española: separador ";" y BOM UTF-8
function aCSV(columnas, filas) {
  const celda = (valor) => {
    if (valor === null || valor === undefined) return "";
    const texto = String(valor);
    return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const lineas = [columnas.map((c) => celda(c.titulo)).join(";")];
  filas.forEach((f) => lineas.push(columnas.map((c) => celda(f[c.clave])).join(";")));
  return "﻿" + lineas.join("\r\n");
}

module.exports = { porcentaje, promedio, horasEntre, aCSV };
