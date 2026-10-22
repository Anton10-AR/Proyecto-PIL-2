// Registro de un ingreso de leche (operador de recepción): proveedor, cisterna, volumen y temperatura.
// La temperatura se compara de inmediato con el parámetro vigente para avisar al operador.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { obtenerCatalogos, registrarIngreso } from "../../api/recepcion";
import { decimal, miles } from "../../formato";

const VACIO = { id_proveedor: "", id_cisterna: "", volumen_l: "", temperatura_c: "", hora_llegada: "", observacion: "" };

export default function FormularioIngreso() {
  const navegar = useNavigate();
  const [catalogos, setCatalogos] = useState(null);
  const [formulario, setFormulario] = useState(VACIO);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerCatalogos().then(setCatalogos).catch((err) => setMensaje(err.message));
  }, []);

  if (!catalogos) return mensaje ? <p className="error">{mensaje}</p> : <p className="cargando">Cargando...</p>;

  const cisterna = catalogos.cisternas.find((c) => String(c.id) === formulario.id_cisterna);
  const parametroTemperatura = catalogos.parametros.find((p) => p.codigo === "temperatura");
  const temperaturaAlta = parametroTemperatura?.maximo !== null && formulario.temperatura_c !== ""
    && Number(formulario.temperatura_c) > parametroTemperatura.maximo;

  const cambiar = (e) => setFormulario({ ...formulario, [e.target.name]: e.target.value });

  function enviar(e) {
    e.preventDefault();
    setMensaje("");
    setGuardando(true);
    registrarIngreso(formulario)
      .then((ingreso) => navegar(`/recepcion/ingresos/${ingreso.id}`))
      .catch((err) => setMensaje(err.message))
      .finally(() => setGuardando(false));
  }

  return (
    <div className="pagina-angosta">
      <div className="encabezado-pagina">
        <h2>Registrar ingreso de leche</h2>
        <Link to="/recepcion">Volver</Link>
      </div>
      <p className="ayuda">Paso 1 de 4. Al guardar, el sistema avisa al laboratorio que hay una muestra por analizar.</p>
      {mensaje && <p className="error">{mensaje}</p>}

      <form onSubmit={enviar} className="formulario-grilla">
        <fieldset>
          <legend>Origen</legend>
          <label>Proveedor *
            <select name="id_proveedor" value={formulario.id_proveedor} onChange={cambiar} required>
              <option value="">— Seleccione —</option>
              {catalogos.proveedores.filter((p) => p.activo).map((p) => (
                <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
              ))}
            </select>
          </label>
          <label>Cisterna *
            <select name="id_cisterna" value={formulario.id_cisterna} onChange={cambiar} required>
              <option value="">— Seleccione —</option>
              {catalogos.cisternas.filter((c) => c.activo).map((c) => (
                <option key={c.id} value={c.id}>{c.placa} · {miles(c.capacidad_l)} L{c.transportista ? ` · ${c.transportista}` : ""}</option>
              ))}
            </select>
          </label>
          <label>Hora de llegada
            <input type="time" name="hora_llegada" value={formulario.hora_llegada} onChange={cambiar} />
            <small className="ayuda">Vacío = ahora</small>
          </label>
        </fieldset>

        <fieldset>
          <legend>Medición</legend>
          <label>Volumen (L) *
            <input type="number" name="volumen_l" min="1" step="1" max={cisterna?.capacidad_l} value={formulario.volumen_l} onChange={cambiar} required />
            {cisterna && <small className="ayuda">Capacidad de la cisterna: {miles(cisterna.capacidad_l)} L</small>}
          </label>
          <label>Temperatura (°C) *
            <input type="number" name="temperatura_c" step="0.1" min="-5" max="50" value={formulario.temperatura_c} onChange={cambiar} required />
            {parametroTemperatura && <small className="ayuda">Límite vigente: {parametroTemperatura.limite}</small>}
          </label>
          {temperaturaAlta && (
            <p className="aviso ancho-completo">
              La temperatura supera el límite de {decimal(parametroTemperatura.maximo)} °C. Regístrela igual: el laboratorio
              completará el análisis y el supervisor de calidad decidirá.
            </p>
          )}
          <label className="ancho-completo">Observación
            <input name="observacion" value={formulario.observacion} onChange={cambiar} placeholder="Ej.: cisterna demorada por desvío en la ruta" />
          </label>
        </fieldset>

        <div className="barra-acciones">
          <button type="submit" className="boton-primario" disabled={guardando}>Registrar ingreso</button>
          <Link to="/recepcion">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
