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

// Lógica pura del dominio (módulos sin imports de Firebase SDK).
// La carpeta ./domain/ se sincroniza automáticamente desde
// ../assets/js/domain/ por functions/prepare-deploy.mjs (predeploy hook).
import { snapshotSaludCompleto } from './domain/salud_activos.js';

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
  { document: 'muestras/{id}', region: 'southamerica-east1' },
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
      pyt: tx.salud_actual && tx.salud_actual.calif_pyt
    });

    await txRef.update({ salud_actual: snap });
    await txRef.collection('historial_hi').add({
      trigger: 'muestra_nueva',
      muestra_origen_ref: event.params.id,
      ...snap, createdAt: new Date()
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
  { schedule: '0 7 * * *', timeZone: 'America/Bogota', region: 'southamerica-east1' },
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

TABLA DE DETALLE OBLIGATORIA Y COMPLETA (campo "tabla" de cada bloque) — REGLA CRÍTICA: la serie grafica UNA magnitud por fase, pero el informe trae MÁS columnas por fila que el lector necesita ver. Por eso TODO bloque con tabla en el informe DEBE traer su "tabla" con TODAS las columnas TAL CUAL el laboratorio las reporta — no solo el valor graficado. La serie es para la curva; la tabla es el dato íntegro. Incluye SIEMPRE estas columnas cuando el informe las tenga:
   · EXCITACIÓN: Posición TAP · I salida (mA) por fase A/B/C · Potencia (W) por fase A/B/C · Desviación % · Evaluación.
   · RELACIÓN: Posición TAP · Tensión aplicada MT1 (V) · MT2 (V) · Relación teórica · valor medido Fase A/B/C · %DIF por fase · Evaluación.
   · RESISTENCIA DE DEVANADOS: Posición TAP · Conexión · R.Medida (Ω/mΩ) por fase · R.Referencia corregida a temperatura por fase · Desviación % · Evaluación (incluye también las filas de MT y BT sin tomas si están).
   · TAN δ / FACTOR DE POTENCIA: Sección · Capacitancia (pF) · Tan δ % a cada tensión de prueba (2 kV, 10 kV…) · Modo · Evaluación.
   · BUJES: Buje · Fase · Cap. placa · Cap. medida · Tan δ placa · Tan δ medida · Evaluación.
   · AISLAMIENTO: Configuración · Tensión · Tiempo · Aislamiento (GΩ) · DAR · (IP si está) · Evaluación.
No resumas ni descartes columnas: si la fila del informe tiene 8 columnas, la fila de "tabla" tiene 8 celdas. Transcribe los valores tal cual (coma decimal → punto). La columna Evaluación (OK / fuera / verificar) cópiala literal del informe.
NO BASTA con las "series" (la curva). Una curva por TAP SIEMPRE debe ir acompañada de su "tabla" completa; un bloque de excitación, relación o resistencia SIN "tabla" se considera INCOMPLETO. Ejemplo EXACTO de la forma esperada para corriente de excitación (transcribe TODAS las posiciones de TAP del informe, no solo la primera):
"tabla": { "columnas": ["TAP","I A (mA)","P A (W)","I B (mA)","P B (W)","I C (mA)","P C (W)","Desv. %","Eval."], "filas": [[1,17.964,156.367,11.623,106.652,18.525,158.868,3.0,"OK"],[2,18.356,158.378,11.881,108.105,18.831,160.524,2.5,"OK"]] }
Y para relación de transformación: "columnas": ["TAP","Tensión MT1 (V)","Relación teórica","Fase A","%DIF A","Fase B","%DIF B","Fase C","%DIF C","Eval."]. Para resistencia de devanados: ["TAP","R.Medida A (Ω)","R.Ref A (Ω)","R.Medida B","R.Ref B","R.Medida C","R.Ref C","Desv. %","Eval."]. Replica esta estructura con los datos reales del informe que estés leyendo. Añade limite/guia (líneas normativas) e invertir=true cuando el límite es un MÍNIMO (ej. aislamiento ≥ 1 GΩ). Si el informe señala un valor puntual como dudoso, inconsistente o "a verificar" (p.ej. una fase que rompe el desbalance, un probable error de digitación), marca ese punto con verificar=true: el tablero lo dibuja RAYADO para pedir confirmación humana. Este arreglo es ADICIONAL y no debe reducir la exhaustividad de los campos canónicos. Crea bloques también para pruebas SIN campo canónico arriba (DGA, SFRA, capacitancia, DAR/PI, etc.). Si una prueba no tiene datos numéricos graficables, no le hagas bloque.

REGLAS ADICIONALES POR BLOQUE (interpretación profunda — la razón de usar IA):
- DESBALANCE ENTRE FASES: en las curvas multi-fase por TAP (excitación, relación, resistencia de devanados) incluye "limite_desbalance" = el criterio normativo de desbalance MÁXIMO entre fases en %, para que el tablero grafique la desviación contra su límite: relación de transformación 0.5 (±0.5%), resistencia de devanados 5 (≤5%), corriente de excitación 10 (Δ<10% si I<50 mA, 5 si I≥50 mA). Omítelo si no aplica.
- AISLAMIENTO — ÍNDICE DE POLARIZACIÓN (IP/PI): si el ensayo de aislamiento (Megger) trae lecturas a 30 s, 1 min y 10 min, además de la serie "Aislamiento" (1 min, GΩ) y "DAR" (R1min/R30s) AÑADE una serie "IP" (índice de polarización = R10min/R1min) por configuración. Criterio IP: <1 peligro, 1–1.5 regular, 1.5–2 precaución, >2 bueno (mayor es mejor → invertir=true). Reporta el IP REAL del informe; si solo hay DAR y no la lectura de 10 min, no inventes IP.
- ANÁLISIS CRÍTICO OBLIGATORIO: TODO bloque DEBE traer "observaciones" con un concepto de ingeniería que EVALÚE los resultados (no que los repita): ¿están dentro de norma?, ¿hay anomalía, asimetría o tendencia?, comparación con placa o con el patrón esperado (p.ej. excitación: fase central menor que las externas; resistencia: forma en V centrada en el TAP nominal), y la conclusión diagnóstica (satisfactorio / a vigilar / investigar). Cita la norma aplicable. Es el valor agregado de la IA sobre el informe crudo.`;

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
                        verificar: { type: ['boolean', 'null'], description: 'true si el informe marca ese valor como dudoso / a confirmar (se grafica rayado).' }
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

export const extraerPruebasElectricasIA = onCall(
  {
    region: 'southamerica-east1',
    secrets: [LLM_API_KEY],
    // 9 min: un escaneo denso con thinking + extracción de bloques excede los
    // 300 s previos. Gen2 admite hasta 3600 s. El cliente espera 540 s (igual).
    timeoutSeconds: 540,
    // 1 GiB (gen2 acopla más CPU → base64 + visión más rápidos) y margen para
    // el PDF base64 (~5 MB) + el stream de la respuesta.
    memory: '1GiB'
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Requiere sesión iniciada.');
    }
    const { storagePath, filename, modelId } = request.data || {};
    if (!storagePath || typeof storagePath !== 'string') {
      throw new HttpsError('invalid-argument', 'Falta storagePath del PDF.');
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
    const client = new Anthropic({ apiKey: LLM_API_KEY.value() });
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
    let message;
    try {
      const stream = client.messages.stream(params);
      message = await stream.finalMessage();
    } catch (e) {
      throw new HttpsError('internal', `Claude API: ${e.message || e}`);
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

    return {
      mediciones: entrada,
      bloques: bloquesRaw,
      modelUsed: model,
      usage,
      diagnostico
    };
  }
);
