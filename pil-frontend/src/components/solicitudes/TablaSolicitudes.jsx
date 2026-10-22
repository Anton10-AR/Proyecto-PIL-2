// Tabla de solicitudes con detalle desplegable por fila
import { Fragment, useState } from "react";
import DetalleSolicitud from "./DetalleSolicitud";
import { ESTADOS_SOLICITUD, rangoFechas, textoTipoSolicitud } from "../../formato";

export default function TablaSolicitudes({ solicitudes, mostrarTrabajador = false, alCambiar, textoVacio }) {
  const [abierta, setAbierta] = useState(null);
  const columnas = mostrarTrabajador ? 6 : 5;

  return (
    <div className="tabla-contenedor">
      <table>
        <thead>
          <tr>
            {mostrarTrabajador && <th>Trabajador</th>}
            <th>Tipo</th><th>Fechas</th><th>Días</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          {solicitudes.map((s) => {
            const estado = ESTADOS_SOLICITUD[s.estado];
            const estaAbierta = abierta === s.id;
            return (
              <Fragment key={s.id}>
                <tr className={estaAbierta ? "fila-seleccionada" : ""}>
                  {mostrarTrabajador && <td>{s.apellido}, {s.nombre}</td>}
                  <td>{textoTipoSolicitud(s)}</td>
                  <td>{rangoFechas(s.fecha_inicio, s.fecha_fin)}</td>
                  <td>{s.dias_habiles}</td>
                  <td><span className={`insignia ${estado.clase}`}>{estado.texto}</span></td>
                  <td>
                    <button className="boton-enlace" aria-expanded={estaAbierta} onClick={() => setAbierta(estaAbierta ? null : s.id)}>
                      {estaAbierta ? "Ocultar" : "Ver detalle"}
                    </button>
                  </td>
                </tr>
                {estaAbierta && (
                  <tr className="fila-detalle">
                    <td colSpan={columnas}><DetalleSolicitud id={s.id} alCambiar={alCambiar} /></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {solicitudes.length === 0 && <tr><td colSpan={columnas} className="vacio">{textoVacio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
