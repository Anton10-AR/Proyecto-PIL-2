// Apariencia y accesibilidad: se guardan en este navegador y se aplican al instante
import { usePreferencias } from "../contexto/usePreferencias";

const TEMAS = [["claro", "Claro"], ["oscuro", "Oscuro"], ["sistema", "Según el equipo"]];
const TAMANOS = [["normal", "Normal"], ["grande", "Grande"], ["muy-grande", "Muy grande"]];
const INTERRUPTORES = [
  ["contraste", "Alto contraste", "Textos en negro (o blanco) puro y bordes más gruesos."],
  ["subrayar", "Subrayar enlaces", "Para no depender solo del color al reconocer un enlace."],
  ["reducirMovimiento", "Reducir animaciones", "Quita transiciones y desplazamientos. Se activa sola si el equipo lo pide."]
];

function Opciones({ titulo, opciones, valor, alElegir }) {
  return (
    <fieldset className="grupo-preferencia">
      <legend>{titulo}</legend>
      <div className="segmentado">
        {opciones.map(([clave, texto]) => (
          <button key={clave} type="button" className={valor === clave ? "activo" : ""}
            aria-pressed={valor === clave} onClick={() => alElegir(clave)}>
            {texto}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function Preferencias() {
  const { preferencias, cambiarPreferencia, restablecer } = usePreferencias();

  return (
    <div className="pagina-angosta pagina-preferencias">
      <h2>Apariencia y accesibilidad</h2>
      <p className="subtitulo">Los cambios se aplican al instante y se recuerdan en este navegador.</p>

      <Opciones titulo="Tema" opciones={TEMAS} valor={preferencias.tema}
        alElegir={(v) => cambiarPreferencia("tema", v)} />
      <Opciones titulo="Tamaño del texto" opciones={TAMANOS} valor={preferencias.texto}
        alElegir={(v) => cambiarPreferencia("texto", v)} />

      {INTERRUPTORES.map(([clave, texto, ayuda]) => (
        <div key={clave} className="fila-interruptor">
          <div>
            <strong id={`etiqueta-${clave}`}>{texto}</strong>
            <small className="ayuda">{ayuda}</small>
          </div>
          <button type="button" role="switch" className="interruptor" aria-labelledby={`etiqueta-${clave}`}
            aria-checked={preferencias[clave]} onClick={() => cambiarPreferencia(clave, !preferencias[clave])}>
            <span />
          </button>
        </div>
      ))}

      <div className="barra-acciones">
        <button type="button" onClick={restablecer}>Restablecer valores</button>
      </div>
    </div>
  );
}
