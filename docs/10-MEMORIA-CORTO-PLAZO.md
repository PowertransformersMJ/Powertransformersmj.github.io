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

## 🎯 Foco actual — HANDOFF (sesión cerrada 2026-06-07, consolidada a ADR-008)

> **TEMA VIVO: Tablero de Pruebas Eléctricas con IA — "ir MÁS ALLÁ del informe".**
> Arco completo consolidado en **ADR-008** (lee `00`→`99 §8`). Recorrido previo: ADR-003/004
> (función IA + tablero detallado), ADR-006 (bloques), ADR-007 (subsistema de diagnóstico).
>
> **Estado: rediseño COMPLETO en código, desplegado y mergeado a `main`** (`origin/main=6a384db`,
> `origin/DESARROLLO=b42b8aa=HEAD`). La IA (Opus 4.7) **extrae EXCELENTE** (9 bloques, curvas de 17
> TAPs, bujes, DAR, análisis crítico, cazó un error de digitación). El tablero es **IA-primaria**:
> bloques = cuerpo, scorecard derivado de la calif de la IA, render interactivo (auto-rango, filtro
> por fase, tabla por TAP, **chart de desviación con física por prueba**, callout de análisis).
> Prompt de la función pide `limite_desbalance` + IP + análisis crítico obligatorio.
>
> **🔴 ÚNICO PASO ABIERTO (TODO-07): validación VISUAL del director.** Lo nuevo (desviación correcta,
> análisis sin truncar, scorecard tan δ) **solo se ve al RE-CARGAR 450108 una vez** — la versión
> guardada en Firestore tiene cálculos/textos viejos. El scorecard se corrige con solo recargar el
> sitio. Tras la re-carga, el director pasa el panel/JSON y se afina el siguiente detalle. La math de
> desviación YA está verificada contra el informe (excitación 3.12%/1.07% = informe 3.0%/1.06%).
> **Limitado por dato**: IP necesita lectura R10min, que ESTE informe no trae (la IA no lo inventó).
>
> **MAPA DE ARCHIVOS CLAVE**: Función IA `functions/index.js#extraerPruebasElectricasIA` (prompt +
> schema bloques) · Render genérico (auto-rango/filtro/desviación) `assets/js/ui/pruebas/grafico-generico.js`
> · Dominio bloques (`limite_desbalance`, cap obs 1200) `assets/js/domain/pruebas_electricas_bloques.js`
> · Shell (scorecard derivado, encabezado, nomenclatura, seed off) `assets/js/pruebas-electricas-shell.js`
> · Schema (fix collar) `assets/js/domain/pruebas_electricas_schema.js` · Data layer (diagnóstico Firestore)
> `assets/js/data/pruebas_electricas.js` · Página `pages/pruebas-electricas.html` · CSS `assets/css/pruebas-electricas.css`.
> Diagnóstico de la IA: panel admin "Interpretación cruda" + `firebase functions:log` → `[IA-DIAG-RESUMEN]`.
>
> **Flujo git (ADR-005)**: Claude commitea + deploya; el director pushea. Claude NUNCA force-push a `main`.
>
> **🚫 Callejones sin salida (curados)**: (1) push del runtime da 403 → solo el director pushea (L-01).
> (2) `httpsCallable` default 70s → fijar `timeout` explícito cliente+server (L-27). (3) Storage NO se LEE
> desde el browser sin CORS → datos legibles van a **Firestore** (L-29). (4) Firestore prohíbe arrays
> anidados → serializar a string JSON (L-30). (5) UI gated por rol → re-render en `sgm:session-ready` (L-28).
> (6) la clave `prueba` de la IA NO es estable (tand↔tan_delta) → **aliasear** (L-31). (7) desviación NO es
> genérica: excitación usa las 2 fases laterales (la central es menor por geometría), resto vs promedio.

---

## 📋 Pendientes abiertos (TODO-NN)

> Al cerrar uno: ✅ + link al ADR §NN, y retirarlo en la próxima poda.

| ID | Item | Estado | Bloqueo |
|---|---|---|---|
| **TODO-01** | Tipificar S03/S04/S05/S06 del contrato 4125000143 (script `scripts/migrate/tipificar-suministros-fan-db.js`, `dryRun` primero) | 🔮 abierto | director corre el script |
| **TODO-02** | Flujo de selección runtime FN-063 vs FN-050 (contrato 4123000081) | 🔮 abierto | brief del director |
| **TODO-07** | **Validación VISUAL del tablero (ADR-008) — lote 4 (commit `a790f94`)**: director (1) **pushea `a790f94`** (DESARROLLO→Pages: filtro por fase en barras + franja de criterio verificable) y (2) **re-corre 450108** (función ya deployada → tablas de TAP completas + recalcula scorecard/desviación viejos en un solo re-run). Luego pasa panel/JSON para siguiente lote. (Umbral resistencia ≤5% IEEE 62.2/C57.152 confirmado por el director — sin cambio de código.) | 🔄 abierto | push + re-corrida + feedback del director |

> Cerrados y consolidados: **TODO-03/04** → ADR-003/004 · **TODO-05** (E2E: la IA extrae excelente) y **TODO-06** (bloques Fases 1-3 + extras) → **ADR-008** en `99`.

---

## 🔮 Contexto estratégico

- Plan v2.2 (F16–F37) **cerrado** en tag `v2.0.0`; ciclos de pulido hasta `v2.4.1`. Modo "features puntuales + bugfixes de campo".
- `_legacy/CLAUDE-previo.md` = referencia histórica (14 reglas §0.1.2.* condensadas en `30-LECCIONES`).
- Skills en `skills/` (catálogo paralelo); auditoría especializada se activa con **Trigger 🔵**.

## 📝 Bitácora (efímera)

- **2026-06-07** — **Lote 5 (verificación + corrección, feedback del director)**: el director mostró que la tabla de TAP seguía flaca y que las gráficas de desviación NO tenían filtro por fase. **Verifiqué con logs `[IA-DIAG]`** (no asumí): los bloques de curva salen con `series` pero SIN `tabla` → el refuerzo de prompt del lote 4 no bastó (instrucción en prosa = sugerencia débil). Correcciones: (1) gráficas de desviación ahora filtrables por fase (refactor `montarGrafica` compartido en `grafico-generico.js`); (2) prompt con **ejemplo few-shot concreto** de la `tabla` completa por TAP (excitación/relación/resistencia). Lección **L-32** (verificar salida LLM antes de declarar hecho). Función **re-desplegada**. **Pend**: director re-corre 450108 y **YO verifico por logs** que la `tabla` ya viene ANTES de declarar OK.
- **2026-06-07** — **Lote 4 (feedback del director sobre 450108, commit `a790f94`)**: comparé el informe PDF completo (29 págs) vs el tablero. (1) Filtro por fase ahora en TODAS las gráficas: curvas (fase=serie) y barras (fase=categoría: bujes H1/H2/H3, resistencia MT/BT) vía `detectarFases()` en `grafico-generico.js`. (2) Criterio verificable por bloque (fórmula+umbral+norma) = `CRITERIOS_NORMA` en `pruebas_electricas_schema.js`, lo adjunta el shell por familia (`criterioDe`/`conCriterios`), render en franja `.pe-criterio`. (3) Tablas de TAP incompletas: el render derivaba tabla skinny de las series (solo fase A/B/C); reforcé prompt+schema de la IA para que emita la `tabla` COMPLETA (Potencia W, %DIF, R.Ref, Desviación, Evaluación, voltajes) — requiere re-extract. Función **deployada**. Tests 997/997 + lint verde. **Pend**: director pushea `a790f94` + re-corre 450108.
- **2026-06-07** — **Cierre de sesión + consolidación**: todo el arco del tablero de Pruebas Eléctricas (pipeline de bloques completo Fases 2-3 + extras, subsistema de diagnóstico, rediseño IA-primaria Etapas 1-3, render interactivo, prompt IA, correcciones) → consolidado en **ADR-008** (`99 §8`) + fila en `00`. Lecciones nuevas L-27..L-31 en `30`. `05` refrescado. `10` podado a este handoff. brain:check SANO. **Único pendiente vivo: TODO-07 (validación visual del director re-cargando 450108).**
