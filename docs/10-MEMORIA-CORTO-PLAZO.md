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
> 2. **Fase 2 bloques** (TODO-06, ADR-006): **HECHA + DESPLEGADA (2026-06-06)** — función emite `bloques`
>    (tool `HERRAMIENTA_PRUEBAS` ampliado + system prompt) y los DEVUELVE; data layer `guardarBloques`/
>    `cargarBloques` (JSON a Storage `…/{informeId}.bloques.json`, carga perezosa, re-sanitiza con dominio);
>    shell persiste tras `crearInforme` (falla suave). storage.rules YA cubre `.bloques.json` (sin cambio).
>    Commiteada (falta **push del director**). **PENDIENTE: validar E2E la versión nueva (TODO-05) + Fase 3.**
> 3. **Fase 3 bloques**: **HECHA (2026-06-06, sin push aún)** — sección `#bloques` en la página +
>    `montarBloques` en el shell: carga perezosa con `cargarBloques` por informe REAL (no seed), cache por
>    informeId (anti-refetch en onSnapshot), render agrupado por año vía `mountBloques` (Fase 1). Frontend
>    puro → SIN deploy de función, solo push del director. **Falta validar render en vivo (acoplado al E2E).**
> 4. **Extras maqueta: HECHOS (2026-06-06)** — callout de hallazgo (título `.ttl` + variante `warn` por
>    `calif`/punto a verificar) + barras/puntos **rayados** (patrón `hatch` SVG) sobre `verificar=true`.
>    Campo `verificar` añadido al punto (dominio + función emite + redeploy). "Lista dinámica de informes"
>    ya existía (`renderInformes`/`reportlist`). **Falta solo push + validar E2E.**
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
| **TODO-05** | Validar extracción IA E2E (1 PDF real). 1er intento (DB5.pdf escaneado) falló por **timeout** → fix L-27 (timeouts 540s + 1GiB) desplegado. **Reintentar la subida.** | 🔄 en curso | reintento del director |
| **TODO-06** | Tablero flexible "bloques" (ADR-006): **Fase 1 ✅** (dominio + render genérico). **Fase 2 ✅ desplegada** (función emite `bloques` + data layer + shell persiste). **Fase 3 ✅** (sección `#bloques` + `montarBloques` lazy/cache/por-año). Falta: **push del director + validar render en vivo (E2E)** + extras maqueta opcionales. | 🔄 Fases 1-3 hechas | push + validar E2E |

> Cerrados y consolidados: **TODO-03** (cleanup raíz) y **TODO-04** (IA Pruebas Eléctricas) → ver ADR-003/004 en `99`.

---

## 🔮 Contexto estratégico

- Plan v2.2 (F16–F37) **cerrado** en tag `v2.0.0`; ciclos de pulido hasta `v2.4.1`. Modo "features puntuales + bugfixes de campo".
- `_legacy/CLAUDE-previo.md` = referencia histórica (14 reglas §0.1.2.* condensadas en `30-LECCIONES`).
- Skills en `skills/` (catálogo paralelo); auditoría especializada se activa con **Trigger 🔵**.

## 📝 Bitácora (efímera)

- **2026-06-06** — **Fix timeout extracción IA (L-27)**: el 1er E2E del director (DB5.pdf, 3.86 MB / 5 págs escaneadas) "procesó por minutos" y la IA cayó al motor local. RCA vía telemetría: `httpsCallable` **sin `timeout` → default 70 s del SDK**; Claude con thinking+effort+bloques tarda más → cliente aborta (deadline-exceeded) → fallback local (OCR lento = los "minutos"). El 404 de `bloques.json` en consola es BENIGNO (`cargarBloques` sin JSON). Fix: cliente `httpsCallable(..., {timeout:540000})` + función `timeoutSeconds:540`, `memory:'1GiB'`. Redesplegada OK. 997/997. **Falta reintentar la subida.**
- **2026-06-06** — **Extras maqueta bloques**: (1) callout de hallazgo en `renderBloque` — título `.ttl` + variante `warn` ("Dato a verificar") cuando `calif` o algún punto pide confirmación (clases `.callout.warn/.ttl` ya en CSS). (2) Patrón `hatch` SVG: barras `fill:url(#peh-hatch)` + ⚠ y puntos de línea como anillo ámbar hueco cuando `verificar=true`. Campo `verificar` (bool, solo si true) añadido al punto en el dominio (`sanitizarPunto`) + test (997/997); función emite `verificar` por punto (schema + system prompt) y **re-desplegada** (southamerica-east1). "Lista dinámica de informes" ya existía. SIN domain test roto (deepEqual `{x,y}` intacto porque el flag se omite si es false).
- **2026-06-06** — **Fase 3 bloques (frontend)**: sección `#bloques` en `pages/pruebas-electricas.html` (antes de Criterios) + estilos `.pe-bloque`/`.pe-bloque-grupo` en el CSS. Shell: `montarBloques(unidadId, informes)` — carga perezosa `cargarBloques` de cada informe REAL (filtra `_seed`), `state.bloquesCache` por informeId (onSnapshot re-renderiza; no refetch), guarda anti-carrera (aborta si la unidad cambió), render agrupado por año desc vía `mountBloques` (Fase 1). Cache se limpia en `seleccionarUnidad`; contenedor se vacía en `renderVacioSeleccion`. Frontend puro → SIN deploy. lint+tests 996/996. **Falta push + validar render en vivo (necesita informe real con bloques en Storage = el E2E aplazado).**
- **2026-06-06** — **Fase 2 bloques DESPLEGADA**: `firebase deploy --only functions:extraerPruebasElectricasIA` OK (*Successful update operation*, southamerica-east1). Commit creado por Claude; **falta push del director**. El director valida E2E la versión nueva (TODO-05). Decisión del director: deployar ya y validar la versión nueva (opción 2).
- **2026-06-06** — **Fase 2 bloques (código)**: función `extraerPruebasElectricasIA` ahora emite `bloques` (property aditivo en `HERRAMIENTA_PRUEBAS` + guía en system prompt: curva COMPLETA, complementa NO reemplaza los campos canónicos) y los devuelve en la respuesta. Data layer: `guardarBloques(unidadId, informeId, raw)` (sanitiza con dominio → JSON a Storage `…/{informeId}.bloques.json`, no escribe si vacío) + `cargarBloques` (lazy, re-sanitiza). Shell `storeReport` persiste tras `crearInforme` (captura `informeId`, falla suave). **Hallazgo de diseño**: la función NO conoce el `informeId` (lo crea el cliente DESPUÉS de extraer) → el cliente persiste, la función solo devuelve. storage.rules ya cubre `.bloques.json`. lint OK · 996/996 tests verde. **SIN commit/deploy** (deploy cambia extracción pendiente de validar TODO-05 → decisión del director).
- **2026-06-06** — Tablero flexible "bloques de análisis" (ADR-006, arquitecto): Fase 1 — dominio genérico `pruebas_electricas_bloques.js` (acotado/versionado) + motor de render `grafico-generico.js` (línea/barra multi-serie, eje dinámico) + 11 tests (suite 125/125). Decisión clave: detalle pesado a JSON en Storage (lazy), resumen liviano en Firestore. Pendiente Fase 2/3 (extracción emite bloques + integración).

- **2026-06-06** — **Consolidación de cerebro** (a pedido del director, que notó que no se estaba consolidando): la obra de Pruebas Eléctricas (IA + tablero detallado + eliminar libros + fixes de gráficas) → **ADR-004**; gobernanza (purga de `Debug/` del historial + nuevo flujo commit/deploy/push) → **ADR-005**. Filas en `00`, `05` refrescado, `10` podado, lecciones L-20..L-26. brain:check SANO.
- **2026-06-06** — `origin/main` = `1678809` tras force-push del director (sin `Debug/`, con features). Función IA re-desplegada por Claude (southamerica-east1) con `auto`+thinking.
