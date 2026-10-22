# Sistema de RR.HH. PIL Andina — Frontend

SPA con **React 19 + Vite + React Router**. Gráficos con **recharts**.

## Requisitos

- Node.js 22.5 o superior.
- El backend corriendo en `http://localhost:3000`. La URL está fija en `src/api/cliente.js`.

## Comandos

```bash
npm install
npm run dev       # servidor de desarrollo en http://localhost:5173
npm run build     # build de producción en dist/
npm run preview   # sirve el build
npm run lint      # oxlint
```

## Estructura

```
src/
├── main.jsx              # BrowserRouter + PreferenciasProvider + AuthProvider + fuente
├── App.jsx               # rutas generadas a partir de MENU
├── navegacion.js         # MENU: ruta, grupo, etiqueta, roles y componente de cada pantalla
├── roles.js · formato.js # nombres de roles; formato de fechas, estados y etiquetas
├── preferencias.js       # tema, tamaño de texto y accesibilidad (localStorage → data-* en <html>)
├── index.css             # variables de color: tema claro, oscuro y alto contraste
├── api/                  # un archivo por módulo; todos usan peticion() de cliente.js
├── contexto/             # sesión (AuthProvider + useAuth) y preferencias (PreferenciasProvider + usePreferencias)
├── paginas/              # Login, Inicio, CambiarClave, Preferencias
└── components/
    ├── Layout.jsx, Campana.jsx, RutaProtegida.jsx
    ├── personal/  asistencia/  turnos/  solicitudes/  capacitaciones/
    └── evaluaciones/  comunicacion/  reportes/  configuracion/
```

## Convenciones

- **Pantallas nuevas:** se agregan como una entrada en `MENU` (`navegacion.js`), con los roles que pueden verla. Las subpáginas llevan `enMenu: false`.
- **Permisos:** el menú y las rutas se filtran por rol en el frontend, pero la autorización real la aplica siempre el backend. Los botones de acción dependen de las banderas que envía la API (`puede_editar`, `puede_decidir`, etc.).
- **Sesión:** el token se guarda en `localStorage`. Si la API responde 401, la sesión se cierra y la app vuelve al login.
- **Archivos protegidos:** se abren con `abrirArchivo()` o se bajan con `descargarArchivo()` de `cliente.js`, porque un enlace directo no envía el token.
- **Código diferido:** la página de Reportes, que incluye recharts, se carga con `React.lazy`.
- **Colores:** `App.css` no usa colores fijos, solo las variables de `index.css` (`--superficie`, `--texto`, `--primario`, `--ok-fondo`, etc.). Un color nuevo se define ahí para los tres temas. Los gráficos de recharts no aceptan variables CSS: toman su juego de colores según el tema resuelto (`usePreferencias().tema`).
- **Identidad visual:** paleta "Leche y cielo" (cabecera `#12355b`, primario `#1f6fb2`, acento `#c2410c`, fondo `#f7f5f0`), tipografía Atkinson Hyperlegible (`@fontsource`, sin CDN) y el logo de PIL en `public/logo-pil.png` (recortado y con fondo transparente), que también da origen a los favicons.
- **Apariencia y accesibilidad** (`/preferencias`, en "Mi cuenta"): tema claro, oscuro o según el equipo (predeterminado), tamaño de texto, alto contraste, subrayar enlaces y reducir animaciones. Se guardan por navegador; `index.html` las aplica antes de pintar para evitar el parpadeo.
- **Menú lateral:** grupos plegables; el grupo de la página actual se abre solo, y los grupos abiertos y el menú contraído se recuerdan en `localStorage` (`pil-menu`).
- **Idioma:** todo el código y los textos están en español.
