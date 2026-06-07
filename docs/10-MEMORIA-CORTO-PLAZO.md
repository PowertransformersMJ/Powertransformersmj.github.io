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

## 🎯 Foco actual — HANDOFF (sesión cerrada 2026-06-06 por contexto lleno)

> **TEMA VIVO: Pruebas Eléctricas con IA (Claude) → tablero que grafica TODO el PDF.**
> Recorrido: ADR-003 (función IA), ADR-004 (tablero detallado + fix completitud), ADR-006
> (tablero FLEXIBLE "bloques"). Todo commiteado y **pusheado** (`origin/DESARROLLO=3f8bbdd`;
> `origin/main≈106c359`). Función `extraerPruebasElectricasIA` **desplegada** con `auto`+thinking.
>
> **Estado:** función IA viva · tablas detalladas + eje dinámico + eliminar libros vivos ·
> tablero flexible **Fase 1 hecha** (motor de bloques + render genérico + 125/125 tests).
>
> **PRÓXIMOS PASOS (en orden):**
> 1. **Validar extracción E2E** (TODO-05): subir 1 PDF real con **Sonnet**, confirmar que extrae
>    TODAS las pruebas (no solo tan δ). Si falla → `firebase functions:log --only extraerPruebasElectricasIA`.
> 2. **Fase 2 bloques** (TODO-06, ADR-006): que la función EMITA `bloques` (ampliar `HERRAMIENTA_PRUEBAS`
>    con array de bloques) + escriba JSON a Storage `pruebas_electricas/{unidadId}/{informeId}.bloques.json`;
>    data layer `cargarBloques`/persistencia.
> 3. **Fase 3 bloques**: sección en la página + `mountBloques` con carga perezosa desde Storage →
>    bushing, capacitancia (pF), DAR, tip-up y **gráficas de línea** salen "gratis" del modelo genérico.
> 4. Extras maqueta: callout de hallazgo, barras rayadas "verificar", lista dinámica de informes.
>
> **MAPA DE ARCHIVOS CLAVE** (ubicar rápido):
> · Función IA: `functions/index.js#extraerPruebasElectricasIA` · Contrato bloques (acotado):
> `assets/js/domain/pruebas_electricas_bloques.js` · Render genérico: `assets/js/ui/pruebas/grafico-generico.js`
> · Schema normativo: `assets/js/domain/pruebas_electricas_schema.js` · Cliente: `assets/js/data/pruebas_electricas.js`
> (`extraerConIA`/`eliminarUnidad`) + shell `assets/js/pruebas-electricas-shell.js#storeReport` · Tablas:
> `ui/pruebas/tabla-pruebas.js` · Gráficas año: `ui/pruebas/grafico-svg.js` (`ejeMax/ticksY`) · Maqueta spec:
> `~/Downloads/Tablero Dinamico de Pruebas Electricas.html` (NO en repo).
>
> **Flujo git (ADR-005)**: Claude commitea + deploya; el director pushea. Claude NUNCA force-push a `main`.
>
> **🚫 Callejones sin salida**: (1) push del runtime da 403 → solo el director pushea (L-01).
> (2) tool_choice **FORZADO mata el thinking** → extracción incompleta en docs densos; usar `auto`+thinking (L-26).
> (3) `2>NUL` recrea `NUL` en macOS → `2>/dev/null` (M-01). (4) NO inflar el doc Firestore con el detalle
> pesado → va a Storage JSON lazy (ADR-006).

---

## 📋 Pendientes abiertos (TODO-NN)

> Al cerrar uno: ✅ + link al ADR §NN, y retirarlo en la próxima poda.

| ID | Item | Estado | Bloqueo |
|---|---|---|---|
| **TODO-01** | Tipificar S03/S04/S05/S06 del contrato 4125000143 (script `scripts/migrate/tipificar-suministros-fan-db.js`, `dryRun` primero) | 🔮 abierto | director corre el script |
| **TODO-02** | Flujo de selección runtime FN-063 vs FN-050 (contrato 4123000081) | 🔮 abierto | brief del director |
| **TODO-05** | Validar extracción IA E2E (1 PDF real, Sonnet) tras fix auto+thinking | 🔄 en curso | prueba del director |
| **TODO-06** | Tablero flexible "bloques" (ADR-006): **Fase 1 ✅** (dominio `bloques` + render genérico + tests). **Fase 2** (función emite `bloques` + escribe JSON a Storage + data layer cargar/guardar) y **Fase 3** (sección en página + carga perezosa; bushing/capacitancia/DAR/tip-up). | 🔄 Fase 1 hecha | construir Fase 2/3 |

> Cerrados y consolidados: **TODO-03** (cleanup raíz) y **TODO-04** (IA Pruebas Eléctricas) → ver ADR-003/004 en `99`.

---

## 🔮 Contexto estratégico

- Plan v2.2 (F16–F37) **cerrado** en tag `v2.0.0`; ciclos de pulido hasta `v2.4.1`. Modo "features puntuales + bugfixes de campo".
- `_legacy/CLAUDE-previo.md` = referencia histórica (14 reglas §0.1.2.* condensadas en `30-LECCIONES`).
- Skills en `skills/` (catálogo paralelo); auditoría especializada se activa con **Trigger 🔵**.

## 📝 Bitácora (efímera)

- **2026-06-06** — Tablero flexible "bloques de análisis" (ADR-006, arquitecto): Fase 1 — dominio genérico `pruebas_electricas_bloques.js` (acotado/versionado) + motor de render `grafico-generico.js` (línea/barra multi-serie, eje dinámico) + 11 tests (suite 125/125). Decisión clave: detalle pesado a JSON en Storage (lazy), resumen liviano en Firestore. Pendiente Fase 2/3 (extracción emite bloques + integración).

- **2026-06-06** — **Consolidación de cerebro** (a pedido del director, que notó que no se estaba consolidando): la obra de Pruebas Eléctricas (IA + tablero detallado + eliminar libros + fixes de gráficas) → **ADR-004**; gobernanza (purga de `Debug/` del historial + nuevo flujo commit/deploy/push) → **ADR-005**. Filas en `00`, `05` refrescado, `10` podado, lecciones L-20..L-26. brain:check SANO.
- **2026-06-06** — `origin/main` = `1678809` tras force-push del director (sin `Debug/`, con features). Función IA re-desplegada por Claude (southamerica-east1) con `auto`+thinking.
