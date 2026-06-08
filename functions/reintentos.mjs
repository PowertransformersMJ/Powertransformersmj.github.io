// Reintento con backoff para llamadas a la IA (Cloud Functions · Pruebas Eléctricas).
// PURO: sin imports de Firebase ni red → testeable con `node --test`.
//
// Por qué existe (TODO-09): un fallo TRANSITORIO de la API de Claude —429
// rate-limit, 500 internal, 502/503/504, 529 overloaded, cortes de conexión o
// de stream— NO es culpa del PDF ni del código. Antes, ese hipo se propagaba
// como HttpsError('internal') y "Reprocesar" fallaba aunque el informe fuera
// perfecto. Reintentar con backoff lo absorbe. Los errores PERMANENTES/EXTERNOS
// (401 auth, 400 invalid_request, 413 payload, sin saldo) se relanzan de
// inmediato: ahí el fallo es real y ajeno a la IA. Resultado: "Reprocesar" solo
// falla por causas externas (infra caída, PDF ilegible, sin saldo), nunca por
// un hipo transitorio de la IA.

// Status HTTP que la API de Claude devuelve en fallos transitorios (la doc de
// Anthropic recomienda reintentar 408/409/429/5xx; 529 = overloaded_error).
export const IA_STATUS_TRANSITORIOS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

// ¿El error amerita reintento? true = transitorio (culpa de la IA/infra), se
// reintenta; false = permanente/externo, se relanza.
export function esErrorTransitorioIA(e) {
  if (!e) return false;
  const status = e.status ?? e.statusCode ?? (e.response && e.response.status);
  if (status != null && IA_STATUS_TRANSITORIOS.has(Number(status))) return true;
  // SDK Anthropic: APIConnectionError / APIConnectionTimeoutError no traen status.
  const name = String(e.name || '');
  if (/Connection|Timeout/i.test(name)) return true;
  const msg = String(e.message || e);
  return /overload|rate.?limit|timed?.?out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|EAI_AGAIN|socket hang up|stream (?:error|disconnect|interrupt)|temporar|overloaded|\b50[234]\b|\b529\b/i.test(msg);
}

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Retraso (ms) del intento i (0-based): backoff exponencial + jitter, acotado a
// maxMs. Si la API mandó Retry-After, lo respeta. `rnd` inyectable para test.
export function retrasoBackoff(i, { baseMs = 1500, maxMs = 30000, retryAfterMs = null, rnd = Math.random } = {}) {
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) return Math.min(retryAfterMs, maxMs);
  const exp = baseMs * Math.pow(2, i);
  const jitter = Math.floor(rnd() * 500);
  return Math.min(exp + jitter, maxMs);
}

// Ejecuta `fabricar(i)` (DEBE devolver una promesa NUEVA por intento — un stream
// no se puede reusar) reintentando solo fallos transitorios, con presupuesto de
// tiempo (deadlineMs) para no exceder el timeout de la Cloud Function. `ahora` y
// `dormirFn` son inyectables para test.
export async function conReintentosIA(fabricar, {
  intentos = 4, baseMs = 1500, maxMs = 30000, deadlineMs = null,
  margenMs = 5000, ahora = Date.now, dormirFn = dormir, onReintento = null,
} = {}) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fabricar(i);
    } catch (e) {
      ultimo = e;
      const quedan = i < intentos - 1;
      if (!quedan || !esErrorTransitorioIA(e)) throw e;
      const retryAfterRaw = Number(e?.headers?.['retry-after']) * 1000;
      let espera = retrasoBackoff(i, {
        baseMs, maxMs,
        retryAfterMs: Number.isFinite(retryAfterRaw) ? retryAfterRaw : null,
      });
      if (deadlineMs != null) {
        const restante = deadlineMs - ahora();
        // Sin margen para otro intento → relanzar (lo retoma "Reprocesar" a mano).
        if (restante <= espera + margenMs) throw e;
        espera = Math.min(espera, Math.max(0, restante - margenMs));
      }
      if (onReintento) onReintento({ intento: i + 1, intentos, espera, error: e });
      await dormirFn(espera);
    }
  }
  throw ultimo;
}
