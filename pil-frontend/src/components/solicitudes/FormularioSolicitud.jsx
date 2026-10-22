// Formulario de nueva solicitud propia. Muestra en vivo los días hábiles que se descontarán
// (calculados por el backend con el turno y los feriados) y si la solicitud es válida.
import { useEffect, useState } from "react";
import { calcularSolicitud, crearSolicitud, listarTiposPermiso, subirArchivo } from "../../api/solicitudes";
import { hoy } from "../../formato";

const TAMANO_MAXIMO = 5 * 1024 * 1024;

export default function FormularioSolicitud({ saldo, alCrear, alCancelar }) {
  const [tipos, setTipos] = useState([]);
  const [datos, setDatos] = useState({ tipo: "vacacion", id_tipo_permiso: "", fecha_inicio: "", fecha_fin: "", motivo: "" });
  const [archivo, setArchivo] = useState(null);
  const [calculo, setCalculo] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    listarTiposPermiso({ activos: true }).then(setTipos).catch((err) => setMensaje(err.message));
  }, []);

  const { tipo, id_tipo_permiso, fecha_inicio, fecha_fin } = datos;
  const tipoPermiso = tipos.find((t) => String(t.id) === String(id_tipo_permiso));
  const listoParaCalcular = Boolean(fecha_inicio && fecha_fin && (tipo === "vacacion" || id_tipo_permiso));

  // Vista previa: se recalcula cuando cambian tipo o fechas (con una pequeña espera para no saturar)
  useEffect(() => {
    if (!listoParaCalcular) return undefined;
    let vigente = true;
    const espera = setTimeout(() => {
      calcularSolicitud({ tipo, id_tipo_permiso, fecha_inicio, fecha_fin })
        .then((r) => { if (vigente) setCalculo(r); })
        .catch(() => {});
    }, 300);
    return () => { vigente = false; clearTimeout(espera); };
  }, [tipo, id_tipo_permiso, fecha_inicio, fecha_fin, listoParaCalcular]);

  function cambiar(e) {
    const { name, value } = e.target;
    const nuevos = { ...datos, [name]: value };
    // Si la fecha de fin queda vacía o antes del inicio, se iguala al inicio
    if (name === "fecha_inicio" && (!datos.fecha_fin || datos.fecha_fin < value)) nuevos.fecha_fin = value;
    setDatos(nuevos);
    setCalculo(null);
  }

  function elegirArchivo(e) {
    const elegido = e.target.files[0] || null;
    if (elegido && elegido.size > TAMANO_MAXIMO) {
      setMensaje("El archivo supera el máximo de 5 MB");
      e.target.value = "";
      return;
    }
    setMensaje("");
    setArchivo(elegido);
  }

  async function enviar(e) {
    e.preventDefault();
    setMensaje("");
    setEnviando(true);
    try {
      let id_archivo_respaldo = null;
      if (archivo) id_archivo_respaldo = (await subirArchivo(archivo)).id;
      const cuerpo = { ...datos, id_archivo_respaldo };
      if (cuerpo.tipo === "vacacion") delete cuerpo.id_tipo_permiso;
      await crearSolicitud(cuerpo);
      alCrear();
    } catch (err) {
      setMensaje(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const minimo = datos.tipo === "vacacion" ? hoy() : undefined;

  return (
    <form onSubmit={enviar} className="formulario-grilla">
      <fieldset>
        <legend>Nueva solicitud</legend>
        {mensaje && <p className="error ancho-completo">{mensaje}</p>}

        <div className="ancho-completo selector-tipo" role="radiogroup" aria-label="Tipo de solicitud">
          <label className="casilla">
            <input type="radio" name="tipo" value="vacacion" checked={datos.tipo === "vacacion"} onChange={cambiar} /> Vacación
          </label>
          <label className="casilla">
            <input type="radio" name="tipo" value="permiso" checked={datos.tipo === "permiso"} onChange={cambiar} /> Permiso
          </label>
          {datos.tipo === "vacacion" && saldo && (
            <span className="ayuda">Disponibles: <strong>{saldo.disponibles}</strong> día(s) hábil(es)</span>
          )}
        </div>

        {datos.tipo === "permiso" && (
          <label>Tipo de permiso *
            <select name="id_tipo_permiso" value={datos.id_tipo_permiso} onChange={cambiar} required>
              <option value="">— Seleccione —</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
        )}
        <label>Desde *<input type="date" name="fecha_inicio" min={minimo} value={datos.fecha_inicio} onChange={cambiar} required /></label>
        <label>Hasta *<input type="date" name="fecha_fin" min={datos.fecha_inicio || minimo} value={datos.fecha_fin} onChange={cambiar} required /></label>

        {tipoPermiso && (
          <p className="ayuda ancho-completo">
            {tipoPermiso.descripcion ? `${tipoPermiso.descripcion}. ` : ""}
            Hasta {tipoPermiso.dias_max_solicitud} día(s) hábil(es) por solicitud
            {tipoPermiso.limite_anual_dias ? `, ${tipoPermiso.limite_anual_dias} al año` : ""}
            {tipoPermiso.con_goce ? ", con goce de haber" : ", sin goce de haber"}
            {tipoPermiso.requiere_respaldo ? ". Requiere documento de respaldo." : "."}
          </p>
        )}

        <label className="ancho-completo">Motivo {datos.tipo === "permiso" ? "*" : ""}
          <input name="motivo" value={datos.motivo} onChange={cambiar} required={datos.tipo === "permiso"} />
        </label>

        {datos.tipo === "permiso" && (
          <label className="ancho-completo">Documento de respaldo {tipoPermiso?.requiere_respaldo ? "*" : "(opcional)"}
            <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={elegirArchivo} required={Boolean(tipoPermiso?.requiere_respaldo)} />
            <small className="ayuda">PDF o imagen, hasta 5 MB.</small>
          </label>
        )}

        {listoParaCalcular && calculo && (
          <p className={`ancho-completo ${calculo.valida ? "exito" : "aviso"}`}>
            {calculo.valida ? `Se solicitarán ${calculo.dias_habiles} día(s) hábil(es).` : calculo.error}
          </p>
        )}

        <div className="barra-acciones ancho-completo">
          <button type="submit" className="boton-primario" disabled={enviando || (calculo && !calculo.valida)}>
            {enviando ? "Enviando..." : "Enviar solicitud"}
          </button>
          <button type="button" onClick={alCancelar}>Cancelar</button>
        </div>
      </fieldset>
    </form>
  );
}
