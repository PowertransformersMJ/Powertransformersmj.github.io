// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cloud Functions (F32)
// ──────────────────────────────────────────────────────────────
// DESPLIEGUE RECOMENDADO (sin email):
//   cd functions && npm install
//   cd ..
//   firebase deploy --only functions:onMuestraCreate
//
// DESPLIEGUE COMPLETO (con email vía Firebase Extension + Gmail):
//   1. En Firebase Console → Extensions, instala
//      "Trigger Email from Firestore" con:
//      - SMTP URI:  smtps://TU_GMAIL:APP_PASSWORD@smtp.gmail.com:465
//      - From:      TU_GMAIL@gmail.com
//      - Collection: mail
//   2. firebase deploy --only functions:cronAlertasDiarias
//
// Triggers exportados:
//   · onMuestraCreate      — recálculo salud_actual + historial_hi
//                            cuando se escribe en /muestras/{id}.
//   · cronAlertasDiarias   — Pub/Sub schedule diario 07:00 Bogotá.
//                            Crea un doc en /mail que la Extension
//                            envía vía SMTP. No usa APIs externas
//                            (Resend, SendGrid) ni Secret Manager.
// ══════════════════════════════════════════════════════════════

import { initializeApp } from 'firebase-admin/app';
import { getFirestore }   from 'firebase-admin/firestore';
import { getStorage }     from 'firebase-admin/storage';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule }        from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret }       from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';
import { Agent } from 'undici';
import { conReintentosIA, conTimeoutAbortable } from './reintentos.mjs';

// Dispatcher HTTP para la IA con el bodyTimeout/headersTimeout DESACTIVADOS
// (ADR-018). Causa raíz del fallo "Claude API: terminated": el bodyTimeout por
// defecto de undici (~5 min) corta el stream de Claude cuando la extracción de un
// informe denso (Opus + thinking + effort alto) tarda más de 5 min → el SDK
// lanza "terminated". Aquí la respuesta puede tardar lo que necesite; el límite
// real lo ponen el timeout interno por intento (conTimeoutAbortable) + el
// timeoutSeconds (900 s) de la función. Módulo-level → se reusa entre invocaciones.
const IA_DISPATCHER = new Agent({ bodyTimeout: 0, headersTimeout: 0, keepAliveTimeout: 60000 });

// Lógica pura del dominio (módulos sin imports de Firebase SDK).
// La carpeta ./domain/ se sincroniza automáticamente desde
// ../assets/js/domain/ por functions/prepare-deploy.mjs (predeploy hook).
import { snapshotSaludCompleto } from './domain/salud_activos.js';
import { mergeConBaseline } from './domain/umbrales_salud_baseline.js';

// G010: lee la config de umbrales editada por el admin (F18) con
// fallback al baseline si el doc no existe o la lectura falla —
// el flujo de la muestra NUNCA se cae por la config.
async function leerUmbralesActivos(db) {
  try {
    const s = await db.doc('umbrales_salud/global').get();
    return s.exists ? mergeConBaseline(s.data()) : null;
  } catch (e) {
    console.warn('[umbrales_salud] fallback a baseline:', e.message || e);
    return null;
  }
}

// Compute mínimo de alertas críticas para el cron (subconjunto v2).
// Las reglas v1 ricas viven en assets/js/data/alertas.js (browser).
function computarAlertasCriticas(transformadores, ordenes) {
  const out = [];
  const hoy = new Date();
  for (const t of transformadores || []) {
    const s = t.salud_actual || {};
    const especiales = t.estados_especiales || [];
    if (s.hi_final != null && s.hi_final >= 4.5) {
      out.push({ tipo: 'hi_degradado', titulo: `${t.codigo} HI ${s.hi_final.toFixed(2)} (muy_pobre)` });
    }
    if (especiales.includes('propuesta_fur_pendiente')) {
      out.push({ tipo: 'propuesta_fur_pendiente', titulo: `${t.codigo} propuesta FUR pendiente experto` });
    }
    if (s.vida_remanente_pct != null && s.vida_remanente_pct < 10) {
      out.push({ tipo: 'vida_util_remanente_baja', titulo: `${t.codigo} vida útil ${s.vida_remanente_pct.toFixed(0)}%` });
    }
  }
  for (const o of ordenes || []) {
    if ((o.estado === 'planificada' || o.estado_v2 === 'programada') &&
        o.fecha_programada && new Date(o.fecha_programada) < hoy &&
        o.prioridad === 'critica') {
      out.push({ tipo: 'orden_critica_vencida', titulo: `${o.codigo} crítica vencida` });
    }
  }
  return out;
}

initializeApp();
const db = getFirestore();

// ── onMuestraCreate ───────────────────────────────────────────
// Trigger Firestore: cuando se crea una muestra de laboratorio,
// recalcula salud_actual del transformador y añade snapshot al
// historial_hi.
export const onMuestraCreate = onDocumentCreated(
  {
    document: 'muestras/{id}',
    region: 'southamerica-east1',
    // Techo de gasto: no usa IA, pero es un trigger de escritura — una
    // carga masiva de muestras la dispararía N veces en paralelo. 10
    // instancias absorben una importación normal y acotan el peor caso.
    maxInstances: 10
  },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data || !data.transformadorId) return;

    const txRef = db.collection('transformadores').doc(data.transformadorId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return;
    const tx = { id: txSnap.id, ...txSnap.data() };

    // Últimas 10 muestras del transformador para reconstruir snapshot.
    const ms = await db.collection('muestras')
      .where('transformadorId', '==', data.transformadorId)
      .orderBy('fecha_muestra', 'desc')
      .limit(10).get();
    const muestras = ms.docs.map((d) => ({ id: d.id, ...d.data() }));
    const dga  = muestras.find((m) => m.tipo === 'DGA'     || m.tipo === 'COMBO');
    const adfq = muestras.find((m) => m.tipo === 'ADFQ'    || m.tipo === 'COMBO');
    const fur  = muestras.find((m) => m.tipo === 'FURANOS' || m.tipo === 'COMBO');

    const snap = snapshotSaludCompleto({
      transformador: tx,
      muestraDGA: dga, muestraADFQ: adfq, muestraFUR: fur,
      her: tx.salud_actual && tx.salud_actual.ubicacion_fuga_dominante,
      pyt: tx.salud_actual && tx.salud_actual.calif_pyt,
      umbrales: await leerUmbralesActivos(db)   // G010: config F18
    });

    await txRef.update({ salud_actual: snap });
    await txRef.collection('historial_hi').add({
      trigger: 'muestra_nueva',
      muestra_origen_ref: event.params.id,
      ...snap,
      // `snap.ts_calculo` viene del dominio como texto ISO (contrato correcto:
      // el dominio es puro y no conoce Firestore). Pero el cliente escribe ese
      // MISMO campo como Timestamp (transformadores_subcolecciones.js:142) y
      // `listarHistorialHI` ordena por él. Firestore ordena PRIMERO por tipo:
      // mezclar texto y Timestamp deja el historial de salud desordenado, con
      // los dos orígenes en bloques separados en vez de en orden cronológico.
      // Se escribe como Date (el Admin SDK lo guarda como Timestamp) para que
      // ambos productores coincidan en tipo. El texto ISO se conserva íntegro
      // dentro de `salud_actual`, donde el esquema sí lo declara `str`.
      ts_calculo: new Date(),
      createdAt: new Date()
    });
  }
);

// ── cronAlertasDiarias ────────────────────────────────────────
// Schedule diario 07:00 Bogotá. Evalúa alertas críticas no
// reconocidas y delega el envío de email a la Firebase Extension
// "Trigger Email from Firestore" creando un doc en /mail.
//
// Formato de doc /mail esperado por la extension:
//   { to: 'destino@dominio.com',
//     message: { subject: '...', html: '...', text: '...' } }
//
// La extension lee el doc, envía por SMTP, y actualiza el doc con
// el estado del envío (success/error). Nuestro código nunca toca
// credenciales SMTP.
export const cronAlertasDiarias = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'America/Bogota',
    region: 'southamerica-east1',
    // Techo de gasto: corre una vez al día y escribe en /mail. Nunca
    // debería haber dos ejecuciones simultáneas (duplicaría correos),
    // así que 1 es a la vez el tope de costo y una guarda funcional.
    maxInstances: 1
  },
  async () => {
    const cfgSnap = await db.doc('alertas_config/global').get();
    const cfg = cfgSnap.exists ? cfgSnap.data() : {};
    if (!cfg.notificaciones_enabled || !cfg.destinatario_email) {
      console.log('[cronAlertasDiarias] Notificaciones deshabilitadas o sin destinatario.');
      return;
    }

    const [trafosSnap, ordsSnap] = await Promise.all([
      db.collection('transformadores').get(),
      db.collection('ordenes').get()
    ]);
    const trafos = trafosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const ords   = ordsSnap.docs.map((d)   => ({ id: d.id, ...d.data() }));

    const criticas = computarAlertasCriticas(trafos, ords);
    if (criticas.length === 0) {
      console.log('[cronAlertasDiarias] Sin alertas críticas; no se envía email.');
      return;
    }

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f6f8fb;color:#1a2440">
        <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,.05)">
          <h2 style="margin:0 0 8px;color:#3570e8;font-weight:600">SGM · TRANSPOWER</h2>
          <p style="margin:0 0 16px;color:#6a7c98;font-size:14px">Resumen diario de alertas críticas</p>
          <p style="font-size:16px;margin:0 0 16px"><strong style="color:#ff5a6e">${criticas.length}</strong> alerta(s) crítica(s) sin reconocer.</p>
          <ul style="padding-left:20px;line-height:1.7">
            ${criticas.slice(0, 30).map((a) =>
              `<li><code style="background:#eef3fb;padding:2px 6px;border-radius:4px;font-size:13px">${a.tipo}</code> &nbsp; ${a.titulo}</li>`
            ).join('')}
          </ul>
          ${criticas.length > 30 ? `<p style="color:#6a7c98;font-size:13px;margin-top:12px">…y ${criticas.length - 30} más. Revisa todas en <a href="https://powertransformersmj.github.io/pages/alertas.html" style="color:#3570e8">la plataforma</a>.</p>` : ''}
          <hr style="border:none;border-top:1px solid #e4e9f2;margin:20px 0">
          <p style="color:#6a7c98;font-size:12px;margin:0">
            MO.00418.DE-GAC-AX.01 Ed. 02 · CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM
          </p>
        </div>
      </div>`;

    const textFallback = `SGM · TRANSPOWER — ${criticas.length} alerta(s) crítica(s) sin reconocer.\n\n` +
      criticas.slice(0, 30).map((a) => `- [${a.tipo}] ${a.titulo}`).join('\n') +
      (criticas.length > 30 ? `\n\n…y ${criticas.length - 30} más. Revisa todas en la plataforma.` : '');

    // Delega el envío a la Firebase Extension "Trigger Email".
    await db.collection('mail').add({
      to: cfg.destinatario_email,
      message: {
        subject: `[SGM] ${criticas.length} alerta(s) crítica(s)`,
        html,
        text: textFallback
      }
    });

    await db.doc('alertas_config/global').update({
      ultima_notificacion_ts: new Date(),
      ultima_notificacion_count: criticas.length
    });

    console.log('[cronAlertasDiarias] Email encolado en /mail:', criticas.length, 'alertas.');
  }
);

// ══════════════════════════════════════════════════════════════
// extraerPruebasElectricasIA — extracción de informes con Claude
// ──────────────────────────────────────────────────────────────
// onCall (HTTPS Callable) que lee un PDF de pruebas eléctricas desde
// Firebase Storage, lo envía a Claude como DOCUMENTO NATIVO (la IA ve
// tablas, layout y escaneos) y fuerza una herramienta de extracción que
// devuelve las mediciones en la MISMA forma que consume
// domain/pruebas_electricas_schema.js → sanitizarInforme(). El cliente
// (pruebas-electricas-shell.js) sigue sanitizando y persistiendo igual:
// esta función solo reemplaza al extractor regex cuando hay saldo/IA.
//
// Modelos en cascada (el cliente elige; aquí se valida contra allowlist):
//   · claude-sonnet-4-6  (por defecto — extracción + visión, mejor $/calidad)
//   · claude-opus-4-7    (escalación — PDFs ambiguos)
//   · claude-haiku-4-5   (barato — informes simples)
//
// Secreto: LLM_API_KEY (Anthropic). Configurar antes de desplegar:
//   firebase functions:secrets:set LLM_API_KEY
//   firebase deploy --only functions:extraerPruebasElectricasIA
// ══════════════════════════════════════════════════════════════

const LLM_API_KEY = defineSecret('LLM_API_KEY');

const MODELOS_IA = new Set(['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5']);
const MODELO_IA_DEFAULT = 'claude-sonnet-4-6';

// Prefijo estable (system) → se cachea con cache_control. Es la pericia
// de dominio que hace la extracción AGNÓSTICA al formato del PDF.
const SYSTEM_PRUEBAS_IA = `Eres un ingeniero experto en pruebas eléctricas de transformadores de potencia. Tu tarea es leer un informe de laboratorio en PDF (de CUALQUIER laboratorio, formato, idioma o diseño: tablas, texto corrido o escaneo) y extraer sus mediciones de forma estructurada, llamando SIEMPRE a la herramienta "registrar_pruebas_electricas".

REGLAS INVIOLABLES:
1. NO inventes datos. Si una prueba o un valor no aparece en el PDF, deja su arreglo vacío u omite ese campo. Es preferible un campo vacío a un valor equivocado.
2. Transcribe los números TAL CUAL aparecen (convierte coma decimal a punto). No redondees ni "corrijas".
3. NO calcules la calificación/semáforo: el sistema lo deriva de los valores. Solo extrae los números crudos.
4. Mapea sinónimos y variantes de cada laboratorio a la nomenclatura canónica de abajo.
5. EXHAUSTIVIDAD: recorre TODO el documento, página por página, hasta el final. Extrae TODAS las familias de prueba que aparezcan — NO te detengas tras la primera (p.ej. factor de potencia). Cada prueba que el informe liste en su índice o realice DEBE quedar registrada. La identidad/placa suele estar en las primeras páginas.
6. DATOS POR POSICIÓN DE TAP/CONMUTADOR: muchos informes reportan excitación, relación y/o resistencia de devanados para VARIAS posiciones de TAP (p.ej. 17 filas, una por posición del conmutador). NUNCA dejes esas pruebas vacías por eso: elige la posición REPRESENTATIVA — la nominal si se indica, o la de PEOR caso (mayor desviación/desbalance) — y reporta sus fases A/B/C con esos valores + la desviación o desbalance MÁXIMO de toda la prueba. Es preferible el peor caso que dejarlo en blanco. Lo mismo para informes con varios devanados (AT/MT/BT): rellena cada uno.

DEVANADOS: AT (alta tensión / H / primario), MT (media / X / secundario), BT (baja / Y / terciario). Fases A/B/C (o U/V/W, R/S/T, H1/H2/H3). TAP = posición del conmutador.

LAS 7 FAMILIAS DE PRUEBA Y SUS UNIDADES:

1) TANGENTE DELTA (factor de potencia / tan δ / FP / power factor) — en %, POR SECCIÓN de aislamiento (no por fase). Códigos canónicos:
   · CH  = AT ↔ tierra        · CHL = AT ↔ MT
   · CL  = MT ↔ tierra        · CLT = MT ↔ BT
   · CT  = BT ↔ tierra        · CHT = AT ↔ BT
   (UST/GST/GSTg son modos de medición; mapea a la sección que corresponda.)

2) CORRIENTE DE EXCITACIÓN (excitation current / corriente de magnetización) — por fase A/B/C del devanado AT, en mA, con TAP. Reporta cada fase y, si está, el desbalance Δ% entre las dos fases mayores (delta_ext_pct).

3) RELACIÓN DE TRANSFORMACIÓN (TTR / turns ratio / relación) — filas por par de devanados. Cada fila trae 3 fases o un valor global. Reporta la desviación % respecto a la nominal/placa (desviacion_pct) si aparece.

4) RESISTENCIA DE DEVANADOS (winding resistance / resistencia óhmica) — filas AT/MT/BT, fases en mΩ (o Ω/µΩ: indica la unidad). Reporta el desbalance máximo entre fases (delta_max_pct) si aparece. Marca verificar=true si el informe señala el dato como dudoso, y no_medido=true si declara que no se midió.

5) RESISTENCIA DE AISLAMIENTO (insulation resistance / Megger / IR) — por par de devanados o a tierra, en GΩ (convierte MΩ→GΩ: 1000 MΩ = 1 GΩ). asociado = "Tierra"/"MT"/"BT".

6) COLLAR CALIENTE / BUJES (hot collar / bushing power factor) — pérdida en mW. Reporta el máximo (max_mw) y el detalle por buje (etiqueta H0/X1/Y3…, fase, devanado, corriente i_ua en µA, pérdida mw en mW).

7) DRM / RESISTENCIA DINÁMICA DEL CONMUTADOR (OLTC / dynamic resistance) — identidad del conmutador (fabricante, tipo, serial, posiciones, operaciones, posición nominal, datos eléctricos) y la ventana de tiempos de transición en ms (tiempo_min_ms / tiempo_max_ms) + detalle por transición si está. Si solo hay un rango resumido, deja transiciones vacío.

METADATOS DEL INFORME: ano (año de la prueba, de la fecha del informe), fecha (texto tal cual), ejecutante (laboratorio/empresa que ejecutó), equipo (instrumento usado, p. ej. "DOBLE M4100"), serie_en_pdf (número de serie del transformador que aparezca en el PDF), tipo_prueba (déjalo vacío salvo que el informe lo declare; el sistema lo infiere).

IDENTIDAD DE LA UNIDAD (objeto "unidad"): lee la PLACA DE CARACTERÍSTICAS / tabla "Características principales" del transformador y extrae sus datos. fabricante (ej. "SIEMENS"), ano_fabricacion (año de fabricación de la placa, NO el de la prueba — ej. 2006), potencia (texto tal cual con unidad, ej. "5000 / 6000 kVA"), tensiones (primaria/secundaria/terciaria, ej. "34.5 / 13.8 kV"), grupo_conexion (ej. "Dyn5"), refrigeracion (ej. "ONAN / ONAF"), frecuencia (ej. "60 Hz"), fases (ej. "3" o "3φ"), cliente (ej. "Afinia Grupo EPM"), ubicacion (sitio/municipio), subestacion (nombre de la S/E). Si la placa no aparece o un campo falta, déjalo vacío — no inventes.

BLOQUES GRÁFICOS (arreglo "bloques") — representación FLEXIBLE para el tablero: además de los campos canónicos de arriba (que alimentan la matriz normativa), construye un "bloque" por cada prueba graficable del informe. Cada bloque es una visualización autocontenida: titulo, unidad del eje Y, eje_x, tipo de grafica (linea para evolución por TAP/buje; barra para comparativas), una o más series (p.ej. una por fase) con TODOS sus puntos (x = posición de TAP o etiqueta; y = valor) y su tabla de detalle. A diferencia de los campos canónicos (que piden la posición representativa/peor caso), aquí SÍ incluye la curva COMPLETA — todas las posiciones de TAP, todos los bujes — porque el tablero las grafica.

DETALLE COMPLETO POR FILA — REGLA CRÍTICA: la serie grafica UNA magnitud por fase, pero el informe trae MÁS columnas por fila que el lector necesita ver. NUNCA pierdas esas columnas. Según el tipo de bloque van por DOS vías (detalladas abajo): curvas por TAP → campo "extra" por punto; barras con tabla propia → campo "tabla". Columnas que trae cada prueba (captúralas TODAS cuando el informe las tenga):
   · EXCITACIÓN: Posición TAP · I salida (mA) por fase A/B/C · Potencia (W) por fase A/B/C.
   · RELACIÓN: Posición TAP · Tensión aplicada MT1 (V) · MT2 (V) · Relación teórica · valor medido Fase A/B/C · %DIF por fase.
   · RESISTENCIA DE DEVANADOS: Posición TAP · Conexión · R.Medida (Ω/mΩ) por fase · R.Referencia corregida a temperatura por fase (incluye también las filas de MT y BT sin tomas si están).
   · TAN δ / FACTOR DE POTENCIA: Sección · Capacitancia (pF) · Tan δ % a cada tensión de prueba (2 kV, 10 kV…) · Modo.
   · BUJES: Buje · Fase · Cap. placa · Cap. medida · Tan δ placa · Tan δ medida.
   · AISLAMIENTO: Configuración · Tensión · Tiempo · Aislamiento (GΩ) · DAR · (IP si está).
NO incluyas columna de "Evaluación"/"Calificación"/"OK" (ni en "tabla" ni en "extra"): el VEREDICTO lo deriva el sistema de los VALORES contra cada NORMA (multi-norma) — un "OK" por fila de la IA estaría fuera de criterio. Solo datos medidos crudos. No resumas ni descartes columnas de DATOS. Transcribe los valores tal cual (coma decimal → punto).
CANAL "extra" POR PUNTO (curvas por TAP — excitación, relación, resistencia) — LA FORMA CORRECTA Y OBLIGATORIA de no perder columnas: para estas pruebas pones la magnitud graficada en series[].puntos[] ({x:TAP, y:valor}); PERO el informe trae MÁS columnas por fila (Potencia W, tensión aplicada, relación teórica, %DIF, R.Referencia…). NO las metas en "tabla" (estructura aparte que tiende a quedar incompleta): adjúntalas INLINE a CADA punto en su campo "extra" = mapa {etiqueta: número}, justo donde ya lees el valor. El tablero arma la tabla completa por TAP a partir de las series + esos "extra" (deriva la columna Desviación %; el VEREDICTO lo da el sistema por norma, NO la IA). Ejemplos por punto:
   · EXCITACIÓN (serie por fase, y = I en mA): cada punto → "extra": {"P (W)": 156.367}. La corriente de excitación SIEMPRE trae Potencia (W) por fase en el informe → es OBLIGATORIO el "extra" con "P (W)". Ejemplo LITERAL de la serie Fase A (replica para TODOS los TAP y las 3 fases con sus valores reales):
     "series": [ { "nombre": "Fase A", "puntos": [ {"x":1,"y":17.964,"extra":{"P (W)":156.367}}, {"x":2,"y":18.356,"extra":{"P (W)":158.378}}, {"x":3,"y":18.78,"extra":{"P (W)":160.738}} ] } ]
     (La Desviación % la deriva el tablero y el veredicto sale de las normas — NO pongas Desviación ni Evaluación.)
   · RELACIÓN (serie por fase, y = relación medida): cada punto → "extra": {"Tensión (V)": 121000, "Relación teórica": 3.5072, "%DIF": -0.14}.
   · RESISTENCIA DE DEVANADOS (serie por fase, y = R medida): cada punto → "extra": {"R.Ref (Ω)": 2.06}.
EL ERROR MÁS GRAVE Y FRECUENTE es emitir los puntos como {x,y} SIN "extra" cuando el informe SÍ trae esa columna por fila — eso PIERDE datos y deja la tabla incompleta. Si la fila del informe tiene Potencia/tensión/R.Ref, el punto DEBE llevar "extra". Incluye "extra" en TODAS las posiciones de TAP, no solo la primera. Para pruebas de BARRA con tabla propia en el informe (tan δ por sección, bujes, aislamiento) SÍ usa el campo "tabla" con TODAS sus columnas tal cual. Añade limite/guia (líneas normativas) e invertir=true cuando el límite es un MÍNIMO (ej. aislamiento ≥ 1 GΩ). Si el informe señala un valor puntual como dudoso o "a verificar", marca ese punto con verificar=true: el tablero lo dibuja RAYADO. Este arreglo es ADICIONAL y no debe reducir la exhaustividad de los campos canónicos. Crea bloques también para pruebas SIN campo canónico arriba (DGA, SFRA, capacitancia, DAR/PI, etc.). Si una prueba no tiene datos numéricos graficables, no le hagas bloque.

REGLAS ADICIONALES POR BLOQUE (interpretación profunda — la razón de usar IA):
- DESBALANCE ENTRE FASES: en las curvas multi-fase por TAP (excitación, relación, resistencia de devanados) incluye "limite_desbalance" = el criterio normativo de desbalance MÁXIMO entre fases en %, para que el tablero grafique la desviación contra su límite: relación de transformación 0.5 (±0.5%), resistencia de devanados 5 (≤5%), corriente de excitación 10 (Δ<10% si I<50 mA, 5 si I≥50 mA). Omítelo si no aplica.
- AISLAMIENTO — ÍNDICE DE POLARIZACIÓN (IP/PI): si el ensayo de aislamiento (Megger) trae lecturas a 30 s, 1 min y 10 min, además de la serie "Aislamiento" (1 min, GΩ) y "DAR" (R1min/R30s) AÑADE una serie "IP" (índice de polarización = R10min/R1min) por configuración. Criterio IP: <1 peligro, 1–1.5 regular, 1.5–2 precaución, >2 bueno (mayor es mejor → invertir=true). Reporta el IP REAL del informe; si solo hay DAR y no la lectura de 10 min, no inventes IP.
- ANÁLISIS CRÍTICO OBLIGATORIO: TODO bloque DEBE traer "observaciones" con un concepto de ingeniería que EVALÚE los resultados (no que los repita): ¿están dentro de norma?, ¿hay anomalía, asimetría o tendencia?, comparación con placa o con el patrón esperado (p.ej. excitación: fase central menor que las externas; resistencia: forma en V centrada en el TAP nominal), y la conclusión diagnóstica (satisfactorio / a vigilar / investigar). Cita la norma aplicable. Es el valor agregado de la IA sobre el informe crudo.

AUTO-CHEQUEO DE COMPLETITUD (universal — hazlo ANTES de emitir el JSON): por CADA prueba que el informe presente como tabla, vuelve a mirar TODAS las columnas de esa tabla en el PDF y confirma que cada columna quedó capturada en el bloque: la magnitud que grafiques va en series[].puntos[].y; CUALQUIER otra columna por fila (Potencia, tensión aplicada, relación teórica, %DIF, R.Referencia, modo, evaluación, etc.) va en el "extra" de ese mismo punto (curvas por TAP) o en una celda de "tabla" (barras). Regla de oro: si una columna del informe NO terminó ni en series, ni en extra, ni en tabla, la PERDISTE → agrégala. Tienes libertad TOTAL para organizar, titular y graficar cada informe a tu criterio (el tablero es dinámico y se adapta a lo que emitas); la ÚNICA restricción es no perder datos del informe.`;

// Fase individual con terminal real — se inlinea en cada prueba que la usa.
const FASE_SCHEMA = {
  type: 'object',
  properties: {
    fase: { type: ['string', 'null'], description: 'A / B / C.' },
    valor: { type: ['number', 'null'] },
    term: { type: ['string', 'null'], description: 'Terminal(es), ej. "H1–PN", "r–s".' },
    verificar: { type: ['boolean', 'null'], description: 'Dato a confirmar.' }
  }
};

const HERRAMIENTA_PRUEBAS = {
  name: 'registrar_pruebas_electricas',
  description: 'Registra las mediciones extraídas de un informe de pruebas eléctricas de un transformador de potencia. Llama a esta herramienta exactamente una vez con todo lo que hayas podido leer del PDF.',
  input_schema: {
    type: 'object',
    properties: {
      ano: { type: ['integer', 'null'], description: 'Año de la prueba (de la fecha del informe).' },
      fecha: { type: ['string', 'null'], description: 'Fecha del informe, texto tal cual (ej. "23/08/2012").' },
      ejecutante: { type: ['string', 'null'], description: 'Laboratorio/empresa que ejecutó (ej. "Applus").' },
      equipo: { type: ['string', 'null'], description: 'Instrumento usado (ej. "DOBLE M4100").' },
      serie_en_pdf: { type: ['string', 'null'], description: 'Número de serie del transformador hallado en el PDF.' },
      tipo_prueba: { type: ['string', 'null'], enum: ['predictivo_completo', 'tan_delta', 'drm_oltc', 'resistencia_devanados', 'ttr', 'mixto', null], description: 'Solo si el informe lo declara explícitamente; si no, null (el sistema lo infiere).' },
      unidad: {
        type: 'object',
        description: 'Identidad del transformador, leída de la PLACA DE CARACTERÍSTICAS / tabla "Características principales". Deja vacío lo que no aparezca; no inventes.',
        properties: {
          fabricante:     { type: ['string', 'null'], description: 'Ej. "SIEMENS".' },
          ano_fabricacion:{ type: ['integer', 'null'], description: 'Año de fabricación de la placa (NO el de la prueba).' },
          potencia:       { type: ['string', 'null'], description: 'Ej. "5000 / 6000 kVA".' },
          tensiones:      { type: ['string', 'null'], description: 'Ej. "34.5 / 13.8 kV".' },
          grupo_conexion: { type: ['string', 'null'], description: 'Ej. "Dyn5".' },
          refrigeracion:  { type: ['string', 'null'], description: 'Ej. "ONAN / ONAF".' },
          frecuencia:     { type: ['string', 'null'], description: 'Ej. "60 Hz".' },
          fases:          { type: ['string', 'null'], description: 'Ej. "3".' },
          cliente:        { type: ['string', 'null'], description: 'Ej. "Afinia Grupo EPM".' },
          ubicacion:      { type: ['string', 'null'], description: 'Sitio / municipio.' },
          subestacion:    { type: ['string', 'null'], description: 'Nombre de la subestación.' }
        }
      },
      tand: {
        type: 'array', description: 'Tangente δ por sección de aislamiento, en %.',
        items: {
          type: 'object',
          properties: {
            code: { type: 'string', enum: ['CH', 'CHL', 'CL', 'CLT', 'CT', 'CHT'], description: 'Sección de aislamiento.' },
            entre: { type: ['string', 'null'], description: 'Aislamiento entre (ej. "AT ↔ tierra").' },
            valor_pct: { type: ['number', 'null'], description: 'Valor en %.' }
          },
          required: ['code']
        }
      },
      excitacion: {
        type: 'object', description: 'Corriente de excitación por fase del devanado AT, en mA.',
        properties: {
          devanado: { type: ['string', 'null'] },
          ref: { type: ['string', 'null'], description: 'Referencia (ej. "N (H0)").' },
          tap: { type: ['string', 'null'] },
          delta_ext_pct: { type: ['number', 'null'], description: 'Desbalance % entre las 2 fases mayores.' },
          fases: { type: 'array', items: FASE_SCHEMA }
        }
      },
      relacion: {
        type: 'array', description: 'Relación de transformación (TTR), filas por par de devanados.',
        items: {
          type: 'object',
          properties: {
            devanado: { type: ['string', 'null'] },
            asociado: { type: ['string', 'null'], description: 'Devanado asociado (ej. "MT", "BT (Terc.)").' },
            tap: { type: ['string', 'null'] },
            global: { type: ['number', 'null'], description: 'Valor global si no hay 3 fases.' },
            global_term: { type: ['string', 'null'] },
            desviacion_pct: { type: ['number', 'null'], description: 'Desviación % respecto a placa.' },
            fases: { type: 'array', items: FASE_SCHEMA }
          }
        }
      },
      resistencia: {
        type: 'array', description: 'Resistencia de devanados, filas AT/MT/BT en mΩ.',
        items: {
          type: 'object',
          properties: {
            ano_tap: { type: ['string', 'null'] },
            devanado: { type: ['string', 'null'] },
            conexion: { type: ['string', 'null'], description: 'Ej. "fase–N", "fase–fase (Δ)".' },
            unidad: { type: ['string', 'null'], description: 'mΩ / Ω / µΩ.' },
            delta_max_pct: { type: ['number', 'null'], description: 'Desbalance máximo entre fases, %.' },
            verificar: { type: ['boolean', 'null'] },
            no_medido: { type: ['boolean', 'null'] },
            fases: { type: 'array', items: FASE_SCHEMA }
          }
        }
      },
      aislamiento: {
        type: 'array', description: 'Resistencia de aislamiento (CC), en GΩ.',
        items: {
          type: 'object',
          properties: {
            devanado: { type: ['string', 'null'] },
            asociado: { type: ['string', 'null'], description: 'Ej. "Tierra", "MT", "BT".' },
            gohm: { type: ['number', 'null'], description: 'Valor en GΩ (convierte MΩ→GΩ).' }
          }
        }
      },
      collar: {
        type: 'object', description: 'Collar caliente / bujes, pérdida en mW.',
        properties: {
          max_mw: { type: ['number', 'null'], description: 'Pérdida máxima del año, en mW.' },
          bujes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                buje: { type: ['string', 'null'], description: 'Etiqueta (ej. "H0", "X1").' },
                fase: { type: ['string', 'null'] },
                fase_label: { type: ['string', 'null'] },
                devanado: { type: ['string', 'null'] },
                i_ua: { type: ['number', 'null'], description: 'Corriente de salida en µA.' },
                mw: { type: ['number', 'null'], description: 'Pérdida en mW.' }
              }
            }
          }
        }
      },
      drm: {
        type: 'object', description: 'DRM / resistencia dinámica del conmutador (OLTC).',
        properties: {
          conmutador: {
            type: 'object',
            properties: {
              fabricante: { type: ['string', 'null'] },
              tipo: { type: ['string', 'null'] },
              serial: { type: ['string', 'null'] },
              posiciones: { type: ['integer', 'null'] },
              operaciones: { type: ['integer', 'null'] },
              pos_nominal: { type: ['integer', 'null'] },
              tension_ui_v: { type: ['number', 'null'] },
              corriente_iu_a: { type: ['number', 'null'] },
              r_conmutacion_ohm: { type: ['number', 'null'] }
            }
          },
          tiempo_min_ms: { type: ['number', 'null'] },
          tiempo_max_ms: { type: ['number', 'null'] },
          transiciones: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                posicion: { type: ['string', 'null'], description: 'Ej. "10→11".' },
                fase: { type: ['string', 'null'] },
                tiempo_ms: { type: ['number', 'null'] },
                sentido: { type: ['string', 'null'], description: '"subir" / "bajar".' }
              }
            }
          }
        }
      },
      bloques: {
        type: 'array',
        description: 'Representación FLEXIBLE y COMPLETA para graficar (ADR-006). Complementa — NO reemplaza — los campos canónicos de arriba: aquí va el detalle GRÁFICO íntegro de cada prueba (TODAS las posiciones de TAP, TODOS los bujes, etc.), incluso pruebas sin campo canónico (DGA, SFRA, etc.). Un bloque = una visualización (una prueba). Omite este arreglo si el informe no tiene series graficables.',
        items: {
          type: 'object',
          properties: {
            prueba: { type: ['string', 'null'], description: 'Clave de familia (ej. "excitacion", "bushing", "relacion").' },
            titulo: { type: 'string', description: 'Título visible del bloque (obligatorio).' },
            unidad: { type: ['string', 'null'], description: 'Unidad del eje Y, ej. "mA" | "GΩ" | "pF" | "%".' },
            eje_x: { type: ['string', 'null'], description: 'Etiqueta del eje X, ej. "Posición del TAP" | "Buje".' },
            grafica: { type: ['string', 'null'], enum: ['linea', 'barra', 'dispersion', null], description: 'Tipo de gráfica (línea para curvas por TAP; barra para comparativas).' },
            series: {
              type: 'array',
              description: 'Una serie por curva/grupo (ej. una por fase A/B/C).',
              items: {
                type: 'object',
                properties: {
                  nombre: { type: ['string', 'null'], description: 'Ej. "Fase A".' },
                  color: { type: ['string', 'null'], description: 'Opcional; el render asigna paleta si falta.' },
                  puntos: {
                    type: 'array',
                    description: 'Puntos (x,y). x puede ser número (TAP) o etiqueta (par de devanados).',
                    items: {
                      type: 'object',
                      properties: {
                        x: { type: ['number', 'string', 'null'] },
                        y: { type: ['number', 'null'] },
                        verificar: { type: ['boolean', 'null'], description: 'true si el informe marca ese valor como dudoso / a confirmar (se grafica rayado).' },
                        extra: {
                          type: ['object', 'null'],
                          additionalProperties: { type: ['number', 'string', 'null'] },
                          description: 'Valores SECUNDARIOS del informe para ESTE punto/fila que NO se grafican pero SÍ van a la tabla de detalle: mapa {etiqueta: número}. Ej. excitación {"P (W)": 156.367}; relación {"Tensión (V)": 121000, "Relación teórica": 3.5072, "%DIF": -0.14}; resistencia {"R.Ref (Ω)": 2.06}. Inclúyelo SIEMPRE que el informe traiga columnas extra por fila — es la forma de que la tabla del tablero quede COMPLETA sin perder esos datos.'
                        }
                      }
                    }
                  }
                }
              }
            },
            tabla: {
              type: 'object',
              description: 'Tabla de detalle COMPLETA del bloque, TAL CUAL el informe: TODAS las columnas por fila, no solo el valor graficado. Ej. excitación: TAP + I(mA) por fase + Potencia(W) por fase + Desviación% + Evaluación. Relación: TAP + tensión aplicada + relación teórica + medido por fase + %DIF por fase + Evaluación. Resistencia: TAP + R.Medida + R.Referencia(corregida) por fase + Desviación + Evaluación. Obligatoria siempre que el informe traiga una tabla para esa prueba.',
              properties: {
                columnas: { type: 'array', items: { type: ['string', 'null'] } },
                filas: { type: 'array', items: { type: 'array', items: { type: ['string', 'number', 'null'] } } }
              }
            },
            limite: { type: ['number', 'null'], description: 'Línea roja: límite normativo del valor.' },
            guia: { type: ['number', 'null'], description: 'Línea ámbar: valor guía.' },
            limite_desbalance: { type: ['number', 'null'], description: 'Criterio de desbalance MÁXIMO entre fases en % (curvas por TAP): relación 0.5, resistencia 5, excitación 10. El tablero grafica la desviación entre fases vs este límite.' },
            invertir: { type: ['boolean', 'null'], description: 'true si el límite es MÍNIMO (ej. aislamiento ≥ 1 GΩ, IP mayor es mejor).' },
            calif: { type: ['string', 'null'], description: 'Calificación global del bloque.' },
            observaciones: { type: ['string', 'null'], description: 'Narrativa del laboratorio (para callout).' }
          },
          required: ['titulo']
        }
      }
    },
    required: []
  }
};

// G007 (ADR-052 Ola 1): las callables de IA cuestan dinero real (API Anthropic).
// Exigir que el llamador sea un miembro ACTIVO (perfil activo, o bootstrap /admins
// sin perfil desactivado) — no solo autenticado. Así una cuenta desactivada o
// cualquier sesión sin rol no puede invocar la IA en bucle y quemar el saldo.
async function exigirMiembroActivo(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Requiere sesión iniciada.');
  const db = getFirestore();
  const [perfilSnap, adminSnap] = await Promise.all([
    db.doc(`usuarios/${uid}`).get(),
    db.doc(`admins/${uid}`).get(),
  ]);
  const perfilActivo = perfilSnap.exists && perfilSnap.data() && perfilSnap.data().activo === true;
  const bootstrap = adminSnap.exists && (!perfilSnap.exists || (perfilSnap.data() && perfilSnap.data().activo === true));
  if (!perfilActivo && !bootstrap) {
    throw new HttpsError('permission-denied', 'Requiere un perfil de equipo activo.');
  }
}

export const extraerPruebasElectricasIA = onCall(
  {
    region: 'southamerica-east1',
    secrets: [LLM_API_KEY],
    // 25 min (ADR-019): a MÁXIMA CALIDAD (effort:high, decisión del director) un
    // escaneo denso (EMS 450108) supera los 12–13 min → con 900 s daba 504 +
    // deadline-exceeded. Gen2 admite 3600 s. El cliente espera lo mismo (1500 s).
    // El presupuesto interno (deadlineMs + ATTEMPT_MS) lo acota MUY por debajo.
    timeoutSeconds: 1500,
    // 1 GiB (gen2 acopla más CPU → base64 + visión más rápidos) y margen para
    // el PDF base64 (~5 MB) + el stream de la respuesta.
    // 2 GiB (gen2 acopla más CPU → base64 + visión + thinking más rápidos y con
    // margen anti-OOM; un OOM-kill tampoco corre catch → dejaría el estado colgado).
    memory: '2GiB',
    // TECHO DE GASTO. Ésta es la única función que factura de verdad:
    // 2 GiB durante hasta 25 min por invocación, más el consumo del
    // proveedor de IA. Sin `maxInstances` Cloud Run puede escalar a
    // cientos de instancias en paralelo (un bucle de reintentos, varios
    // PDFs soltados a la vez o un abuso bastan) y el costo es
    // instancias × 25 min × 2 GiB, sin freno.
    // 3 es deliberadamente conservador: el flujo real es un ingeniero
    // subiendo informes de uno en uno, así que 3 extracciones simultáneas
    // ya son holgura; la cuarta ESPERA en cola, no falla. Si algún día el
    // equipo carga en lote y la espera molesta, se sube con criterio —
    // pero se sube a un número, nunca a "sin límite".
    maxInstances: 3
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Requiere sesión iniciada.');
    }
    await exigirMiembroActivo(request);
    const { storagePath, filename, modelId } = request.data || {};
    if (!storagePath || typeof storagePath !== 'string') {
      throw new HttpsError('invalid-argument', 'Falta storagePath del PDF.');
    }
    // G008 (ADR-052 Ola 1): confinar el túnel admin-SDK a PDFs de pruebas.
    // Sin esto la función podía leer CUALQUIER objeto del bucket (bypass de rules).
    if (!storagePath.startsWith('pruebas_electricas/') || !/\.pdf$/i.test(storagePath)) {
      throw new HttpsError('invalid-argument', 'storagePath inválido: debe ser un PDF bajo pruebas_electricas/.');
    }
    const model = MODELOS_IA.has(modelId) ? modelId : MODELO_IA_DEFAULT;

    // 1) Descargar el PDF nativo desde Storage (server-side: sin límite
    //    de payload del callable; el PDF ya fue subido por el cliente).
    let pdfBase64;
    try {
      const [buf] = await getStorage().bucket().file(storagePath).download();
      pdfBase64 = buf.toString('base64');
    } catch (e) {
      throw new HttpsError('not-found', `No se pudo leer el PDF en Storage: ${e.message}`);
    }

    // 2) Claude: PDF nativo + prompt caching del system.
    //    CLAVE (completitud): tool_choice 'auto' + adaptive thinking permiten
    //    que el modelo RAZONE recorriendo las 22 páginas antes de emitir el
    //    JSON. Con la herramienta FORZADA, el thinking se desactiva y el
    //    modelo se "conforma" extrayendo solo lo más visible (tan δ) → por eso
    //    fallaba en informes densos. Streaming evita que outputs largos corten.
    // maxRetries: 0 → el reintento lo gobierna conReintentosIA (presupuesto de
    // tiempo + "no tool block" = transitorio), no el backoff opaco del SDK.
    // fetchOptions.dispatcher → sin bodyTimeout (ADR-018): el stream largo de la
    // extracción densa no se corta a los 5 min ("terminated"). timeout del SDK a
    // 14 min (≥ ATTEMPT_MS) para que tampoco aborte antes que nuestro control.
    const client = new Anthropic({
      apiKey: LLM_API_KEY.value(),
      maxRetries: 0,
      timeout: 1440000, // ≥ ATTEMPT_MS (22 min); nuestro control aborta antes
      fetchOptions: { dispatcher: IA_DISPATCHER }
    });
    const userMsg =
      `Analiza este informe de pruebas eléctricas COMPLETO, página por página, de ` +
      `principio a fin (archivo: ${filename || 'informe.pdf'}). Un informe típico trae VARIAS ` +
      `pruebas (factor de potencia/tan δ, corriente de excitación, relación de transformación, ` +
      `resistencia de devanados, resistencia de aislamiento, collar/bushing, y a veces DRM). ` +
      `Extrae TODAS las que aparezcan — NO te detengas tras la primera. Para pruebas con muchas ` +
      `posiciones de TAP/conmutador, usa la posición representativa o de PEOR caso. Lee también la ` +
      `placa de características para la identidad. Solo deja vacía una prueba si REALMENTE no está ` +
      `en el documento. Cuando termines de analizarlo todo, llama UNA vez a la herramienta ` +
      `registrar_pruebas_electricas con TODO lo extraído.`;
    const params = {
      model,
      max_tokens: 32000,
      system: [
        { type: 'text', text: SYSTEM_PRUEBAS_IA, cache_control: { type: 'ephemeral' } }
      ],
      tools: [HERRAMIENTA_PRUEBAS],
      tool_choice: { type: 'auto' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: userMsg }
          ]
        }
      ]
    };
    // Thinking + effort solo en modelos que lo soportan (Opus 4.7 / Sonnet 4.6).
    if (model === 'claude-opus-4-7' || model === 'claude-sonnet-4-6') {
      params.thinking = { type: 'adaptive' };
      params.output_config = { effort: 'high' };
    }
    // Reintento con backoff (TODO-09) + TIMEOUT INTERNO POR INTENTO (ADR-017):
    // un fallo TRANSITORIO (429/500/529 overloaded, corte de stream) o que el
    // modelo NO llame la herramienta es un hipo de la IA → se reintenta. PERO el
    // peor caso es que el stream se CUELGUE (ni responde ni falla): sin timeout
    // interno el `await` no retorna nunca → la plataforma mata la función a los
    // 900 s → ningún catch corre → el reproceso queda 'en_curso' para siempre
    // (causa raíz del "no se aprecia si terminó"). `conTimeoutAbortable` aborta
    // el stream colgado a los ATTEMPT_MS → se vuelve un error transitorio →
    // reintenta o cae a 'error' limpio. Un stream no se reusa: cada intento abre
    // uno NUEVO. Presupuesto total acotado MUY por debajo de los 900 s.
    // ATTEMPT_MS generoso (22 min): a máxima calidad un escaneo denso puede
    // necesitarlo (ADR-019). Patrón "un intento largo + reintento SOLO si falla
    // rápido": `intentoMaxMs` evita el bug que arrancaba un 2.º intento sin sitio
    // (corría hasta el SIGKILL → 504). Si el 1.º se aborta por timeout, ya no hay
    // presupuesto para otro intento ENTERO → 'error' limpio; si falla rápido, reintenta.
    const ATTEMPT_MS = 1320000;
    const inicioIA = Date.now();
    let message;
    try {
      message = await conReintentosIA(() => conTimeoutAbortable(async (signal) => {
        const stream = client.messages.stream(params, { signal });
        const msg = await stream.finalMessage();
        const tiene = (msg.content || []).some(
          (b) => b.type === 'tool_use' && b.name === 'registrar_pruebas_electricas'
        );
        // Sin tool_use: el modelo se "conformó" (hipo transitorio, L-26) →
        // marcar 529 para que el reintento lo absorba en vez de fallar duro.
        if (!tiene) { const err = new Error('La IA no devolvió datos estructurados.'); err.status = 529; throw err; }
        return msg;
      }, ATTEMPT_MS), {
        intentos: 2,
        baseMs: 1500,
        intentoMaxMs: ATTEMPT_MS, // no reintentar sin sitio para un intento ENTERO (ADR-019)
        deadlineMs: inicioIA + 1440000, // 1 intento largo + retry-solo-si-falla-rápido < 1500 s
        onReintento: ({ intento, intentos, espera, error }) =>
          console.warn(`[extraerPruebasElectricasIA] reintento ${intento}/${intentos} tras fallo transitorio (${error.status || error.code || ''} ${error.message || error}); espera ${Math.round(espera)}ms`),
      });
    } catch (e) {
      // Permanente/externo, timeout interno o presupuesto agotado → relanzar con
      // mensaje claro (el cliente cae al lector local / editor manual).
      const motivo = (e && (e.code === 'ia_timeout' || e.name === 'TimeoutIA'))
        ? 'La IA no respondió a tiempo (informe muy denso). Intenta de nuevo.'
        : `${e.message || e}`;
      throw new HttpsError('internal', `Claude API: ${motivo}`);
    }

    const toolBlock = (message.content || []).find(
      (b) => b.type === 'tool_use' && b.name === 'registrar_pruebas_electricas'
    );
    if (!toolBlock) {
      throw new HttpsError('internal', 'La IA no devolvió datos estructurados.');
    }

    const u = message.usage || {};
    console.info('[extraerPruebasElectricasIA]', model, storagePath,
      `in=${u.input_tokens || 0} out=${u.output_tokens || 0} cacheR=${u.cache_read_input_tokens || 0} cacheW=${u.cache_creation_input_tokens || 0}`);

    const entrada = toolBlock.input || {};
    const bloquesRaw = Array.isArray(entrada.bloques) ? entrada.bloques : [];
    const usage = {
      input: u.input_tokens || 0,
      output: u.output_tokens || 0,
      cache_read: u.cache_read_input_tokens || 0,
      cache_write: u.cache_creation_input_tokens || 0
    };

    // ── Diagnóstico de extracción (ADR-007) ──
    // Resumen de conteos: de un vistazo revela si la IA soltó pruebas
    // (todos en 0 salvo n_tand = el bug de extracción incompleta).
    const resumen = {
      n_tand:             (entrada.tand || []).length,
      n_excitacion_fases: ((entrada.excitacion || {}).fases || []).length,
      n_relacion:         (entrada.relacion || []).length,
      n_resistencia:      (entrada.resistencia || []).length,
      n_aislamiento:      (entrada.aislamiento || []).length,
      n_bujes:            ((entrada.collar || {}).bujes || []).length,
      drm:                !!(entrada.drm && ((entrada.drm.transiciones || []).length || entrada.drm.tiempo_min_ms != null || entrada.drm.conmutador)),
      n_bloques:          bloquesRaw.length,
      n_series:           bloquesRaw.reduce((a, b) => a + ((b && b.series) || []).length, 0),
      n_puntos:           bloquesRaw.reduce((a, b) => a + ((b && b.series) || []).reduce((s, se) => s + ((se && se.puntos) || []).length, 0), 0)
    };
    const diagnostico = { modelo: model, stop_reason: message.stop_reason || null, usage, resumen };

    // Log CHICO de resumen → SIEMPRE cabe en la ventana de `firebase functions:log`
    // (el volcado grande [IA-DIAG] a veces no aparece por tamaño). Los conteos
    // bastan para saber al instante si la IA soltó pruebas.
    console.info('[IA-DIAG-RESUMEN]', JSON.stringify({ modelo: model, stop_reason: message.stop_reason || null, usage, resumen }));

    // Log estructurado [IA-DIAG] → legible con `firebase functions:log` para
    // depurar QUÉ interpretó Claude vs el PDF, SIN re-correr la IA (coste 0).
    // Cap por el límite de tamaño de entrada de log (~256 KB): si el crudo es
    // grande, se loguea sin bloques_raw (resumen + canónicos bastan).
    try {
      const full = JSON.stringify({ ...diagnostico, mediciones_raw: entrada, bloques_raw: bloquesRaw });
      const safe = full.length > 200000
        ? JSON.stringify({ ...diagnostico, mediciones_raw: entrada, bloques_raw: `[truncado: ${bloquesRaw.length} bloques]` })
        : full;
      console.info('[IA-DIAG]', safe);
    } catch (e) {
      console.warn('[IA-DIAG] no se pudo serializar el diagnóstico:', e && e.message);
    }

    // La función es "thin": devuelve los datos crudos; el cliente sanitiza y
    // persiste (con su upsert por fecha + confirmación). El "Reprocesar" se retiró
    // (ADR-020): re-extraer = volver a subir el PDF (mismo flujo de carga).
    return {
      mediciones: entrada,
      bloques: bloquesRaw,
      modelUsed: model,
      usage,
      diagnostico
    };
  }
);

// ══════════════════════════════════════════════════════════════
// NARRATIVA DE TENDENCIA (F3) — lectura en prosa de la evolución
// ──────────────────────────────────────────────────────────────
// NO lee PDFs: recibe el resumen YA extraído (determinista, cliente:
// resumenTendenciaParaIA) — series temporales por métrica vs su umbral —
// y redacta un diagnóstico de tendencia. Entrada chica → función barata
// (sin visión, sin thinking, timeout corto).
// ══════════════════════════════════════════════════════════════
const SYSTEM_NARRATIVA_TENDENCIA = `Eres un ingeniero experto en mantenimiento predictivo de transformadores de potencia. Recibes la EVOLUCIÓN en el tiempo de las métricas clave de un transformador (ya medidas, una serie por ensayo, contra su umbral normativo) y redactas un diagnóstico de TENDENCIA en español técnico claro.

REGLAS:
1. Básate SOLO en los números dados. No inventes valores ni causas que no se deduzcan de la serie.
2. Cada métrica trae su umbral y dirección: si "invertir" es true el umbral es un MÍNIMO (estar POR DEBAJO es malo, p.ej. aislamiento); si es false el umbral es un MÁXIMO (estar POR ENCIMA es malo, p.ej. tan δ, desbalances).
3. Identifica qué métricas DEGRADAN (empeoran informe a informe), a qué ritmo y cuán cerca/lejos del límite están; cuáles están ESTABLES; y si alguna ya CRUZÓ el umbral.
4. Si una métrica tiene un solo punto, dilo: no hay tendencia, solo una foto.
5. Sé conciso y accionable. Cierra con una recomendación priorizada (qué vigilar, qué ensayo repetir, urgencia).

FORMATO (markdown breve): un párrafo de "Estado general", luego viñetas por métrica relevante, y una línea final "Recomendación:". Máximo ~200 palabras. No uses tablas.`;

export const narrativaTendenciaIA = onCall(
  {
    region: 'southamerica-east1',
    secrets: [LLM_API_KEY],
    // Entrada chica (números, sin PDF) → respuesta corta. 120 s sobra; el
    // cliente espera lo mismo (ver narrarTendencia en la capa de datos).
    timeoutSeconds: 120,
    memory: '512MiB',
    // Techo de gasto: también llama al proveedor de IA, pero es barata
    // (512 MiB, 120 s). 5 en paralelo cubren a todo el equipo mirando
    // tendencias a la vez sin dejar la puerta abierta.
    maxInstances: 5
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Requiere sesión iniciada.');
    }
    await exigirMiembroActivo(request);
    const { serie, metricas, modelId } = request.data || {};
    if (!Array.isArray(metricas) || !metricas.length) {
      throw new HttpsError('invalid-argument', 'Falta el resumen de tendencia (metricas).');
    }
    const model = MODELOS_IA.has(modelId) ? modelId : MODELO_IA_DEFAULT;

    // Resumen textual COMPACTO: una línea por métrica con su umbral, dirección
    // y la serie de puntos (año: valor). Determinista, sin re-leer nada.
    const lineas = metricas.map((m) => {
      const dir = m.invertir ? `mínimo ${m.limite}${m.unidad}` : `máximo ${m.limite}${m.unidad}`;
      const serieTxt = (Array.isArray(m.puntos) ? m.puntos : [])
        .map((p) => `${p.x}: ${p.y}${m.unidad || ''}`).join(' · ');
      return `- ${m.metrica} (umbral ${dir}): ${serieTxt}`;
    }).join('\n');
    const userMsg =
      `Transformador serie ${serie || 's/d'}. Evolución de sus métricas de prueba ` +
      `eléctrica a lo largo de los informes (cronológico):\n\n${lineas}\n\n` +
      `Redacta el diagnóstico de tendencia siguiendo tu formato.`;

    const client = new Anthropic({ apiKey: LLM_API_KEY.value() });
    let message;
    try {
      message = await client.messages.create({
        model,
        max_tokens: 1200,
        system: [
          { type: 'text', text: SYSTEM_NARRATIVA_TENDENCIA, cache_control: { type: 'ephemeral' } }
        ],
        messages: [{ role: 'user', content: userMsg }]
      });
    } catch (e) {
      throw new HttpsError('internal', `Claude API: ${e.message || e}`);
    }

    const narrativa = (message.content || [])
      .filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!narrativa) {
      throw new HttpsError('internal', 'La IA no devolvió narrativa.');
    }
    const u = message.usage || {};
    const usage = {
      input: u.input_tokens || 0,
      output: u.output_tokens || 0,
      cache_read: u.cache_read_input_tokens || 0,
      cache_write: u.cache_creation_input_tokens || 0
    };
    console.info('[narrativaTendenciaIA]', model, serie || '-',
      `metricas=${metricas.length} in=${usage.input} out=${usage.output}`);

    return { narrativa, modelUsed: model, usage };
  }
);
