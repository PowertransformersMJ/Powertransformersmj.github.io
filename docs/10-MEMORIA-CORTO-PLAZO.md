# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Todo lo EJECUTADO (Fase 9 + fase CONECTAR) → `99 §52.8-52.14`. Crudos → bóveda
> `~/Desktop/brain-private/sgm-transpower/research-archive/` (`2026-07-21-fase9/` + `2026-07-22-decision-rbac-f28/`).

---

## 🎯 Foco (2026-07-23) — Fase 9 + CONECTAR completas · "HAS TODO TU" ejecutado (ADR-053)

> Fase 9 (ADR-052) Olas 0-5 + CONECTAR A/B/C/E desplegadas; D decidido NO activar (§52.14). **ADR-053 (hoy)**:
> **G010 cableado** (umbrales F18 → Health Index, aditivo, revisión adversarial 0 defectos) + **TODO-04 validado
> parcial** (re-atribución tan δ + per-clase aplicadas; ver `49 §Validación`) + **fixes FASE E** (tarjeta causa
> real + XSS tabla RCA). Billing RESUELTO en vivo (CF vivas) · extracción IA validada con informe real.

### ▶️ RETOMAR (próxima sesión)
> Confirma git real (M-01) + lee `05`+`10`. ✅ TODO-04/07/10/15/16 CERRADOS (ADR-053/054/055). Trabajo autónomo
> disponible: **TODO-09** (conectar dashboard Salud de Activos a Firestore real — hoy corre en DEMO, visto en
> vivo) · TODO-17 (hygiene menor). Del Ingeniero: ratificar umbrales + MO.00418 · clasificar unidades RESPALDO ·
> GitHub Support · PATs (TODO-08) · TODO-05. Decisiones abiertas sin urgencia: G017 · G111-xlsx · STRUCT · D.

### 🔴 Acciones que SOLO el Ingeniero puede hacer
> **(A) GitHub Support** "remove sensitive data" (purga `refs/pull/*`). **(B) Revocar PATs viejos** (TODO-08).
> **(C) Ratificar TODO-04** (`49 §Validación`) y entregar MO.00418 Ed.02 (tabla per-clase no confirmable en
> fuentes públicas). (✅ Alerta de presupuesto GCP $5/mes hecha — detalle en `05`.)

### 🚫 Callejones (NO reintentar)
> Workflow `args` grande como string → serializado (embeber en script) · git-filter-repo: `--branch` reescribe
> SOLO esa rama, aborta con `tmp_pack_*` (rm+gc antes), `glob:*.pdf` matchea todo dir · ref local `main` stale
> post-filter → usar `origin/main` · "FUSIÓN muerta"=FALSA · G024 "XSS dashboards" casi todo FALSO · tablas
> tand-panel→L-57 · chip por norma→L-58 · "Reprocesar"→ADR-020 · `.calif` de schema write-only (G012).

---

## 📋 Pendientes (TODO-NN) — lo ejecutado → `99 §52.8-52.14`

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **CONECTAR D** | D decidido: **NO activar** (§52.14 — prerrequisitos del día D allá: UI no-admin, custom claims, constraints por CAMPO). Esperar necesidad multi-rol real del negocio. | 🔵 decidido |
| **TODO-04** | **✅ PARCIAL (ADR-053)**: clusters IR/PI/DAR + FP/tan δ/bujes + TTR validados con fuente y refutación; 2 re-atribuciones aplicadas (`c7683d7`). RESTA: ratificación del director + MO.00418 (per-clase) + clusters 3b/4 (→ TODO-15). | 🟢 parcial |
| **TODO-17** | Hygiene (hallazgo ADR-055): `calificarResistencia` (schema) da OK ≤5% mientras semáforo/scorecard usan 2% — unificar o documentar; ligado al `.calif` write-only (G012). | 🟢 menor |
| **TODO-12** | Ola 3: **✅ G025** (suite de reglas vía emulador + CI, §52.12 — desbloquea CONECTAR D). Pendiente: CSP en 95 HTML (vía `<meta>`, trade-offs CDN/inline) · G111 xlsx = **decisión** (sin fix npm → migrar a cdn.sheetjs.com vs aceptar). | 🟡 G025 ✅ |
| **TODO-13** | Ola 4: G017 movimientos no atómicos = **decisión** (contadores agregados vs Cloud Function vs aceptar; fix "obvio" INVIABLE en SDK Web). | 🟡 decisión |
| **TODO-14** | Ola 5: separar 5 dominios (app/cerebro/skills/OLTC) + monolitos (shell 2398L, `calculo-refrigeracion.js` 4913L) = **decisión de arquitectura**. | 🟡 decisión |
| **TODO-09** | Ola 0 follow-ups: `SGM_DATA_SOURCE` real (Firestore) + template xlsm sanitizado + fixture test. Core desplegado. | 🟢 follow-up |
| **TODO-05** | Valida arquitectura de las 11 skills `transformadores-potencia` antes de replicar. | 🔄 |
| **TODO-06** | Validar ADR-046→050 en la APP real (tras Firebase Auth). | 🔲 |
| **TODO-08** | 🔐 Ingeniero revoca PAT clásicos viejos de GitHub (uno de mayo 2026). | 🔲 |
| **TODO-02/03** | Tipificar S03-S06 contrato 4125000143 (`scripts/migrate/tipificar-suministros-fan-db.js`, dryRun) · flujo runtime FN-063 vs FN-050 (contrato 4123000081). | 🔮 |

---

## 📝 Bitácora (efímera)

> **2026-07-22/23 (Opus 4.8)** — Fase 9 re-verificada + batch REAL + CONECTAR A-E + D decidido NO + G025 + GC del
> cerebro (shard 30→31). Todo consolidado en `99 §52.8-52.14` (bitácora vieja podada — GC 2026-07-23).
>
> **2026-07-23 (Fable 5) — ESCANEO DE CIERRE ✅**: auditoría Fase 9+CONECTAR 100% respaldada (workflow Opus) ·
> skills consistentes (las 6 refs "¿fantasma?" existen) · 6 fixes: política git VIEJA en `20` L126 → ADR-051,
> GC pre-shard, conteos/`nav.js`, rótulo CI, `brain-kit/` retirado (respaldo en bóveda), flag interinato en
> `05`. Falsos positivos NO reabrir: "38 data layers" correcto (`_firestore_clean.js` es helper) · hash `05`
> 1 atrás = por diseño. Detalle → commits `6d2b7b5`/`5fcbffd` + bóveda `2026-07-23-escaneo-cierre-fable/`.
>
> **2026-07-23 (Fable 5) — "HAS TODO TU" (ADR-053)**: G010 ejecutado (revisión adversarial 0 defectos, 1194
> pass) · TODO-04 validado con refutación (2 re-atribuciones aplicadas) · B/E headless FUNCIONALES + fixes ·
> billing diagnosticado caído (§3.3: el "OK" inicial era texto de error). Detalle → ADR-053 + bóveda
> `2026-07-23-todo04-umbrales/` + `2026-07-23-hastodotu/`.
>
> **2026-07-23 (Fable 5 + Ingeniero) — VALIDACIÓN VIVA B/E + TODO-16 RESUELTO (ADR-054)**: B guard OK; E: tab
> Fallados estaba ROTO en prod → 2 bugs sistémicos del shell (evento sesión window≠document ×10 páginas ·
> modales pegados ×6) → fix `b27b8f1` re-verificado vivo (213 unidades cargan solas). Falta clasificar
> RESPALDO en el parque (Ingeniero) para salida útil del evaluador.
>
> **2026-07-23 (Fable 5) — TODO-15 COMPLETO + TODO-07 (ADR-055)**: (a) **ΔC1 de bujes AL VEREDICTO** (>5%
> investigar; nunca rojo sin dirección) en matriz + scorecard, +5 tests → **1199 pass**; (b) caveat 20 °C en IR;
> (c) clusters 3b/4 validados (workflow Opus, 0 refutados): 2+1 y R-dev CONFIRMADOS; re-atribuciones aplicadas
> `52de77e` (50 mA→práctica de campo · DRM→fabricante · collar→Doble TDRB · 4ª copia tan δ); (d) scorecard
> reetiquetado. IR núcleo y resistores LTC = fabricante/MO.00418 (⚠️ en skills). Bóveda ahora repo git local
> (`f709509`) + crudos archivados. Nuevo: TODO-17 (calificarResistencia 5% vs 2%, hygiene menor).
>
> **2026-07-23 (Fable 5, con el Ingeniero en vivo) — BILLING RESUELTO + DEPLOY**: causa raíz = prueba gratuita
> GCP expirada (no tarjeta vencida). Claude navegó con Chrome a billing/enable, el Ingeniero clickeó "Activar"
> (cuenta completa; créditos restantes conservados). Secret Manager OK al 1er reintento → deploy de las 3 CF
> exitoso → verificación viva: extracción/narrativa responden **401 JSON limpio** (antes 500 HTML = contenedor
> muerto). TODO-10 ✅. Umbrales F18 editables desde ya (cliente+servidor coherentes con G010).
>
> **2026-07-23 (Fable 5 + Ingeniero) — EXTRACCIÓN IA VALIDADA EN VIVO 🏆 (TODO-06 parcial)**: informe REAL
> 2020 de SE Montería cargado por Chrome guiado (serie nueva **LEL27007**, TRAFO UNION 1986, 40/15/35 MVA,
> 110 kV) → IA extrajo identidad+mediciones correctas → veredicto multi-norma en vivo: **INVESTIGAR** (FP buje
> C1 0.84% banda 0.5–1; relación 0.43% vigilar; tan δ 18/18 verde; excitación/collar verde; no-realizadas
> listadas). Calificación POR PRUEBA respetada. Parque: 3 TX / 3 SE. Password de Chrome estaba stale → reset
> por email + huella operativa. Gotchas de carga: file_upload de la extensión solo acepta archivos de la
> sesión; fetch a localhost bloqueado por Local-Network-Access de Chrome (ni con header PNA) → la vía es
> drag&drop del usuario (Finder `open -R` ayuda). Falta en vivo: FASE B/E (2 clics, gated). Hallazgo → TODO-15(d).
