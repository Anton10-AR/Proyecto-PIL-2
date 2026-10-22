// Detalle de un ingreso de leche y su flujo de 4 pasos: ingreso -> análisis -> decisión -> descarga.
// Cada paso lo realiza un puesto distinto (operador, analista, supervisor de calidad); las correcciones
// exigen motivo y quedan en la bitácora.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../../contexto/useAuth";
import {
  obtenerIngreso, obtenerCatalogos, registrarAnalisis, corregirAnalisis, corregirIngreso, registrarDecision, registrarDescarga
} from "../../api/recepcion";
import { ESTADOS_INGRESO, SUGERENCIAS, decimal, fechaHora, miles } from "../../formato";

const CAMPOS_ANALISIS = { acidez: "", densidad: "", grasa: "", alcohol: "negativo", antibioticos: "ausencia" };
const CAMPOS_LEGIBLES = {
  volumen_l: "Volumen (L)", temperatura_c: "Temperatura (°C)", id_proveedor: "Proveedor", id_cisterna: "Cisterna",
  observacion: "Observación", acidez: "Acidez", densidad: "Densidad", grasa: "Materia grasa", alcohol: "Prueba de alcohol",
  antibioticos: "Antibióticos"
};

// Misma regla que el backend (utils/recepcion.js), solo para avisar mientras se escribe
function cumple(parametro, valor) {
  if (valor === "" || valor === null || valor === undefined) return true;
  if (parametro.tipo === "cualitativo") return valor === parametro.valor_aceptable;
  const n = Number(valor);
  if (parametro.minimo !== null && n < parametro.minimo) return false;
  if (parametro.maximo !== null && n > parametro.maximo) return false;
  return true;
}

function Paso({ titulo, estado, detalle }) {
  return (
    <li className={`paso paso-${estado}`}>
      <strong>{titulo}</strong>
      <span>{detalle}</span>
    </li>
  );
}

function CampoAnalisis({ nombre, etiqueta, valores, setValores, parametro, paso, min, max }) {
  const fuera = parametro && !cumple(parametro, valores[nombre]);
  return (
    <label>{etiqueta} *
      <input type="number" step={paso} min={min} max={max} value={valores[nombre]} required
        onChange={(e) => setValores({ ...valores, [nombre]: e.target.value })} aria-invalid={fuera} />
      {parametro && <small className={fuera ? "fuera-norma" : "ayuda"}>{fuera ? "Fuera de norma · " : ""}Límite: {parametro.limite}</small>}
    </label>
  );
}

function FormularioAnalisis({ inicial, parametros, conMotivo, alGuardar, alCancelar, guardando }) {
  const [valores, setValores] = useState(inicial);
  const p = Object.fromEntries(parametros.map((x) => [x.codigo, x]));
  function enviar(e) {
    e.preventDefault();
    alGuardar(valores);
  }
  const cualitativo = (nombre, etiqueta, opciones) => {
    const fuera = p[nombre] && !cumple(p[nombre], valores[nombre]);
    return (
      <label>{etiqueta} *
        <select value={valores[nombre]} onChange={(e) => setValores({ ...valores, [nombre]: e.target.value })}>
          {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {p[nombre] && <small className={fuera ? "fuera-norma" : "ayuda"}>{fuera ? "Fuera de norma · " : ""}Aceptable: {p[nombre].limite}{p[nombre].critico ? " (crítico)" : ""}</small>}
      </label>
    );
  };
  return (
    <form onSubmit={enviar} className="formulario-grilla">
      <fieldset>
        <legend>{conMotivo ? "Corregir análisis" : "Resultados de la muestra"}</legend>
        <CampoAnalisis nombre="acidez" etiqueta="Acidez (%)" paso="0.001" min="0" max="1" valores={valores} setValores={setValores} parametro={p.acidez} />
        <CampoAnalisis nombre="densidad" etiqueta="Densidad (g/ml)" paso="0.0001" min="1" max="1.1" valores={valores} setValores={setValores} parametro={p.densidad} />
        <CampoAnalisis nombre="grasa" etiqueta="Materia grasa (%)" paso="0.1" min="0" max="15" valores={valores} setValores={setValores} parametro={p.grasa} />
        {cualitativo("alcohol", "Prueba de alcohol", ["negativo", "positivo"])}
        {cualitativo("antibioticos", "Antibióticos", ["ausencia", "presencia"])}
        {conMotivo && (
          <label className="ancho-completo">Motivo de la corrección *
            <input value={valores.motivo || ""} onChange={(e) => setValores({ ...valores, motivo: e.target.value })} required placeholder="Ej.: se repitió la titulación" />
          </label>
        )}
        <div className="barra-acciones ancho-completo">
          <button type="submit" className="boton-primario" disabled={guardando}>{conMotivo ? "Guardar corrección" : "Registrar análisis"}</button>
          {alCancelar && <button type="button" onClick={alCancelar}>Cancelar</button>}
        </div>
      </fieldset>
    </form>
  );
}

function FormularioDecision({ ingreso, tanques, alGuardar, guardando }) {
  const sugerido = SUGERENCIAS[ingreso.sugerencia].resultado;
  const [resultado, setResultado] = useState(sugerido);
  const [tanque, setTanque] = useState("");
  const [motivo, setMotivo] = useState("");
  const distinto = resultado !== sugerido;
  const pideMotivo = distinto || resultado !== "aceptado";
  function enviar(e) {
    e.preventDefault();
    alGuardar({ resultado, tanque: resultado === "rechazado" ? null : tanque, motivo });
  }
  return (
    <form onSubmit={enviar} className="formulario-grilla">
      <fieldset>
        <legend>Decisión</legend>
        <div className="ancho-completo segmentado" role="radiogroup" aria-label="Resultado">
          {["aceptado", "derivado", "rechazado"].map((r) => (
            <button type="button" key={r} role="radio" aria-checked={resultado === r} className={resultado === r ? "activo" : ""} onClick={() => setResultado(r)}>
              {ESTADOS_INGRESO[r].texto}{r === sugerido ? " (sugerido)" : ""}
            </button>
          ))}
        </div>
        {resultado !== "rechazado" && (
          <label>Tanque de destino *
            <select value={tanque} onChange={(e) => setTanque(e.target.value)} required>
              <option value="">— Seleccione —</option>
              {tanques.map((t) => <option key={t.codigo} value={t.codigo}>{t.codigo} · {miles(t.capacidad_l)} L</option>)}
            </select>
          </label>
        )}
        <label className="ancho-completo">Motivo {pideMotivo ? "*" : "(opcional)"}
          <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} required={pideMotivo}
            placeholder={distinto ? "Explique por qué se aparta de la sugerencia del sistema" : "Ej.: acidez elevada, se deriva a elaboración de queso"} />
        </label>
        {distinto && <p className="aviso ancho-completo">Su decisión se aparta de la sugerencia del sistema: quedará registrada con su motivo.</p>}
        {resultado === "rechazado" && <p className="ayuda ancho-completo">Al rechazar se avisa al operador (no descargar) y a la jefatura de planta y al coordinador de acopio.</p>}
        <div className="barra-acciones ancho-completo">
          <button type="submit" className={resultado === "rechazado" ? "boton-peligro" : "boton-primario"} disabled={guardando}>
            Confirmar: {ESTADOS_INGRESO[resultado].texto.toLowerCase()}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function CorreccionIngreso({ ingreso, alGuardar, alCancelar, guardando }) {
  const [datos, setDatos] = useState({ volumen_l: ingreso.volumen_l, temperatura_c: ingreso.temperatura_c, observacion: ingreso.observacion || "", motivo: "" });
  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); alGuardar(datos); }} className="formulario-grilla">
      <fieldset>
        <legend>Corregir datos del ingreso</legend>
        <label>Volumen (L)<input type="number" name="volumen_l" min="1" value={datos.volumen_l} onChange={cambiar} /></label>
        <label>Temperatura (°C)<input type="number" step="0.1" name="temperatura_c" value={datos.temperatura_c} onChange={cambiar} /></label>
        <label className="ancho-completo">Observación<input name="observacion" value={datos.observacion} onChange={cambiar} /></label>
        <label className="ancho-completo">Motivo de la corrección *<input name="motivo" value={datos.motivo} onChange={cambiar} required placeholder="Ej.: error de digitación, la guía indica otro volumen" /></label>
        <div className="barra-acciones ancho-completo">
          <button type="submit" className="boton-primario" disabled={guardando}>Guardar corrección</button>
          <button type="button" onClick={alCancelar}>Cancelar</button>
        </div>
      </fieldset>
    </form>
  );
}

export default function DetalleIngreso() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const permisos = usuario.permisos_recepcion;
  const [ingreso, setIngreso] = useState(null);
  const [catalogos, setCatalogos] = useState(null);
  const [corrigiendo, setCorrigiendo] = useState(null); // "ingreso" | "analisis"
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    obtenerIngreso(id).then(setIngreso).catch((err) => setMensaje(err.message));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { obtenerCatalogos().then(setCatalogos).catch((err) => setMensaje(err.message)); }, []);

  function ejecutar(promesa, textoExito) {
    setMensaje("");
    setAviso("");
    setGuardando(true);
    promesa
      .then(() => { setAviso(textoExito); setCorrigiendo(null); cargar(); })
      .catch((err) => setMensaje(err.message))
      .finally(() => setGuardando(false));
  }

  if (!ingreso || !catalogos) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const dia = ingreso.fecha_hora_llegada.slice(0, 10);
  const estado = ESTADOS_INGRESO[ingreso.estado];
  const pendiente = ["en_analisis", "por_decidir"].includes(ingreso.estado);
  const decidido = !pendiente;
  const rechazado = ingreso.estado === "rechazado";
  const fuera = new Set(ingreso.observaciones.map((o) => o.codigo));
  const valorAnalisis = { temperatura: ingreso.temperatura_c, acidez: ingreso.acidez, densidad: ingreso.densidad, grasa: ingreso.grasa, alcohol: ingreso.alcohol, antibioticos: ingreso.antibioticos };

  const pasos = [
    { titulo: "1. Ingreso", estado: "hecho", detalle: `${fechaHora(ingreso.fecha_hora_llegada)} · ${ingreso.operador}` },
    { titulo: "2. Análisis", estado: ingreso.sugerencia ? "hecho" : "actual", detalle: ingreso.sugerencia ? `${fechaHora(ingreso.fecha_hora_analisis, dia)} · ${ingreso.analista}` : "Esperando al laboratorio" },
    { titulo: "3. Decisión", estado: decidido ? (rechazado ? "rechazo" : "hecho") : ingreso.sugerencia ? "actual" : "espera", detalle: decidido ? `${estado.texto} · ${ingreso.supervisor}` : ingreso.sugerencia ? "Esperando al supervisor de calidad" : "—" },
    { titulo: "4. Descarga", estado: rechazado ? "rechazo" : ingreso.fecha_hora_descarga ? "hecho" : decidido ? "actual" : "espera", detalle: rechazado ? "No se descarga" : ingreso.fecha_hora_descarga ? `${fechaHora(ingreso.fecha_hora_descarga, dia)} · ${ingreso.tanque}` : decidido ? `Pendiente en ${ingreso.tanque}` : "—" }
  ];

  return (
    <div>
      <div className="encabezado-pagina">
        <div>
          <h2>{ingreso.codigo} <span className={`insignia insignia-grande ${estado.clase}`}>{estado.texto}</span></h2>
          <p className="subtitulo">{ingreso.proveedor} · {miles(ingreso.volumen_l)} L · cisterna {ingreso.placa}</p>
        </div>
        <div className="barra-acciones">
          {ingreso.codigo_lote && <Link to={`/recepcion/trazabilidad?codigo=${ingreso.codigo_lote}`}>Trazabilidad del lote</Link>}
          <Link to="/recepcion">Volver a recepción</Link>
        </div>
      </div>
      {mensaje && <p className="error">{mensaje}</p>}
      {aviso && <p className="exito">{aviso}</p>}

      <ol className="pasos">{pasos.map((p) => <Paso key={p.titulo} {...p} />)}</ol>

      <section className="bloque">
        <div className="encabezado-pagina">
          <h3>Datos del ingreso</h3>
          {pendiente && permisos.registrar && corrigiendo !== "ingreso" && <button className="boton-enlace" onClick={() => setCorrigiendo("ingreso")}>Corregir</button>}
        </div>
        <dl className="datos">
          <div className="dato"><dt>Proveedor</dt><dd>{ingreso.codigo_proveedor} · {ingreso.proveedor}</dd></div>
          <div className="dato"><dt>Centro de acopio</dt><dd>{ingreso.centro_acopio || "—"}</dd></div>
          <div className="dato"><dt>Cisterna</dt><dd>{ingreso.placa}{ingreso.transportista ? ` · ${ingreso.transportista}` : ""}</dd></div>
          <div className="dato"><dt>Llegada</dt><dd>{fechaHora(ingreso.fecha_hora_llegada)}</dd></div>
          <div className="dato"><dt>Volumen</dt><dd>{miles(ingreso.volumen_l)} L</dd></div>
          <div className="dato"><dt>Temperatura</dt><dd className={fuera.has("temperatura") ? "fuera-norma" : ""}>{decimal(ingreso.temperatura_c)} °C{fuera.has("temperatura") ? " (fuera de norma)" : ""}</dd></div>
          <div className="dato"><dt>Registró</dt><dd>{ingreso.operador}</dd></div>
          <div className="dato"><dt>Observación</dt><dd>{ingreso.observacion || "—"}</dd></div>
        </dl>
        {corrigiendo === "ingreso" && (
          <CorreccionIngreso ingreso={ingreso} guardando={guardando} alCancelar={() => setCorrigiendo(null)}
            alGuardar={(d) => ejecutar(corregirIngreso(ingreso.id, d), "Corrección guardada en la bitácora")} />
        )}
      </section>

      <section className={`bloque${ingreso.estado === "en_analisis" && permisos.analizar ? " bloque-accion" : ""}`}>
        <div className="encabezado-pagina">
          <h3>Análisis de la muestra {ingreso.codigo_muestra && <small className="ayuda">· {ingreso.codigo_muestra}</small>}</h3>
          {ingreso.estado === "por_decidir" && permisos.analizar && corrigiendo !== "analisis" && <button className="boton-enlace" onClick={() => setCorrigiendo("analisis")}>Corregir</button>}
        </div>
        {ingreso.sugerencia ? (
          <>
            <div className="tabla-contenedor">
              <table>
                <thead><tr><th>Parámetro</th><th>Resultado</th><th>Límite vigente</th><th>Cumple</th></tr></thead>
                <tbody>
                  {catalogos.parametros.map((p) => {
                    const obs = ingreso.observaciones.find((o) => o.codigo === p.codigo);
                    const valor = valorAnalisis[p.codigo];
                    return (
                      <tr key={p.codigo}>
                        <td>{p.nombre}{p.critico ? <span className="insignia insignia-inactivo insignia-chica">crítico</span> : null}</td>
                        <td className={obs ? "fuera-norma" : ""}>{typeof valor === "number" ? decimal(valor) : valor}{p.unidad ? ` ${p.unidad}` : ""}</td>
                        <td>{obs ? obs.limite : p.limite}</td>
                        <td>{obs ? <span className="fuera-norma">No</span> : "Sí"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p>
              Sugerencia del sistema: <span className={`insignia ${SUGERENCIAS[ingreso.sugerencia].clase}`}>{SUGERENCIAS[ingreso.sugerencia].texto}</span>{" "}
              <span className="ayuda">
                {ingreso.sugerencia === "aceptar" && "Todos los parámetros dentro de norma."}
                {ingreso.sugerencia === "derivar" && "Hay parámetros no críticos fuera de norma."}
                {ingreso.sugerencia === "rechazar" && "Hay un parámetro crítico fuera de norma."}
                {" "}Analizó {ingreso.analista} · {fechaHora(ingreso.fecha_hora_analisis, dia)}
              </span>
            </p>
          </>
        ) : (
          !permisos.analizar && <p className="ayuda">Esperando el análisis del laboratorio.</p>
        )}
        {ingreso.estado === "en_analisis" && permisos.analizar && (
          <FormularioAnalisis inicial={CAMPOS_ANALISIS} parametros={catalogos.parametros} guardando={guardando}
            alGuardar={(v) => ejecutar(registrarAnalisis(ingreso.id, v), "Análisis registrado: se avisó al supervisor de calidad")} />
        )}
        {corrigiendo === "analisis" && (
          <FormularioAnalisis
            inicial={{ acidez: ingreso.acidez, densidad: ingreso.densidad, grasa: ingreso.grasa, alcohol: ingreso.alcohol, antibioticos: ingreso.antibioticos, motivo: "" }}
            parametros={catalogos.parametros} conMotivo guardando={guardando} alCancelar={() => setCorrigiendo(null)}
            alGuardar={(v) => ejecutar(corregirAnalisis(ingreso.id, v), "Corrección guardada en la bitácora y sugerencia recalculada")} />
        )}
      </section>

      <section className={`bloque${ingreso.estado === "por_decidir" && permisos.decidir ? " bloque-accion" : ""}`}>
        <h3>Decisión del supervisor de calidad</h3>
        {decidido && (
          <dl className="datos">
            <div className="dato"><dt>Resultado</dt><dd><span className={`insignia ${estado.clase}`}>{estado.texto}</span>{ingreso.coincide_sugerencia ? " · coincide con la sugerencia" : " · se apartó de la sugerencia"}</dd></div>
            <div className="dato"><dt>Lote de recepción</dt><dd>{ingreso.codigo_lote || "— (rechazado, sin lote)"}</dd></div>
            <div className="dato"><dt>Tanque</dt><dd>{ingreso.tanque || "—"}</dd></div>
            <div className="dato"><dt>Decidió</dt><dd>{ingreso.supervisor} · {fechaHora(ingreso.fecha_hora_decision, dia)}</dd></div>
            <div className="dato"><dt>Motivo</dt><dd>{ingreso.motivo || "—"}</dd></div>
          </dl>
        )}
        {ingreso.estado === "en_analisis" && <p className="ayuda">Se decide después del análisis.</p>}
        {ingreso.estado === "por_decidir" && !permisos.decidir && <p className="ayuda">Esperando la decisión del supervisor de calidad.</p>}
        {ingreso.estado === "por_decidir" && permisos.decidir && (
          <FormularioDecision ingreso={ingreso} tanques={catalogos.tanques} guardando={guardando}
            alGuardar={(d) => ejecutar(registrarDecision(ingreso.id, d), "Decisión registrada: se avisó al operador")} />
        )}
      </section>

      {!rechazado && decidido && (
        <section className={`bloque${!ingreso.fecha_hora_descarga && permisos.registrar ? " bloque-accion" : ""}`}>
          <h3>Descarga a tanque</h3>
          {ingreso.fecha_hora_descarga ? (
            <p>Descargado en {ingreso.tanque} · {fechaHora(ingreso.fecha_hora_descarga, dia)} · {ingreso.operador_descarga}</p>
          ) : permisos.registrar ? (
            <button className="boton-primario" disabled={guardando} onClick={() => ejecutar(registrarDescarga(ingreso.id), "Descarga registrada")}>
              Registrar descarga en {ingreso.tanque} (lote {ingreso.codigo_lote})
            </button>
          ) : (
            <p className="ayuda">Pendiente: el operador de recepción debe descargar en {ingreso.tanque}.</p>
          )}
        </section>
      )}

      {ingreso.bitacora.length > 0 && (
        <section className="bloque">
          <h3>Bitácora de correcciones</h3>
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Fecha</th><th>Campo</th><th>Antes</th><th>Después</th><th>Motivo</th><th>Usuario</th></tr></thead>
              <tbody>
                {ingreso.bitacora.map((b) => (
                  <tr key={b.id}>
                    <td>{fechaHora(b.fecha)}</td><td>{CAMPOS_LEGIBLES[b.campo] || b.campo}</td>
                    <td>{decimal(b.valor_anterior)}</td><td>{decimal(b.valor_nuevo)}</td><td>{b.motivo}</td><td>{b.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
