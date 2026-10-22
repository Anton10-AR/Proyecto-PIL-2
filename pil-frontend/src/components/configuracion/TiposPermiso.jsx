// Catálogo de tipos de permiso (sección de Configuración). RRHH lo edita; Gerencia lo consulta.
import { useCallback, useEffect, useState } from "react";
import { listarTiposPermiso, crearTipoPermiso, actualizarTipoPermiso } from "../../api/solicitudes";

const VACIO = { nombre: "", descripcion: "", dias_max_solicitud: 1, limite_anual_dias: "", requiere_respaldo: false, con_goce: true };

function FormularioTipo({ inicial, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState({
    ...inicial,
    limite_anual_dias: inicial.limite_anual_dias ?? "",
    requiere_respaldo: Boolean(inicial.requiere_respaldo),
    con_goce: Boolean(inicial.con_goce)
  });
  const cambiar = (e) => {
    const { name, value, type, checked } = e.target;
    setDatos({ ...datos, [name]: type === "checkbox" ? checked : value });
  };

  return (
    <form className="formulario-grilla" onSubmit={(e) => { e.preventDefault(); alGuardar({ ...datos, limite_anual_dias: datos.limite_anual_dias || null }); }}>
      <fieldset>
        <legend>{inicial.id ? `Editar "${inicial.nombre}"` : "Nuevo tipo de permiso"}</legend>
        <label>Nombre *<input name="nombre" value={datos.nombre} onChange={cambiar} required /></label>
        <label>Días máximos por solicitud *<input type="number" min="1" name="dias_max_solicitud" value={datos.dias_max_solicitud} onChange={cambiar} required /></label>
        <label>Límite anual de días<input type="number" min="1" name="limite_anual_dias" value={datos.limite_anual_dias} onChange={cambiar} placeholder="Sin límite" /></label>
        <label className="ancho-completo">Descripción<input name="descripcion" value={datos.descripcion || ""} onChange={cambiar} /></label>
        <label className="casilla"><input type="checkbox" name="requiere_respaldo" checked={datos.requiere_respaldo} onChange={cambiar} /> Requiere documento de respaldo</label>
        <label className="casilla"><input type="checkbox" name="con_goce" checked={datos.con_goce} onChange={cambiar} /> Con goce de haber</label>
        <p className="ayuda ancho-completo">Los cambios se aplican a las solicitudes nuevas; las ya creadas no se modifican.</p>
        <div className="barra-acciones ancho-completo">
          <button type="submit" className="boton-primario">Guardar</button>
          <button type="button" onClick={alCancelar}>Cancelar</button>
        </div>
      </fieldset>
    </form>
  );
}

export default function TiposPermiso({ esRRHH, setMensaje, setAviso }) {
  const [tipos, setTipos] = useState([]);
  const [formulario, setFormulario] = useState(null);

  const cargar = useCallback(() => {
    listarTiposPermiso().then(setTipos).catch((err) => setMensaje(err.message));
  }, [setMensaje]);

  useEffect(() => { cargar(); }, [cargar]);

  function ejecutar(promesa, texto, alTerminar) {
    setMensaje("");
    setAviso("");
    promesa.then(() => { setAviso(texto); alTerminar?.(); cargar(); }).catch((err) => setMensaje(err.message));
  }

  return (
    <section>
      <div className="encabezado-pagina">
        <h3>Tipos de permiso</h3>
        {esRRHH && !formulario && <button className="boton-primario" onClick={() => setFormulario(VACIO)}>Nuevo tipo</button>}
      </div>
      {formulario && (
        <FormularioTipo
          key={formulario.id || "nuevo"}
          inicial={formulario}
          alCancelar={() => setFormulario(null)}
          alGuardar={(datos) => ejecutar(
            datos.id ? actualizarTipoPermiso(datos.id, datos) : crearTipoPermiso(datos),
            datos.id ? "Tipo de permiso actualizado" : "Tipo de permiso creado",
            () => setFormulario(null)
          )}
        />
      )}
      <div className="tabla-contenedor">
        <table>
          <thead>
            <tr><th>Tipo</th><th>Máx. por solicitud</th><th>Límite anual</th><th>Respaldo</th><th>Goce de haber</th><th>Estado</th>{esRRHH && <th></th>}</tr>
          </thead>
          <tbody>
            {tipos.map((t) => (
              <tr key={t.id}>
                <td>{t.nombre}{t.descripcion && <div className="ayuda">{t.descripcion}</div>}</td>
                <td>{t.dias_max_solicitud} día(s)</td>
                <td>{t.limite_anual_dias ? `${t.limite_anual_dias} día(s)` : "Sin límite"}</td>
                <td>{t.requiere_respaldo ? "Obligatorio" : "No"}</td>
                <td>{t.con_goce ? "Sí" : "No"}</td>
                <td><span className={`insignia insignia-${t.activo ? "activo" : "inactivo"}`}>{t.activo ? "activo" : "inactivo"}</span></td>
                {esRRHH && (
                  <td><div className="barra-acciones">
                    <button className="boton-enlace" onClick={() => setFormulario(t)}>Editar</button>
                    <button className="boton-enlace" onClick={() => ejecutar(actualizarTipoPermiso(t.id, { activo: !t.activo }), t.activo ? "Tipo desactivado" : "Tipo activado")}>
                      {t.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
