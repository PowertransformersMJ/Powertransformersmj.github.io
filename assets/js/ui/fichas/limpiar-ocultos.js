// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · QUITAR LOS DATOS OCULTOS DEL EXCEL (`99 §104`)
// ──────────────────────────────────────────────────────────────────────────────
// Orden del Ingeniero (2026-09-25), viendo la pestaña «Datos ocultos del archivo»
// de la vista previa: «datos ocultos no necesito que se exporte en los documentos».
//
// La plantilla oficial PE.02081 trae escondido, y viajaba en CADA Excel:
//   · un vínculo a otro archivo («PE.02081.PE-FO.03 Ficha tecnica.xlsx») que usa
//     Beneficios!K11 — Excel pide «actualizar vínculos» al abrir;
//   · fechas de la plantilla (creada 2018, impresa 2023), propiedades de
//     SharePoint / Microsoft 365, etiqueta de clasificación y 3 bloques customXml;
//   · nombres definidos rotos (#REF!), la impresora de quien hizo la plantilla y
//     los nombres de una hoja borrada («Anexos MT») en las propiedades;
//   · una captura de UPME dibujada FUERA del área de impresión (Beneficios y
//     Anexo AT), y piezas sueltas de la hoja borrada (su dibujo con una tira vieja
//     de logos y sus textos).
//
// Aquí se quita todo eso del archivo YA armado, justo antes de comprimirlo.
// Lo VISIBLE de las hojas no cambia: celdas, dibujos dentro del área de
// impresión, firmas, formato de página. Beneficios!K11 deja de leer el otro
// archivo y lee la misma casilla de «Ficha Técnica» de este libro: hoy da el
// mismo 0 (el sistema no escribe esa casilla) y Excel ya no pide vínculos.
//
// Dos piezas:
//   · `planDeLimpieza(nombres, textos)` — PURA: de los textos del paquete saca
//     qué reescribir y qué quitar. Probada en `tests/fichas_limpiar_ocultos.test.js`.
//   · `limpiarOcultos(zip)` — lee, planea y SOLO al final aplica. Si algo falla
//     antes de aplicar, el archivo sale como estaba (nunca se deja de emitir).
// También exporta `partesSueltas` y `textosSobrantes`, que la vista previa usa
// para mostrar lo que quedara (la lista debe salir vacía).
// ══════════════════════════════════════════════════════════════════════════════

const TIPO = {
  documento: /\/officeDocument$/,
  hoja: /\/worksheet$/,
  vinculo: /\/externalLink$/,
  personalizadas: /\/custom-properties$/,
  etiqueta: /\/classificationlabels$/,
  customXml: /\/customXml$/,
  impresora: /\/printerSettings$/,
  dibujo: /\/drawing$/,
  textos: /\/sharedStrings$/
};

function attr(tag, nombre) {
  const m = String(tag).match(new RegExp('\\s' + nombre + '="([^"]*)"'));
  return m ? m[1] : null;
}

/** Ruta del .rels de una parte ('' = el paquete). */
export function rutaRels(parte) {
  if (!parte) return '_rels/.rels';
  const i = parte.lastIndexOf('/');
  return parte.slice(0, i + 1) + '_rels/' + parte.slice(i + 1) + '.rels';
}

/** Resuelve el Target de una relación contra la parte que la declara. */
export function resolver(base, target) {
  if (/^\//.test(target)) return target.slice(1);
  const partes = base ? base.split('/') : [''];
  partes.pop();
  for (const p of String(target).split('/')) {
    if (p === '..') partes.pop();
    else if (p !== '.' && p !== '') partes.push(p);
  }
  return partes.join('/');
}

function relaciones(xml) {
  return [...String(xml || '').matchAll(/<Relationship\b[^>]*\/?>/g)].map((m) => ({
    tag: m[0], id: attr(m[0], 'Id'), tipo: attr(m[0], 'Type') || '',
    target: attr(m[0], 'Target') || '', externo: attr(m[0], 'TargetMode') === 'External'
  }));
}

function quitarRelaciones(xml, ids) {
  if (!ids.length) return xml;
  return String(xml).replace(/<Relationship\b[^>]*\/?>/g, (t) => (ids.includes(attr(t, 'Id')) ? '' : t));
}

/**
 * Partes del paquete a las que NINGUNA relación llega (restos de hojas borradas).
 * @param {string[]} nombres  todos los archivos del zip (sin carpetas)
 * @param {(ruta: string) => (string|null)} leer  texto de un .rels, o null
 * @returns {string[]} las que sobran, en el orden de `nombres`
 */
export function partesSueltas(nombres, leer) {
  const hay = new Set(nombres);
  const alcanzadas = new Set(['[Content_Types].xml']);
  const pendientes = [''];
  while (pendientes.length) {
    const parte = pendientes.pop();
    const rr = rutaRels(parte);
    if (!hay.has(rr) || alcanzadas.has(rr)) continue;
    alcanzadas.add(rr);
    for (const r of relaciones(leer(rr))) {
      if (r.externo) continue;
      const destino = resolver(parte, r.target);
      if (hay.has(destino) && !alcanzadas.has(destino)) { alcanzadas.add(destino); pendientes.push(destino); }
    }
  }
  return nombres.filter((n) => !alcanzadas.has(n));
}

/** Índices de los textos compartidos que usan las celdas de las hojas. */
function textosUsados(hojas) {
  const usados = new Set();
  for (const xml of hojas) {
    for (const c of String(xml || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      if (attr(c[1], 't') !== 's' || !c[2]) continue;
      const v = c[2].match(/<v>(\d+)<\/v>/);
      if (v) usados.add(+v[1]);
    }
  }
  return usados;
}

/**
 * Textos guardados en el libro que ninguna celda usa (restos de hojas borradas).
 * @returns {Array<{i: number, texto: string}>}
 */
export function textosSobrantes(sharedStringsXml, hojas) {
  const usados = textosUsados(hojas);
  const out = [];
  let i = 0;
  for (const si of String(sharedStringsXml || '').matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) {
    const texto = [...String(si[1] || '').matchAll(/<t\b[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join('');
    if (!usados.has(i) && texto.trim()) out.push({ i, texto });
    i++;
  }
  return out;
}

/** 'Anexo AT'!$B$2:$O$41 → [{c0, r0, c1, r1}] con índices desde 0. */
function rangosDeArea(texto) {
  const col = (l) => [...l].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return [...String(texto).matchAll(/\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/g)].map((m) => ({
    c0: col(m[1]), r0: +m[2] - 1, c1: col(m[3]), r1: +m[4] - 1
  }));
}

/** ¿El ancla queda ENTERA fuera de todos los rangos del área de impresión? */
function anclaFuera(ancla, rangos) {
  const pos = (que) => {
    const m = ancla.match(new RegExp('<xdr:' + que + '>\\s*<xdr:col>(\\d+)</xdr:col>[\\s\\S]*?<xdr:row>(\\d+)</xdr:row>'));
    return m ? { c: +m[1], r: +m[2] } : null;
  };
  const de = pos('from'); const a = pos('to');
  if (!de) return false;
  return rangos.every((g) => de.c > g.c1 || de.r > g.r1 || (a && (a.c < g.c0 || a.r < g.r0)));
}

const escRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * PURA. Decide qué reescribir y qué quitar para que el archivo no lleve datos
 * ocultos. No toca lo que se ve.
 * @param {string[]} nombres  archivos del zip (sin carpetas)
 * @param {Map<string,string>|Object} textos  contenido de las partes .xml/.rels
 * @returns {{ escribir: Map<string,string>, quitar: string[], hecho: string[] }}
 */
export function planDeLimpieza(nombres, textos) {
  const t = new Map(textos instanceof Map ? textos : Object.entries(textos || {}));
  const antes = new Map(t);
  const hecho = [];
  const leer = (r) => (t.has(r) ? t.get(r) : null);

  // El libro y sus relaciones.
  const raiz = relaciones(leer('_rels/.rels'));
  const relDoc = raiz.find((r) => TIPO.documento.test(r.tipo));
  if (!relDoc) throw new Error('El archivo no tiene libro: no se limpia.');
  const libro = resolver('', relDoc.target);
  const relsLibro = rutaRels(libro);
  let wb = leer(libro) || '';
  let wbRels = leer(relsLibro) || '';
  const relsWb = relaciones(wbRels);
  // `idx` = posición en <sheets>, que es la que usan las áreas de impresión.
  const hojas = [...wb.matchAll(/<sheet\b[^>]*\/?>/g)].map((m, idx) => {
    const rel = relsWb.find((r) => r.id === attr(m[0], 'r:id'));
    return { idx, nombre: attr(m[0], 'name'), ruta: rel ? resolver(libro, rel.target) : null };
  }).filter((h) => h.ruta && t.has(h.ruta));
  const nombresHoja = new Set(hojas.map((h) => h.nombre));

  // 1) Vínculo a otro archivo. Cada fórmula que lo usa pasa a leer la hoja del
  //    MISMO nombre en este libro; si no existe, la celda queda con su valor.
  const refsExternas = [...wb.matchAll(/<externalReference\b[^>]*\/?>/g)].map((m) => attr(m[0], 'r:id'));
  if (refsExternas.length) {
    const reNum = /(?:'|&apos;)\[(\d+)\]((?:[^'&]|&(?!apos;))+?)(?:'|&apos;)!|\[(\d+)\]([A-Za-z0-9_.ÁÉÍÓÚÑáéíóúñ]+)!/g;
    for (const h of hojas) {
      const xml = t.get(h.ruta);
      if (!/\[\d+\]/.test(xml)) continue;
      const nuevo = xml.replace(/<f\b([^>]*)>([^<]*)<\/f>/g, (f, atributos, formula) => {
        if (!/\[\d+\]/.test(formula)) return f;
        let resuelta = true;
        // Nombres tal como vienen escritos en el XML, a ambos lados.
        const cambiada = formula.replace(reNum, (m, n1, hoja1, n2, hoja2) => {
          const hoja = hoja1 !== undefined ? hoja1 : hoja2;
          if (!nombresHoja.has(hoja)) { resuelta = false; return m; }
          return "'" + hoja + "'!";
        });
        if (resuelta && !/\[\d+\]/.test(cambiada)) return '<f' + atributos + '>' + cambiada + '</f>';
        // Una fórmula compartida la heredan otras celdas: quitarla dañaría el
        // archivo. Mejor no limpiar nada (el archivo sale como antes).
        if (attr(atributos, 't') === 'shared') throw new Error('Fórmula compartida con vínculo externo: no se limpia.');
        return '';                                   // sin fórmula: queda su valor
      });
      if (nuevo !== xml) { t.set(h.ruta, nuevo); hecho.push('fórmulas que leían otro archivo · ' + h.nombre); }
    }
    wb = wb.replace(/<externalReferences>[\s\S]*?<\/externalReferences>|<externalReferences\/>/, '');
    wb = wb.replace(/<definedName\b[^>]*>[^<]*\[\d+\][^<]*<\/definedName>/g, '');
    wbRels = quitarRelaciones(wbRels, relsWb.filter((r) => TIPO.vinculo.test(r.tipo)).map((r) => r.id));
    hecho.push('vínculo a otro archivo');
  }

  // 2) Datos de SharePoint incrustados (customXml).
  const idsCx = relsWb.filter((r) => TIPO.customXml.test(r.tipo)).map((r) => r.id);
  if (idsCx.length) { wbRels = quitarRelaciones(wbRels, idsCx); hecho.push('datos de SharePoint incrustados'); }

  // 3) Nombres definidos rotos (#REF!).
  const antesNombres = wb;
  wb = wb.replace(/<definedName\b[^>]*>[^<]*#REF![^<]*<\/definedName>/g, '');
  wb = wb.replace(/<definedNames>\s*<\/definedNames>/, '');
  if (wb !== antesNombres) hecho.push('nombres definidos rotos');

  // 4) Huellas de edición del libro: identificador de revisión y carpeta del autor.
  wb = wb.replace(/<xr:revisionPtr\b[^>]*\/>/, '');
  wb = wb.replace(/<mc:AlternateContent\b[^>]*>(?:(?!<\/mc:AlternateContent>)[\s\S])*?x15ac:absPath[\s\S]*?<\/mc:AlternateContent>/, '');

  t.set(libro, wb);
  t.set(relsLibro, wbRels);

  // 5) Propiedades personalizadas y etiqueta de clasificación (paquete).
  const idsRaiz = raiz.filter((r) => TIPO.personalizadas.test(r.tipo) || TIPO.etiqueta.test(r.tipo)).map((r) => r.id);
  if (idsRaiz.length) { t.set('_rels/.rels', quitarRelaciones(leer('_rels/.rels'), idsRaiz)); hecho.push('propiedades personalizadas y etiqueta'); }

  // 6) Propiedades del documento: sin fechas de la plantilla ni autor.
  for (const r of raiz) {
    const ruta = resolver('', r.target);
    const xml = leer(ruta);
    if (xml == null) continue;
    if (/\/core-properties$/.test(r.tipo)) {
      const limpio = xml.replace(/(<cp:coreProperties\b[^>]*>)[\s\S]*(<\/cp:coreProperties>)/, '$1$2');
      if (limpio !== xml) { t.set(ruta, limpio); hecho.push('fechas y datos de la plantilla en las propiedades'); }
    } else if (/\/extended-properties$/.test(r.tipo)) {
      const limpio = xml
        .replace(/<HeadingPairs>[\s\S]*?<\/HeadingPairs>/, '')
        .replace(/<TitlesOfParts>[\s\S]*?<\/TitlesOfParts>/, '')
        .replace(/<(Company|Manager|HyperlinkBase)>[^<]+<\/\1>/g, '<$1></$1>');
      if (limpio !== xml) { t.set(ruta, limpio); hecho.push('nombres de hojas que ya no existen'); }
    }
  }

  // 7) Por hoja: impresora guardada y dibujos FUERA del área de impresión.
  const areas = new Map();
  for (const m of wb.matchAll(/<definedName\b([^>]*)>([^<]*)<\/definedName>/g)) {
    if (attr(m[1], 'name') !== '_xlnm.Print_Area') continue;
    const idx = attr(m[1], 'localSheetId');
    if (idx != null) areas.set(+idx, rangosDeArea(m[2]));
  }
  let impresora = false; let fuera = 0;
  hojas.forEach((h) => {
    const rr = rutaRels(h.ruta);
    const rels = relaciones(leer(rr));
    const idsImp = rels.filter((r) => TIPO.impresora.test(r.tipo)).map((r) => r.id);
    if (idsImp.length) {
      t.set(rr, quitarRelaciones(leer(rr), idsImp));
      t.set(h.ruta, t.get(h.ruta).replace(/<pageSetup\b[^>]*?\/?>/g, (tag) => {
        const id = attr(tag, 'r:id');
        return id && idsImp.includes(id) ? tag.replace(new RegExp('\\s+r:id="' + escRegex(id) + '"'), '') : tag;
      }));
      impresora = true;
    }
    const rangos = areas.get(h.idx);
    if (!rangos || !rangos.length) return;
    for (const r of rels.filter((q) => TIPO.dibujo.test(q.tipo))) {
      const ruta = resolver(h.ruta, r.target);
      const xml = leer(ruta);
      if (xml == null) continue;
      let quitadas = 0;
      const nuevo = xml.replace(/<xdr:(twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:\1>/g, (ancla, _tipo, pos, todo) => {
        const previo = todo.slice(0, pos);
        const dentroDeAlternativa = previo.lastIndexOf('<mc:AlternateContent') > previo.lastIndexOf('</mc:AlternateContent>');
        if (dentroDeAlternativa || !anclaFuera(ancla, rangos)) return ancla;
        quitadas++;
        return '';
      });
      if (!quitadas) continue;
      fuera += quitadas;
      t.set(ruta, nuevo);
      const rd = rutaRels(ruta);
      const usados = new Set([...nuevo.matchAll(/\sr:(?:embed|link|id|pict)="([^"]*)"/g)].map((m) => m[1]));
      t.set(rd, quitarRelaciones(leer(rd), relaciones(leer(rd)).filter((q) => !usados.has(q.id)).map((q) => q.id)));
    }
  });
  if (impresora) hecho.push('impresora guardada');
  if (fuera) hecho.push(fuera + ' dibujo(s) fuera del área de impresión');

  // 8) Textos sobrantes: se vacían sin mover los demás (las celdas los llaman
  //    por su número, que así no cambia).
  const relTextos = relaciones(leer(relsLibro)).find((r) => TIPO.textos.test(r.tipo));
  if (relTextos) {
    const ruta = resolver(libro, relTextos.target);
    const xml = leer(ruta);
    if (xml != null) {
      const usados = textosUsados(hojas.map((h) => t.get(h.ruta)));
      let i = 0; let vaciados = 0;
      const nuevo = xml.replace(/<si>[\s\S]*?<\/si>|<si\/>/g, (si) => {
        const k = i++;
        if (usados.has(k) || !/<t\b[^>]*>[^<]*\S[^<]*<\/t>/.test(si)) return si;
        vaciados++;
        return '<si><t></t></si>';
      });
      if (vaciados) { t.set(ruta, nuevo); hecho.push(vaciados + ' texto(s) sobrantes de hojas borradas'); }
    }
  }

  // 9) Piezas a las que ya nada llega: se quitan, y su tipo sale del índice.
  const quitar = partesSueltas(nombres, leer);
  if (quitar.length) {
    const fuera2 = new Set(quitar.map((q) => '/' + q));
    const ct = leer('[Content_Types].xml');
    if (ct != null) {
      t.set('[Content_Types].xml', ct.replace(/<Override\b[^>]*\/>/g, (o) => (fuera2.has(attr(o, 'PartName')) ? '' : o)));
    }
    hecho.push(quitar.length + ' pieza(s) sueltas');
  }

  const escribir = new Map();
  for (const [ruta, xml] of t) {
    if (quitar.includes(ruta)) continue;
    if (antes.get(ruta) !== xml) escribir.set(ruta, xml);
  }
  return { escribir, quitar, hecho };
}

/**
 * Quita los datos ocultos del zip del .xlsx ya armado. Primero lee y planea;
 * solo al final escribe. Si algo falla antes, el zip queda intacto.
 * @param {object} zip  instancia de JSZip
 * @returns {Promise<string[]>} qué se quitó (en palabras)
 */
export async function limpiarOcultos(zip) {
  const nombres = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const textos = new Map();
  for (const n of nombres) {
    if (/\.(xml|rels)$/i.test(n) || n === '[Content_Types].xml') textos.set(n, await zip.file(n).async('string'));
  }
  const plan = planDeLimpieza(nombres, textos);
  for (const [ruta, xml] of plan.escribir) zip.file(ruta, xml);
  for (const ruta of plan.quitar) zip.remove(ruta);
  // Carpetas que quedaron vacías (p. ej. «customXml/», «docMetadata/»).
  const quedan = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  for (const d of Object.keys(zip.files).filter((n) => zip.files[n].dir)) {
    if (!quedan.some((n) => n.startsWith(d))) zip.remove(d);
  }
  return plan.hecho;
}
