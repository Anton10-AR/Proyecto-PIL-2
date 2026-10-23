// Inicio: lo pendiente para el puesto del usuario en el proceso (muestras por analizar, decisiones,
// descargas, lotes por recibir, pedidos por despachar) y, para quien supervisa, la cobertura del día.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../contexto/useAuth";
import { menuDelUsuario } from "../navegacion";
import { NOMBRES_ROL } from "../roles";
import { listarIngresos } from "../api/recepcion";
import { listarLotes } from "../api/almacen";
import { listarPedidos } from "../api/pedidos";
import { obtenerCobertura } from "../api/proceso";
import { ESTADOS_COBERTURA } from "../formato";

function Pendiente({ cantidad, texto, enlace }) {
  return (
    <Link to={enlace} className="tarjeta tarjeta-enlace tarjeta-indicador">
      <span className="tarjeta-valor">{cantidad}</span>
      <span className="tarjeta-etiqueta">{texto}</span>
    </Link>
  );
}

export default function Inicio() {
  const { usuario } = useAuth();
  const permisos = usuario.permisos_recepcion || {};
  const permisosAlmacen = usuario.permisos_almacen || {};
  const [pendientes, setPendientes] = useState(null);
  const [almacen, setAlmacen] = useState(null);
  const [cobertura, setCobertura] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (!permisos.consultar) return;
    Promise.all([listarIngresos({ estado: "pendientes" }), listarIngresos({})])
      .then(([abiertos, recientes]) => setPendientes({
        analisis: abiertos.filter((i) => i.estado === "en_analisis").length,
        decision: abiertos.filter((i) => i.estado === "por_decidir").length,
        descarga: recientes.filter((i) => ["aceptado", "derivado"].includes(i.estado) && !i.fecha_hora_descarga).length
      }))
      .catch((err) => setMensaje(err.message));
  }, [permisos.consultar]);

  useEffect(() => {
    if (!permisosAlmacen.consultar) return;
    Promise.all([listarLotes({ estado: "registrado" }), listarPedidos({ estado: "pendiente" })])
      .then(([lotes, pedidos]) => setAlmacen({
        lotes: lotes.length,
        pedidos: pedidos.length,
        atrasados: pedidos.filter((p) => p.atrasado).length
      }))
      .catch((err) => setMensaje(err.message));
  }, [permisosAlmacen.consultar]);

  useEffect(() => {
    if (!usuario.ve_proceso) return;
    obtenerCobertura().then(setCobertura).catch((err) => setMensaje(err.message));
  }, [usuario.ve_proceso]);

  const alertas = cobertura?.puestos.filter((p) => ["descubierto", "en_riesgo"].includes(p.estado)) || [];
  const tarjetasPendientes = pendientes ? [
    permisos.analizar && { cantidad: pendientes.analisis, texto: "Muestras por analizar", enlace: "/recepcion" },
    permisos.decidir && { cantidad: pendientes.decision, texto: "Ingresos esperando su decisión", enlace: "/recepcion" },
    permisos.registrar && { cantidad: pendientes.descarga, texto: "Descargas a tanque por registrar", enlace: "/recepcion" },
    !permisos.analizar && !permisos.decidir && { cantidad: pendientes.analisis + pendientes.decision, texto: "Ingresos de leche en curso", enlace: "/recepcion" }
  ].filter(Boolean) : [];
  const tarjetasAlmacen = almacen ? [
    permisosAlmacen.recibir ? { cantidad: almacen.lotes, texto: "Lotes por recibir en almacén", enlace: "/almacen/lotes" }
      : { cantidad: almacen.lotes, texto: "Lotes envasados esperando al almacén", enlace: "/almacen/lotes" },
    { cantidad: almacen.pedidos, texto: permisosAlmacen.despachar ? "Pedidos por despachar" : "Pedidos pendientes", enlace: "/pedidos" },
    almacen.atrasados > 0 && { cantidad: almacen.atrasados, texto: "Pedidos con la entrega atrasada", enlace: "/pedidos" }
  ].filter(Boolean) : [];

  return (
    <div>
      <h2>Bienvenido, {usuario.nombre}</h2>
      <p className="subtitulo">
        {usuario.cargo || "Sin cargo"} · {usuario.area || "Sin área"} ·{" "}
        {usuario.nombre_puesto ? `Puesto en el proceso: ${usuario.nombre_puesto}` : `Rol: ${NOMBRES_ROL[usuario.rol]}`}
      </p>
      {mensaje && <p className="error">{mensaje}</p>}

      {tarjetasPendientes.length > 0 && (
        <section>
          <h3>Recepción de leche</h3>
          <div className="tarjetas tarjetas-indicadores">
            {tarjetasPendientes.map((t) => <Pendiente key={t.texto} {...t} />)}
          </div>
        </section>
      )}

      {tarjetasAlmacen.length > 0 && (
        <section>
          <h3>Almacén y despacho</h3>
          <div className="tarjetas tarjetas-indicadores">
            {tarjetasAlmacen.map((t) => <Pendiente key={t.texto} {...t} />)}
          </div>
        </section>
      )}

      {cobertura && (
        <section>
          <div className="encabezado-pagina">
            <h3>Cobertura de puestos críticos hoy</h3>
            <Link to="/proceso">Ver panel del proceso</Link>
          </div>
          {!cobertura.opera && <p className="ayuda">Hoy la planta no opera.</p>}
          {cobertura.opera && alertas.length === 0 && (
            <p className="exito">Todos los puestos críticos tienen la cobertura mínima o están por confirmar.</p>
          )}
          {alertas.map((p) => (
            <p key={p.id} className={p.estado === "descubierto" ? "error" : "aviso"}>
              <span className={`insignia ${ESTADOS_COBERTURA[p.estado].clase}`}>{ESTADOS_COBERTURA[p.estado].texto}</span>{" "}
              Etapa {p.id_etapa} ({p.etapa}): {p.puesto}. Se requiere {p.cobertura_minima} y hay {p.presentes} presente(s).
            </p>
          ))}
        </section>
      )}

      <section>
        <h3>Accesos</h3>
        <div className="tarjetas">
          {menuDelUsuario(usuario).map((item) => (
            <Link key={item.ruta} to={item.ruta} className="tarjeta tarjeta-enlace">
              <span className="tarjeta-titulo">{item.etiqueta}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
