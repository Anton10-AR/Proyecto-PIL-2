// Respaldos (solo RRHH): generar uno manual, ver los existentes y descargarlos
import { useCallback, useEffect, useState } from "react";
import { listarRespaldos, crearRespaldo, descargarRespaldo } from "../../api/reportes";

function tamanoLegible(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Respaldos({ setMensaje, setAviso }) {
  const [respaldos, setRespaldos] = useState([]);
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(() => {
    listarRespaldos().then(setRespaldos).catch((err) => setMensaje(err.message));
  }, [setMensaje]);

  useEffect(() => { cargar(); }, [cargar]);

  function generar() {
    setMensaje("");
    setAviso("");
    setGenerando(true);
    crearRespaldo()
      .then((r) => { setAviso(`Respaldo generado: ${r.nombre}`); cargar(); })
      .catch((err) => setMensaje(err.message))
      .finally(() => setGenerando(false));
  }

  return (
    <section>
      <div className="encabezado-pagina">
        <h3>Respaldos</h3>
        <button className="boton-primario" disabled={generando} onClick={generar}>{generando ? "Generando..." : "Generar respaldo ahora"}</button>
      </div>
      <p className="ayuda">
        Cada respaldo es un ZIP con la base de datos y los archivos adjuntos. El sistema genera uno automático por día y conserva
        los últimos 7; los manuales se conservan todos. Para restaurar, siga las instrucciones del archivo LEEME.txt incluido.
      </p>
      <div className="tabla-contenedor">
        <table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Tamaño</th><th></th></tr></thead>
          <tbody>
            {respaldos.map((r) => (
              <tr key={r.nombre}>
                <td>{r.fecha}</td>
                <td>{r.tipo === "manual" ? "Manual" : "Automático"}</td>
                <td>{tamanoLegible(r.tamano)}</td>
                <td><button className="boton-enlace" onClick={() => descargarRespaldo(r.nombre).catch((err) => setMensaje(err.message))}>Descargar</button></td>
              </tr>
            ))}
            {respaldos.length === 0 && <tr><td colSpan={4} className="vacio">Todavía no hay respaldos.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
