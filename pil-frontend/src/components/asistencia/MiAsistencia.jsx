// Marcación propia de entrada y salida (con la hora del servidor) e historial del mes
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import { obtenerMiDiaHoy, marcarEntrada, marcarSalida, consultarAsistencia } from "../../api/asistencia";
import { listarAusencias } from "../../api/ausencias";
import { fechaCorta, mesActual, textoRetraso } from "../../formato";

function TarjetaHoy({ dia, alMarcar, procesando }) {
  const { turno, feriado, laborable, registro, ausencia, solicitud } = dia;

  let descripcion;
  if (solicitud) descripcion = `Hoy está de ${solicitud.tipo === "vacacion" ? "vacaciones" : `permiso (${solicitud.tipo_permiso})`}, del ${fechaCorta(solicitud.fecha_inicio)} al ${fechaCorta(solicitud.fecha_fin)}.`;
  else if (feriado) descripcion = `Hoy es feriado: ${feriado.descripcion}.`;
  else if (!turno) descripcion = "No tiene un turno asignado. Consulte con RRHH.";
  else if (!laborable) descripcion = `Hoy no es día laborable de su turno ${turno.nombre}.`;
  else descripcion = `Turno ${turno.nombre}: ${turno.hora_inicio} a ${turno.hora_fin} (tolerancia ${dia.tolerancia_minutos} min).`;

  return (
    <div className="tarjeta-hoy">
      <div>
        <span className="tarjeta-hoy-fecha">{fechaCorta(dia.fecha)}</span>
        <p>{descripcion}</p>
        {!laborable && !registro && !ausencia && !solicitud && (
          <p className="ayuda">Si marca hoy, el registro quedará como "fuera de turno".</p>
        )}
      </div>

      <div className="tarjeta-hoy-estado">
        {ausencia && (
          <p className="aviso">RRHH registró una ausencia {ausencia.justificada ? "justificada" : "injustificada"} para hoy.</p>
        )}
        {!ausencia && !solicitud && !registro && (
          <button className="boton-primario boton-grande" onClick={() => alMarcar("entrada")} disabled={procesando}>
            Marcar entrada
          </button>
        )}
        {registro && (
          <dl className="datos datos-compactos">
            <div className="dato"><dt>Entrada</dt><dd>{registro.hora_entrada}</dd></div>
            <div className="dato"><dt>Salida</dt><dd>{registro.hora_salida || "—"}</dd></div>
            <div className="dato"><dt>Retraso</dt><dd>{textoRetraso(registro.minutos_retraso)}</dd></div>
          </dl>
        )}
        {registro && !registro.hora_salida && (
          <button className="boton-primario boton-grande" onClick={() => alMarcar("salida")} disabled={procesando}>
            Marcar salida
          </button>
        )}
        {registro?.hora_salida && <p className="exito">Jornada registrada: {registro.horas_trabajadas} h.</p>}
        <small className="ayuda">Se registra la hora del servidor, no la de su dispositivo.</small>
      </div>
    </div>
  );
}

export default function MiAsistencia() {
  const { usuario } = useAuth();
  const [dia, setDia] = useState(null);
  const [mes, setMes] = useState(mesActual());
  const [filas, setFilas] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);

  const cargarHoy = useCallback(() => {
    obtenerMiDiaHoy().then(setDia).catch((err) => setMensaje(err.message));
  }, []);

  // Historial del mes: marcaciones y ausencias en una sola lista ordenada por fecha
  const cargarHistorial = useCallback(() => {
    const filtro = { trabajador: usuario.id_trabajador, mes };
    Promise.all([consultarAsistencia(filtro), listarAusencias(filtro)])
      .then(([marcaciones, ausencias]) => {
        const combinadas = [
          ...marcaciones.map((m) => ({ ...m, clase: "marcacion" })),
          ...ausencias.map((a) => ({ ...a, clase: "ausencia" }))
        ].sort((x, y) => y.fecha.localeCompare(x.fecha));
        setFilas(combinadas);
      })
      .catch((err) => setMensaje(err.message));
  }, [usuario.id_trabajador, mes]);

  useEffect(() => { cargarHoy(); }, [cargarHoy]);
  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  function alMarcar(tipo) {
    setMensaje("");
    setProcesando(true);
    (tipo === "entrada" ? marcarEntrada() : marcarSalida())
      .then(() => { cargarHoy(); cargarHistorial(); })
      .catch((err) => setMensaje(err.message))
      .finally(() => setProcesando(false));
  }

  return (
    <div>
      <h2>Mi asistencia</h2>
      {mensaje && <p className="error">{mensaje}</p>}
      {dia ? <TarjetaHoy dia={dia} alMarcar={alMarcar} procesando={procesando} /> : <p className="cargando">Cargando...</p>}

      <section>
        <div className="encabezado-pagina">
          <h3>Historial</h3>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes" />
        </div>
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Turno</th><th>Entrada</th><th>Salida</th><th>Retraso</th><th>Horas</th><th>Observación</th></tr>
            </thead>
            <tbody>
              {filas.map((f) => f.clase === "ausencia" ? (
                <tr key={`a${f.id}`} className="fila-ausencia">
                  <td>{fechaCorta(f.fecha)}</td>
                  <td colSpan={5}>Ausencia {f.justificada ? "justificada" : "injustificada"}</td>
                  <td>{f.motivo || "—"}</td>
                </tr>
              ) : (
                <tr key={`m${f.id}`}>
                  <td>{fechaCorta(f.fecha)}</td>
                  <td>{f.turno || "—"}</td>
                  <td>{f.hora_entrada}</td>
                  <td>{f.hora_salida || "—"}</td>
                  <td className={f.minutos_retraso > 0 ? "texto-alerta" : ""}>{textoRetraso(f.minutos_retraso)}</td>
                  <td>{f.horas_trabajadas ?? "—"}</td>
                  <td>{f.observacion ? `Corregido por RRHH: ${f.observacion}` : "—"}</td>
                </tr>
              ))}
              {filas.length === 0 && <tr><td colSpan={7} className="vacio">Sin registros en este mes.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
