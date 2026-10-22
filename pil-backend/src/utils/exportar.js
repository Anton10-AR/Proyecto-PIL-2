// Generación de reportes exportables (Excel con exceljs, PDF con pdfkit). CSV en utils/estadistica.js.
// Cada reporte se describe como { titulo, columnas: [{ clave, titulo, ancho }], filas }.
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const AZUL = "1E3A8A";

// Libro de Excel con una hoja por reporte (encabezado con estilo, filtros y fila fija)
async function generarExcel(reportes, subtitulo) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Sistema de RR.HH. PIL Andina";
  reportes.forEach((r) => {
    const hoja = libro.addWorksheet(r.hoja || r.titulo.slice(0, 31));
    hoja.addRow([r.titulo]).font = { bold: true, size: 14, color: { argb: AZUL } };
    hoja.addRow([subtitulo]).font = { italic: true, color: { argb: "6B7280" } };
    hoja.addRow([]);
    const encabezado = hoja.addRow(r.columnas.map((c) => c.titulo));
    encabezado.eachCell((celda) => {
      celda.font = { bold: true, color: { argb: "FFFFFF" } };
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
      celda.alignment = { vertical: "middle", wrapText: true };
    });
    r.filas.forEach((f) => hoja.addRow(r.columnas.map((c) => f[c.clave] ?? "")));
    r.columnas.forEach((c, i) => { hoja.getColumn(i + 1).width = c.ancho || 16; });
    hoja.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: r.columnas.length } };
    hoja.views = [{ state: "frozen", ySplit: 4 }];
  });
  return Buffer.from(await libro.xlsx.writeBuffer());
}

// PDF apaisado con secciones: { titulo, texto?: [líneas], tabla?: reporte }
function generarPDF(titulo, subtitulo, secciones) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true, info: { Title: titulo } });
    const partes = [];
    doc.on("data", (p) => partes.push(p));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);

    const izquierda = doc.page.margins.left;
    const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const limiteInferior = () => doc.page.height - doc.page.margins.bottom - 20;

    doc.fillColor(`#${AZUL}`).font("Helvetica-Bold").fontSize(16).text(titulo);
    doc.fillColor("#6b7280").font("Helvetica").fontSize(9).text(subtitulo).moveDown();

    secciones.forEach((s) => {
      if (doc.y > limiteInferior() - 60) doc.addPage();
      doc.fillColor(`#${AZUL}`).font("Helvetica-Bold").fontSize(12).text(s.titulo, izquierda).moveDown(0.3);
      (s.texto || []).forEach((linea) => doc.fillColor("#1f2937").font("Helvetica").fontSize(9.5).text(linea, izquierda));
      if (s.tabla) dibujarTabla(doc, s.tabla, izquierda, anchoUtil, limiteInferior);
      doc.moveDown();
    });

    // Pie con número de página
    const total = doc.bufferedPageRange().count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(i);
      // El pie va dentro del margen inferior: sin quitarlo, pdfkit agregaría una página nueva
      const margenInferior = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor("#9ca3af").font("Helvetica").fontSize(8)
        .text(`Sistema de RR.HH. PIL Andina · Página ${i + 1} de ${total}`, izquierda, doc.page.height - 24, { width: anchoUtil, align: "center", lineBreak: false });
      doc.page.margins.bottom = margenInferior;
    }
    doc.end();
  });
}

function dibujarTabla(doc, reporte, izquierda, anchoUtil, limiteInferior) {
  const totalPesos = reporte.columnas.reduce((t, c) => t + (c.ancho || 16), 0);
  const anchos = reporte.columnas.map((c) => ((c.ancho || 16) / totalPesos) * anchoUtil);
  const alto = (celdas, fuente) => {
    doc.font(fuente).fontSize(8);
    return Math.max(...celdas.map((texto, i) => doc.heightOfString(texto, { width: anchos[i] - 6 }))) + 6;
  };
  const fila = (celdas, { encabezado = false, sombreada = false } = {}) => {
    const fuente = encabezado ? "Helvetica-Bold" : "Helvetica";
    const h = alto(celdas, fuente);
    if (doc.y + h > limiteInferior()) {
      doc.addPage();
      if (!encabezado) fila(reporte.columnas.map((c) => c.titulo), { encabezado: true });
    }
    const y = doc.y;
    if (encabezado || sombreada) doc.rect(izquierda, y, anchoUtil, h).fill(encabezado ? `#${AZUL}` : "#f3f4f6");
    let x = izquierda;
    celdas.forEach((texto, i) => {
      doc.fillColor(encabezado ? "#ffffff" : "#1f2937").font(fuente).fontSize(8).text(texto, x + 3, y + 3, { width: anchos[i] - 6 });
      x += anchos[i];
    });
    doc.y = y + h;
  };
  fila(reporte.columnas.map((c) => c.titulo), { encabezado: true });
  reporte.filas.forEach((f, n) => fila(reporte.columnas.map((c) => (f[c.clave] === null || f[c.clave] === undefined ? "—" : String(f[c.clave]))), { sombreada: n % 2 === 1 }));
  if (reporte.filas.length === 0) doc.fillColor("#6b7280").font("Helvetica-Oblique").fontSize(9).text("Sin datos en el período.", izquierda);
  doc.x = izquierda;
}

module.exports = { generarExcel, generarPDF };
