// Estructura de la app con sesión: cabecera, menú lateral según el rol y el puesto, y contenido
import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "../contexto/useAuth";
import { menuAgrupado, MENU } from "../navegacion";
import { NOMBRES_ROL } from "../roles";
import Campana from "./Campana";

const GRUPO_CUENTA = "Mi cuenta";
const CUENTA = [
  { ruta: "/preferencias", etiqueta: "Apariencia y accesibilidad" },
  { ruta: "/cambiar-clave", etiqueta: "Cambiar contraseña" }
];
const CLAVE_MENU = "pil-menu";

function tieneSubrutasEnMenu(ruta) {
  return MENU.some((item) => item.enMenu !== false && item.ruta.startsWith(`${ruta}/`));
}

// La ruta actual pertenece a la entrada si es la misma o una subpágina suya (ej. /personal/5 → Personal)
function contieneRuta(item, pathname) {
  return pathname === item.ruta || pathname.startsWith(`${item.ruta}/`);
}

// Grupos abiertos y menú contraído se recuerdan en este navegador
function leerEstadoMenu() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_MENU));
    return { abiertos: guardado?.abiertos || [], contraido: Boolean(guardado?.contraido) };
  } catch {
    return { abiertos: [], contraido: false };
  }
}

function conGrupoAbierto(estado, grupo) {
  if (!grupo || estado.abiertos.includes(grupo)) return estado;
  return { ...estado, abiertos: [...estado.abiertos, grupo] };
}

export default function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  // Mientras deba cambiar la contraseña inicial, solo se muestra ese formulario
  const restringido = usuario.debe_cambiar_clave;
  const grupos = [...menuAgrupado(usuario), { grupo: GRUPO_CUENTA, items: CUENTA }];
  const grupoActivo = grupos.find(({ items }) => items.some((item) => contieneRuta(item, pathname)))?.grupo;
  const [estadoMenu, setEstadoMenu] = useState(() => conGrupoAbierto(leerEstadoMenu(), grupoActivo));
  const [grupoAnterior, setGrupoAnterior] = useState(grupoActivo);

  // El grupo de la página actual se abre solo (al navegar desde Inicio, una notificación, etc.)
  if (grupoActivo !== grupoAnterior) {
    setGrupoAnterior(grupoActivo);
    setEstadoMenu((e) => conGrupoAbierto(e, grupoActivo));
  }

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_MENU, JSON.stringify(estadoMenu));
    } catch {
      // Sin almacenamiento: el menú vuelve a su estado inicial en la próxima visita
    }
  }, [estadoMenu]);

  function alternarGrupo(grupo) {
    setEstadoMenu((e) => ({
      ...e,
      abiertos: e.abiertos.includes(grupo) ? e.abiertos.filter((g) => g !== grupo) : [...e.abiertos, grupo]
    }));
  }

  function alternarMenu() {
    setEstadoMenu((e) => ({ ...e, contraido: !e.contraido }));
  }

  function salir() {
    cerrarSesion().then(() => navegar("/login", { replace: true }));
  }

  const clasesLayout = ["layout", !restringido && estadoMenu.contraido ? "layout-menu-contraido" : ""].join(" ").trim();

  return (
    <div className={clasesLayout}>
      <header className="barra-superior">
        <div className="marca">
          <img src="/logo-pil.png" alt="" className="marca-logo" />
          <h1>PIL Andina — Proceso y personal</h1>
        </div>
        <div className="barra-usuario">
          {!restringido && <Campana />}
          <div className="usuario-datos">
            <span>{usuario.nombre} {usuario.apellido}</span>
            <small>{usuario.nombre_puesto || NOMBRES_ROL[usuario.rol]}</small>
          </div>
          <button onClick={salir}>Cerrar sesión</button>
        </div>
      </header>

      {!restringido && estadoMenu.contraido && (
        <nav className="menu-lateral menu-lateral-contraido" aria-label="Menú principal">
          <button type="button" className="menu-alternar" onClick={alternarMenu} aria-expanded="false" title="Mostrar menú">
            <span aria-hidden="true">»</span>
            <span className="solo-lectores">Mostrar menú</span>
          </button>
        </nav>
      )}

      {!restringido && !estadoMenu.contraido && (
        <nav className="menu-lateral" aria-label="Menú principal">
          <NavLink to="/" end>Inicio</NavLink>
          {grupos.map(({ grupo, items }) => {
            const abierto = estadoMenu.abiertos.includes(grupo);
            const idLista = `menu-${grupo.toLowerCase().replace(/\s+/g, "-")}`;
            return (
              <div key={grupo} className={grupo === grupoActivo ? "menu-grupo menu-grupo-activo" : "menu-grupo"}>
                <button type="button" className="menu-grupo-boton" aria-expanded={abierto} aria-controls={idLista}
                  onClick={() => alternarGrupo(grupo)}>
                  {grupo}
                  <span className="menu-grupo-flecha" aria-hidden="true">›</span>
                </button>
                {abierto && (
                  <div id={idLista} className="menu-grupo-items">
                    {items.map((item) => (
                      // "end" solo donde otra entrada del menú cuelga de esta ruta (ej. /asistencia y /asistencia/personal)
                      <NavLink key={item.ruta} to={item.ruta} end={tieneSubrutasEnMenu(item.ruta)}>{item.etiqueta}</NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" className="menu-alternar menu-contraer" onClick={alternarMenu} aria-expanded="true">
            « Contraer menú
          </button>
        </nav>
      )}

      <main className={restringido ? "contenido contenido-completo" : "contenido"}>
        <Suspense fallback={<p className="cargando">Cargando...</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
