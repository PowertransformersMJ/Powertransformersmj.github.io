# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Nodo neuronal: Memoria a Corto Plazo.** Junto con `CLAUDE.md` + `05-ESTADO-GLOBAL`,
> es de las primeras lecturas de cada sesión (Ignorancia Selectiva, `CLAUDE.md §G`).
> SOLO lo vivo: foco actual, pendientes abiertos, bitácora. Estado técnico → `05`.
>
> **Es la pizarra, no el archivo.** Al cerrar una tarea: consolidar a ADR (`99`) +
> fila en `00-INDICE`, extraer lecciones a `30`, y PODAR esto al foco vivo (GC §G.4).
>
> **Convención de handoff (relevo a ventana nueva)**: el "Foco actual" debe incluir
> **🚫 Callejones sin salida** — qué se probó que FALLÓ y NO reintentar, con el porqué.
> Le ahorra al próximo "tú" repetir errores ya descartados (relevo curado > `/compact`).

---

## 🎯 Foco actual — HANDOFF (sesión cerrada 2026-06-07)

> **TEMA: Tablero de Pruebas Eléctricas con IA — "ir MÁS ALLÁ del informe".**
> **Arco COMPLETO consolidado en ADR-003→ADR-009 y EN PRODUCCIÓN** (`origin/main=7f2b61b`, PR #128;
> `origin/DESARROLLO=f2533da=HEAD`, en sync). Detalle: `00`→`99 §3..§9`.
>
> **Qué hay hoy (todo en prod):** la IA (Opus 4.7) extrae EXCELENTE; tablero **IA-primaria** (bloques =
> cuerpo, scorecard derivado). **Completitud DETERMINISTA** (ADR-009): `derivarTablaTAP` arma la tabla por
> TAP desde las series + Desviación/Evaluación derivadas en cliente; la IA aporta lo único-del-PDF por el
> **canal `extra`** (Potencia/Tensión/Relación teórica/%DIF/R.Ref — **VERIFICADO** por el auditor). Excitación
> con Potencia graficada + desviación ÷mayor; relación con desviación = %DIF (vs placa); **aislamiento conforme
> a NETA por clase** (110 kV→30 GΩ → los 5–6 GΩ medidos = "pobre"). Subtítulos por gráfica + criterios con
> fórmula. **Pestaña Tendencia (F1)** + **Biblioteca como HUB** (informes + PDF + accesos Tablero/Tendencia).
> **Workflow de auditoría por sección**: `scripts/audit-bloques-pruebas.mjs` + hoja `workflow-auditoria-secciones-pruebas.md`.
>
> **PRÓXIMO:** Arco Tendencia **F1-F3 EN PRODUCCIÓN y consolidado → ADR-010 (`99 §10`)** (F2 PR #130, F3 PR #131,
> `main 75daf29`). ⚠️ **ÚNICO pendiente del tablero: confirmación VISUAL del director** de la franja-timeline (F2)
> y la narrativa por IA (F3) en vivo — Claude no puede (UI gated por Auth+Firestore). Luego: seguir validando
> secciones con informes reales; confirmar valores NETA si la edición de la norma del director difiere.
>
> **MAPA DE ARCHIVOS CLAVE**: Funciones IA `functions/index.js#extraerPruebasElectricasIA` (extracción, canal `extra`)
> + `#narrativaTendenciaIA` (F3, narrativa sin PDF) · Render genérico `assets/js/ui/pruebas/grafico-generico.js` ·
> Dominio bloques `…/pruebas_electricas_bloques.js` (`derivarTablaTAP`/`extra`) · Tendencia `…/pruebas_electricas_tendencia.js`
> (`bloquesTendencia`/`resumenTendenciaParaIA`) · Semáforo `ui/pruebas/semaforo.js` (`estadoInforme`/`lineaTiempoInformes`) ·
> Schema `…_schema.js` (`CRITERIOS_NORMA`/`NETA_IR_MIN_GOHM`) · Capa datos `data/pruebas_electricas.js` (`narrarTendencia`) ·
> Shell `pruebas-electricas-shell.js` (`renderTendenciaUI`/`timelineHtml`/`onGenerarNarrativa`/`narrativaCache`) ·
> Página `pages/pruebas-electricas.html` · CSS `…/pruebas-electricas.css` · Auditor `scripts/audit-bloques-pruebas.mjs`. Ref local gitignored: `450108/`.
>
> **Flujo git (ADR-005)**: Claude commitea + deploya; el director pushea/mergea. Claude NUNCA force-push a `main`.
>
> **🚫 Callejones sin salida (curados)**: (1) push del runtime da 403 → solo el director pushea (L-01).
> (2) `httpsCallable` default 70s → `timeout` explícito cliente+server (L-27). (3) Storage NO se LEE del browser
> sin CORS → datos legibles a **Firestore** (L-29). (4) Firestore prohíbe arrays anidados → string JSON (L-30).
> (5) UI gated por rol → re-render en `sgm:session-ready` (L-28). (6) clave `prueba` de la IA NO estable
> (tand↔tan_delta) → **aliasear** (L-31). (7) el LLM OMITE estructura redundante (tabla ancha) aunque insistas →
> derivar en cliente + `extra` inline (L-32/L-33). (8) NO graficar toda clave `extra` (duplica/ensucia: R.Ref≈R)
> → curar (L-34). (9) desviación NO genérica: excitación ÷ lateral mayor, relación = %DIF (vs placa), resistencia
> vs promedio. (10) aislamiento NO es ≥1 GΩ genérico → mínimo NETA por clase de tensión.

---

## 📋 Pendientes abiertos (TODO-NN)

> Al cerrar uno: ✅ + link al ADR §NN, y retirarlo en la próxima poda.

| ID | Item | Estado | Bloqueo |
|---|---|---|---|
| **TODO-01** | Tipificar S03/S04/S05/S06 del contrato 4125000143 (script `scripts/migrate/tipificar-suministros-fan-db.js`, `dryRun` primero) | 🔮 abierto | director corre el script |
| **TODO-02** | Flujo de selección runtime FN-063 vs FN-050 (contrato 4123000081) | 🔮 abierto | brief del director |

> Cerrados y consolidados: **TODO-03/04** → ADR-003/004 · **TODO-05/06** → ADR-008 · **TODO-07** (arco del tablero: completitud determinista, workflow de auditoría, excitación/relación/aislamiento, tendencia F1, biblioteca-hub) → **ADR-009** (EN PRODUCCIÓN, PR #128).

---

## 🔮 Contexto estratégico

- Plan v2.2 (F16–F37) **cerrado** en tag `v2.0.0`; ciclos de pulido hasta `v2.4.1`. Modo "features puntuales + bugfixes de campo".
- `_legacy/CLAUDE-previo.md` = referencia histórica (14 reglas §0.1.2.* condensadas en `30-LECCIONES`).
- Skills en `skills/` (catálogo paralelo); auditoría especializada se activa con **Trigger 🔵**.

## 📝 Bitácora (efímera)

- **2026-06-07** — **2 fixes de biblioteca (revisan ADR-009 §9.2):** (1) **click en libro YA NO salta al tablero** → despliega el hub "Libro abierto" (opciones Ver tablero/Ver tendencia) y hace scrollIntoView (`onClickParque`). El atajo serieInput+Enter sí sigue yendo al tablero (deliberado). (2) **Dedupe de serie**: `normalizarSerie` (dominio, sin espacios/guiones, mayúsculas; refactor de `confirmarSerie`) + en `storeReport` se reutiliza el libro existente cuya serie normalizada coincide → evita partir la tendencia por formato (`173523-15510` vs `17352315510`). Backward-compatible (NO cambia docId existente, solo compara). +5 tests `normalizarSerie`. **1036/1036 verde + lint.** ⚠️ Sin verificar en navegador. Pendiente commit+push (director). NO se auto-extrae la serie del PDF para auto-enrutar (mejora futura posible).
- **2026-06-07** — **Tendencia F2+F3 → consolidado en ADR-010 (`99 §10`)** + fila en `00` + L-35 en `30`. F2 (franja-timeline determinista, `estadoInforme`/`lineaTiempoInformes`) + F3 (narrativa por IA on-demand, CF `narrativaTendenciaIA` desplegada, sin PDF). **EN PRODUCCIÓN** (F2 PR #130, F3 PR #131, `main 75daf29`). 1031/1031 verde. ⚠️ Falta confirmación visual del director (UI gated). `10` podado, `05` al día, brain:check SANO.
- **2026-06-07** — Arco del tablero → ADR-009 (`99 §9`). EN PRODUCCIÓN (PR #129).
