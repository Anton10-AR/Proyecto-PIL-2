// Detalle de una solicitud: datos, respaldo, recorrido de aprobación y acciones disponibles
// (decidir la etapa actual o cancelar la propia). Lo usan "Mis solicitudes" y la bandeja.
import { useCallback, useEffect, useState } from "react";
import { obtenerSolicitud, decidirSolicitud, cancelarSolicitud, verArchivo } from "../../api/solicitudes";
import { obtenerImpactoSolicitud } from "../../api/proceso";
import { ESTADOS_SOLICITUD, ETAPAS, fechaCorta, rangoFechas, textoTipoSolicitud } from "../../formato";

export default function DetalleSolicitud({ id, alCambiar }) {
  const [solicitud, setSolicitud] = useState(null);
  const [comentario, setComentario] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [impacto, setImpacto] = useState(null);

  const cargar = useCallback(() => {
    obtenerSolicitud(id).then(setSolicitud).catch((err) => setMensaje(err.message));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  // Impacto en el proceso: días en que aprobarla dejaría un puesto crítico sin la cobertura mínima
  const pendiente = solicitud?.estado?.startsWith("pendiente_");
  useEffect(() => {
    if (!pendiente) return;
    obtenerImpactoSolicitud(id).then(setImpacto).catch(() => setImpacto(null));
  }, [id, pendiente]);

  function ejecutar(promesa) {
    setMensaje("");
    setProcesando(true);
    promesa
      .then(() => { setComentario(""); cargar(); alCambiar?.(); })
      .catch((err) => setMensaje(err.message))
      .finally(() => setProcesando(false));
  }

  if (!solicitud) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const estado = ESTADOS_SOLICITUD[solicitud.estado];

  return (
    <div className="detalle-solicitud">
      {mensaje && <p className="error">{mensaje}</p>}
      <dl className="datos">
        <div className="dato"><dt>Trabajador</dt><dd>{solicitud.nombre} {solicitud.apellido} · {solicitud.area || "Sin área"}</dd></div>
        <div className="dato"><dt>Tipo</dt><dd>{textoTipoSolicitud(solicitud)}{solicitud.tipo === "permiso" && !solicitud.con_goce ? " (sin goce de haber)" : ""}</dd></div>
        <div className="dato"><dt>Fechas</dt><dd>{rangoFechas(solicitud.fecha_inicio, solicitud.fecha_fin)}</dd></div>
        <div className="dato"><dt>Días hábiles</dt><dd>{solicitud.dias_habiles}</dd></div>
        <div className="dato"><dt>Motivo</dt><dd>{solicitud.motivo || "—"}</dd></div>
        <div className="dato"><dt>Solicitada</dt><dd>{solicitud.fecha_solicitud}</dd></div>
        {solicitud.id_archivo_respaldo && (
          <div className="dato">
            <dt>Respaldo</dt>
            <dd><button className="boton-enlace" onClick={() => verArchivo(solicitud.id_archivo_respaldo).catch((err) => setMensaje(err.message))}>{solicitud.archivo_nombre}</button></dd>
          </div>
        )}
        {solicitud.saldo && (
          <div className="dato">
            <dt>Saldo de vacaciones</dt>
            <dd>{solicitud.saldo.disponibles} disponibles de {solicitud.saldo.dias} (gestión desde {fechaCorta(solicitud.saldo.gestion_inicio)})</dd>
          </div>
        )}
      </dl>

      {pendiente && impacto?.critico && (impacto.dias.length > 0 ? (
        <div className="aviso">
          <strong>Impacto en el proceso:</strong> {solicitud.nombre} ocupa el puesto crítico «{impacto.puesto}». Si se aprueba, el puesto queda
          sin la cobertura mínima ({impacto.cobertura_minima}) en {impacto.dias.length} día(s) de operación:{" "}
          {impacto.dias.map((d) => fechaCorta(d.fecha)).join(", ")}. Coordine un reemplazo antes de aprobar.
        </div>
      ) : (
        <p className="ayuda">Puesto crítico «{impacto.puesto}»: aprobarla no deja el puesto sin cobertura mínima.</p>
      ))}

      <ol className="recorrido">
        {solicitud.etapas.map((etapa) => {
          const decision = solicitud.aprobaciones.find((a) => a.etapa === etapa);
          const esActual = solicitud.estado === `pendiente_${etapa}`;
          let clase = "recorrido-espera";
          let texto = "En espera";
          if (decision) {
            clase = decision.decision === "aprobado" ? "recorrido-aprobado" : "recorrido-rechazado";
            texto = `${decision.decision === "aprobado" ? "Aprobó" : "Rechazó"} ${decision.aprobador} · ${decision.fecha}`;
          } else if (esActual) {
            clase = "recorrido-actual";
            texto = "Pendiente de decisión";
          } else if (solicitud.estado === "cancelado" || solicitud.estado === "rechazado") {
            texto = "No llegó a esta etapa";
          }
          return (
            <li key={etapa} className={clase}>
              <strong>{ETAPAS[etapa]}</strong>
              <span>{texto}</span>
              {decision?.comentario && <em>“{decision.comentario}”</em>}
            </li>
          );
        })}
      </ol>
      <p>Estado: <span className={`insignia ${estado.clase}`}>{estado.texto}</span></p>

      {solicitud.puede_decidir && (
        <div className="decision">
          <label>
            Comentario {""}<small className="ayuda">(obligatorio para rechazar)</small>
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} />
          </label>
          <div className="barra-acciones">
            <button className="boton-primario" disabled={procesando} onClick={() => ejecutar(decidirSolicitud(id, "aprobado", comentario))}>Aprobar</button>
            <button className="boton-peligro" disabled={procesando} onClick={() => ejecutar(decidirSolicitud(id, "rechazado", comentario))}>Rechazar</button>
          </div>
        </div>
      )}
      {solicitud.puede_cancelar && (
        <div className="barra-acciones">
          <button
            disabled={procesando}
            onClick={() => confirm("¿Cancelar esta solicitud?") && ejecutar(cancelarSolicitud(id))}
          >
            Cancelar solicitud
          </button>
        </div>
      )}
    </div>
  );
}
