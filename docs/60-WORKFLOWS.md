# 🔁 60 — WORKFLOWS REUTILIZABLES (catálogo de procesos de detección)

> **Nodo neuronal: catálogo de procesos.** Recetas **reutilizables** que cazan los MISMOS errores
> una y otra vez, para no reinventar el proceso cada sesión. On-demand: NO se auto-carga.
>
> **Cuándo leerlo (Trigger 🧪 Experiencia + 🔵 Auditoría)**: ANTES de una revisión/auditoría/verificación
> o de una operación repetitiva — *"voy a revisar reglas / un criterio normativo / una importación /
> lo que dejó un subagente / si esto cumple"*.
>
> **W-11 es la SSoT del flujo fuerte**: si la tarea dispara su GATE, se recorre COMPLETO o no se aplicó.
> Su forma operativa es la skill global `proceso-decision-fuerte`.
>
> Origen: portado del ecosistema hermano (2026-07-28, ADR-058) y **adaptado a SGM** — W-01/W-05 sobre
> Firestore/CF reales de este repo, W-04/W-06 con la regla del Ingeniero (*workflows acotados y con Opus*),
> y **W-12/W-13 son propios**: no existen en el catálogo de origen.

---

## 🧭 Catálogo

| ID | Workflow | Cuándo usarlo | Qué detecta | Cómo se corre |
|---|---|---|---|---|
| **W-01** | **Red-team de reglas Firestore/Storage** | Antes de desplegar `firestore.rules` / `storage.rules` | Fuga de datos entre roles, escritura no autorizada, escalada `tecnico`→`admin` | Lentes que intentan ROMPER las reglas (escalada · lectura indebida · integridad) + `npm run test:rules` (emulador) |
| **W-02** | **Auditoría de panel/feature por dimensiones** | Antes de moldear o construir una fase del tablero | Huecos de UX, navegación, dominio, costo/escala en free-tier | Una lente por dimensión → síntesis contra el norte. Acotado. |
| **W-03** | **Red-team de diseño** | Antes de congelar un diseño caro de revertir (schema, RBAC, flujo de datos) | Supuestos frágiles, modos de fallo, sobre-ingeniería | Lentes (seguridad · costo · escala · datos · mantenibilidad) atacan el diseño → síntesis |
| **W-04** | **Verificación post-subagente** | SIEMPRE tras delegar a un subagente o workflow | Que el subagente **alucinó**: reporta algo que no quedó en el repo | Releer los archivos/estado REALES y comparar contra lo reportado. Nunca dar por bueno el informe. |
| **W-05** | **Testing de Cloud Functions (puro + integración)** | Antes de desplegar una CF (`southamerica-east1`) | Bugs de lógica + glue del trigger | Separar **lógica pura** (`node --test`, sin emulador) de **integración** (emulador real). Ojo: `functions/domain/` DIVERGE de `assets/js/domain/` — verificar cuál se está tocando. |
| **W-06** | **Fan-out multi-agente ACOTADO** | Decisión que cruza varios sub-temas independientes | Puntos ciegos, hechos sin verificar, opciones no consideradas | N agentes **dimensionados al mínimo**, `model: opus`, inline + schema, sin tools, in-cwd → sintetizar. Regla del Ingeniero (2026-07-23): acotados y con Opus; lo pesado se cuelga. |
| **W-07** | **Comité de expertos ×3** | Mejorar cualquier entregable importante | Debilidades, errores, falta de profundidad | Skill `comite-expertos` |
| **W-08** | **Investigación con fuente primaria** | Antes de afirmar un hecho normativo/externo | Datos inventados o desactualizados | Fuente primaria (MO.00418 en mano, IEEE, NETA, CREG) y marcar lo no confirmable como `⚠️ verificar`. **Nunca fabricar el dato faltante** (ADR-027). |
| **W-09** | **brain:check (linter del cerebro)** | Al arrancar/cerrar sesión o tras tocar el cerebro | Huérfanas, caps reventados, índice desincronizado, refs colgantes, kernel forkeado | `npm run brain:check` (§G.4) |
| **W-10** | **Caza-bugs: camino vivo end-to-end** | Al **TOCAR o ROZAR** un subsistema con estado observable (render · CRUD · flujo · listener) | Bugs que solo emergen en el camino COMPLETO desde estado-cero | Recorrer las 2 fronteras del estado-cero (crear el 1er ítem → ¿aparece en vivo Y tras recargar? · borrar el último → ¿colapsa limpio?). Escalar SOLO si no-trivial. Skill `caza-bugs` |
| **W-11** | **🛡️ FLUJO FUERTE COMPLETO** | Decisión Fuerte (`15 §2`) **o** UI sensible no trivial | Que el flujo se aplique **A MEDIAS** (faltó el preview fiel / el prompt de consejo / la validación live) | Checklist CERRADO de 10 capas (↓). **Cuando dispara: COMPLETO o NO se aplicó.** Skill `proceso-decision-fuerte` |
| **W-12** | **⚡ Verificación de criterio multi-norma** *(propio)* | Al añadir/cambiar/citar un criterio de prueba eléctrica | Veredicto sacado del TEXTO de la IA en vez del VALOR contra la NORMA; criterio sin clase de tensión; norma mal atribuida; fusión indebida de calificaciones | Ver detalle ↓ |
| **W-13** | **📥 Importación de datos reales del Ingeniero** *(propio)* | Antes de cargar un Excel/entregable real a producción | Cabeceras que cambian, filas-título, silencios (filas omitidas sin reportar), sobre-escritura de datos buenos | Ver detalle ↓ |

---

## 🛡️ W-11 — el FLUJO FUERTE COMPLETO (ninguna capa es opcional cuando dispara)

**GATE (¿califica?)** — Decisión Fuerte (`docs/15-CONSEJO-EXTERNO.md §2`) **o** UI sensible no trivial.
Trivial / reversible / mecánico → trabajo directo (+ `caza-bugs` si hay estado observable). Si dispara → COMPLETO.

> **Orden:** primero EVIDENCIA (capas 1-4), después DELIBERACIÓN (5-7). Opinar antes de verificar es opinar sobre el aire.

1. **VERIFICAR ground-truth** — leer el código/estado/datos REALES (§3.3). Citar archivo:línea.
2. **SKILLS** — invocar TODAS las relevantes: dominio (`49-PRUEBAS-ELECTRICAS`, `50-TRANSFORMADORES`, las 13 de criterios) + proceso (`arquitecto-software`, `caza-bugs`, `anti-codigo-muerto`).
3. **ARQUITECTO** (`arquitecto-software`, 6 pilares) → diseño candidato CONCRETO + explícito "lo que NO verifiqué". Separar PROPONER de CRITICAR.
4. **INSTRUMENTO según el tipo:**
   • **Sistema vivo** → leer datos/logs REALES de Firestore/CF, no inferirlos del código.
   • **UI** → **preview FIEL** (módulo real + scope + composición del shell, L-56) **ANTES** de tocar producción. Aquí NO sirve un mockup bonito: el fallo histórico fue creer un preview que no reproducía el shell.
   • **Normativo** → W-08 con la fuente primaria en mano.
5. **COMITÉ ×3 ACOTADO** (`comite-expertos`) — ≥1 escéptico + ≥1 ejecutor.
6. **CONSEJO EXTERNO** (`docs/15`, **Gemini vía Antigravity, solo-lectura**) — prompt autocontenido y CRUDO (anti-anclaje). Humano en el medio. **Verificar cada afirmación: es insumo, NUNCA oráculo** (ya propuso model IDs inválidos, `99 §77`).
7. **VEREDICTO** — decido yo, con el criterio de éxito escrito ANTES de codear.
8. **IMPLEMENTAR.**
9. **VALIDACIÓN LIVE en Chrome real** (`validacion-live-chrome`, no preview headless). Entrego el **REPORTE**: la lista CERRADA de caminos que recorrí — qué recorrí, no "pasó".
10. **CIERRE** — ADR en `99` + fila en `00` + lección en `30` + `brain:check` verde. (`npm run brain:archive -- --adr NN --title "…"` hace la plomería; el juicio lo escribo yo.)

**🔒 Artefactos visibles al Ingeniero (si falta uno, el flujo está INCOMPLETO):**
(a) el **preview fiel** cuando es UI · (b) el **prompt de consejo externo** en bloque copiable · (c) el **reporte de validación live**. Se entregan SIEMPRE, sin que los pida.

---

## ⚡ W-12 — Verificación de criterio multi-norma *(propio de SGM)*

**Disparador:** tocar `pruebas_electricas_multinorma.js` / `schema.js` / `semaforo.js`, o citar un umbral.

1. **El veredicto sale del VALOR contra la NORMA** — jamás del texto que devuelve la IA (L-36/L-37/L-58).
2. **Multi-norma honesta**: el peor de TODAS las normas aplicables + **chip por norma** mostrando dónde divergen. La cita ES parte del veredicto: ninguna norma es "la buena".
3. **Por CLASE DE TENSIÓN**: un umbral sin clase es un umbral incompleto (MO.00418).
4. **Calificación global POR PRUEBA, independiente** — FP de bujes ≠ FP de devanados. **NUNCA fusionarlas** aunque no se hagan el mismo año.
5. **Atribución exacta**: si el valor no es de la norma citada, decirlo (`criterio interno ⚠️`) en vez de inventar la cita. Lo no confirmable públicamente se marca, no se rellena.
6. **DGA / aceite EXCLUIDO** del tablero de pruebas eléctricas (ADR-027). No cruzar dominios ni fabricar datos.
7. Cerrar con `npm run test:unit` (las suites de multinorma) + revisar que ningún chip perdió visibilidad.

---

## 📥 W-13 — Importación de datos reales *(propio de SGM)*

**Disparador:** el Ingeniero entrega un Excel/entregable real para cargar (ADR-057).

1. **Alias ADITIVOS de cabeceras** — las cabeceras reales cambian entre entregas; nunca renombrar ni exigir una forma exacta (§3.2 cambios aditivos).
2. **Detección de fila-cabecera** antes de importar hojas con títulos encima (columnas `__EMPTY`).
3. **Simulación primero (dry-run)**: reportar creados/actualizados EXACTOS contra el total esperado, antes de escribir nada.
4. **Guard de omitidos**: toda fila que no entra se REPORTA. Una importación que omite en silencio es peor que una que falla.
5. **El drag&drop lo hace el Ingeniero** en su Chrome (L-62) — no simularlo por él.
6. **Verificar el tablero vivo** tras la carga (W-10 + validación live), no solo el log del importador.

---

## 🌱 Cómo crece este catálogo

Cuando un proceso de revisión/detección **se repite** o demuestra valor, regístralo aquí con:
**disparador · qué detecta · cómo se corre**. Recetas cortas y accionables; el detalle de un caso
concreto vive en su `30 §L-NN` o en su ADR. Si un flujo deja de usarse, no lo borres: márcalo.
