import { Navigate, Route, Routes } from "react-router";
import RutaProtegida from "./components/RutaProtegida";
import Layout from "./components/Layout";
import Login from "./paginas/Login";
import Inicio from "./paginas/Inicio";
import CambiarClave from "./paginas/CambiarClave";
import Preferencias from "./paginas/Preferencias";
import { MENU } from "./navegacion";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RutaProtegida><Layout /></RutaProtegida>}>
        <Route index element={<Inicio />} />
        <Route path="/cambiar-clave" element={<CambiarClave />} />
        <Route path="/preferencias" element={<Preferencias />} />
        {MENU.map(({ ruta, roles, acceso, componente: Componente }) => (
          <Route key={ruta} path={ruta} element={<RutaProtegida roles={roles} acceso={acceso}><Componente /></RutaProtegida>} />
        ))}
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
