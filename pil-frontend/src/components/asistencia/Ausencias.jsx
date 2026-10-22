// Ausencias: RRHH las registra (justificadas o injustificadas); supervisor y Gerencia las consultan.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import { listarTrabajadores } from "../../api/trabajadores";
import { listarAusencias, registrarAusencia, actualizarAusencia, eliminarAusencia } from "../../api/ausencias";
import { fechaCorta, hoy, mesActual } from "../../formato";

const NUEVA_VACIA = { id_trabajador: "", fecha: "", justificada: false, motivo: "" };

export default function Ausencias() {
  const { usuario } = useAuth();
  const esRRHH = usuario.rol === "rrhh";
  const [trabajadores, setTrabajadores] = useState([]);
  const [filtros, setFiltros] = useState({ trabajador: "", mes: mesActual(), justificada: "" });
  const [ausencias, setAusencias] = useState([]);
  const [nueva, setNueva] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    listarTrabajadores({ estado: "" }).then(setTrabajadores).catch((err) => setMensaje(err.message));
  }, []);

  const cargar = useCallback(() => {
    listarAusencias(filtros).then(setAusencias).catch((err) => setMensaje(err.message));
  }, [filtros]);

  useEffect(() => { cargar(); }, [cargar]);

  function ejecutar(promesa, textoExito, alTerminar) {
    setMensaje("");
    setAviso("");
    promesa
      .then(() => { setAviso(textoExito); alTerminar?.(); cargar(); })
      .catch((err) => setMensaje(err.message));
  }

  function guardarNueva(e) {
    e.preventDefault();
    ejecutar(registrarAusencia(nueva), "Ausencia registrada", () => setNueva(null));
  }

  function cambiarJustificacion(a) {
    let motivo = a.motivo;
    if (!a.justificada) {
      motivo = prompt("Motivo de la justificación:", a.motivo || "");
      if (motivo === null) return;
    }
    ejecutar(actualizarAusencia(a.id, { justificada: !a.justificada, motivo }), a.justificada ? "Marcada como injustificada" : "Marcada como justificada");
  }

  function eliminar(a) {
    if (!confirm(`¿Eliminar la ausencia de ${a.nombre} ${a.apellido} del ${fechaCorta(a.fecha)}?`)) return;
    ejecutar(eliminarAusencia(a.id), "Ausencia eliminada");
  }

  const cambiarFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Ausencias</h2>
        {esRRHH && !nueva && (
          <button className="boton-primario" onClick={() => setNueva({ ...NUEVA_VACIA, fecha: hoy() })}>Registrar ausencia</button>
        )}
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      {nueva && (
        <form onSubmit={guardarNueva} className="formulario-grilla">
          <fieldset>
            <legend>Nueva ausencia</legend>
            <label>Trabajador *
              <select value={nueva.id_trabajador} onChange={(e) => setNueva({ ...nueva, id_trabajador: e.target.value })} required>
                <option value="">— Seleccione —</option>
                {trabajadores.filter((t) => t.estado === "activo").map((t) => (
                  <option key={t.id} value={t.id}>{t.apellido}, {t.nombre}</option>
                ))}
              </select>
            </label>
            <label>Fecha *<input type="date" max={hoy()} value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} required /></label>
            <label className="casilla casilla-formulario">
              <input type="checkbox" checked={nueva.justificada} onChange={(e) => setNueva({ ...nueva, justificada: e.target.checked })} /> Justificada
            </label>
            <label className="ancho-completo">Motivo
              <input value={nueva.motivo} onChange={(e) => setNueva({ ...nueva, motivo: e.target.value })} placeholder="Ej.: reposo médico con certificado" />
            </label>
            <p className="ayuda ancho-completo">Solo se puede registrar en un día laborable del turno del trabajador y sin marcación de asistencia.</p>
            <div className="barra-acciones ancho-completo">
              <button type="submit" className="boton-primario">Registrar</button>
              <button type="button" onClick={() => setNueva(null)}>Cancelar</button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="busqueda filtros">
        <select name="trabajador" value={filtros.trabajador} onChange={cambiarFiltro} aria-label="Trabajador">
          <option value="">Todos los trabajadores</option>
          {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.apellido}, {t.nombre}</option>)}
        </select>
        <input type="month" name="mes" value={filtros.mes} onChange={cambiarFiltro} aria-label="Mes" />
        <select name="justificada" value={filtros.justificada} onChange={cambiarFiltro} aria-label="Tipo">
          <option value="">Justificadas e injustificadas</option>
          <option value="1">Solo justificadas</option>
          <option value="0">Solo injustificadas</option>
        </select>
      </div>

      <div className="tabla-contenedor">
        <table>
          <thead>
            <tr><th>Trabajador</th><th>Área</th><th>Fecha</th><th>Tipo</th><th>Motivo</th>{esRRHH && <th></th>}</tr>
          </thead>
          <tbody>
            {ausencias.map((a) => (
              <tr key={a.id}>
                <td>{a.apellido}, {a.nombre}</td>
                <td>{a.area || "—"}</td>
                <td>{fechaCorta(a.fecha)}</td>
                <td>
                  <span className={`insignia ${a.justificada ? "insignia-justificada" : "insignia-injustificada"}`}>
                    {a.justificada ? "Justificada" : "Injustificada"}
                  </span>
                </td>
                <td>{a.motivo || "—"}</td>
                {esRRHH && (
                  <td><div className="barra-acciones">
                    <button className="boton-enlace" onClick={() => cambiarJustificacion(a)}>
                      {a.justificada ? "Quitar justificación" : "Justificar"}
                    </button>
                    <button className="boton-enlace texto-peligro" onClick={() => eliminar(a)}>Eliminar</button>
                  </div></td>
                )}
              </tr>
            ))}
            {ausencias.length === 0 && <tr><td colSpan={esRRHH ? 6 : 5} className="vacio">Sin ausencias para los filtros elegidos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
