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
| **TODO-09** | 🔴 **Ola 0 — Confidencialidad** ✅ **COMPLETA** (ADR-052; commits `7c43908`→`6298916`): binarios confidenciales retirados (→bóveda `confidencial-retirado-2026-07-21/`), Storage cerrado+desplegado, historia git reescrita (`.git` 220M→23M, respaldo bundle 110M), G021/G006/G101 (datos reales embebidos→demo + guards, verificado). **Restan solo**: (d) 🔴 el Ingeniero pide a **GitHub Support** purga de `refs/pull/*` (commits viejos por SHA); (e) follow-ups: `SGM_DATA_SOURCE` real + template xlsm sanitizado (roto export) + fixture test. | ✅ core | GitHub Support (d) + follow-ups |
| **TODO-10** | 🔐 **Ola 1 — Backend** (commit `630cd7c`). ✅ **Reglas DESPLEGADAS en vivo**: G004 (`/admins` ya no ignora desactivación — `adminsBootstrapValido`, conserva bootstrap sin-perfil), G002 (auditoría create → `isTeamMember`), G005 (storage isAdmin reconoce admins v2). ✅ G009 (.gitignore secretos). ⏸️ **G007/G008 (callables IA: chequeo rol + storagePath) CÓDIGO LISTO pero DEPLOY BLOQUEADO**: `firebase deploy --only functions` falla con **403 billing** (Secret Manager `LLM_API_KEY` exige plan **Blaze**; proyecto en Spark). 🔴 **ACCIÓN DEL INGENIERO**: revisar billing en consola Firebase — si las CF de IA estaban funcionando es que Blaze lapsó (¿tarjeta/crédito?); reactivarlo permite el deploy Y es probable que las CF actuales tampoco corran hoy. Free-tier sagrado: Blaze tiene tier gratis, pero es decisión tuya. | 🟡 reglas live / functions pend-billing | acción billing |
| **TODO-11** | 🧮 **Ola 2 — Dominio**. 🟡 **G020 PARCIAL hecho** (commit `3bc89c4`): retirado KPI fabricado '4.2h' (kpis.js) + reetiquetado "tiempo real" → "Simulación (datos NO reales)" (cargabilidad-shell.js). ⏳ **FALTA G020**: modal-detalle.js (workflow estático '2/4' + tendencia seno+random). ⏳ **FALTA (motor normativo — NO rush, trabajo cuidadoso con tests)**: G010 (umbrales HI editables que ningún cálculo consume → hilar `/umbrales_salud/global` por `snapshotSaludCompleto`), G011 (excitación no pasa corriente al calificador → hilar `corrienteMA` por `metricaPrueba`/scorecard), G012 (calificadores contradictorios resistencia 5%/2% entre schema y semáforo), G013/G014 (módulos huérfanos F24/F29/F37: conectar o retirar). | 🟡 G020 parcial / motor pend | motor normativo con cuidado |
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
