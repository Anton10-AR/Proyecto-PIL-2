// Solicitudes propias: saldo de vacaciones, nueva solicitud e historial
import { useCallback, useEffect, useState } from "react";
import { listarSolicitudes, obtenerSaldoVacaciones } from "../../api/solicitudes";
import FormularioSolicitud from "./FormularioSolicitud";
import TablaSolicitudes from "./TablaSolicitudes";
import { fechaCorta } from "../../formato";

function TarjetaSaldo({ saldo }) {
  if (!saldo) return null;
  if (!saldo.gestion_inicio) {
    return (
      <div className="tarjeta-saldo">
        <p>{saldo.fecha_ingreso
          ? `Aún no cumple un año de servicio (ingresó el ${fechaCorta(saldo.fecha_ingreso)}), por lo que todavía no tiene vacaciones.`
          : "No tiene fecha de ingreso registrada; consulte con RRHH."}</p>
      </div>
    );
  }
  return (
    <div className="tarjeta-saldo">
      <div className="tarjetas">
        <div className="tarjeta"><span className="tarjeta-valor">{saldo.disponibles}</span><span className="tarjeta-etiqueta">Días disponibles</span></div>
        <div className="tarjeta"><span className="tarjeta-valor">{saldo.usados}</span><span className="tarjeta-etiqueta">Usados (aprobados)</span></div>
        <div className="tarjeta"><span className="tarjeta-valor">{saldo.reservados}</span><span className="tarjeta-etiqueta">Reservados (pendientes)</span></div>
        <div className="tarjeta"><span className="tarjeta-valor">{saldo.dias}</span><span className="tarjeta-etiqueta">Derecho de la gestión</span></div>
      </div>
      <p className="ayuda">
        Gestión del {fechaCorta(saldo.gestion_inicio)} al {fechaCorta(saldo.gestion_fin)} · {saldo.anios} año(s) de servicio.
        Los días no usados no se acumulan a la siguiente gestión.
      </p>
    </div>
  );
}

export default function MisSolicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [saldo, setSaldo] = useState(null);
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(() => {
    listarSolicitudes({ alcance: "mias" }).then(setSolicitudes).catch((err) => setMensaje(err.message));
    obtenerSaldoVacaciones().then(setSaldo).catch((err) => setMensaje(err.message));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Mis solicitudes</h2>
        {!creando && <button className="boton-primario" onClick={() => { setAviso(""); setCreando(true); }}>Nueva solicitud</button>}
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      <section>
        <h3>Vacaciones</h3>
        <TarjetaSaldo saldo={saldo} />
      </section>

      {creando && (
        <FormularioSolicitud
          saldo={saldo}
          alCrear={() => { setCreando(false); setAviso("Solicitud enviada. Se notificó a quien debe aprobarla."); cargar(); }}
          alCancelar={() => setCreando(false)}
        />
      )}

      <section>
        <h3>Historial</h3>
        <TablaSolicitudes solicitudes={solicitudes} alCambiar={cargar} textoVacio="Todavía no hizo solicitudes." />
      </section>
    </div>
  );
}
