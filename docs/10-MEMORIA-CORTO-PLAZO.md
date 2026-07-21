# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Nodo de Memoria a Corto Plazo.** Junto con `CLAUDE.md` + `05-ESTADO-GLOBAL`, es de las primeras
> lecturas de cada sesión (Ignorancia Selectiva, §G.1). SOLO lo vivo: foco actual, pendientes abiertos,
> bitácora. Estado técnico → `05`. Es la **pizarra, no el archivo**: al cerrar una tarea, consolidar a
> ADR (`99`) + fila en `00`, extraer lecciones a `30`, y PODAR esto al foco vivo (GC §G.4).

---

## 🎯 Foco actual (2026-07-21)

> **✅ HOY: Fase 9 diagnóstico COMPLETADA (ADR-052, `99 §52`)** — escaneo total (14 auditores) +
> 11 verificadores adversariales en Fable (**0 refutados de 41 crítica/alta**). 123 hallazgos en
> **6 olas**. Informe detallado + crudos en la **bóveda privada** `~/Desktop/brain-private/sgm-transpower/
> research-archive/2026-07-21-fase9/` (NO al repo público: cataloga qué confidencial está expuesto).
>
> **➡️ SIGUIENTE: el Ingeniero autoriza qué olas ejecutar** (⛔ NO refactorizar sin su OK — se ejecuta
> ola por ola con verificación). **Ola 0 = EMERGENCIA** (confidencialidad/copyright en repo público).
> El producto (FP/Tan δ devanados) queda en pausa hasta que decida el orden.
>
> **🚫 Callejones (NO reintentar)**: pasar `args` grandes a un Workflow como string → llega serializado
> (`args.batches` undefined, 0 agentes); EMBEBER los datos en el script · tablas dentro de `tand-panel.js`
> → las da `montarPanelPrueba` (L-57) · chip POR norma no consolidado (L-58) · "Reprocesar" (ADR-020).

---

## 📋 Pendientes abiertos (TODO-NN)

| ID | Item | Estado | Nota |
|---|---|---|---|
| **TODO-09** | 🔴 **Ola 0 — Confidencialidad/copyright**. ✅ HECHO (2026-07-21): retirados TODOS los binarios-doc confidenciales del repo (15 root + 13 contratos + 3 xlsm + 3 PDFs pruebas seed → bóveda `confidencial-retirado-2026-07-21/`); `storage.rules` read→`isSignedIn()` DESPLEGADO; `.gitignore` blindado; `main`+dev en historia REESCRITA (git-filter-repo por extensión, `.git` 220M→23M, 0 confidenciales en historial; respaldo bundle 110M en bóveda); build verde 1171/0/12. ✅ **App-coupled HECHO (2026-07-21, commit `6298916`)**: (a) G021 — `parque-transformadores.html`: 261 registros reales → 6 DEMO sintéticos; (b) G006 — guard `page-guard.js` a parque + seguimiento-cargabilidad (verificado en navegador: redirige a login sin sesión); (c) G101 — baselines scada(2.9MB)+cargabilidad(105KB) → demo sintético (1.3KB). **Ola 0 COMPLETA salvo 2 ítems del Ingeniero/follow-up**: (d) 🔴 **PR-refs**: GitHub retiene `refs/pull/*/head` viejos (commits confidenciales por SHA) — el Ingeniero pide purga a GitHub Support o acepta GC gradual; (e) follow-ups: implementar `SGM_DATA_SOURCE` real (Firestore) + template xlsm SANITIZADO (roto el export) + fixture de test sanitizado. | ✅ core | falta acción GitHub Support (d) + follow-ups |
| **TODO-10** | 🔐 **Ola 1 — Backend**: `/admins` puerta trasera (revocación no funciona, G004); callables IA sin rol/App Check/rate-limit (G007); + rules hardening (G002/G005/G008/G009). | 🔲 | espera OK |
| **TODO-11** | 🧮 **Ola 2 — Dominio**: umbrales HI editables que nada consume (G010); excitación ignora corriente I≥50mA (G011); datos fabricados en cargabilidad (G020); calificadores contradictorios (G012); módulos huérfanos F24/F29/F37 (G013/G014). | 🔲 | espera OK |
| **TODO-12** | 🛡️ **Ola 3 — CI/red de seguridad**: `firestore.rules` sin test (G025); 1185 tests fuera de CI (G026/G109/G110); `lucide@latest` sin SRI (G022/G094); deps vulnerables (G111); XSS/CSP (G024/G019); enlaces rotos muestras.html (G023). | 🔲 | espera OK |
| **TODO-13** | 💸 **Ola 4 — Costo/robustez datos**: auditoría suministros rota `setDoc`/`addDoc` (G015, quick-win S); lecturas duplicadas dashboard (G016); tx no atómica stock (G017); `/scada_eventos` sin limit (G018); borrado sin cascada (G095). | 🔲 | espera OK |
| **TODO-14** | 🏗️ **Ola 5 — Arquitectura**: separar los 5 dominios del repo (app/cerebro/skills/estudio-OLTC/contratos); `functions/domain` copia commiteada (G119); monolitos (shell 2398L, parque 275KB); código muerto (`ui/nav.js`, FUSIÓN excitacion ADR-046). | 🔲 | espera OK |
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
>
> **2026-07-21 tarde (Opus 4.8)**: El Ingeniero autorizó las 6 olas. **Ola 0 ejecutada (binarios+historia)**:
> contención publicada a `main` + `storage.rules` desplegado + historia reescrita con `git-filter-repo`
> (force-push a main autorizado con respaldo). 🚫 Callejón git-rewrite: clonar `--branch X` reescribe SOLO
> esa rama → tags/otras ramas del remoto quedan sucias; usar `--mirror` si hay tags remotos (aquí no había).
> filter-repo aborta si el `.git` tiene `tmp_pack_*` basura → `rm` + `git gc` antes. `--paths-from-file` con
> `glob:*.pdf` (matchea todo dir) es más robusto que listar nombres. `.git` LOCAL sigue en 105M por refs
> locales viejas (tags v*, ramas `claude/*`, stash) — NO son públicas (Mac); no borrar sin pedir. FALTA la
> parte app-coupled de Ola 0 (G021 dataset embebido, G006 guards) + Olas 1-5.
>
> **2026-07-21 (Fable 5)**: **Fase 9 COMPLETADA** (ADR-052). Escaneo total 14 auditores (10 Fable + 4 Opus
> tras topes de uso, recuperados vía `resumeFromRunId`) → 123 hallazgos → 11 verificadores adversariales
> Fable por lotes: **0 refutados de 41 crítica/alta** (18 bajados a media con razón). Informe + crudos en
> bóveda `2026-07-21-fase9/`. Olas → TODO-09..14. **Brain-kit YA se puede borrar** (Fase 9 cerrada) — pero
> eso es un cambio al repo; ofrecerlo al Ingeniero. Gotcha capturado: `args` grande a Workflow llega como
> string → embeber en el script (nuevo callejón en Foco).
