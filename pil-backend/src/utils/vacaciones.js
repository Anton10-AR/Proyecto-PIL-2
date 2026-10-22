// Derecho a vacaciones según la Ley General del Trabajo de Bolivia (reglas puras, sin base de datos).
// - Se gana por año de servicio cumplido, contado desde la fecha de ingreso ("gestión").
// - 1 a 4 años cumplidos: 15 días hábiles; 5 a 9: 20; 10 o más: 30. Menos de 1 año: 0.
// - Los días no usados en una gestión no se acumulan a la siguiente.

function diasSegunAntiguedad(anios) {
  if (anios >= 10) return 30;
  if (anios >= 5) return 20;
  if (anios >= 1) return 15;
  return 0;
}

// Aniversario de ingreso en un año dado. Si ingresó un 29 de febrero, en años no bisiestos
// el aniversario es el 28 de febrero.
function aniversario(fechaIngreso, anio) {
  const [, mes, dia] = fechaIngreso.split("-").map(Number);
  const ultimoDiaDelMes = new Date(anio, mes, 0).getDate();
  const diaReal = Math.min(dia, ultimoDiaDelMes);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(diaReal).padStart(2, "0")}`;
}

// Gestión vigente en "fecha" y días que le corresponden.
// Devuelve { anios, dias, gestion_inicio, gestion_fin } (gestion_* en null si aún no cumple 1 año).
function calcularDerechoVacaciones(fechaIngreso, fecha) {
  if (!fechaIngreso || fecha < fechaIngreso) {
    return { anios: 0, dias: 0, gestion_inicio: null, gestion_fin: null };
  }
  const anioIngreso = Number(fechaIngreso.slice(0, 4));
  let anioActual = Number(fecha.slice(0, 4));
  if (aniversario(fechaIngreso, anioActual) > fecha) anioActual -= 1;

  const anios = anioActual - anioIngreso;
  if (anios < 1) return { anios: 0, dias: 0, gestion_inicio: null, gestion_fin: null };

  const inicio = aniversario(fechaIngreso, anioActual);
  const siguiente = aniversario(fechaIngreso, anioActual + 1);
  const [a, m, d] = siguiente.split("-").map(Number);
  const fin = new Date(a, m - 1, d - 1);
  const gestionFin = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;

  return { anios, dias: diasSegunAntiguedad(anios), gestion_inicio: inicio, gestion_fin: gestionFin };
}

module.exports = { diasSegunAntiguedad, calcularDerechoVacaciones };
