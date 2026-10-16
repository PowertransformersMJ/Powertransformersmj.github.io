// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · DOCUMENTO (bloques del papel)
// ──────────────────────────────────────────────────────────────────────────────
// `construirDocumento(contenido)` convierte el informe (JSON) en una lista de
// BLOQUES en el orden del papel F60-ADM: portada, títulos, párrafos, tablas,
// cuadrículas de fotos y anexos. Lo leen IGUAL el papel HTML (PDF) y el Word, así
// los dos dicen exactamente las mismas palabras.
//
// Reglas que se garantizan aquí (y se prueban):
//  · Ningún texto lleva HTML: los «runs» son datos `{ t, b?, mark?, esc?, sep?, falta? }`;
//    quien dibuja escapa (el papel escapa HTML, el Word escapa XML).
//  · Figuras numeradas 1..N en el orden del papel; una cuadrícula de una sola figura
//    (1x1, 3f, 2x2f) cuenta UNA figura.
//  · Firmas: la imagen y la fecha SOLO en un informe EMITIDO y solo si la versión
//    emitida trae la firma de esa línea con el MISMO nombre. Nunca en borrador.
//  · Marca de agua «BORRADOR · SIN EMITIR» en borrador y «ANULADO» si se anuló.
//  · Hoja nueva antes de «3.», «4.», «ANEXOS» y de cada anexo siguiente.
//  · Anexo de cálculo: SOLO dos tablas, ACTUAL y PROYECTADO (decisión 9).
// Dominio puro: se prueba con `node --test`.
// ══════════════════════════════════════════════════════════════════════════════

import { numES, fechaDMA, mayusculasEs, matriculaArchivo } from './informe_brigada_formato.js';
import {
  FORMATO, PORTADA, INDICE, FIRMAS_PORTADA, TITULOS, TEXTOS, ANTES_TEXTOS, CONCLUSIONES, RECOMENDACIONES, ANTES_VINETAS,
  TABLAS, PALABRAS_ROTULO_FUERTE, ESCALA_ROTULO, DISPOSICIONES, SECCIONES_FIGURAS, ANTES_CUADRICULA, ANEXO_TITULOS,
  MARCA_CLAVES, aRuns, rellenar, variablesDe
} from './informe_brigada_plantilla.js';
import { variablesDelInforme, ajusteLimpio } from './informe_brigada_modelo.js';
import { normalizarNombre } from './firmas.js';
import { tamanoFirma } from './firmas_tamano.js';

const txt = (v) => (v == null ? '' : String(v).trim());
const lleno = (v) => v != null && String(v).trim() !== '';
function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
const espacios = (s) => String(s).replace(/\s+/g, ' ').trim();

/** Alto útil del cuerpo de una hoja (pt). */
const ALTO_CUERPO = FORMATO.cuerpo.abajo - FORMATO.cuerpo.arriba;
/** Renglón de un título de anexo (Arial Narrow Bold 11). */
const RENGLON_TITULO = 12.455;
/**
 * Tamaño de la firma estampada en la casilla «Fecha / Firma:» de la portada (pt). Pedido del Ingeniero (2026-10-16,
 * `99 §163.14`, opción A de su maqueta): *«ordenadas, justo debajo de la fecha, centrado, proporcional a los espacios,
 * todas las firmas»*. Mismo peso visual para todas (§101: misma superficie) pero más grandes que antes (1200 → 1600 pt²),
 * dentro de una caja de 92 × 26 pt: 26 es lo que cabe bajo la fecha de «Elaborado» sin acercarse a «Revisado por:», y
 * 92 deja 5 pt hasta la línea que divide la portada.
 */
export const FIRMA_PORTADA = Object.freeze({ area: 1600, altoMax: 26, anchoMax: 92 });
/**
 * Dónde va la firma estampada y su fecha (pt de la hoja). El papel y el Word usan ESTOS números.
 * `xCentro`: centro de la fecha «dd/mm/aaaa» que empieza en `xFecha` (Arial Narrow 10: 8 cifras de 0,556 em y 2 barras
 * de 0,278 em, al 82 % → 41,03 pt). Cada firma se centra ahí, `dyFirma` debajo del renglón de la fecha.
 * `xFirma` es el borde izquierdo de antes (se conserva por si una pantalla vieja lo pide).
 */
export const FIRMA_POSICION = Object.freeze({ xFirma: 232.0, dyFirma: 11.5, xFecha: 250.0, xCentro: 270.5 });

/**
 * ¿La firma guardada en la versión es la del firmante de ESA línea? (cierre de seguridad, además
 * del nombre): la clave de la versión debe ser el firmante escogido en la línea y la imagen debe
 * estar en la carpeta de esa clave (`informes_brigada_marca/firmas/<clave>/<huella>` o
 * `informes_brigada_bin/firma_<clave>_<16 hex>`). Así nadie estampa la firma de otro escribiendo
 * a mano en la base una versión con el nombre de la línea.
 */
export function firmaCorrespondeALinea(v, linea) {
  if (!v || !v.firma || !linea) return false;
  const clave = txt(v.clave);
  if (!clave || clave !== txt(linea.firmante)) return false;
  const huella = txt(v.firma.huella);
  if (!/^[0-9a-f]{64}$/.test(huella)) return false;
  const ruta = txt(v.firma.ruta);
  return ruta === 'informes_brigada_marca/firmas/' + clave + '/' + huella
    || ruta === 'informes_brigada_bin/firma_' + clave + '_' + huella.slice(0, 16);
}

/** Pie de figura uniforme (forma corregida): «Figura N» en negrita + «. » + texto. */
export function runsPieFigura(numero, pie) {
  const p = espacios(pie == null ? '' : pie);
  return p ? [{ t: 'Figura ' + numero, b: true }, { t: '. ' + p }] : [{ t: 'Figura ' + numero, b: true }];
}

/** Texto escrito a mano: siempre texto plano (nunca se interpretan marcas ni HTML). */
const runsManual = (s) => {
  const t = espacios(s);
  return t ? [{ t }] : [];
};

/** Celda de tabla desde plantilla: si falta alguna de sus variables, la celda queda en blanco. */
function runsCelda(plantilla, vars) {
  if (variablesDe(plantilla).some((v) => vars[v] == null)) return [];
  return aRuns(plantilla, vars);
}

/** Rótulo de la Tabla 1 con su escala horizontal palabra por palabra (como el modelo). */
function runsRotulo(rotulo) {
  const out = [];
  String(rotulo).split(' ').forEach((w, i) => {
    if (i > 0) out.push({ t: ' ', b: true });
    const fuerte = PALABRAS_ROTULO_FUERTE.includes(w);
    const r = { t: w, b: true, esc: fuerte ? ESCALA_ROTULO.fuerte : ESCALA_ROTULO.normal };
    if (fuerte) r.sep = ESCALA_ROTULO.separacion;
    out.push(r);
  });
  return out;
}

const celda = (t, extra = {}) => ({ runs: t === '' || t == null ? [] : [{ t: String(t) }], ...extra });

/** Fecha «dd/mm/aaaa» de la emisión, en hora de Colombia. */
function fechaEmision(en) {
  if (en == null) return '';
  let d = null;
  if (typeof en === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(en)) return fechaDMA(en);
    d = new Date(en);
  } else if (en instanceof Date) d = en;
  else if (typeof en.toDate === 'function') d = en.toDate();
  else if (typeof en.seconds === 'number') d = new Date(en.seconds * 1000);
  if (!d || Number.isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return fechaDMA(p);
}

/* ── anexos ───────────────────────────────────────────────────────────────── */
function plantillaAnexo(a) {
  if (ANEXO_TITULOS[a.clave]) return ANEXO_TITULOS[a.clave];
  if (a.tipo === 'ficha' && a.ficha && lleno(a.ficha.titulo)) return { titulo: String(a.ficha.titulo) };
  if (a.tipo === 'ficha') return ANEXO_TITULOS.ficha_extra;
  return { titulo: '' };
}
function tituloAnexo(a, vars, enPortada) {
  if (enPortada && lleno(a.titulo_portada)) return espacios(a.titulo_portada);
  if (lleno(a.titulo)) return espacios(a.titulo);
  const p = plantillaAnexo(a);
  const tpl = enPortada && p.titulo_portada ? p.titulo_portada : p.titulo;
  // En el título de un anexo un dato que falta no deja hueco: se omite.
  const v = { ...vars };
  variablesDe(tpl).forEach((k) => { if (v[k] == null) v[k] = ''; });
  return mayusculasEs(espacios(rellenar(tpl, v)));
}
/** Títulos de los anexos (para la portada y para el cuerpo). */
export function titulosAnexos(contenido) {
  const vars = variablesDelInforme(contenido);
  return (Array.isArray(contenido && contenido.anexos) ? contenido.anexos : [])
    .filter(Boolean)
    .map((a) => ({ clave: a.clave, titulo: tituloAnexo(a, vars, false), titulo_portada: tituloAnexo(a, vars, true) }));
}

/** Ancho en pt de la imagen de un anexo para que quepa en su hoja (ancho del cuerpo o menos, centrada). */
function anchoAnexoPt(ancho, alto, primero) {
  const disp = ALTO_CUERPO - (primero ? 2 * RENGLON_TITULO + 1.05 : RENGLON_TITULO) - 1.0;
  const w = FORMATO.cuerpo.ancho;
  if (!(ancho > 0 && alto > 0)) return w;
  const h = w * alto / ancho;
  return h > disp ? Math.floor((disp * ancho / alto) * 10) / 10 : w;
}

/* ── documento ────────────────────────────────────────────────────────────── */
/**
 * Contenido del informe → Documento (bloques del papel).
 * @param {object} contenido  informe «ibr@1»
 * @param {object} [o]
 * @param {'borrador'|'emitido'|'anulado'} [o.estado]
 * @param {number} [o.version]   versión emitida que se imprime (0 = nunca emitido)
 * @param {object} [o.versionDoc] versión emitida (`versiones/{n}`): de ahí salen las firmas y la marca
 */
export function construirDocumento(contenido, { estado = 'borrador', version = 0, versionDoc = null } = {}) {
  const c = contenido || {};
  const vars = variablesDelInforme(c);
  const est = estado === 'emitido' || estado === 'anulado' ? estado : 'borrador';
  const matricula = txt(c.equipo && c.equipo.matricula);

  const meta = {
    titulo: ('INFORME ' + matriculaArchivo(matricula)).trim(),
    matricula,
    estado: est,
    version: num(version) || 0,
    marcaAgua: est === 'emitido' ? null : est === 'anulado' ? 'ANULADO' : 'BORRADOR · SIN EMITIR'
  };

  const formato = {
    codigo: FORMATO.codigo,
    direcciones: FORMATO.direcciones.map((d) => ({ ...d })),
    web: FORMATO.web
  };
  const encabezado = { logo: 'marca:applus-encabezado', together: 'marca:together-encabezado' };

  /* Portada */
  const anexos = (Array.isArray(c.anexos) ? c.anexos : []).filter(Boolean);
  const firmasVersion = est === 'emitido' && versionDoc && Array.isArray(versionDoc.firmas) ? versionDoc.firmas : [];
  const fecha = est === 'emitido' && versionDoc ? fechaEmision(versionDoc.en) : '';
  const conEscala = (runs, esc) => runs.map((r) => ({ ...r, esc }));
  const portada = {
    logos: { afinia: 'marca:afinia-portada', applus: 'marca:applus-portada', together: 'marca:together-portada' },
    titulo: PORTADA.titulo.map((t) => rellenar(t, vars)),
    indice: INDICE.map((x) => ({ ...x })),
    anexosTitulo: PORTADA.anexosTitulo,
    anexosSubtitulo: vars.subtitulo_anexos || '',
    anexos: anexos.map((a) => tituloAnexo(a, vars, true)),
    cliente: rellenar(PORTADA.cliente, vars),
    datos: [conEscala(aRuns(PORTADA.asunto, vars), PORTADA.escalaAsunto)]
      .concat(PORTADA.datos.map((d) => conEscala(aRuns(d, vars), PORTADA.escalaDatos))),
    firmas: FIRMAS_PORTADA.map((f) => {
      const linea = (c.firmas && c.firmas[f.rol]) || {};
      const nombre = mayusculasEs(txt(linea.nombre));
      const v = firmasVersion.find((x) => x && x.rol === f.rol && x.firma);
      // Solo se estampa si la línea lleva el nombre del firmante, el firmante escogido es el de la firma
      // y la imagen está en la carpeta de ESE firmante (nunca la firma de otro).
      const vale = !!(v && nombre && normalizarNombre(v.nombre) === normalizarNombre(nombre) && firmaCorrespondeALinea(v, linea));
      const rel = vale && num(v.firma.ancho) > 0 && num(v.firma.alto) > 0 ? num(v.firma.ancho) / num(v.firma.alto) : 2.5;
      const tam = vale ? tamanoFirma(rel, FIRMA_PORTADA) : null;
      return {
        rol: f.rol, rotulo: f.rotulo, casilla: f.casilla, nombre,
        firmaRef: vale ? 'firma:' + f.rol : null,
        fecha: vale && fecha ? fecha : null,
        firmaTamPt: tam,
        // borde izquierdo para que quede CENTRADA bajo la fecha (§163.14)
        firmaXPt: tam ? Math.round((FIRMA_POSICION.xCentro - tam.ancho / 2) * 1000) / 1000 : null
      };
    })
  };

  /* Cuerpo */
  const B = [];
  const titulo = (id) => {
    const t = TITULOS[id];
    const b = { tipo: 'titulo', id, nivel: t.nivel, numero: t.numero, texto: t.texto, estilo: t.estilo, antes: t.antes, conSiguiente: true };
    if (t.antesEnTope) b.antesEnTope = true;
    if (t.saltoAntes) b.saltoAntes = true;
    B.push(b);
  };
  const parrafo = (id) => {
    const manual = c.textos ? c.textos[id] : null;
    const esManual = manual != null;
    B.push({ tipo: 'parrafo', id, runs: esManual ? runsManual(manual) : aRuns(TEXTOS[id], vars), antes: ANTES_TEXTOS[id], origen: esManual ? 'manual' : 'plantilla' });
  };
  const vinetas = (lista, plantillas, antesPrimera) => {
    let k = 0;
    (Array.isArray(lista) ? lista : []).forEach((it) => {
      if (!it) return;
      const pl = plantillas.find((x) => x.id === it.plantilla);
      let runs; let origen;
      if (it.texto != null) { runs = runsManual(it.texto); origen = 'manual'; } else if (pl) { runs = aRuns(pl.texto, vars); origen = 'plantilla'; } else return;
      B.push({ tipo: 'vineta', id: it.plantilla || ('m' + (k + 1)), runs, antes: k === 0 ? antesPrimera : 0, origen });
      k += 1;
    });
  };

  let nfig = 0;
  const cuadriculas = (s) => {
    ((c.figuras && c.figuras[s]) || []).forEach((g, gi) => {
      const d = g && DISPOSICIONES[g.disposicion];
      if (!d) return;
      const antes = gi === 0 ? (ANTES_CUADRICULA[s] != null ? ANTES_CUADRICULA[s] : ANTES_CUADRICULA.otras) : ANTES_CUADRICULA.siguientes;
      const figs = (Array.isArray(g.figuras) ? g.figuras : []).slice(0, d.figuras);
      const unica = d.unaFigura ? ++nfig : null;
      const figuras = figs.map((f) => {
        const numero = d.unaFigura ? unica : ++nfig;
        const fotos = (Array.isArray(f.fotos) ? f.fotos : []).slice(0, d.fotosPorFigura);
        while (fotos.length < d.fotosPorFigura) fotos.push({ archivo: null, marcas: [] });
        return {
          numero,
          pie: espacios(f.pie == null ? '' : f.pie),
          runs: runsPieFigura(numero, f.pie),
          fotos: fotos.map((ft) => fotoDoc(c, ft, d))
        };
      });
      B.push({ tipo: 'cuadricula', id: g.id || (s + '_' + gi), seccion: s, disposicion: g.disposicion, geom: geomCuadricula(g.disposicion, g.ajuste), figuras, antes });
    });
  };

  // 1. INTRODUCCIÓN
  titulo('s1'); parrafo('intro_p1'); parrafo('intro_p2'); parrafo('intro_p3');
  // 2. DESCRIPCIÓN DE TRABAJOS
  titulo('s2'); titulo('s2_1'); titulo('s2_1_1'); parrafo('obj_general');
  titulo('s2_1_2'); parrafo('obj_esp_1'); parrafo('obj_esp_2'); parrafo('obj_esp_3');
  titulo('s2_2'); parrafo('personal');
  titulo('s2_3'); parrafo('alcance'); cuadriculas('alcance');
  // 3. INFORMACIÓN CARACTERÍSTICA (hoja nueva) — Tablas 1 a 4
  titulo('s3');
  B.push(tabla1(vars));
  B.push(pieTabla(TABLAS.t1));
  B.push(tablaLista('t2', (c.tablas && c.tablas.material) || []));
  B.push(pieTabla(TABLAS.t2));
  B.push(tablaLista('t3', (c.tablas && c.tablas.herramientas) || []));
  B.push(pieTabla(TABLAS.t3));
  B.push(tablaLista('t4', (c.tablas && c.tablas.sst) || []));
  B.push(pieTabla(TABLAS.t4));
  // 4. PROCEDIMIENTO (hoja nueva)
  titulo('s4'); titulo('s4_1'); parrafo('ingreso'); cuadriculas('ingreso');
  titulo('s4_2'); parrafo('cond_iniciales'); cuadriculas('condiciones_iniciales');
  titulo('s4_3'); parrafo('montaje'); cuadriculas('montaje');
  titulo('s4_4'); parrafo('pruebas_1'); cuadriculas('pruebas_consumo');
  B.push({ tipo: 'etiqueta', texto: TABLAS.t5.etiqueta, antes: TABLAS.t5.etiquetaAntes, conSiguiente: true });
  B.push(tabla5(c.corrientes || {}));
  parrafo('pruebas_2'); cuadriculas('pruebas_giro'); cuadriculas('estado_final');
  // 5. RECOMENDACIONES Y CONCLUSIONES
  titulo('s5'); vinetas(c.conclusiones, CONCLUSIONES, ANTES_VINETAS.conclusiones);
  titulo('s5_1'); vinetas(c.recomendaciones, RECOMENDACIONES, ANTES_VINETAS.recomendaciones);

  // ANEXOS (hoja nueva; cada anexo en su hoja)
  if (anexos.length) {
    B.push({ tipo: 'anexoTitulo', id: 'anexos', texto: PORTADA.anexosTitulo, antes: 0, saltoAntes: true, conSiguiente: true });
    anexos.forEach((a, k) => {
      const t = { tipo: 'anexoTitulo', id: 'anexo_' + a.clave, texto: tituloAnexo(a, vars, false), antes: k === 0 ? 1.05 : 0, conSiguiente: true };
      if (k > 0) t.saltoAntes = true;
      B.push(t);
      if (a.tipo === 'calculo') {
        const ve = c.ventiladores || {};
        B.push(tablaCalculo('calc_actual', TABLAS.calculo.actual, ve.actual, (f) => txt(f.modelo), TABLAS.calculo.antesPrimera));
        B.push(tablaCalculo('calc_proyectado', TABLAS.calculo.proyectado, ve.nuevo, (f) => espacios([txt(f.marca), txt(f.modelo)].join(' ')), TABLAS.calculo.separacion));
      } else {
        B.push(anexoImagen(c, a, k === 0));
      }
    });
  }

  return { meta, formato, encabezado, portada, bloques: B };
}

/* ── piezas del cuerpo ────────────────────────────────────────────────────── */
function fotoDoc(c, ft, d) {
  const id = ft && lleno(ft.archivo) ? String(ft.archivo) : null;
  const m = id && c.archivos ? c.archivos[id] : null;
  const ancho = m && num(m.ancho) > 0 ? num(m.ancho) : 1000;
  const alto = m && num(m.alto) > 0 ? num(m.alto) : Math.round(1000 / d.aspectoDefecto);
  const marcas = (Array.isArray(ft && ft.marcas) ? ft.marcas : [])
    .map((x) => ({ x: num(x && x.x), y: num(x && x.y), w: num(x && x.w), h: num(x && x.h) }))
    .filter((x) => [x.x, x.y, x.w, x.h].every((v) => v != null && v >= 0 && v <= 1) && x.w > 0 && x.h > 0);
  return { ref: id ? 'archivo:' + id : null, ancho, alto, marcas };
}

/** Geometría de una cuadrícula: la de su disposición + el ajuste fino del modelo (si lo trae). Copia plana. */
export function geomCuadricula(disposicion, ajuste = null) {
  const d = DISPOSICIONES[disposicion];
  if (!d) return null;
  const g = { ...d };
  delete g.nombre;
  const a = ajusteLimpio(ajuste);
  if (a) Object.assign(g, a, a.anchosCol ? { anchosCol: a.anchosCol.slice() } : {});
  return g;
}

/** Margen de la foto dentro de su celda (pt): 5,2 a la izquierda y 5,6 a la derecha (medido en el modelo). */
export const FOTO_MARGEN = Object.freeze({ izq: 5.2, total: 10.8 });

/**
 * Dónde va cada foto de una cuadrícula y su fila de pie (pt, pura): lo usan el papel (PDF) y el Word,
 * así los dos ponen las fotos del MISMO tamaño y en el MISMO sitio (topes, sangrías y ajustes incluidos).
 *  · modo «ancho» (2x1, 1x1): la foto llena el ancho de su columna menos 10,8 pt; nunca más alta que `altoMax`;
 *  · modo «alto» (3f): las fotos a un alto común y columnas a su medida (o `altoFoto` fijo);
 *  · 2x2f: alto fijo 175,1 pt, sin pasarse del ancho de la columna;
 *  · la foto va arriba a la izquierda de su celda (como el modelo); con `alinearV: 'centro'`, centrada en alto.
 * @returns {{ x0, ancho, colW: number[], colX: number[], filas: { y, alto, fotos: { x, y, w, h }[] }[], alto,
 *            pie: { alto, dy, sangria }, alinearV: string|null, extraInferior: number }}
 */
export function geometriaCuadricula(bloque) {
  const base = DISPOSICIONES[bloque && bloque.disposicion];
  if (!base) throw new Error('Disposición de fotos desconocida.');
  const d = { ...base, ...((bloque && bloque.geom) || {}) };
  const M = FOTO_MARGEN.total;
  const cols = d.columnas;
  const ancho = d.ancho;
  const x0 = d.x0 != null ? d.x0 : 306.0 - ancho / 2;
  const altoMax = d.altoMax || 430;
  const figs = Array.isArray(bloque.figuras) ? bloque.figuras : [];
  const fotos = d.unaFigura ? ((figs[0] && figs[0].fotos) || []) : figs.map((f) => (f.fotos || [])[0] || { ancho: 0, alto: 0 });
  const asp = (f) => (f && f.ancho > 0 && f.alto > 0 ? f.ancho / f.alto : d.aspectoDefecto);
  const filasF = [];
  for (let k = 0; k < fotos.length; k += cols) filasF.push(fotos.slice(k, k + cols));
  let colW = Array(cols).fill(ancho / cols);
  const tam = filasF.map((fila) => fila.map(() => ({ w: 0, h: 0 })));
  if (d.modoFoto === 'alto') {
    filasF.forEach((fila, r) => {
      const a = fila.map(asp);
      const h = d.altoFoto ? Math.min(d.altoFoto, altoMax) : Math.min(altoMax, (ancho - cols * M) / a.reduce((x, y) => x + y, 0));
      a.forEach((v, c) => { tam[r][c] = { w: h * v, h }; });
    });
    if (filasF.length === 1) {
      // Una sola fila: columnas a la medida de cada foto y lo que sobra, repartido (como Word).
      const usado = tam[0].reduce((s, t) => s + t.w + M, 0);
      const sobra = (ancho - usado) / cols;
      colW = tam[0].map((t) => t.w + M + sobra);
    }
  }
  if (Array.isArray(d.anchosCol) && d.anchosCol.length === cols) colW = d.anchosCol.slice();
  filasF.forEach((fila, r) => fila.forEach((f, c) => {
    if (d.modoFoto === 'alto') {
      let { w, h } = tam[r][c];
      if (w > colW[c] - M) { w = colW[c] - M; h = w / asp(f); }
      tam[r][c] = { w, h };
    } else {
      let w = colW[c] - M; let h = w / asp(f);
      if (h > altoMax) { h = altoMax; w = h * asp(f); }
      tam[r][c] = { w, h };
    }
  }));
  const colX = [x0];
  colW.forEach((w, c) => colX.push(colX[c] + w));
  const padT = 0.5; const padB = d.modoFoto === 'alto' ? 0.3 : 0.5; const ext = d.extraInferior || 0;
  const centro = d.alinearV === 'centro';
  let y = 0;
  const filas = filasF.map((fila, r) => {
    const hMax = Math.max(...tam[r].map((t) => t.h));
    const alto = hMax + padT + padB + ext;
    const out = { y, alto, fotos: fila.map((f, c) => {
      const t = tam[r][c];
      return { x: colX[c] + FOTO_MARGEN.izq, y: centro ? y + (hMax + padT + padB - t.h) / 2 : y + padT, w: t.w, h: t.h };
    }) };
    y += alto;
    return out;
  });
  return {
    x0, ancho: colX[cols] - x0, colW, colX, filas, alto: y,
    pie: { alto: d.altoPie, dy: d.dyPie != null ? d.dyPie : 0.6, sangria: d.sangriaPie || 0 },
    alinearV: centro ? 'centro' : null, extraInferior: ext
  };
}

function tabla1(vars) {
  const t = TABLAS.t1;
  return {
    tipo: 'tabla', id: 't1', geom: copiaGeom(t.geom), antes: t.antes,
    filas: t.filas.map(([rot, tpl]) => ({ alto: t.altoFila, celdas: [{ runs: runsRotulo(rot), estilo: 'rotulo' }, { runs: runsCelda(tpl, vars) }] }))
  };
}
const copiaGeom = (g) => ({ ...g, cols: g.cols.slice() });
const pieTabla = (t) => ({ tipo: 'pieTabla', texto: t.pie, antes: t.pieAntes, conAnterior: true });

function tablaLista(id, filas) {
  const t = TABLAS[id];
  return {
    tipo: 'tabla', id, geom: copiaGeom(t.geom), antes: t.antes,
    filas: (Array.isArray(filas) ? filas : []).filter(Boolean).map((r, k) => ({
      alto: t.altoFila,
      celdas: [celda(k + 1), celda(espacios(r.descripcion == null ? '' : r.descripcion), { envolver: true }), celda(txt(r.unidad)), celda(numES(num(r.cantidad)))]
    }))
  };
}

function tabla5(co) {
  const t = TABLAS.t5;
  const fila = (rot, x) => ({ alto: t.altoFila, celdas: [celda(txt(rot)), celda(numES(num(x && x.r))), celda(numES(num(x && x.s))), celda(numES(num(x && x.t)))] });
  const filas = [
    { alto: t.altoFila, celdas: [celda(t.titulo, { span: 4 })] },
    { alto: t.altoFila, celdas: t.encabezados.map((h) => celda(h)) }
  ];
  (Array.isArray(co.filas) ? co.filas : []).filter(Boolean).forEach((f) => filas.push(fila(f.ventilador, f)));
  const no = co.nominal || {};
  filas.push(fila(no.etiqueta || 'NOMINAL', no));
  return { tipo: 'tabla', id: 't5', geom: copiaGeom(t.geom), antes: t.antes, filas };
}

function tablaCalculo(id, defn, lista, etiqueta, antes) {
  const t = TABLAS.calculo;
  const neg = (x, extra = {}) => ({ runs: x === '' || x == null ? [] : [{ t: String(x), b: true }], estilo: 'negrita', ...extra });
  const filas = [
    { alto: t.altoFila, celdas: [neg(defn.titulo, { span: 4, fondo: t.fondoTitulo })] },
    { alto: t.altoFila, celdas: defn.encabezados.map((h) => neg(h)) }
  ];
  const datos = (Array.isArray(lista) ? lista : []).filter((f) => f && (lleno(f.modelo) || lleno(f.marca) || num(f.cantidad) != null || num(f.cfm_unitario) != null));
  let sumaCant = 0; let sumaTot = 0; let completas = true;
  datos.forEach((f) => {
    const n = num(f.cantidad); const cfm = num(f.cfm_unitario);
    const tot = n != null && cfm != null ? n * cfm : null;
    if (n != null) sumaCant += n; else completas = false;
    if (tot != null) sumaTot += tot; else completas = false;
    filas.push({ alto: t.altoFila, celdas: [celda(etiqueta(f), { envolver: true }), celda(numES(n)), celda(numES(cfm)), celda(numES(tot))] });
  });
  if (datos.length > 1) {
    filas.push({ alto: t.altoFila, celdas: [neg(t.total), neg(completas ? numES(sumaCant) : ''), neg(''), neg(completas ? numES(sumaTot) : '')] });
  }
  return { tipo: 'tabla', id, geom: copiaGeom(t.geom), antes, filas };
}

function anexoImagen(c, a, primero) {
  let ref = null; let m = null;
  if (a.tipo === 'ficha' && a.ficha) { ref = 'ficha:' + a.clave; m = a.ficha; } else if (lleno(a.archivo)) { ref = 'archivo:' + a.archivo; m = c.archivos ? c.archivos[a.archivo] : null; }
  const porDefecto = a.tipo === 'ficha' ? [1150, 1538] : [1178, 893];
  const ancho = m && num(m.ancho) > 0 ? num(m.ancho) : porDefecto[0];
  const alto = m && num(m.alto) > 0 ? num(m.alto) : porDefecto[1];
  const b = { tipo: 'anexoImagen', clave: a.clave, ref, ancho, alto, antes: 0 };
  const w = anchoAnexoPt(ancho, alto, primero);
  if (w < FORMATO.cuerpo.ancho) b.anchoPt = w;
  return b;
}

/* ── referencias a imágenes ───────────────────────────────────────────────── */
/** Todas las imágenes que pide el documento (logos, firmas, fotos y anexos), sin repetir. */
export function refsDelDocumento(documento) {
  const d = documento || {};
  const out = [];
  const add = (r) => { if (r && !out.includes(r)) out.push(r); };
  if (d.encabezado) { add(d.encabezado.logo); add(d.encabezado.together); }
  if (d.portada) {
    Object.values(d.portada.logos || {}).forEach(add);
    (d.portada.firmas || []).forEach((f) => add(f.firmaRef));
  }
  (d.bloques || []).forEach((b) => {
    if (b.tipo === 'cuadricula') b.figuras.forEach((f) => f.fotos.forEach((ft) => add(ft.ref)));
    if (b.tipo === 'anexoImagen') add(b.ref);
  });
  return out;
}

/**
 * Metadatos de almacenamiento de una referencia (`archivo:`, `ficha:`, `marca:`, `firma:`):
 * { almacen, ruta, huella, mime, ancho, alto, … } o null. Las firmas salen SOLO de una
 * versión emitida (`versionDoc.firmas`); la marca, de la versión si se imprime una, si no
 * de la configuración.
 */
export function metaDeRef(ref, { contenido = null, config = null, versionDoc = null } = {}) {
  const m = /^(archivo|ficha|marca|firma):(.+)$/.exec(String(ref == null ? '' : ref));
  if (!m) return null;
  const [, tipo, id] = m;
  if (tipo === 'archivo') return (contenido && contenido.archivos && contenido.archivos[id]) || null;
  if (tipo === 'ficha') {
    const a = ((contenido && contenido.anexos) || []).find((x) => x && x.clave === id);
    return (a && a.ficha) || null;
  }
  if (tipo === 'marca') {
    if (!MARCA_CLAVES.includes(id)) return null;
    return (versionDoc && versionDoc.marca && versionDoc.marca[id]) || (config && config.marca && config.marca[id]) || null;
  }
  // firma: solo de una versión emitida y solo si es la del firmante de esa línea
  const f = versionDoc && Array.isArray(versionDoc.firmas) ? versionDoc.firmas.find((x) => x && x.rol === id) : null;
  if (!f) return null;
  if (contenido && contenido.firmas && !firmaCorrespondeALinea(f, contenido.firmas[id])) return null;
  return f.firma || null;
}
