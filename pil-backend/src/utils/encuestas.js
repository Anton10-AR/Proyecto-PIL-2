// Agregación de resultados de encuestas (reglas puras, sin base de datos, con pruebas).
// Para proteger el anonimato, un grupo de respuestas (la empresa o un área) solo se muestra
// si tiene al menos MINIMO_RESPUESTAS envíos.

const MINIMO_RESPUESTAS = 3;

// preguntas: [{ id, texto, tipo, opciones: [..] | null }]
// envios: [{ id, area }]
// respuestas: [{ id_envio, id_pregunta, valor_numero, valor_texto }]
function resumirResultados(preguntas, envios, respuestas, minimo = MINIMO_RESPUESTAS) {
  if (envios.length < minimo) {
    return { total: envios.length, suficiente: false, preguntas: [] };
  }
  const idsEnvios = new Set(envios.map((e) => e.id));
  const delGrupo = respuestas.filter((r) => idsEnvios.has(r.id_envio));

  return {
    total: envios.length,
    suficiente: true,
    preguntas: preguntas.map((p) => {
      const propias = delGrupo.filter((r) => r.id_pregunta === p.id);
      const base = { id: p.id, texto: p.texto, tipo: p.tipo, respondidas: propias.length };
      if (p.tipo === "escala") {
        const distribucion = [1, 2, 3, 4, 5].map((v) => propias.filter((r) => r.valor_numero === v).length);
        const suma = propias.reduce((t, r) => t + r.valor_numero, 0);
        return { ...base, distribucion, promedio: propias.length ? Math.round((suma / propias.length) * 100) / 100 : null };
      }
      if (p.tipo === "opcion") {
        return { ...base, conteo: p.opciones.map((opcion) => ({ opcion, cantidad: propias.filter((r) => r.valor_texto === opcion).length })) };
      }
      // Texto libre: ordenado alfabéticamente para no revelar el orden de llegada
      return { ...base, textos: propias.map((r) => r.valor_texto).filter(Boolean).sort((a, b) => a.localeCompare(b, "es")) };
    })
  };
}

// Promedio de las preguntas de escala por área, solo para áreas con suficientes envíos.
// Las áreas con menos envíos se agrupan en "otras" sin detalle.
function promediosPorArea(preguntas, envios, respuestas, minimo = MINIMO_RESPUESTAS) {
  const idsEscala = new Set(preguntas.filter((p) => p.tipo === "escala").map((p) => p.id));
  const porArea = {};
  envios.forEach((e) => { (porArea[e.area || "Sin área"] ||= []).push(e.id); });

  const areas = [];
  let otras = 0;
  Object.entries(porArea).forEach(([area, ids]) => {
    if (ids.length < minimo) { otras += ids.length; return; }
    const conjunto = new Set(ids);
    const valores = respuestas.filter((r) => conjunto.has(r.id_envio) && idsEscala.has(r.id_pregunta)).map((r) => r.valor_numero);
    const promedio = valores.length ? Math.round((valores.reduce((t, v) => t + v, 0) / valores.length) * 100) / 100 : null;
    areas.push({ area, envios: ids.length, promedio });
  });
  areas.sort((a, b) => a.area.localeCompare(b.area, "es"));
  return { areas, envios_otras_areas: otras };
}

module.exports = { MINIMO_RESPUESTAS, resumirResultados, promediosPorArea };
