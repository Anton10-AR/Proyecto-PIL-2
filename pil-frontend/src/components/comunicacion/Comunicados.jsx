// Comunicados internos: todos leen los dirigidos a su área; RRHH y Gerencia publican y eliminan.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import { listarComunicados, publicarComunicado, eliminarComunicado } from "../../api/comunicacion";
import { obtenerOpcionesPersonal } from "../../api/trabajadores";

const VACIO = { titulo: "", contenido: "", areas: [], importante: false };

export default function Comunicados() {
  const { usuario } = useAuth();
  const puedePublicar = usuario.rol === "rrhh" || usuario.rol === "gerencia";
  const [comunicados, setComunicados] = useState([]);
  const [areasDisponibles, setAreasDisponibles] = useState([]);
  const [nuevo, setNuevo] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    listarComunicados().then(setComunicados).catch((err) => setMensaje(err.message));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (puedePublicar) obtenerOpcionesPersonal().then((o) => setAreasDisponibles(o.areas)).catch(() => {});
  }, [puedePublicar]);

  function ejecutar(promesa, texto, alTerminar) {
    setMensaje("");
    setAviso("");
    promesa.then(() => { setAviso(texto); alTerminar?.(); cargar(); }).catch((err) => setMensaje(err.message));
  }

  const alternarArea = (area) => setNuevo({
    ...nuevo, areas: nuevo.areas.includes(area) ? nuevo.areas.filter((a) => a !== area) : [...nuevo.areas, area]
  });

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Comunicados</h2>
        {puedePublicar && !nuevo && <button className="boton-primario" onClick={() => setNuevo(VACIO)}>Publicar comunicado</button>}
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      {nuevo && (
        <form className="formulario-grilla" onSubmit={(e) => { e.preventDefault(); ejecutar(publicarComunicado(nuevo), "Comunicado publicado; se notificó a los destinatarios", () => setNuevo(null)); }}>
          <fieldset>
            <legend>Nuevo comunicado</legend>
            <label className="ancho-completo">Título *<input value={nuevo.titulo} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })} required /></label>
            <label className="ancho-completo">Contenido *
              <textarea className="area-texto" rows={5} value={nuevo.contenido} onChange={(e) => setNuevo({ ...nuevo, contenido: e.target.value })} required />
            </label>
            <div className="ancho-completo">
              <span className="etiqueta-campo">Destinatarios</span>
              <div className="dias-semana">
                {areasDisponibles.map((a) => (
                  <label key={a} className="casilla"><input type="checkbox" checked={nuevo.areas.includes(a)} onChange={() => alternarArea(a)} /> {a}</label>
                ))}
              </div>
              <small className="ayuda">{nuevo.areas.length ? `Solo para: ${nuevo.areas.join(", ")}` : "Sin áreas seleccionadas: toda la empresa"}</small>
            </div>
            <label className="casilla"><input type="checkbox" checked={nuevo.importante} onChange={(e) => setNuevo({ ...nuevo, importante: e.target.checked })} /> Importante (se muestra primero)</label>
            <div className="barra-acciones ancho-completo">
              <button type="submit" className="boton-primario">Publicar</button>
              <button type="button" onClick={() => setNuevo(null)}>Cancelar</button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="lista-comunicados">
        {comunicados.map((c) => (
          <article key={c.id} className={`comunicado${c.importante ? " comunicado-importante" : ""}`}>
            <header>
              <h3>{c.importante ? "📌 " : ""}{c.titulo}</h3>
              <span className="ayuda">
                {c.autor} · {c.fecha_publicacion.slice(0, 16)} · {c.areas.length ? `Para: ${c.areas.join(", ")}` : "Toda la empresa"}
              </span>
            </header>
            <p className="texto-largo">{c.contenido}</p>
            {c.puede_eliminar && (
              <button className="boton-enlace texto-peligro" onClick={() => confirm("¿Eliminar este comunicado?") && ejecutar(eliminarComunicado(c.id), "Comunicado eliminado")}>Eliminar</button>
            )}
          </article>
        ))}
        {comunicados.length === 0 && <p className="vacio">No hay comunicados.</p>}
      </div>
    </div>
  );
}
