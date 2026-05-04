# Sesión 2026-05-03 · Continuación · Mantenimiento Brigada (mix multi-modelo + plan microfases + hotfix)

> Documento de handoff para retomar el trabajo en una sesión nueva.
> Captura estado completo, decisiones, errores conocidos y próximas
> movidas. Si arranca un nuevo chat: lee este archivo + `CLAUDE.md`
> §0–§7 antes de tocar el módulo Mantenimiento Brigada.

---

## 1. Línea de tiempo de la sesión

| # | Bloque | Descripción | Commits |
|---|---|---|---|
| 1 | **Refactor mix multi-modelo (5 commits)** | Permitir combinar varios modelos de ventilador en el mismo transformador con cantidades, evaluar si cumple CFM requerido, sugerir mejoras, persistir, y consolidar | `a856e2a` → `bd588fb` |
| 2 | **Hotfix CI lint** | `<th>` sin scope en consolidado · WCAG H63 | `f1a4403` |
| 3 | **Hotfix protección eléctrica (3 rutas)** | Restaurar fallback legacy + placeholder informativo cuando mix vacío | `a3bc06b` |
| 4 | **Plan microfases (6 commits)** | Tolerancia + estrategias + FLC/contactor/SCADA + faltantes + JSON + validación gráfica | `6a59912` → `58299c6` |
| 5 | **Hotfix post-plan · deep-clean** | Firestore rechazaba undefined con `permission-denied` engañoso. Helper genérico + tests + regla permanente CLAUDE.md §0.1.2.6 | _este commit_ |

Total commits sesión: **15** en branch `claude/adjust-website-pages-8Ntwz`.
Tests acumulados: 503 → **570** (+67).
HTML lint limpio durante toda la sesión.

---

## 2. Bloque 1 · Refactor mix multi-modelo (5 commits)

**Pregunta del director:** *"necesito que en el apartado de sistema
de refrigeración me permitas la opción de seleccionar varios tipos
de ventiladores"*. Después aclaró: *"escoger varios tipos de
ventiladores con cantidades y evaluar si cumple con los CFM
requeridos en un mismo segmento, luego protección según los
ventiladores necesarios"*.

### Commit 1 — Dominio puro (`a856e2a`)

`assets/js/domain/refrigeracion.js`:
- `evaluarMixVentiladores({items, cfm_requerido})` — suma aportes
  cantidad × CFM unitario, calcula cobertura, déficit, exceso,
  estado APROBADO/NO_APROBADO/SIN_DATOS.
- `sugerirMejoras({items, cfm_requerido, fan_db, max_sugerencias})`
  con 3 estrategias: agregar_unidades, sustituir, agregar_modelo.
- `calcularProteccionMix({items, factor_seguridad})` con grupos por
  modelo (cada uno con guardamotor MS116) + breaker S203 único.
- Constante `MIX_ESTADO`.
- 18 tests en `tests/refrigeracion.test.js` (44 → 62).

### Commit 2 — UI (`14bf0c7`)

`pages/calculo-refrigeracion.html`:
- Selector `#mix_fan_sel` + cantidad + botón "+ Agregar al mix".
- Tabla `#mix-table` con columnas Marca / Modelo / CFM/u /
  Cantidad editable / Aporte CFM / Aporte % / Eliminar.
- Banner `#mix-status` con badge APROBADO ✓ / NO APROBADO ✗.
- Panel `#mix-suggestions` con 3 cards "Aplicar".

`assets/js/calculo-refrigeracion.js`:
- `state.mix` reemplaza `state.fans` legacy.
- Funciones nuevas: `addToMix`, `removeFromMix`, `updateMixQty`,
  `applyMixSuggestion`, `renderMix`, `renderMixStatus`,
  `renderMixSuggestions`, `syncFichaVisibleConKey`.
- `calcProtection()` reescrito para usar `calcularProteccionMix`.
- 120 LOC legacy eliminadas.

### Commit 3 — Informe AFINIA (`3ca46f9`)

`generateReport()`:
- §5 N fichas (una por modelo del mix) con cantidad + aporte CFM.
- §8 tabla del mix + banner + sugerencias + fórmula del mix.
- §9 grupos por modelo + breaker único + KPIs (kW, kVA, peso) +
  fórmulas eléctricas con sumatoria.
- §10 BOM agrupado.

### Commit 4 — Persistencia (`a86a51f`)

- Colección Firestore `acciones_refrigeracion/{id}` con snapshot
  completo del cálculo.
- `firestore.rules` con validación server-side de campos
  obligatorios + enum estado_accion.
- `firestore.indexes.json` con 4 índices compuestos.
- Data layer `assets/js/data/acciones_refrigeracion.js` con
  CRUD + suscripción realtime.
- Modal "Registrar acción de mantenimiento" en la UI.
- ⚠ Requirió deploy manual: `firebase deploy --only firestore:rules`
  + `firebase deploy --only firestore:indexes` (ya hecho por el
  director esa sesión).

### Commit 5 — Tab Consolidado (`bd588fb`)

- Segunda tab en `pages/mantenimiento-brigada.html`.
- `pages/consolidado-refrigeracion.html` con tabla realtime
  (`onSnapshot`), 5 KPIs, filtros, export CSV, acciones admin.
- `assets/js/consolidado-refrigeracion.js` UI binding.

---

## 3. Bloque 2 · Hotfix CI lint (`f1a4403`)

**Bug:** GitHub Actions CI falló con 15 errores WCAG H63 (`<th>`
sin atributo `scope`).

**Causa:** verifiqué localmente con `npx html-validate` que descarga
versión transitoria distinta a la del `package.json`. CI usa
`html-validate ^8.24.0` declarado, más estricto.

**Fix:** agregado `scope="col"` a las 15 cabeceras de
`pages/consolidado-refrigeracion.html`.

**Regla permanente** documentada en CLAUDE.md §0.1.2.5: lint local
con `npm install --no-audit && npm run lint:html`, NUNCA con `npx`.

---

## 4. Bloque 3 · Hotfix protección eléctrica (`a3bc06b`)

**Reporte del director:** *"eliminaste todo lo de este apartado,
aquí reposaban guardamotores con sus contactos auxiliares de
señalización con SCADA y breaker principal con su contacto auxiliar
de señalización con SCADA, cantidades de cada uno y sus
referencias"*. Con captura mostrando el stub *"Agregue al menos un
modelo de ventilador al mix para calcular la protección eléctrica"*.

**Causa:** mi `calcProtection()` cortocircuitaba con un stub cuando
`state.mix.length === 0`, eliminando la ruta legacy de cómputo con
un solo modelo + N derivado del CFM.

**Fix:** `calcProtection()` reescrita con **3 rutas**:

1. **Mix multi-modelo (≥ 1)** — cómputo agregado por grupos.
2. **Fallback legacy (mix vacío + dropdown técnico cargado)** —
   cálculo con 1 modelo + N derivado, restaura comportamiento
   v2.9.0 completo.
3. **Sin datos** — placeholder informativo con tarjetas dashed
   del catálogo de componentes esperables (MS116, HK1-11, S203,
   S2C-H11L) con sus PIDs.

**Regla permanente nueva** CLAUDE.md §0.1.2.4: *"Refactor 1→N NO
debe vaciar la UI legacy"*.

---

## 5. Bloque 4 · Plan de 6 microfases

**Pregunta del director:** entregó un prompt técnico extenso
detallando el flujo completo de selección de ventiladores +
protección + SCADA + JSON output. Pidió *"podemos manejarlo por
microfases para evitar timeouts y crasheos"*.

Plan acordado: **6 microfases** con preview + implementación + push
+ checklist de prueba en cada una.

### Microfase 1 — Tolerancia configurable (`6a59912`)

- `evaluarMixVentiladores` acepta `tolerancia_pct` (default 0).
  Umbral relajado: `cfm_requerido × (1 − tol/100)`.
- Devuelve campos nuevos `cfm_umbral` y `tolerancia_pct`.
- Campo `#mix_tolerancia` en UI con default 5%.
- Helper `getTolerancia()` con clamp [0, 100].
- Listener input para recalcular en vivo.
- Banner ampliado con KPI "Umbral · X CFM (tol Y%)".
- Persistido en Firestore.
- +4 tests (62 → 66).

### Microfase 2 — Estrategias enriquecidas (`0fcc0de`)

- 5 estrategias en total (3 existentes + 2 nuevas):
  - `vfd_uprate` · operar con variador de frecuencia. Si hay
    variante de mayor RPM en el catálogo (ej. fn063_50 →
    fn063_60) usa el CFM exacto. Si no, asume factor 1.20.
  - `optimizacion_aerodinamica` · informativa solo cuando
    déficit > 10%.
- Cada sugerencia con 3 campos nuevos:
  `impacto_estimado_cfm`, `implicaciones`, `factibilidad`
  (`alta` / `media` / `baja`).
- Ordenamiento nuevo: aprobado primero, luego factibilidad,
  luego menor exceso.
- Default `max_sugerencias` 3 → 5.
- UI: cards con badge factibilidad + KPI delta CFM (verde/rojo)
  + bloque "Implicaciones" + botón disabled en informativas.
- Informe AFINIA: tabla con columnas Factibilidad + Δ CFM +
  texto implicaciones en cursiva.
- +5 tests (66 → 71 + ajuste de 1 test existente para reflejar
  el nuevo ordenamiento).

### Microfase 3 — Selección eléctrica detallada (`a78db27`)

- Catálogo nuevo `CONTACTOR_AF_DB` (7 modelos ABB AF: AF09 …
  AF80) con AC-3, kW @ 400 V, PID, bobina universal.
- `TAGS_SCADA` con 4 tags estándar (RUN/FAULT/TRIP/READY) +
  contacto físico + descripción.
- Funciones puras nuevas:
  - `seleccionarContactor(flc, factor=1.15)` con `margen_pct`.
  - `calcularFLC({p_w, hp, voltaje, cosphi, eficiencia,
    amps_directo})` con 3 rutas (placa / cálculo / sin_datos).
- `calcularProteccionMix` y `calcularProteccionElectrica`
  devuelven `contactor` por grupo + `tags_scada` raíz.
- UI: cada card de grupo muestra 4 columnas (FLC + memoria
  cálculo, MS116, AF + tags SCADA inline, auxiliar SCADA).
  Bloque SCADA al pie con grid de 4 tags + norma IEEE C37.91 /
  IEC 61850.
- Card del breaker incluye coordinación con MCCB aguas arriba.
- BOM enriquecido con contactor por grupo.
- Informe AFINIA sec 9: tabla con columnas Guardamotor + Contactor
  separadas + sub-tabla SCADA + nota coordinación.
- +12 tests (71 → 83).

### Microfase 4 — Detección de faltantes (`c182a3d`)

- Función pura `detectarFaltantes({mix})` con 3 severidades:
  - `critico` · sin esto NO se puede calcular protección.
  - `aviso` · cálculo con default razonable (cos φ 0.85, η 0.85,
    voltaje 400 V).
  - `info` · opcional, solo afecta exports.
- Banner amarillo `#prot-faltantes` debajo del bloque conexión
  Δ/Y, hidden por default.
- `renderFaltantes(arr)` ordena por severidad, contador en header,
  pills coloreadas, hint diferenciado.
- Persistencia: campo `faltantes` en `acciones_refrigeracion`.
- Informe AFINIA sec 9: bloque amarillo informativo bajo la tabla
  cuando hay faltantes.
- +8 tests (83 → 91).

### Microfase 5 — Snapshot JSON estructurado (`2f42616`)

- Función pura `construirResumenJSON({mix, evaluacion, proteccion,
  sugerencias, faltantes, metadatos})` con shape EXACTO del
  prompt: selecciones / cfm_requerido / cfm_total / cfm_umbral /
  tolerancia_pct / cobertura_pct / deficit_cfm / exceso_cfm /
  n_unidades_total / evaluacion / razon / estrategias_sugeridas /
  seleccion_electrica / breaker_sistema / faltantes / metadatos.
- `seleccion_electrica[]` por grupo con guardamotor + contactor +
  auxiliar (cada uno con justificacion citando norma).
- Botón nuevo `#btnExportJson` (color púrpura) + función
  `exportarResumenJSON()` que descarga `.json`.
- Helper `calcularResumenActual()` reutilizado por export +
  guardarAccion + generateReport.
- Persistencia: campo `resumen_json` en `acciones_refrigeracion`.
- +7 tests (91 → 98).

### Microfase 6 — Validación gráfica vs cálculo (`58299c6`)

- Función pura `validarPuntoOperacion({onan_kva, pct,
  cfm_calculado, alt_m})` con 2 chequeos:
  - Rango calibrado (115–166% Westinghouse).
  - Coherencia: CFM esperado vs calculado, severidad por delta
    (≤ 2% ok, 2–5% warn, > 5% err).
- Banner `#valida-grafica` bajo el canvas Chart.js con badge
  ✓/⚠/✗ + KPIs (CFM esperado, delta abs y %, pendiente).
- 3 variantes CSS (.is-ok verde / .is-warn naranja / .is-err
  rojo).
- `upd()` invoca la validación en cada cambio de input.
- Persistencia: campo `validacion_grafica` en
  `acciones_refrigeracion`.
- +6 tests (98 → 104).

---

## 6. Bloque 5 · Hotfix post-plan · Deep-clean (commit pendiente)

**Reporte del director con captura:** modal "Registrar acción de
mantenimiento" muestra error *"Missing or insufficient permissions"*
al guardar. Payload visible:
- Transformador T1-M/M-CHG · Subestación CHIRIGUANA
- Mix 2 modelos · 6 unidades · 35.284 CFM total
- CFM requerido 24.094 · Cobertura 146.4% · APROBADO
- Descripción 100+ chars
- Estado Planificada · Fecha 03/05/2026 · Ejecución 20/05/2026
- Observaciones presentes

Todos los campos cumplen las rules.

**Causa raíz definitiva:** Firestore Web SDK rechaza valores
`undefined` con error `permission-denied` engañoso. El sanitizador
top-level del data layer no recurría a objetos anidados, así que
`mix[].ficha`, `evaluacion`, `proteccion`, `compatibilidad`,
`resumen_json`, `validacion_grafica` (de microfases 4-5-6) podían
contener `undefined` en campos opcionales del catálogo.

**Fix implementado:**

1. **`assets/js/data/_firestore_clean.js` (nuevo)** · helper
   genérico `deepClean(value)` recursivo:
   - Elimina `undefined`, `NaN`, `Infinity`, `function`.
   - Preserva `null`, `0`, `''`, `false`.
   - Preserva `Timestamp` (con `toDate`) y `FieldValue`
     (con `_methodName`).
   - Mapea arrays + objetos planos.

2. **`assets/js/data/acciones_refrigeracion.js`** · importa
   `deepClean` y lo aplica en `crear()` y `actualizar()` justo
   antes de `addDoc()` / `updateDoc()`.

3. **`assets/js/calculo-refrigeracion.js`** · `guardarAccion()`
   mejora detección de error: si `code === 'permission-denied'`
   o regex `/permission/i`, muestra mensaje accionable con las 3
   causas probables. Misma lógica para `invalid-argument` y
   `failed-precondition`.

4. **`tests/acciones_refrigeracion_deepclean.test.js` (nuevo)** ·
   13 tests:
   - undefined / null / primitivos / NaN / Infinity / function
   - Objeto plano / objeto anidado profundidad 3
   - Array con items undefined / array de objetos
   - Caso real con payload completo de acciones_refrigeracion
   - Timestamp simulado preservado / FieldValue simulado preservado

5. **CLAUDE.md** · regla permanente nueva **§0.1.2.6** *"Firestore
   rechaza undefined con error 'permission-denied' engañoso"*.

**Sin deploys Firebase requeridos** (cambio 100% cliente).

**Tests totales:** 570/570 verdes (+13).
**HTML lint:** OK.

---

## 7. Estado al cierre de sesión 2026-05-03

### Branch

`claude/adjust-website-pages-8Ntwz` — sincronizada con remoto, **15
commits** desde último merge a `main`.

### Tests

570/570 verdes en toda la suite (`npm run test:unit`).

### Lint

`npm run lint:html` exit 0.

### Pendiente del director

1. **Validar visualmente** que el modal "Registrar acción de
   mantenimiento" ya guarda correctamente con el deep-clean.
2. **Mergear** la branch a `main` desde GitHub (PR o GitHub
   Desktop) cuando todas las microfases + el hotfix queden
   aprobadas en producción.
3. **Revocar PATs** históricos de la sesión.
4. **Cleanup** de los 7 PDFs subidos por error al raíz del repo
   (commit `91f386c` previo).

### Pendiente operativo (low-prio)

- Sincronizar `firestore.indexes.json` local con producción
  (24+ índices que están en la nube pero no en el archivo). Cuando
  el director ejecute `firebase deploy --only firestore:indexes`
  el CLI sigue preguntando si borrar los locales — siempre
  responder **N**. En una sesión futura podemos hacer
  `firebase firestore:indexes` para volcar los reales.

### Reglas permanentes nuevas en CLAUDE.md

| Sección | Regla | Aplica a |
|---|---|---|
| §0.1.2.4 | Refactor 1→N NO debe vaciar la UI legacy | Refactors de la calculadora ONAF, batches, multi-contrato, etc. |
| §0.1.2.5 | Lint local con `npm run lint:html`, no `npx html-validate` | Cualquier sesión que modifique HTML |
| §0.1.2.6 | Firestore rechaza undefined con error "permission-denied" engañoso | Cualquier data layer que persista objetos anidados |

### Documentación de referencia (módulo Mantenimiento Brigada)

- `docs/MANTENIMIENTO-BRIGADA.md` — secciones 4.3 (dominio mix),
  4.4 (UI mix), 4.5 (informe), 4.6 (persistencia), 4.7 (consolidado).
- `CHANGELOG.md` — entradas detalladas de cada commit.
- `CLAUDE.md` §7 — fila de estado actualizada.

---

## 8. Cómo continuar en una sesión nueva

Si arrancas un chat nuevo y el director te pide trabajar sobre
Mantenimiento Brigada:

1. **Lee este archivo completo** + CLAUDE.md §0 (permisos push) +
   §0.1.2.4-6 (reglas permanentes) + §7 (estado actual).
2. **Verifica** que estás en la branch `claude/adjust-website-pages-8Ntwz`
   o ya está mergeada a `main`.
3. **Verifica tests** con `npm install && npm run test:unit` (deben
   ser 570/570 verdes).
4. **Verifica lint** con `npm run lint:html` (exit 0).
5. **NO toques** el shape del payload de `acciones_refrigeracion`
   sin aplicar `deepClean` antes del write — Firestore lo rechazará
   con `permission-denied` engañoso.
6. **Si agregas funciones puras nuevas al dominio** que devuelvan
   objetos con campos opcionales, **siempre** documenta en su
   docstring que el caller debe pasar el output por `deepClean`
   antes de persistir.

### Si el director reporta un bug visual

1. Pide captura concreta.
2. Antes de editar, abre la página local y reproduce.
3. Diagnóstico: la regla §0.1.2.4 dice que no rompiste un flujo
   legacy. La regla §0.1.2.5 dice que tus checks locales deben
   usar `npm run lint:html` no `npx`. La regla §0.1.2.6 dice que
   "permission-denied" puede ser undefined enmascarado.

### Si el director quiere otra calculadora del módulo brigada

Patrón establecido para reusar:
1. Dominio puro en `assets/js/domain/{nombre}.js`.
2. Tests `tests/{nombre}.test.js`.
3. Página `pages/{nombre}.html`.
4. UI binding `assets/js/{nombre}.js`.
5. Tab nueva en `pages/mantenimiento-brigada.html` (`module-shell`).
6. Si persiste: data layer `assets/js/data/{coleccion}.js` con
   `deepClean` aplicado en escrituras (regla §0.1.2.6).
7. Si persiste: rules + indexes en Firestore (regla §0.1.1 ·
   avisar deploy manual).
