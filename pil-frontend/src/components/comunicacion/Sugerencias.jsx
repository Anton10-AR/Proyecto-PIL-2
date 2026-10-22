// Buzón de sugerencias: cualquier usuario envía (con anonimato opcional) y consulta las suyas;
// las anónimas se siguen con un código. RRHH gestiona y responde; Gerencia consulta.
import { Fragment, useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexto/useAuth";
import { enviarSugerencia, listarSugerencias, seguimientoSugerencia, responderSugerencia } from "../../api/comunicacion";
import { CATEGORIAS_SUGERENCIA, ESTADOS_SUGERENCIA, fechaCorta } from "../../formato";

function Insignia({ estado }) {
  const info = ESTADOS_SUGERENCIA[estado];
  return <span className={`insignia ${info.clase}`}>{info.texto}</span>;
}

function Respuesta({ s }) {
  if (!s.respuesta) return <span className="ayuda">Sin respuesta todavía</span>;
  return <div className="respuesta-rrhh"><strong>Respuesta de RRHH{s.respondido_por ? ` (${s.respondido_por})` : ""}:</strong> {s.respuesta}</div>;
}

function FormularioEnvio({ alEnviar }) {
  const [datos, setDatos] = useState({ categoria: "", texto: "", anonima: false });
  const [error, setError] = useState("");
  return (
    <form className="formulario-grilla" onSubmit={(e) => {
      e.preventDefault();
      setError("");
      enviarSugerencia(datos).then((r) => { alEnviar(r, datos.anonima); setDatos({ categoria: "", texto: "", anonima: false }); }).catch((err) => setError(err.message));
    }}>
      <fieldset>
        <legend>Nueva sugerencia</legend>
        {error && <p className="error ancho-completo">{error}</p>}
        <label>Categoría *
          <select value={datos.categoria} onChange={(e) => setDatos({ ...datos, categoria: e.target.value })} required>
            <option value="">— Seleccione —</option>
            {Object.entries(CATEGORIAS_SUGERENCIA).map(([clave, texto]) => <option key={clave} value={clave}>{texto}</option>)}
          </select>
        </label>
        <label className="casilla casilla-formulario">
          <input type="checkbox" checked={datos.anonima} onChange={(e) => setDatos({ ...datos, anonima: e.target.checked })} /> Enviar de forma anónima
        </label>
        <label className="ancho-completo">Sugerencia *
          <textarea className="area-texto" rows={4} minLength={10} maxLength={2000} value={datos.texto} onChange={(e) => setDatos({ ...datos, texto: e.target.value })} required />
        </label>
        <p className="ayuda ancho-completo">
          {datos.anonima
            ? "No se guardará su nombre ni su área. Recibirá un código para consultar el estado y la respuesta."
            : "RRHH verá su nombre y le avisará cuando responda."}
        </p>
        <div className="barra-acciones ancho-completo"><button type="submit" className="boton-primario">Enviar</button></div>
      </fieldset>
    </form>
  );
}

function Seguimiento() {
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");
  return (
    <section>
      <h3>Seguimiento de una sugerencia anónima</h3>
      <form className="formulario" onSubmit={(e) => {
        e.preventDefault();
        setError("");
        setResultado(null);
        seguimientoSugerencia(codigo.trim()).then(setResultado).catch((err) => setError(err.message));
      }}>
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código de seguimiento" aria-label="Código de seguimiento" required />
        <button type="submit">Consultar</button>
      </form>
      {error && <p className="error">{error}</p>}
      {resultado && (
        <div className="tarjeta-sugerencia">
          <p><Insignia estado={resultado.estado} /> {CATEGORIAS_SUGERENCIA[resultado.categoria]} · {fechaCorta(resultado.fecha)}</p>
          <p>{resultado.texto}</p>
          <Respuesta s={resultado} />
        </div>
      )}
    </section>
  );
}

function FilaGestion({ s, columnas, alGuardar, alCancelar }) {
  const [estado, setEstado] = useState(s.estado);
  const [respuesta, setRespuesta] = useState(s.respuesta || "");
  return (
    <tr className="fila-edicion">
      <td colSpan={columnas}>
        <div className="formulario-resultado">
          <label>Estado
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              {Object.entries(ESTADOS_SUGERENCIA).map(([clave, { texto }]) => <option key={clave} value={clave}>{texto}</option>)}
            </select>
          </label>
          <label className="campo-ancho">Respuesta {estado === "atendida" ? "*" : ""}
            <input value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Visible para quien la envió" />
          </label>
          <div className="barra-acciones">
            <button className="boton-primario" onClick={() => alGuardar({ estado, respuesta })}>Guardar</button>
            <button onClick={alCancelar}>Cancelar</button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function Sugerencias() {
  const { usuario } = useAuth();
  const gestiona = usuario.rol === "rrhh" || usuario.rol === "gerencia";
  const [pestana, setPestana] = useState("mias");
  const [mias, setMias] = useState([]);
  const [todas, setTodas] = useState([]);
  const [filtros, setFiltros] = useState({ estado: "", categoria: "" });
  const [editando, setEditando] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");

  const cargarMias = useCallback(() => {
    listarSugerencias({ alcance: "mias" }).then(setMias).catch((err) => setMensaje(err.message));
  }, []);
  const cargarTodas = useCallback(() => {
    if (gestiona) listarSugerencias({ alcance: "todas", ...filtros }).then(setTodas).catch((err) => setMensaje(err.message));
  }, [gestiona, filtros]);

  useEffect(() => { cargarMias(); }, [cargarMias]);
  useEffect(() => { cargarTodas(); }, [cargarTodas]);

  function alEnviar(resultado, anonima) {
    setMensaje("");
    setAviso(anonima
      ? `Sugerencia enviada de forma anónima. Guarde este código para consultar la respuesta: ${resultado.codigo_seguimiento}`
      : "Sugerencia enviada. Le avisaremos cuando RRHH responda.");
    cargarMias();
    cargarTodas();
  }

  function guardar(id, datos) {
    setMensaje("");
    setAviso("");
    responderSugerencia(id, datos).then(() => { setAviso("Sugerencia actualizada"); setEditando(null); cargarTodas(); }).catch((err) => setMensaje(err.message));
  }

  const columnas = usuario.rol === "rrhh" ? 6 : 5;

  return (
    <div>
      <h2>Buzón de sugerencias</h2>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className={aviso.includes("código") ? "aviso aviso-codigo" : "exito"}>{aviso}</p>}

      {gestiona && (
        <div className="pestanas" role="tablist">
          <button role="tab" aria-selected={pestana === "mias"} className={pestana === "mias" ? "activa" : ""} onClick={() => setPestana("mias")}>Enviar y mis sugerencias</button>
          <button role="tab" aria-selected={pestana === "todas"} className={pestana === "todas" ? "activa" : ""} onClick={() => setPestana("todas")}>
            Bandeja ({todas.filter((s) => s.estado !== "atendida").length} sin atender)
          </button>
        </div>
      )}

      {pestana === "mias" && (
        <>
          <FormularioEnvio alEnviar={alEnviar} />
          <section>
            <h3>Mis sugerencias</h3>
            <p className="ayuda">Aquí aparecen las que envió con su nombre. Las anónimas se consultan con su código.</p>
            <div className="lista-comunicados">
              {mias.map((s) => (
                <div key={s.id} className="tarjeta-sugerencia">
                  <p><Insignia estado={s.estado} /> {CATEGORIAS_SUGERENCIA[s.categoria]} · {fechaCorta(s.fecha)}</p>
                  <p>{s.texto}</p>
                  <Respuesta s={s} />
                </div>
              ))}
              {mias.length === 0 && <p className="vacio">No envió sugerencias con su nombre.</p>}
            </div>
          </section>
          <Seguimiento />
        </>
      )}

      {pestana === "todas" && gestiona && (
        <>
          <div className="busqueda filtros">
            <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })} aria-label="Estado">
              <option value="">Todos los estados</option>
              {Object.entries(ESTADOS_SUGERENCIA).map(([clave, { texto }]) => <option key={clave} value={clave}>{texto}</option>)}
            </select>
            <select value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {Object.entries(CATEGORIAS_SUGERENCIA).map(([clave, texto]) => <option key={clave} value={clave}>{texto}</option>)}
            </select>
          </div>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Fecha</th><th>Autor</th><th>Categoría</th><th>Sugerencia</th><th>Estado</th>{usuario.rol === "rrhh" && <th></th>}</tr></thead>
              <tbody>
                {todas.map((s) => (
                  <Fragment key={s.id}>
                    <tr>
                      <td>{fechaCorta(s.fecha)}</td>
                      <td>{s.anonima ? <em>Anónima</em> : <>{s.autor}<div className="ayuda">{s.area}</div></>}</td>
                      <td>{CATEGORIAS_SUGERENCIA[s.categoria]}</td>
                      <td>{s.texto}{s.respuesta && <div className="ayuda">Respuesta: {s.respuesta}</div>}</td>
                      <td><Insignia estado={s.estado} /></td>
                      {usuario.rol === "rrhh" && (
                        <td><button className="boton-enlace" onClick={() => setEditando(editando === s.id ? null : s.id)}>{s.respuesta ? "Actualizar" : "Responder"}</button></td>
                      )}
                    </tr>
                    {editando === s.id && <FilaGestion s={s} columnas={columnas} alGuardar={(d) => guardar(s.id, d)} alCancelar={() => setEditando(null)} />}
                  </Fragment>
                ))}
                {todas.length === 0 && <tr><td colSpan={columnas} className="vacio">No hay sugerencias para los filtros elegidos.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
