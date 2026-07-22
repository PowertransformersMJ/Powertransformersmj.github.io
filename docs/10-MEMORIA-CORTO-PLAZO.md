# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Todo lo EJECUTADO (Fase 9 + fase CONECTAR) → `99 §52.8-52.11`. Crudos → bóveda
> `~/Desktop/brain-private/sgm-transpower/research-archive/2026-07-21-fase9/`.

---

## 🎯 Foco (2026-07-22) — Fase 9 ejecutada · fase CONECTAR en marcha

> **Fase 9 (ADR-052)**: Olas 0-5 ejecutadas y desplegadas (confidencialidad, backend, batch REAL
> G020/G011/G095/G016/G012, infra G022/G024/G119). **Fase CONECTAR** (conectar los 4 módulos de dominio
> huérfanos, §52.11): ✅ **A** sobrecarga IEEE en modal · ✅ **B** botón "sugerir orden desde salud" · ✅ **C**
> feedback de rol en órdenes. Detalle commit-por-commit → `99 §52.8-52.11`.

### ▶️ RETOMAR
> Confirma git real (HEAD, M-01) + lee `05`+`10`. **Siguiente = CONECTAR D/E** (ambas necesitan decisión del
> Ingeniero): **D** enforcement RBAC en `firestore.rules` (seguridad, decisión de rollout + montar emulador =
> G025; decisión fuerte) · **E** respaldo TPT (`tpt_respaldo.js`; cruce a colección v2 + mini-form + elegir
> superficie modal-cargabilidad vs fallados). **Prueba en vivo pendiente**: FASE B (botón en `admin/ordenes.html`,
> gated — no verificable sin auth).

### 🔴 Acciones que SOLO el Ingeniero puede hacer
> **(A) Billing Blaze** → desbloquea deploy de functions (G007/G008) y quizá las CF de IA. **(B) GitHub Support**
> "remove sensitive data" (purga `refs/pull/*` viejos). **(C) Valida umbrales (TODO-04)** → desbloquea motor
> normativo G010-12.

### 🚫 Callejones (NO reintentar)
> `args` grande a Workflow como string → llega serializado (embeber en el script) · git-filter-repo `--branch X`
> reescribe SOLO esa rama (usar `--mirror` si hay tags), aborta con `tmp_pack_*` (rm+gc antes), `glob:*.pdf`
> matchea todo dir · ref LOCAL `main` puede quedar stale tras filter-repo → comparar contra `origin/main` ·
> "FUSIÓN muerta" del diagnóstico = FALSA (viva) · G024 "XSS en dashboards" = casi todo FALSO (escape ya
> universal) · tablas en `tand-panel.js` las da `montarPanelPrueba` (L-57) · chip POR norma (L-58) · "Reprocesar"
> (ADR-020) · `.calif` de `schema.js` quedó write-only tras retirar Familia B (G012).

---

## 📋 Pendientes (TODO-NN) — lo ejecutado → `99 §52.8-52.11`

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **CONECTAR D** | **A/B/C/E desplegadas**. **D → DECIDIDO (comité ×4 + red-team ×3 independiente, §52.14): NO activar ahora** (2 capas convergen; sin Gemini se usó red-team interno). Mantener `/ordenes` admin-only + feedback FASE C. **Hoy SOLO admin está enforced** (los otros 6 roles ni escriben — el feedback cliente es cosmético). Prerrequisitos del día D (cuando el negocio lo exija): UI no-admin real · rol en **custom claims** (evita get() facturado) · **constraints a nivel de CAMPO** (la matriz solo gobierna `estado`; el doc entero queda abierto — falsa completitud) · test paridad+denegaciones verde · create/delete admin-only · rollout por-rol reversible. Pendiente del Ingeniero: ¿hay necesidad operativa real de multi-rol? → si sí, es un épico. | 🔵 esperar (decidido) |
| **TODO-04** | Ingeniero valida los `⚠️ verificar` del lóbulo `49` (MO.00418 por clase, C1 bujes, PI/DAR, NETA 0.5%, TIPUP 0.1/PEND 0.05) → **bloquea motor normativo G010-12**. | 🔄 |
| **TODO-10** | G007/G008 código listo, **deploy bloqueado por billing** Blaze. | 🟡 billing |
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

> **2026-07-22 (Opus 4.8)** — Fase 9 re-verificada adversarialmente (21 agentes; una hipótesis salió FALSA) +
> batch REAL (G020/G011/G095/G016/G012, con tests+preview) + infra (G024/G022/G119), todo desplegado a `main`.
> Fase CONECTAR arrancada: mapeo (4 agentes) → plan A-E; A/B/C desplegadas. **Brain-kit se borra solo al 100% de
> Fase 9 (aún no).** Detalle → `99 §52.8-52.11`. **Poda de cerebro 2026-07-22** (boot al tope) — este `10`
> recortado al foco vivo (8447→4735c; boot margen 169→3757c). **GC COMPLETO**: `30-LECCIONES` shardeado (§G.5) —
> el cluster IA/Cloud-Functions (L-35, L-43–L-48) movido a `31-LECCIONES-IA.md` (30: 41804→34281c, bajo tope);
> `brain-check.mjs` reconoce el nodo hijo; registrado en `CLAUDE.md §0`+`00`+manifest. Cerebro SANO.
