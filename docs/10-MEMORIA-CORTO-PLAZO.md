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
> tablas en `tand-panel.js` → las da `montarPanelPrueba` (L-57) · chip POR norma (L-58) · "Reprocesar" (ADR-020).

---

## 📋 Pendientes abiertos (TODO-NN) — lo EJECUTADO en `99 §52.8`

| ID | Item PENDIENTE (lo hecho → §52.8) | Estado |
|---|---|---|
| **TODO-09** | Ola 0: (d) GitHub Support purga `refs/pull/*`; (e) follow-ups: `SGM_DATA_SOURCE` real (Firestore) + template xlsm SANITIZADO (roto el export) + fixture test sanitizado. | ✅ core / follow-ups |
| **TODO-10** | Ola 1: **G007/G008 código listo, DEPLOY BLOQUEADO por billing** — desplegar `functions` cuando el Ingeniero reactive Blaze. | 🟡 pend-billing |
| **TODO-11** | Ola 2 (motor normativo — CUIDADO + tests + validar umbrales TODO-04): G010 (umbrales HI que nada consume → hilar `/umbrales_salud/global` por `snapshotSaludCompleto`), G011 (excitación no pasa `corrienteMA` al calificador — 4 callers de `evaluarMultiNorma`), G012 (calificadores contradictorios 5%/2%), G013/G014 (huérfanos F24/F29/F37: **decisión** conectar o retirar). G020: falta `modal-detalle.js` (workflow '2/4' + tendencia seno+random). | 🟡 motor pend |
| **TODO-12** | Ola 3: G025 (tests de `firestore.rules` vía emulador), G022/G094 (`lucide@latest` sin SRI 67 pág — pin+SRI/self-host), G111 (deps `websocket-driver`), G024/G019 (CSP + escapar innerHTML dashboards). | 🟡 CI+links ✅ |
| **TODO-13** | Ola 4: G016 (dashboard suscribe 2× — refactor `suscribirStockGlobal` para exponer lo que ya lee), G017 (stock no atómico en `runTransaction`), G095 (borrado transformador sin cascada). | 🟡 2/5 ✅ |
| **TODO-14** | Ola 5: separar 5 dominios del repo (app/cerebro/skills/OLTC/contratos), G119 (`functions/domain` copia commiteada → gitignore+rm), monolitos (shell 2398L, parque 275KB). (nav.js/css muertos ✅ retirados). | 🟡 nav ✅ |
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
