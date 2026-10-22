// Campana de notificaciones: consulta periódicamente las no leídas
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { listarNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from "../api/notificaciones";

const INTERVALO_MS = 60000;

function IconoCampana() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function Campana() {
  const [datos, setDatos] = useState({ no_leidas: 0, notificaciones: [] });
  const [abierta, setAbierta] = useState(false);
  const navegar = useNavigate();

  const cargar = useCallback(() => {
    listarNotificaciones().then(setDatos).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  function abrir(notificacion) {
    setAbierta(false);
    const ir = () => { if (notificacion.enlace) navegar(notificacion.enlace); };
    if (notificacion.leida) return ir();
    marcarNotificacionLeida(notificacion.id).then(cargar).finally(ir);
  }

  function leerTodas() {
    marcarTodasLeidas().then(cargar);
  }

  return (
    <div className="campana">
      <button
        className="campana-boton"
        onClick={() => setAbierta(!abierta)}
        aria-label={`Notificaciones (${datos.no_leidas} sin leer)`}
      >
        <IconoCampana />
        {datos.no_leidas > 0 && <span className="campana-contador">{datos.no_leidas}</span>}
      </button>

      {abierta && (
        <div className="campana-panel">
          <div className="campana-cabecera">
            <strong>Notificaciones</strong>
            {datos.no_leidas > 0 && <button onClick={leerTodas}>Marcar todas como leídas</button>}
          </div>
          {datos.notificaciones.length === 0 && <p className="campana-vacia">No hay notificaciones.</p>}
          <ul>
            {datos.notificaciones.map((n) => (
              <li key={n.id}>
                <button className={n.leida ? "" : "no-leida"} onClick={() => abrir(n)}>
                  <span>{n.mensaje}</span>
                  <small>{n.fecha}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
