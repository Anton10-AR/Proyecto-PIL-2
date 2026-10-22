// Utilidades de fechas y horas como strings "YYYY-MM-DD" y "HH:MM" (24 h).
// Se trabaja con la hora local del servidor (se asume que corre en la zona horaria de la empresa).
// Las comparaciones entre strings con este formato son válidas lexicográficamente.

function dosDigitos(n) {
  return String(n).padStart(2, "0");
}

function formatearFecha(fecha) {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
}

function hoyLocal() {
  return formatearFecha(new Date());
}

function horaLocal() {
  const ahora = new Date();
  return `${dosDigitos(ahora.getHours())}:${dosDigitos(ahora.getMinutes())}`;
}

function esFecha(texto) {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return fecha.getFullYear() === a && fecha.getMonth() === m - 1 && fecha.getDate() === d;
}

function esHora(texto) {
  return typeof texto === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(texto);
}

function esMes(texto) {
  return typeof texto === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(texto);
}

function minutosDelDia(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// Horas entre dos "HH:MM" del mismo día, con 2 decimales (no hay turnos que crucen la medianoche)
function calcularHoras(horaEntrada, horaSalida) {
  const minutos = minutosDelDia(horaSalida) - minutosDelDia(horaEntrada);
  return Math.round((minutos / 60) * 100) / 100;
}

// Minutos de retraso respecto del inicio del turno. Llegar dentro de la tolerancia no es
// retraso (devuelve 0); pasada la tolerancia se cuentan todos los minutos desde el inicio.
function calcularRetraso(horaEntrada, horaInicioTurno, tolerancia) {
  const diferencia = minutosDelDia(horaEntrada) - minutosDelDia(horaInicioTurno);
  return diferencia > tolerancia ? diferencia : 0;
}

function aFechaLocal(texto) {
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(a, m - 1, d);
}

// Día de la semana ISO: 1 = lunes ... 7 = domingo
function diaSemana(fecha) {
  const dia = aFechaLocal(fecha).getDay();
  return dia === 0 ? 7 : dia;
}

function sumarDias(fecha, dias) {
  const f = aFechaLocal(fecha);
  f.setDate(f.getDate() + dias);
  return formatearFecha(f);
}

// Primer y último día de un mes "YYYY-MM"
function rangoDelMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  return { desde: `${mes}-01`, hasta: formatearFecha(new Date(a, m, 0)) };
}

module.exports = {
  hoyLocal, horaLocal, esFecha, esHora, esMes, minutosDelDia, calcularHoras, calcularRetraso,
  diaSemana, sumarDias, rangoDelMes, formatearFecha
};
