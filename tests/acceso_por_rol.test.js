// Páginas que puede abrir cada rol (assets/js/domain/acceso_por_rol.js) · `99 §198`
//
// El visitante solo abre Cargabilidad SCADA y el Mapa; cualquier otra página lo manda a su inicio,
// y su inicio SIEMPRE se acepta a sí mismo (si no, el guardián lo dejaría rebotando). Para los
// demás roles no cambia nada. Además, amarres de texto: el guardián carga el módulo SOLO para el
// visitante, y las cuatro capas (reglas, Storage, funciones, cliente) nombran el mismo rol.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { decidirAcceso, clavePagina, esRolVisitante, ROL_VISITANTE } from '../assets/js/domain/acceso_por_rol.js';

const leer = (r) => readFileSync(new URL('../' + r, import.meta.url), 'utf8');
// data/usuarios.js importa el SDK desde el CDN (no corre en node): su lista se lee como texto.
const USUARIOS = leer('assets/js/data/usuarios.js');
const ROLES = [...USUARIOS.slice(USUARIOS.indexOf('export const ROLES = ['), USUARIOS.indexOf('];', USUARIOS.indexOf('export const ROLES = [')))
  .matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe('decidirAcceso — el equipo no cambia', () => {
  test('admin, técnico, roles F28, sin rol: todo permitido, sin restricción', () => {
    for (const rol of ['admin', 'tecnico', 'director_proyectos', 'auditor_campo', '', undefined, null]) {
      for (const p of ['/home.html', '/admin/usuarios.html', '/pages/ordenes.html', '/pages/cargabilidad-scada.html']) {
        assert.deepEqual(decidirAcceso(rol, p), { restringido: false, permitido: true }, rol + ' ' + p);
      }
    }
  });
});

describe('decidirAcceso — visitante', () => {
  const PERMITIDAS = ['/pages/cargabilidad-scada.html', '/pages/mapa-v2.html'];
  test('sus dos páginas, en todas sus formas (con y sin .html, con / final, con prefijo, con hash o consulta)', () => {
    for (const base of ['', '/repo']) {
      for (const p of PERMITIDAS) {
        for (const forma of [p, p.replace(/\.html$/, ''), p.replace(/\.html$/, '/'), p + '?x=1', p + '#mat=T1']) {
          const r = decidirAcceso('visitante', base + forma);
          assert.equal(r.permitido, true, base + forma);
          assert.equal(r.restringido, true);
          assert.equal(r.destino, null);
        }
      }
    }
  });
  test('todo lo demás va a su inicio', () => {
    const OTRAS = ['/', '/home.html', '/index.html', '/admin/usuarios.html', '/admin/scada-datos.html', '/pages/activos.html',
      '/pages/mapa.html', '/pages/mapa', '/pages/seguimiento-cargabilidad.html', '/pages/salud.html', '/pages/_firebase-test.html',
      '/pages/cargabilidad-scada-x.html', '/pages/mapa-v2.html.bak', '/_dev/cargabilidad-scada.html', '/cargabilidad-scada.html'];
    for (const p of OTRAS) {
      const r = decidirAcceso('visitante', p);
      assert.equal(r.permitido, false, p);
      assert.equal(r.destino, 'pages/cargabilidad-scada.html', p);
    }
  });
  test('su destino y su inicio siempre se aceptan (sin bucle), con o sin prefijo', () => {
    for (const base of ['https://x.github.io/', 'https://x.github.io/repo/']) {
      const r = decidirAcceso('visitante', '/admin/usuarios.html');
      const vuelta = decidirAcceso('visitante', new URL(r.destino, base).pathname);
      assert.equal(vuelta.permitido, true);
      for (const p of r.paginas) assert.equal(decidirAcceso('visitante', new URL(p.ruta, base).pathname).permitido, true, p.ruta);
    }
  });
  test('menú: las dos páginas, inicio = Cargabilidad SCADA; copias que no tocan la lista interna', () => {
    const r = decidirAcceso('visitante', '/pages/mapa-v2.html');
    assert.deepEqual(r.paginas.map((p) => p.ruta), ['pages/cargabilidad-scada.html', 'pages/mapa-v2.html']);
    assert.equal(r.inicio, 'pages/cargabilidad-scada.html');
    r.paginas[0].ruta = 'admin/usuarios.html';
    assert.equal(decidirAcceso('visitante', '/x').paginas[0].ruta, 'pages/cargabilidad-scada.html');
  });
  test('ante la duda, cerrado: variantes escritas a mano y roles que no son texto cuentan como visitante', () => {
    for (const rol of ['visitante', 'Visitante', ' VISITANTE ', 'visitante\u00a0', '\ufeffvisitante', 'visitante\n', ['visitante'], 7, true]) {
      assert.equal(esRolVisitante(rol), true, JSON.stringify(rol));
      assert.equal(decidirAcceso(rol, '/home.html').permitido, false, JSON.stringify(rol));
    }
    for (const rol of ['visit', 'admin', 'tecnico', 'auditor_campo', '', null, undefined]) assert.equal(esRolVisitante(rol), false, String(rol));
  });
  test('clavePagina: dos tramos exactos', () => {
    assert.equal(clavePagina('/pages/mapa-v2.html'), 'pages/mapa-v2');
    assert.equal(clavePagina('/pages/mapa.html'), 'pages/mapa');
    assert.equal(clavePagina('/repo/pages/Cargabilidad-SCADA/'), 'pages/cargabilidad-scada');
    assert.equal(clavePagina('/pages/%E0%A4%A.html'), 'pages/%e0%a4%a');   // mal codificada: no rompe
  });
});

describe('amarres de texto entre capas', () => {
  test('el guardián carga el módulo SOLO para el visitante y antes del chequeo de admin', () => {
    const g = leer('assets/js/auth/session-guard.js');
    assert.match(g, /const r = profile\.rol;[^\n]*\n\s*if \(r != null && \(typeof r !== 'string' \|\| r\.toLowerCase\(\)\.includes\('visitante'\)\)\) \{\s*const \{ decidirAcceso \} = await import\('\.\.\/domain\/acceso_por_rol\.js'\);/);
    assert.ok(g.indexOf("import('../domain/acceso_por_rol.js')") < g.indexOf('if (requireAdmin && profile.rol'), 'antes del chequeo de admin');
    assert.ok(g.indexOf("import('../domain/acceso_por_rol.js')") > g.indexOf("profile.activo === false"), 'después del de activo');
    assert.match(g, /redirect\(BASE_URL \+ acceso\.destino\);\s*return;/);
  });
  test('reglas, Storage, funciones, guardián y login: el MISMO criterio (ante la duda, cerrado)', () => {
    const REGLA = /function esRolVisitante\(r\) \{\s*return r is string \? r\.lower\(\)\.matches\('\(\?s\)\.\*visitante\.\*'\) : r != null;/;
    assert.match(leer('firestore.rules'), REGLA);
    assert.match(leer('storage.rules'), REGLA);
    const JS = /if \(rol == null\) return false;\s*return typeof rol !== 'string' \|\| rol\.toLowerCase\(\)\.includes\(/;
    assert.match(leer('functions/acceso_ia.mjs'), JS);
    assert.match(leer('assets/js/domain/acceso_por_rol.js'), JS);
    assert.match(leer('index.html'), /r != null && \(typeof r !== 'string' \|\| r\.toLowerCase\(\)\.includes\('visitante'\)\) \? 'pages\/cargabilidad-scada\.html' : 'home\.html'/);
    assert.equal(ROL_VISITANTE, 'visitante');
  });
  test('la lista de roles del panel coincide con la de las reglas de /usuarios (alta y edición)', () => {
    const reglas = leer('firestore.rules');
    const listas = [...reglas.matchAll(/request\.resource\.data\.rol in \[([^\]]*)\]/g)]
      .map((m) => [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort());
    assert.equal(listas.length, 2);
    assert.ok(ROLES.includes('visitante'));
    for (const l of listas) assert.deepEqual(l, [...ROLES].sort());
    assert.match(USUARIOS, /visitante:\s+'Visitante/);
  });
  test('el panel ofrece «visitante» en el alta, la edición y el filtro', () => {
    const h = leer('admin/usuarios.html');
    for (const id of ['fRol', 'fNuevoRol', 'eRol']) {
      const sel = h.slice(h.indexOf(`id="${id}"`), h.indexOf('</select>', h.indexOf(`id="${id}"`)));
      assert.match(sel, /value="visitante"/, id);
    }
  });
});
