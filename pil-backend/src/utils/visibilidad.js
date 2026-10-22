// Qué trabajadores puede ver cada rol (matriz de permisos del plan):
// - rrhh y gerencia: todos
// - supervisor: él mismo y su equipo directo (id_supervisor = él)
// - trabajador: solo él mismo
const db = require("../db/database");

function veTodos(usuario) {
  return usuario.rol === "rrhh" || usuario.rol === "gerencia";
}

// Devuelve null si el usuario ve a todos, o el array de ids visibles
function idsVisibles(usuario) {
  if (veTodos(usuario)) return null;

  const ids = [usuario.id_trabajador];
  if (usuario.rol === "supervisor") {
    db.prepare("SELECT id FROM trabajadores WHERE id_supervisor = ?")
      .all(usuario.id_trabajador)
      .forEach((fila) => ids.push(fila.id));
  }
  return ids;
}

function puedeVerTrabajador(usuario, idTrabajador) {
  const ids = idsVisibles(usuario);
  return ids === null || ids.includes(Number(idTrabajador));
}

// Fragmento SQL para filtrar por los trabajadores visibles.
// Uso: const { sql, params } = filtroVisibilidad(req.usuario, "a.id_trabajador");
function filtroVisibilidad(usuario, columna) {
  const ids = idsVisibles(usuario);
  if (ids === null) return { sql: "", params: [] };
  return { sql: ` AND ${columna} IN (${ids.map(() => "?").join(",")})`, params: ids };
}

module.exports = { veTodos, idsVisibles, puedeVerTrabajador, filtroVisibilidad };
