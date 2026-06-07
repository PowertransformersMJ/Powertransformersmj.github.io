# 🔁 Workflow — Auditoría y completitud de secciones del Tablero de Pruebas Eléctricas

> **Hoja de detalle** (madre: `20-MEMORIA-ESPACIAL §Extracción IA`). Codifica el
> proceso REPETIBLE para detectar y corregir, en CUALQUIER sección del tablero, la
> inconsistencia recurrente: **el informe trae más columnas/magnitudes por fila de
> las que el tablero plasma** (la IA grafica el valor principal y pierde los
> secundarios). Nació del trabajo por secciones con el director (lotes 4–7, 2026-06-07).
>
> **Principio rector — el tablero es DINÁMICO**: la IA organiza, titula, interpreta
> y grafica cada informe a su criterio. Este workflow NO impone layout ni columnas
> fijas. Su única meta es **no perder datos del informe** y que las **fórmulas sean
> correctas**. Mecanismos genéricos (sirven para toda prueba, presente o futura), no
> reglas por-sección hardcodeadas.

---

## 0 · Cuándo se dispara
El director reporta "faltan datos / la tabla está incompleta" en una o más secciones,
o al cargar un informe nuevo. También de forma proactiva tras cada cambio del prompt.

## 1 · DETECTAR (¿qué secciones pierden datos?)
1. Consigue el JSON crudo de la IA: panel admin **"Interpretación cruda"** o un dump de
   `firebase functions:log` → `[IA-DIAG]` (`bloques_raw`). **Nunca asumas la salida (L-32).**
2. Corre el auditor:
   ```
   node scripts/audit-bloques-pruebas.mjs <ruta-al-json>
   ```
   Flagea cada bloque y dice qué capturó (series · extra · tabla). Banderas típicas:
   - **curva por TAP sin `extra`** → probable pérdida de columnas secundarias.
   - **barra sin `tabla`** → ¿el informe traía tabla para esa prueba?
3. Abre el **PDF del informe** en la sección flageada y lista TODAS sus columnas por fila.

## 2 · CLASIFICAR cada columna faltante
| Tipo | Ejemplos | Canal de corrección |
|---|---|---|
| **Derivable en cliente** (sin IA, determinista) | Desviación %, Evaluación, ratios | `derivarTablaTAP()` / render (`assets/js/domain/pruebas_electricas_bloques.js`, `ui/pruebas/grafico-generico.js`). Aparece solo con push, SIN re-extraer. |
| **Sólo-del-PDF** (la IA debe extraerlo) | Potencia (W), tensión aplicada, relación teórica, %DIF, R.Referencia | Canal **`extra` por punto** (`{x,y,extra:{…}}`). Reforzar prompt con **few-shot literal** (lever L-32/L-33). |
| **Magnitud secundaria GRAFICABLE** | Potencia (W) por fase | `bloquesDeExtra()` la dibuja como curva companion automáticamente. |
| **Columna de una BARRA** | tan δ por sección, bujes, aislamiento | campo `tabla` del bloque (la IA sí lo suele emitir en barras). |

> Regla: **lo computable, derívalo en cliente; lo único-del-PDF, pásalo por `extra`.**
> Los umbrales/criterios normativos van por DOMINIO (`UMBRAL_DESBALANCE`,
> `CRITERIOS_NORMA`), nunca confiando en que la IA los traiga.

## 3 · VALIDAR la fórmula contra el informe
Antes de "corregir", comprueba que el cálculo derivado **reproduce la columna del
informe** en 2–3 filas. Caso real (lote 7): la desviación de excitación se dividía
entre la lateral *menor* (3.12%) cuando el informe divide entre la *mayor* (3.0%).
Si tu número no cuadra con el del laboratorio, la fórmula está mal — ajústala.

## 4 · APLICAR la corrección
- Derivadas → editar `derivarTablaTAP` / render (genérico, toda prueba).
- `extra` → reforzar el bloque correspondiente del prompt en `functions/index.js`
  (`SYSTEM_PRUEBAS_IA`) con un ejemplo LITERAL `{x,y,extra:{…}}` para esa prueba; el
  **AUTO-CHEQUEO DE COMPLETITUD universal** del prompt cubre el resto.
- Tests puros en `tests/pruebas_electricas_bloques.test.js`. `npm test` verde.

## 5 · DESPLEGAR y VERIFICAR (no declarar hecho sin evidencia · L-32)
1. Si cambió el prompt/función → `firebase deploy --only functions:extraerPruebasElectricasIA`
   (lo hace Claude, ADR-005) + commit del mirror sincronizado.
2. El director **pushea** (Pages) y **re-corre** el informe.
3. **Vuelve al paso 1**: corre el auditor sobre el NUEVO JSON. Las banderas de esa
   sección deben desaparecer. Si el `extra` sigue sin venir tras un few-shot →
   **plan B**: emitir la magnitud como **bloque-companion** (canal `series`, que la IA
   nunca falla) y mergearlo en cliente; no insistir en el mismo canal (L-33).

## 6 · Mecanismos genéricos que sostienen el dinamismo
- `derivarTablaTAP(bloque)` — arma la tabla por TAP desde las series + columnas
  `extra` + Desviación/Evaluación derivadas. Funciona con CUALQUIER clave `extra`.
- `bloquesDeExtra(bloque)` — grafica cualquier magnitud secundaria `extra` como
  curva companion.
- `conCriterios()` (shell) — adjunta `criterio` (fórmula+norma) y `limite_desbalance`
  normativo si la IA no lo dio.
- Prompt `SYSTEM_PRUEBAS_IA` — canal `extra` + AUTO-CHEQUEO DE COMPLETITUD universal.

Ninguno fija columnas por sección: la IA emite lo que el informe tenga y el tablero
lo absorbe. Añadir una prueba/columna nueva NO requiere tocar el render.

## 7 · Estado del barrido por secciones (vivo — actualízalo)
- **Excitación** — lote 7: desviación ÷mayor (=informe) + Potencia (W) graficada/tabla vía `extra`. Verificación de `extra` pendiente (re-run).
- **Relación** — pendiente: tensión aplicada, relación teórica, %DIF por fase, Evaluación.
- **Resistencia devanados** — pendiente: R.Referencia corregida, Desviación vs ref, Evaluación.
- **Barras (tan δ, bujes, MT/BT)** — pendiente: columna Evaluación.
- **Aislamiento** — decisión de criterio: ≥1 GΩ genérico vs NETA 110 kV (el lab lo marca 'pobre').
