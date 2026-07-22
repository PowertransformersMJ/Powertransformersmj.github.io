# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Nodo de Memoria a Corto Plazo.** Junto con `CLAUDE.md` + `05-ESTADO-GLOBAL`, es de las primeras
> lecturas de cada sesión (Ignorancia Selectiva, §G.1). SOLO lo vivo. Es la **pizarra, no el archivo**:
> lo ya EJECUTADO vive en `99 §52` (ADR-052 §52.8); aquí solo lo PENDIENTE + cómo retomar.

---

## 🎯 Foco actual (2026-07-21) — Fase 9 EN EJECUCIÓN por olas

> **Fase 9 (ADR-052) en marcha.** ✅ **Ola 0 confidencialidad COMPLETA** (emergencia resuelta: repo+historia
> reescrita+Storage, desplegado). ✅ **Ola 1 reglas desplegadas** (functions bloqueadas por billing). 🟡 Olas
> 2-5 parciales. **Detalle de TODO lo ejecutado (commits, qué se hizo) → `99 §52.8`.** Informe del diagnóstico
> + crudos → bóveda `~/Desktop/brain-private/sgm-transpower/research-archive/2026-07-21-fase9/`.

### ▶️ PARA RETOMAR (próxima sesión)
> Di: **"Retoma la Fase 9 — continúa las olas pendientes (docs/10 TODO-09..14)"**.
> Yo: leo `05`+`10`+`99 §52.8`, confirmo git real, y sigo. **ANTES de tocar cualquier finding media/baja:
> RE-VERIFICARLA leyendo el código** (no pasaron por verificación adversarial; una ya salió FALSA — la
> "FUSIÓN muerta", ver §52.8). El motor normativo (G010-12) necesita tu validación de umbrales (TODO-04).

### 🔴 2 acciones que SOLO el Ingeniero puede hacer (idealmente antes de retomar)
> **(A) Billing Firebase** — reactivar Blaze en consola; desbloquea el deploy de functions Y quizá tus CF de
> IA no corren hoy si lapsó. **(B) GitHub Support** — pedir "remove sensitive data" (purga `refs/pull/*` con
> commits confidenciales viejos por SHA).

### 🚫 Callejones (NO reintentar)
> `args` grande a Workflow como string → llega serializado (embeber en el script) · git-filter-repo: clonar
> `--branch X` reescribe SOLO esa rama (usar `--mirror` si hay tags remotos), aborta con `tmp_pack_*` basura
> (`rm`+`gc` antes), `glob:*.pdf` matchea todo dir · "FUSIÓN muerta" del diagnóstico = FALSA (está viva) ·
> tablas en `tand-panel.js` → las da `montarPanelPrueba` (L-57) · chip POR norma (L-58) · "Reprocesar" (ADR-020) · **ref LOCAL `main` quedó stale en la historia vieja pre-filter-repo (`2f0e67f`)** → comparar SIEMPRE contra `origin/main`, no el local (parecía 786-commits divergida y era FF limpio) · hallazgo G024 "XSS en dashboards" = **casi todo FALSO** (escape ya universal; solo `bump.js` tenía fuga real).

---

## 📋 Pendientes abiertos (TODO-NN) — lo EJECUTADO en `99 §52.8`

| ID | Item PENDIENTE (lo hecho → §52.8) | Estado |
|---|---|---|
| **TODO-09** | Ola 0: (d) GitHub Support purga `refs/pull/*`; (e) follow-ups: `SGM_DATA_SOURCE` real (Firestore) + template xlsm SANITIZADO (roto el export) + fixture test sanitizado. | ✅ core / follow-ups |
| **TODO-10** | Ola 1: **G007/G008 código listo, DEPLOY BLOQUEADO por billing** — desplegar `functions` cuando el Ingeniero reactive Blaze. | 🟡 pend-billing |
| **TODO-11** | Ola 2 (re-verificado §52.9). **✅ G011** (excitación aplica margen por corriente, §52.10) · **✅ G020** (modal "2/4" neutralizado). **PENDIENTE**: G012-resto (retirar render muerto Familia B en `tabla-pruebas.js` + reconciliar `.calif` 5%/1GΩ de `schema.js:170-181` al canon 2%/por-clase + espejo `functions/domain`; superficie visible YA consolidada). **DECISIÓN Ingeniero = CONECTAR** (fase siguiente, features nuevas): G013 (cablear respaldo TPT + sobrecarga IEEE + autogeneración órdenes a la UI) · G014 (enforcement RBAC F28 en `firestore.rules`). **BLOQUEADO**: G010 dirección = TODO-04. | 🟡 G011/G020 ✅ |
| **TODO-12** | Ola 3 (re-verificado §52.9): **G022/G094 ✅** (auto-hospedado lucide v1.25.0 en `assets/vendor/lucide/`) · **G024 bump ✅** (escHtml). Pendiente: G025 (tests `firestore.rules` vía emulador — REAL, aditivo, L) · G024-CSP (falta CSP en 95 HTML; GitHub Pages estático → vía `<meta>`, trade-offs con CDN/inline) · G111 = **decisión** (websocket-driver: `npm audit fix` mecánico; **xlsx: sin fix npm** → migrar a cdn.sheetjs.com off-registry vs aceptar riesgo). | 🟡 G022/G024 ✅ |
| **TODO-13** | Ola 4 (re-verificado §52.9): **✅ G095** (join-guard KPIs, historial conservado, §52.10). **PENDIENTE**: G016 (dashboard suministros suscribe 2× — quick-win: `nombreSum`→`cacheStockGlobal` + fix mayor: exponer `movimientos` en emit de `suscribirStockGlobal`; verificar end-to-end en dashboard gated). **DECISIÓN Ingeniero pendiente**: G017 (movimientos no atómicos; fix obvio INVIABLE en SDK Web → contadores agregados vs Cloud Function vs aceptar). | 🟡 G015/G018/G095 ✅ |
| **TODO-14** | Ola 5 (re-verificado §52.9): **G119 ✅** (`.gitignore`+`git rm --cached functions/domain`; predeploy regenera). **DECISIÓN Ingeniero**: separar 5 dominios (app/cerebro/skills/OLTC) + monolitos (shell 2398L; +`calculo-refrigeracion.js` 4913L que el diagnóstico omitió). Dato corregido: parque.html YA 275→88KB (Ola 0). (nav ✅). | 🟡 G119/nav ✅ |
| **TODO-04** | El Ingeniero valida los `⚠️ verificar` del lóbulo `49` (MO.00418 por clase, C1 bujes, PI/DAR, NETA 0.5%, `TIPUP 0.1`/`PEND 0.05`) → **bloquea Ola 2 (G010-12)**. | 🔄 validación |
| **TODO-05** | Valida arquitectura de las 11 skills `transformadores-potencia` antes de replicar. | 🔄 espera |
| **TODO-06** | Validar ADR-046→050 en la APP real (tras Firebase Auth). | 🔲 |
| **TODO-07** | Convertir `~/Desktop/brain-private/` en repo git PRIVADO (respaldo bóveda). | 🔲 |
| **TODO-08** | 🔐 El Ingeniero revoca PAT clásicos viejos de GitHub (uno de mayo 2026). | 🔲 |
| **TODO-02** | Tipificar S03-S06 del contrato 4125000143 (`scripts/migrate/tipificar-suministros-fan-db.js`, `dryRun`). | 🔮 |
| **TODO-03** | Flujo selección runtime FN-063 vs FN-050 (contrato 4123000081). | 🔮 |

---

## 📝 Bitácora (efímera)

> **2026-07-21 (Opus 4.8) — Fase 9 diagnóstico + Olas 0-5 ejecución**: 14 auditores + 11 verificadores Fable
> (0 refutados de 41 crítica/alta). Ola 0 completa (confidencialidad: repo 136M→17M, `.git` 220M→23M, historia
> reescrita, Storage cerrado, todo desplegado; respaldo bundle en bóveda). Ola 1 reglas desplegadas; functions
> bloqueadas por billing. Olas 2-5 parciales (ver §52.8). Cerré por: findings media sin verificar (una FALSA),
> motor normativo necesita validación de umbrales, entorno con fatiga (clasificador, boot al tope). Detalle
> completo commit-por-commit → `99 §52.8`. **Brain-kit se borra solo al 100% de Fase 9 (aún no).**
>
> **2026-07-22 (Opus 4.8) — Re-verificación + Olas 3/5**: workflow 21 agentes re-verificó los 15 hallazgos
> media/baja pendientes (crudo en bóveda). Ejecutados+desplegados a `main` (FF): G024 (escHtml bump.js),
> G119 (untrack functions/domain), G022 (auto-hospeda lucide v1.25.0, verificado en preview). Triaje completo
> → `99 §52.9`. Corregí ref local `main` stale. Siguiente: batch REAL (G011/G016/G020/G012) + presenté al
> Ingeniero las 6 decisiones de producto/arquitectura (G013/G014/G017/G095/G111-xlsx/STRUCT).
>
> **2026-07-22 (Opus 4.8) — Batch REAL (cont.)**: el Ingeniero eligió "batch REAL ahora" + decidió G095
> (conservar historial) y G013/G014 (CONECTAR módulos huérfanos). Ejecutados+desplegados (§52.10): **G020**
> (modal "2/4" neutralizado), **G011** (excitación por corriente, +8 tests, preview fiel), **G095** (join-guard
> KPIs, +2 tests). Suite 1181 pass. PENDIENTE del batch: **G016** (doble suscripción — verificar en dashboard
> gated) + **G012-resto** (código muerto + reconciliar `.calif` persistido, delicado). Luego: fase CONECTAR
> (G013/G014).
