// Rutas de la app. Cada entrada indica quién puede verla y en qué grupo del menú aparece;
// las que tienen enMenu: false son subpáginas (no aparecen en el menú lateral).
// - roles: módulos de RRHH (soporte organizacional), según el rol del sistema.
// - acceso(usuario): módulos del proceso productivo (recepción, almacén y despacho), según el puesto que la
//   persona ocupa en el proceso (permisos que calcula el backend en /auth/yo).
import { lazy } from "react";
import ListaPersonal from "./components/personal/ListaPersonal";
import FichaTrabajador from "./components/personal/FichaTrabajador";
import FormularioTrabajador from "./components/personal/FormularioTrabajador";
import MiAsistencia from "./components/asistencia/MiAsistencia";
import AsistenciaPersonal from "./components/asistencia/AsistenciaPersonal";
import Ausencias from "./components/asistencia/Ausencias";
import Turnos from "./components/turnos/Turnos";
import Configuracion from "./components/configuracion/Configuracion";
import MisSolicitudes from "./components/solicitudes/MisSolicitudes";
import BandejaSolicitudes from "./components/solicitudes/BandejaSolicitudes";
import Calendario from "./components/solicitudes/Calendario";
import ListaCapacitaciones from "./components/capacitaciones/ListaCapacitaciones";
import DetalleCapacitacion from "./components/capacitaciones/DetalleCapacitacion";
import FormularioCapacitacion from "./components/capacitaciones/FormularioCapacitacion";
// Evaluación del desempeño y Clima/Comunicación quedan para versiones futuras (documento, sección 4.4):
// su código sigue en components/evaluaciones y components/comunicacion, pero no tienen rutas.
import PanelProceso from "./components/proceso/PanelProceso";
import EstructuraProceso from "./components/proceso/EstructuraProceso";
import BandejaRecepcion from "./components/recepcion/BandejaRecepcion";
import FormularioIngreso from "./components/recepcion/FormularioIngreso";
import DetalleIngreso from "./components/recepcion/DetalleIngreso";
import Trazabilidad from "./components/recepcion/Trazabilidad";
import Catalogos from "./components/recepcion/Catalogos";
import Inventario from "./components/almacen/Inventario";
import LotesProducto from "./components/almacen/LotesProducto";
import FormularioLote from "./components/almacen/FormularioLote";
import DetalleLote from "./components/almacen/DetalleLote";
import CatalogosAlmacen from "./components/almacen/CatalogosAlmacen";
import IndicadoresAlmacen from "./components/almacen/IndicadoresAlmacen";
import ListaPedidos from "./components/pedidos/ListaPedidos";
import FormularioPedido from "./components/pedidos/FormularioPedido";
import DetallePedido from "./components/pedidos/DetallePedido";
// Reportes e indicadores de calidad usan recharts (pesado): se cargan recién cuando se abre la página
const Reportes = lazy(() => import("./components/reportes/Reportes"));
const IndicadoresCalidad = lazy(() => import("./components/recepcion/IndicadoresCalidad"));
import { ROLES } from "./roles";

// Roles que consultan información de otros trabajadores (su equipo o toda la empresa)
const CON_EQUIPO = ["supervisor", "rrhh", "gerencia"];

const CONSULTA_RECEPCION = (u) => u.permisos_recepcion?.consultar;
const REGISTRA_INGRESOS = (u) => u.permisos_recepcion?.registrar;
const VE_PROCESO = (u) => u.ve_proceso;
const PROCESO = "Proceso productivo";
const CONSULTA_ALMACEN = (u) => u.permisos_almacen?.consultar;
const ENVASA = (u) => u.permisos_almacen?.envasar;
const PIDE = (u) => u.permisos_almacen?.pedir;
const ALMACEN = "Almacén y despacho";
// La trazabilidad sirve a los dos módulos: recepción rastrea desde la leche (LR-, ING-) y almacén desde el producto (LP-)
const CONSULTA_TRAZABILIDAD = (u) => CONSULTA_RECEPCION(u) || CONSULTA_ALMACEN(u);

export const MENU = [
  { ruta: "/proceso", grupo: PROCESO, etiqueta: "Panel del proceso", acceso: VE_PROCESO, componente: PanelProceso },
  { ruta: "/recepcion", grupo: PROCESO, etiqueta: "Recepción de leche", acceso: CONSULTA_RECEPCION, componente: BandejaRecepcion },
  { ruta: "/recepcion/nuevo", acceso: REGISTRA_INGRESOS, componente: FormularioIngreso, enMenu: false },
  { ruta: "/recepcion/ingresos/:id", acceso: CONSULTA_RECEPCION, componente: DetalleIngreso, enMenu: false },
  { ruta: "/recepcion/trazabilidad", grupo: PROCESO, etiqueta: "Trazabilidad de lotes", acceso: CONSULTA_TRAZABILIDAD, componente: Trazabilidad },
  { ruta: "/recepcion/indicadores", grupo: PROCESO, etiqueta: "Indicadores de calidad", acceso: CONSULTA_RECEPCION, componente: IndicadoresCalidad },
  { ruta: "/recepcion/catalogos", grupo: PROCESO, etiqueta: "Parámetros y proveedores", acceso: CONSULTA_RECEPCION, componente: Catalogos },
  { ruta: "/proceso/estructura", grupo: PROCESO, etiqueta: "Etapas y puestos", roles: ROLES, componente: EstructuraProceso },
  { ruta: "/almacen", grupo: ALMACEN, etiqueta: "Inventario", acceso: CONSULTA_ALMACEN, componente: Inventario },
  { ruta: "/almacen/lotes", grupo: ALMACEN, etiqueta: "Lotes de producto terminado", acceso: CONSULTA_ALMACEN, componente: LotesProducto },
  { ruta: "/almacen/lotes/nuevo", acceso: ENVASA, componente: FormularioLote, enMenu: false },
  { ruta: "/almacen/lotes/:id", acceso: CONSULTA_ALMACEN, componente: DetalleLote, enMenu: false },
  { ruta: "/pedidos", grupo: ALMACEN, etiqueta: "Pedidos y despacho", acceso: CONSULTA_ALMACEN, componente: ListaPedidos },
  { ruta: "/pedidos/nuevo", acceso: PIDE, componente: FormularioPedido, enMenu: false },
  { ruta: "/pedidos/:id", acceso: CONSULTA_ALMACEN, componente: DetallePedido, enMenu: false },
  { ruta: "/almacen/indicadores", grupo: ALMACEN, etiqueta: "Indicadores de despacho", acceso: CONSULTA_ALMACEN, componente: IndicadoresAlmacen },
  { ruta: "/almacen/catalogos", grupo: ALMACEN, etiqueta: "Productos y clientes", acceso: CONSULTA_ALMACEN, componente: CatalogosAlmacen },
  { ruta: "/personal", grupo: "Personal", etiqueta: "Personal", roles: ROLES, componente: ListaPersonal },
  { ruta: "/personal/nuevo", roles: ["rrhh"], componente: FormularioTrabajador, enMenu: false },
  { ruta: "/personal/:id", roles: ROLES, componente: FichaTrabajador, enMenu: false },
  { ruta: "/personal/:id/editar", roles: ["rrhh"], componente: FormularioTrabajador, enMenu: false },
  { ruta: "/asistencia", grupo: "Asistencia", etiqueta: "Mi asistencia", roles: ROLES, componente: MiAsistencia },
  { ruta: "/asistencia/personal", grupo: "Asistencia", etiqueta: "Asistencia del personal", roles: CON_EQUIPO, componente: AsistenciaPersonal },
  { ruta: "/asistencia/ausencias", grupo: "Asistencia", etiqueta: "Ausencias", roles: CON_EQUIPO, componente: Ausencias },
  { ruta: "/turnos", grupo: "Asistencia", etiqueta: "Turnos", roles: CON_EQUIPO, componente: Turnos },
  { ruta: "/solicitudes", grupo: "Permisos y vacaciones", etiqueta: "Mis solicitudes", roles: ROLES, componente: MisSolicitudes },
  { ruta: "/solicitudes/bandeja", grupo: "Permisos y vacaciones", etiqueta: "Aprobación de solicitudes", roles: CON_EQUIPO, componente: BandejaSolicitudes },
  { ruta: "/calendario", grupo: "Permisos y vacaciones", etiqueta: "Calendario", roles: ROLES, componente: Calendario },
  { ruta: "/capacitaciones", grupo: "Capacitación", etiqueta: "Capacitaciones", roles: ROLES, componente: ListaCapacitaciones },
  { ruta: "/capacitaciones/nueva", roles: ["rrhh"], componente: FormularioCapacitacion, enMenu: false },
  { ruta: "/capacitaciones/:id", roles: ROLES, componente: DetalleCapacitacion, enMenu: false },
  { ruta: "/capacitaciones/:id/editar", roles: ["rrhh"], componente: FormularioCapacitacion, enMenu: false },
  // Cada rol ve sus indicadores con su alcance (empresa, equipo o propios)
  { ruta: "/reportes", grupo: "Administración", etiqueta: "Indicadores de personal", roles: ROLES, componente: Reportes },
  { ruta: "/configuracion", grupo: "Administración", etiqueta: "Configuración", roles: ["rrhh", "gerencia"], componente: Configuracion }
];

// ¿Puede el usuario abrir esta entrada? (por puesto en el proceso o por rol)
export function puedeVer(item, usuario) {
  if (item.acceso) return Boolean(item.acceso(usuario));
  return item.roles.includes(usuario.rol);
}

export function menuDelUsuario(usuario) {
  return MENU.filter((item) => item.enMenu !== false && puedeVer(item, usuario));
}

// Entradas del menú del usuario agrupadas, en el orden en que aparecen: [{ grupo, items }]
export function menuAgrupado(usuario) {
  const grupos = [];
  menuDelUsuario(usuario).forEach((item) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.grupo === item.grupo) ultimo.items.push(item);
    else grupos.push({ grupo: item.grupo, items: [item] });
  });
  return grupos;
}
