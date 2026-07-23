# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Todo lo EJECUTADO (Fase 9 + fase CONECTAR) → `99 §52.8-52.14`. Crudos → bóveda
> `~/Desktop/brain-private/sgm-transpower/research-archive/` (`2026-07-21-fase9/` + `2026-07-22-decision-rbac-f28/`).

---

## 🎯 Foco (2026-07-23) — Fase 9 + CONECTAR completas · "HAS TODO TU" ejecutado (ADR-053)

> Fase 9 (ADR-052) Olas 0-5 + CONECTAR A/B/C/E desplegadas; D decidido NO activar (§52.14). **ADR-053 (hoy)**:
> **G010 cableado** (umbrales F18 → Health Index, aditivo, revisión adversarial 0 defectos) + **TODO-04 validado
> parcial** (re-atribución tan δ + per-clase aplicadas; ver `49 §Validación`) + **fixes FASE E** (tarjeta causa
> real + XSS tabla RCA). **Billing CONFIRMADO caído → las 2 CF de IA están CAÍDAS en prod (HTTP 500)**.

### ▶️ RETOMAR (próxima sesión)
> Confirma git real (M-01) + lee `05`+`10`. ✅ Billing/deploy RESUELTOS (TODO-10; CF vivas, umbrales F18 editables).
> **(1) TODO-15** (ΔC1 semáforo + corrección IR 20 °C + clusters 3b/4) — diseño especificado en `49`; trabajo
> autónomo disponible. **(2) probar B/E + extracción IA en vivo** (gated; verificación headless hecha: FUNCIONALES,
> ADR-053). Decisiones abiertas sin urgencia: G017 · G111-xlsx · STRUCT · D.

### 🔴 Acciones que SOLO el Ingeniero puede hacer
> **(A) GitHub Support** "remove sensitive data" (purga `refs/pull/*`). **(B) Revocar PATs viejos** (TODO-08).
> **(C) Ratificar TODO-04** (`49 §Validación`) y entregar MO.00418 Ed.02 (tabla per-clase no confirmable en
> fuentes públicas). **(D) Alerta de presupuesto GCP** (recomendada tras reactivar billing — Claude lo guía).

### 🚫 Callejones (NO reintentar)
> `args` grande a Workflow como string → llega serializado (embeber en el script) · git-filter-repo `--branch X`
> reescribe SOLO esa rama (usar `--mirror` si hay tags), aborta con `tmp_pack_*` (rm+gc antes), `glob:*.pdf`
> matchea todo dir · ref LOCAL `main` puede quedar stale tras filter-repo → comparar contra `origin/main` ·
> "FUSIÓN muerta" del diagnóstico = FALSA (viva) · G024 "XSS en dashboards" = casi todo FALSO (escape ya
> universal) · tablas en `tand-panel.js` las da `montarPanelPrueba` (L-57) · chip POR norma (L-58) · "Reprocesar"
> (ADR-020) · `.calif` de `schema.js` quedó write-only tras retirar Familia B (G012).

---

## 📋 Pendientes (TODO-NN) — lo ejecutado → `99 §52.8-52.14`

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **CONECTAR D** | D decidido: **NO activar** (§52.14 — prerrequisitos del día D allá: UI no-admin, custom claims, constraints por CAMPO). Esperar necesidad multi-rol real del negocio. | 🔵 decidido |
| **TODO-04** | **✅ PARCIAL (ADR-053)**: clusters IR/PI/DAR + FP/tan δ/bujes + TTR validados con fuente y refutación; 2 re-atribuciones aplicadas (`c7683d7`). RESTA: ratificación del director + MO.00418 (per-clase) + clusters 3b/4 (→ TODO-15). | 🟢 parcial |
| **TODO-15** | Del TODO-04 (spec en `49 §Validación`): (a) evaluador ΔC1 bujes (>5% investigar NETA; >10% DIRECCIONAL/tendencia, práctica) con preview fiel; (b) corrección IR a 20 °C (Tabla 100.14) o caveat visible; (c) re-correr clusters 3b (excitación/R-dev) y 4 (núcleo/reactancia/LTC/collar) en Opus. | 🔴 nuevo |
| **TODO-12** | Ola 3: **✅ G025** (suite de reglas vía emulador + CI, §52.12 — desbloquea CONECTAR D). Pendiente: CSP en 95 HTML (vía `<meta>`, trade-offs CDN/inline) · G111 xlsx = **decisión** (sin fix npm → migrar a cdn.sheetjs.com vs aceptar). | 🟡 G025 ✅ |
| **TODO-13** | Ola 4: G017 movimientos no atómicos = **decisión** (contadores agregados vs Cloud Function vs aceptar; fix "obvio" INVIABLE en SDK Web). | 🟡 decisión |
| **TODO-14** | Ola 5: separar 5 dominios (app/cerebro/skills/OLTC) + monolitos (shell 2398L, `calculo-refrigeracion.js` 4913L) = **decisión de arquitectura**. | 🟡 decisión |
| **TODO-09** | Ola 0 follow-ups: `SGM_DATA_SOURCE` real (Firestore) + template xlsm sanitizado + fixture test. Core desplegado. | 🟢 follow-up |
| **TODO-05** | Valida arquitectura de las 11 skills `transformadores-potencia` antes de replicar. | 🔄 |
| **TODO-06** | Validar ADR-046→050 en la APP real (tras Firebase Auth). | 🔲 |
| **TODO-07** | Convertir `~/Desktop/brain-private/` en repo git PRIVADO (respaldo bóveda). | 🔲 |
| **TODO-08** | 🔐 Ingeniero revoca PAT clásicos viejos de GitHub (uno de mayo 2026). | 🔲 |
| **TODO-02/03** | Tipificar S03-S06 contrato 4125000143 (`scripts/migrate/tipificar-suministros-fan-db.js`, dryRun) · flujo runtime FN-063 vs FN-050 (contrato 4123000081). | 🔮 |

---

## 📝 Bitácora (efímera)

> **2026-07-22/23 (Opus 4.8)** — Fase 9 re-verificada + batch REAL + CONECTAR A-E + D decidido NO + G025 + GC del
> cerebro (shard 30→31). Todo consolidado en `99 §52.8-52.14` (bitácora vieja podada — GC 2026-07-23).
>
> **2026-07-23 (Fable 5) — ESCANEO DE CIERRE ✅ + interinato Opus 4.8 listo**: brain:check SANO · tests vivos
> 1189/1187 · git real sync (HEAD==origin/main==`ae593da`). Workflow adversarial ACOTADO en **Opus** (regla
> NUEVA del Ingeniero: workflows acotados y con Opus; Fable solo analiza): **cierre Fase 9+CONECTAR 100%
> respaldado** (§52.8-14, commits y código B/E verificados) · **skills 100% consistentes** (las 6 refs
> "¿fantasma?" existen: 5 globales + `resistencia-aislamiento` anidada en `skills/pruebas-electricas/`).
> **Fixes**: (1) `20` L126 tenía la política git VIEJA ("el director pushea") → ADR-051 (riesgo para el
> interino); (2) GC pre-shard de `20` (dup fusionado, 14921→14347c) sin shard; (3) `20`: 55→54 domain +
> `nav.js` fantasma → `contrato-context.js`; (4) rótulo CI "1185 tests" → sin número; (5) **`brain-kit/`
> retirado** (Fase 9 100%; respaldo con diff OK en bóveda `brain-kit-v1.0-respaldo-2026-07-23/`); (6) **flag
> interinato en `05`** (cargar `opus-interino-protocolo` al boot). **Falsos positivos (NO reabrir)**: "38 data
> layers" es CORRECTO (`_firestore_clean.js` es helper) · hash del `05` 1 commit atrás = artefacto por diseño.
> CRUDO+síntesis → bóveda `2026-07-23-escaneo-cierre-fable/`.
>
> **2026-07-23 (Fable 5) — "HAS TODO TU" (ADR-053)**: billing sondeado con exit-code REAL (la 1ª lectura "494
> bytes OK" era el TEXTO del error — §3.3): **deshabilitado, CF de IA CAÍDAS en prod (500)**; deploy en cola.
> **G010 EJECUTADO**: umbrales F18 → motor HI (aditivo, 6 consumidores + CF fail-safe, `umbrales_version`),
> +7 tests → **1194 pass/0 fail**, revisión adversarial del diff (Opus): 0 defectos. **TODO-04**: workflow Opus
> 4 clusters + refutación → 2 re-atribuciones aplicadas, 2 ajustes refutados, gaps→TODO-15 (detalle `49`).
> **B/E verificadas headless** (Opus): FUNCIONALES; fix tarjeta E + XSS tabla RCA (`18f4632`). Commits
> `52f06b7→c7683d7` a `main`. Crudos → bóveda `2026-07-23-todo04-umbrales/` + `2026-07-23-hastodotu/`.
>
> **2026-07-23 (Fable 5, con el Ingeniero en vivo) — BILLING RESUELTO + DEPLOY**: causa raíz = prueba gratuita
> GCP expirada (no tarjeta vencida). Claude navegó con Chrome a billing/enable, el Ingeniero clickeó "Activar"
> (cuenta completa; créditos restantes conservados). Secret Manager OK al 1er reintento → deploy de las 3 CF
> exitoso → verificación viva: extracción/narrativa responden **401 JSON limpio** (antes 500 HTML = contenedor
> muerto). TODO-10 ✅. Umbrales F18 editables desde ya (cliente+servidor coherentes con G010).
