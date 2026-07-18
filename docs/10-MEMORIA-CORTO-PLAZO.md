# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Nodo de Memoria a Corto Plazo.** Junto con `CLAUDE.md` + `05-ESTADO-GLOBAL`, es de las primeras
> lecturas de cada sesión (Ignorancia Selectiva, §G.1). SOLO lo vivo: foco actual, pendientes abiertos,
> bitácora. Estado técnico → `05`. Es la **pizarra, no el archivo**: al cerrar una tarea, consolidar a
> ADR (`99`) + fila en `00`, extraer lecciones a `30`, y PODAR esto al foco vivo (GC §G.4).

---

## 🎯 Foco actual (2026-07-18)

> **✅ HOY: cerebro MIGRADO a brain-kit v1.0** (ADR-051, `99 §51`): kernel v1.2 + gates + hooks +
> handoff + rescate exhaustivo (`_legacy/TRIAJE.md`). Política git NUEVA del Ingeniero (F3a):
> Claude commitea + pushea + mergea + deploya, validando cada commit.
>
> **➡️ SIGUIENTE MISIÓN: Fase 9 (TODO-01)** — sesión nueva dedicada. Luego retomar el producto:
> el foco de producto sigue siendo el segmento **"Factor de Potencia / Tan δ — devanados"**
> (⛔ NO tocar otras pruebas; reorg de las demás SOLO cuando el Ingeniero lo pida, una por una).
> Decisión abierta FP/tan δ (no bloqueante): ¿acordeón único (actual) o split por devanado
> AT/MT/Terciario como excitación? (si split → `grupoDe('tand',…)` en `tablas-pruebas-panel.js`).
>
> **🚫 Callejones (NO reintentar)**: tablas dentro de `tand-panel.js` imitando excitación → rechazado;
> las tablas las da `montarPanelPrueba` (L-57) · estado consolidado multi-norma en un solo chip →
> chip POR norma (L-58) · reactivar "Reprocesar" (ADR-020) · overlay genérico multi-año (ADR-033/034).

---

## 📋 Pendientes abiertos (TODO-NN)

| ID | Item | Estado | Nota |
|---|---|---|---|
| **TODO-01** | **Fase 9 — ESCANEO TOTAL + propuestas**: recorrer TODO el repo (código/config/seguridad/CI/dependencias) con skill `arquitecto-software` → someter el diagnóstico a `comite-expertos` ×3 (arquitectura·seguridad·costo) → consejo externo si hay acceso (`15`) → **informe priorizado al Ingeniero + plan por olas en `specs/`** (skill `spec-kit`). ⛔ NO refactorizar en la sesión del diagnóstico: el Ingeniero decide, luego se ejecuta ola por ola. Incluye: PDFs OLTC ~60MB en raíz de `main` (peso/copyright) + código muerto FUSIÓN (`excitacion-panel.js`). Crudos → bóveda. | 🔲 | siguiente sesión |
| **TODO-02** | Tipificar S03/S04/S05/S06 del contrato 4125000143 (`scripts/migrate/tipificar-suministros-fan-db.js`, `dryRun` primero) — script verificado presente | 🔮 abierto | ex TODO-01 viejo |
| **TODO-03** | Flujo de selección runtime FN-063 vs FN-050 (contrato 4123000081) | 🔮 abierto | espera brief del Ingeniero (ex TODO-02) |
| **TODO-04** | El Ingeniero valida los valores `⚠️ verificar` del lóbulo `49` contra su edición de norma (MO.00418 por clase, C1 bujes, PI/DAR, guía NETA 0.5%, `TIPUP 0.1`/`PEND 0.05`) → fijarlos en el motor multi-norma | 🔄 en validación | ex TODO-08 viejo |
| **TODO-05** | El Ingeniero valida la arquitectura de las 11 skills `transformadores-potencia` (ya commiteadas — 59 archivos tracked, verificado 2026-07-18) antes de replicar el patrón | 🔄 esperando validación | ex TODO-10 viejo |
| **TODO-06** | Validar ADR-046→050 en la APP real (tras Firebase Auth); el preview fiel `_dev/preview-tand-tablas.html` / `preview-excitacion-fiel.html` es lo más cercano | 🔲 | transversal |
| **TODO-07** | Convertir `~/Desktop/brain-private/` en repo git PRIVADO (respaldo de la bóveda `sgm-transpower/research-archive`) | 🔲 | recomendación F4 |
| **TODO-08** | 🔐 El Ingeniero revoca los PAT clásicos viejos de GitHub (hay uno de mayo 2026 anotado "pendiente revocar" en `_legacy/CLAUDE-previo.md §9.3.2`; el flujo PAT-inline quedó obsoleto — el push del runtime ya funciona) | 🔲 | seguridad — solo el Ingeniero puede (github.com → Settings → Developer settings → Tokens) |

---

## 📝 Bitácora (efímera)

> **2026-07-18 (Fable 5)**: Cerebro instalado con brain-kit v1.0 (ADR-051). Rescate F7: 99 (51 ADRs) +
> 15/40/49/50 íntegros; 30 condensado 77.5k→<40k (59 lecciones intactas, L-01 ACTUALIZADA con la
> política git nueva); 20 verificado contra el repo; TRIAJE completo en `_legacy/TRIAJE.md`.
> Hallazgo `git fetch`: PRs #181–#187 ya mergeadas (el "PR pendiente" del 2026-06-23 no existía ya)
> + 10 PDFs OLTC en la raíz de `main` (→ Fase 9). Brain-kit se borra SOLO al completar la Fase 9.
