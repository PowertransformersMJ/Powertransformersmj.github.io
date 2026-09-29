// «Diagrama Operativo» (`99 §118`): Carlos Martelo y Jorge Rhenals (técnicos) lo adjuntan y
// reemplazan con un permiso PUNTUAL que da el administrador; quitarlo sigue siendo del admin.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PERMISO_ADJUNTAR_OPERATIVO, puedeAdjuntarOperativo, puedeQuitarOperativo, conPermisoOperativo } from '../assets/js/domain/permiso_operativo.js';
import { PERMISOS, tienePermiso } from '../assets/js/domain/rbac.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const leer = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');

describe('quién adjunta, reemplaza y quita', () => {
  test('el admin todo; el técnico con el permiso adjunta pero no quita; sin permiso, nada', () => {
    const admin = { rol: 'admin', activo: true };
    const conPermiso = { rol: 'tecnico', activo: true, permisos_extra: [PERMISO_ADJUNTAR_OPERATIVO] };
    const sin = { rol: 'tecnico', activo: true, permisos_extra: ['inventario.editar'] };
    assert.equal(puedeAdjuntarOperativo(admin), true); assert.equal(puedeQuitarOperativo(admin), true);
    assert.equal(puedeAdjuntarOperativo(conPermiso), true); assert.equal(puedeQuitarOperativo(conPermiso), false);
    assert.equal(puedeAdjuntarOperativo(sin), false);
    assert.equal(puedeAdjuntarOperativo({ ...conPermiso, activo: false }), false);
    assert.equal(puedeAdjuntarOperativo({ rol: 'admin', activo: true, legacy: true }), false, 'el perfil de arranque no escribe');
    assert.equal(puedeAdjuntarOperativo({ rol: 'tecnico', activo: true, permisos_extra: PERMISO_ADJUNTAR_OPERATIVO }), false);
    assert.equal(puedeAdjuntarOperativo(null), false);
  });
  test('el catálogo RBAC lo conoce (por rol, solo admin; por permiso extra, el usuario puntual)', () => {
    assert.deepEqual(PERMISOS[PERMISO_ADJUNTAR_OPERATIVO], ['admin']);
    assert.equal(tienePermiso({ rol: 'tecnico', activo: true, permisos_extra: [PERMISO_ADJUNTAR_OPERATIVO] }, PERMISO_ADJUNTAR_OPERATIVO), true);
    assert.equal(tienePermiso({ rol: 'tecnico', activo: true }, PERMISO_ADJUNTAR_OPERATIVO), false);
  });
  test('dar o quitar el permiso conserva los demás y no lo repite', () => {
    assert.deepEqual(conPermisoOperativo(['a', 'b'], true), ['a', 'b', PERMISO_ADJUNTAR_OPERATIVO]);
    assert.deepEqual(conPermisoOperativo(['a', PERMISO_ADJUNTAR_OPERATIVO], true), ['a', PERMISO_ADJUNTAR_OPERATIVO]);
    assert.deepEqual(conPermisoOperativo(['a', PERMISO_ADJUNTAR_OPERATIVO, 'b'], false), ['a', 'b']);
    assert.deepEqual(conPermisoOperativo(undefined, true), [PERMISO_ADJUNTAR_OPERATIVO]);
  });
});

describe('las piezas usan el MISMO permiso', () => {
  test('las reglas de Firestore exigen la misma clave; quitar (meta y retiro) sigue siendo del admin', () => {
    const r = leer('firestore.rules');
    assert.match(r, new RegExp("hasAny\\(\\['" + PERMISO_ADJUNTAR_OPERATIVO.replace('.', '\\.') + "'\\]\\)"));
    assert.match(r, /allow delete: if isAdmin\(\) && hasProfile\(\)\s*&& existsAfter\(rutaRegistroAdjunto\(id \+ '_' \+ resource\.data\.lote \+ '_retiro'\)\)/);
    assert.match(r, /\(isAdmin\(\) \|\| request\.resource\.data\.get\('accion', ''\) in \['alta', 'reemplazo'\]\)/);
  });
  test('los datos: adjunta quien tiene el permiso; quita solo el admin', () => {
    const d = leer('assets', 'js', 'data', 'fichas_adjuntos.js');
    assert.match(d, /export function puedeEscribir\(\) \{ return !!\(getDbSafe\(\) && quienAdjunta\(\)\); \}/);
    assert.match(d, /export function puedeQuitar\(\) \{ return !!\(getDbSafe\(\) && administrador\(\)\); \}/);
    assert.match(d, /export async function guardar[\s\S]{0,120}quienAdjunta\(\)/);
    assert.match(d, /export async function quitar[\s\S]{0,120}administrador\(\)/);
  });
  test('la pantalla muestra «Quitar» solo si puede quitar; la página le pasa esa pregunta', () => {
    const p = leer('assets', 'js', 'ui', 'fichas', 'diagrama-operativo-panel.js');
    assert.equal((p.match(/if \(quita\) \{ const qui = boton\(/g) || []).length, 2);
    assert.doesNotMatch(p, /boton\('Quitar'\); const|const qui = boton\('Quitar el del aparato anterior'\);\n/);
    assert.match(leer('pages', 'fichas-tecnicas.html'), /async puedeQuitar\(\) \{/);
  });
  test('Administración › Usuarios tiene la casilla y guarda el permiso sin tocar los demás', () => {
    assert.match(leer('admin', 'usuarios.html'), /id="ePermOperativo"/);
    const a = leer('assets', 'js', 'admin', 'admin-usuarios.js');
    assert.match(a, /patch\.permisos_extra = conPermisoOperativo\(u\.permisos_extra, perm\.checked\)/);
  });
});
