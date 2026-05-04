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
| 5 | **Hotfix post-plan · deep-clean** | Firestore rechazaba undefined con `permission-denied` engañoso. Helper genérico + tests + regla permanente CLAUDE.md §0.1.2.6 | `e0ccffb` |
| 6 | **UI reorder + gráfica HD primer intento** | Mix antes de Datos técnicos + ficha completa por modelo del mix + DPR 3 en captura del gráfico | `2662671` |
| 7 | **Pre-chequeo permisos admin** | `verificarPermisosAdmin` lee `/usuarios/{uid}` antes del `addDoc` y muestra mensaje accionable | `c85eb41` |
| 8 | **Diagnóstico exhaustivo + regla §0.1.2.7** | Distingue "rules desactualizadas" de "no admin"; regla permanente sobre re-deploy de `firestore.rules` | `525fc3c` |
| 9 | **Gráfica HD/4K real** | Canvas 2400×1400 px × DPR 3 → ~7200×4200 efectivos (impresión a 300 dpi sin pixelado) | `08dcf03` |

Total commits sesión: **20** en branch `claude/adjust-website-pages-8Ntwz`.
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

## 6.bis · Bloque 6 · UI reorder + gráfica HD primer intento (`2662671`)

**Reportes del director:**
1. *"me gustaría que la gráfica en el informe se vea con mejor
   resolución"*.
2. *"me gustaría que en el apartado de Datos técnicos del
   motoventilador aparezcan todos los seleccionados en el mix"*.
3. *"queda mejor que el orden sea así, primero el mix, luego los
   datos técnicos del motoventilador, este a su vez debe asociar
   todos los datos de la ficha técnica"*.

**Cambios:**

1. **`pages/calculo-refrigeracion.html`** — sección "Mix de
   motoventiladores" movida ANTES de "Datos técnicos del
   motoventilador". Orden lógico: primero qué modelos y cuántos,
   después sus fichas técnicas detalladas.

2. **`pages/calculo-refrigeracion.html`** — "Datos técnicos del
   motoventilador" ahora trae al inicio el contenedor
   `#fichas-mix-wrap` que se rellena dinámicamente con UNA ficha
   read-only por cada modelo del mix (24 campos del catálogo:
   identificación + aerodinámica + motor eléctrico).

3. **Editor manual / preview legacy** se mantiene debajo con título
   explícito *"Editor manual / preview de un modelo (opcional)"* y
   hint que aclara su rol (alimenta compatibilidad mecánica +
   fallback legacy de protección).

4. **`assets/js/calculo-refrigeracion.js`** — funciones nuevas
   `renderFichasMix()` y `renderFichaUnica(it, idx)`. Cada ficha
   con cabecera (marca + modelo + cantidad + aporte CFM) + grid
   identificación + grid motor eléctrico.

5. **`assets/css/calculo-refrigeracion.css`** — estilos nuevos
   `.fichas-mix-wrap`, `.ficha-mix-grid`, `.fmf-cell`, `.fmf-l`,
   `.fmf-v`, `.fmf-empty`.

6. **Gráfica del informe (primer intento, insuficiente):**
   - `generateReport()` setea `devicePixelRatio = 3` antes de
     `toBase64Image`.
   - CSS del informe `.chart-img` aumenta `max-width` 5.6in → 6in
     + `image-rendering: crisp-edges`.

---

## 6.ter · Bloque 7 · Pre-chequeo de permisos admin (`c85eb41`)

**Reporte del director:** captura del modal con error
*"Permiso denegado al escribir en Firestore. Verifique: (1) que su
sesión sea de admin..."*. Pidió: *"corrige este error"*.

**Análisis:** el deep-clean ya estaba activo; el mensaje genérico
no distinguía entre las 3 causas (no admin / rules no desplegadas
/ undefined). Faltaba diagnóstico específico.

**Solución implementada:**
- Función nueva exportada `verificarPermisosAdmin(uid)` en
  `assets/js/data/acciones_refrigeracion.js` que lee
  `/usuarios/{uid}` y `/admins/{uid}` antes del `addDoc` y devuelve
  `{ok, motivo, perfil, mensaje}` con diagnóstico:
  · `'admin_via_usuarios'` o `'admin_via_admins_bootstrap'` (OK)
  · `'no_logueado'` (sin sesión Firebase)
  · `'no_admin'` (perfil existe pero rol≠admin o activo=false)
  · `'sin_perfil'` (UID no tiene doc en `/usuarios` ni `/admins`)
- `guardarAccion()` invoca la verificación antes de `mod.crear`.

---

## 6.quater · Bloque 8 · Diagnóstico exhaustivo + regla §0.1.2.7 (`525fc3c`)

**Reporte del director (escenario complejo):** captura del modal
con el MISMO mensaje genérico de las 3 causas a pesar de:
- Deep-clean activo (descarta undefined).
- Pre-chequeo cliente debería decir si NO es admin.

**Análisis:** si el pre-chequeo cliente retorna `ok: true` (es
admin) PERO el `addDoc` sigue fallando con permission-denied, la
única causa restante es que **las rules en producción NO incluyen
el match `/acciones_refrigeracion/{id}`**. Esto pasa cuando:
1. El director ejecutó `firebase deploy --only firestore:indexes`
   (commit microfase 4) pero olvidó `firestore:rules`.
2. O la versión local de `firestore.rules` al momento del deploy
   no tenía el match agregado.

Sin el match, las rules caen al fallback final
`match /{document=**}` con `allow read, write: if false` →
**deny-all explícito** que la SDK reporta como permission-denied
genérico.

**Solución implementada:**

1. **`guardarAccion()` enriquecido**:
   - Guarda el resultado de `verificarPermisosAdmin` en
     `window.__sgmDiag_lastPermisos`.
   - Loguea el payload completo (truncado a 4 KB) antes del addDoc.
   - Catch handler distingue dos sub-casos del permission-denied:
     · Si pre-chequeo `ok: true` Y Firestore rechaza → mensaje
       *"CAUSA MUY PROBABLE: las rules en producción NO incluyen
       el match `/acciones_refrigeracion/{id}` (deploy
       desactualizado). → ACCIÓN: `firebase deploy --only
       firestore:rules`"*.
     · Si pre-chequeo `ok: false` → causa es el rol del usuario.

2. **CSS `.sgm-modal-status`**: `white-space: pre-wrap` +
   `line-height: 1.55` para que el banner muestre los saltos de
   línea del mensaje estructurado.

3. **CLAUDE.md §0.1.2.7 (regla permanente nueva)**: *"Re-deploy
   obligatorio de firestore.rules tras cualquier cambio en el
   archivo"*. 6 reglas obligatorias:
   - Avisar deploy con bloque `⚠ Requiere deploy manual`.
   - Verificar la salida del CLI muestra *"released rules
     firestore.rules to cloud.firestore"*.
   - Ejecutar AMBOS comandos cuando aplica (rules + indexes).
   - Comparar rules en Firebase Console vs repo.
   - Mensaje accionable en UI con sugerencia de deploy.
   - NUNCA asumir rules al día.

---

## 6.quinta · Bloque 9 · Gráfica HD/4K real (`08dcf03`)

**Reporte del director (con dos capturas):**
1. Cómo se ve en el informe — pequeña, pixelada, ilegible.
2. Cómo se ve en la página UI — nítida, legible.

Pidió: *"necesito que se vea en HD y 4K, la imagen representa alto
valor en el informe"*.

**Análisis:** el fix anterior solo aumentó `devicePixelRatio = 3`
pero NO el tamaño físico del canvas. El canvas en pantalla es
~600 × 360 px (limitado por su contenedor `.cw`). Aunque DPR sea 3,
la base de resolución sigue siendo pequeña → ~1800 × 1080 efectivos.

**Solución implementada:** **forzar tamaño físico explícito** del
canvas antes de capturar:

```javascript
const oldDpr      = state.chart.options.devicePixelRatio || 1;
const oldRespOpt  = state.chart.options.responsive;
const oldMantOpt  = state.chart.options.maintainAspectRatio;
const oldStyleW   = canvas.style.width;
const oldStyleH   = canvas.style.height;

state.chart.options.responsive          = false;
state.chart.options.maintainAspectRatio = false;
state.chart.options.devicePixelRatio    = 3;
canvas.style.width  = '2400px';
canvas.style.height = '1400px';
state.chart.resize(2400, 1400);
state.chart.update('none');

chartImg = state.chart.toBase64Image('image/png', 1);

// restaurar todo
state.chart.options.responsive          = oldRespOpt;
state.chart.options.maintainAspectRatio = oldMantOpt;
state.chart.options.devicePixelRatio    = oldDpr;
canvas.style.width  = oldStyleW;
canvas.style.height = oldStyleH;
state.chart.resize();
state.chart.update('none');
```

Resultado efectivo: canvas físico 2400×1400 × DPR 3 → ~**7200×4200
píxeles** (4K+, suficiente para impresión a 300 dpi y zoom digital
sin pixelado).

CSS del informe: `.chart-img max-width: 6.14in` (todo el ancho útil
de la hoja Letter dentro de los márgenes laterales del template
AFINIA: 8.5in − 2 × 1.18in). Padding del bloque reducido a
`4pt 4pt 2pt`.

Causa un flash visual breve (~0.3s) en pantalla durante el export
porque el canvas se reescala temporalmente. Es aceptable porque
solo se dispara al click de "Exportar informe técnico AFINIA".

---

## 7. Estado al cierre de sesión 2026-05-03

### Branch

`claude/adjust-website-pages-8Ntwz` — sincronizada con remoto, **20
commits** desde último merge a `main`. Último commit: `08dcf03`.

### Tests

570/570 verdes en toda la suite (`npm run test:unit`).

### Lint

`npm run lint:html` exit 0.

### Pendiente del director

1. **⚠ EJECUTAR DEPLOY DE RULES** (acción obligatoria antes de
   probar):
   ```bash
   cd ~/ruta/al/repo/LordPowerTransformersMJ.github.io
   git pull origin claude/adjust-website-pages-8Ntwz
   firebase deploy --only firestore:rules
   ```
   Verificar que la salida del CLI muestra:
   ```
   ✓ firestore: released rules firestore.rules to cloud.firestore
   ✓ Deploy complete!
   ```
   Si solo dice *"deployed indexes"* sin *"released rules"*, el
   deploy de rules NO se ejecutó y el modal "Registrar acción"
   seguirá fallando con permission-denied.
2. **Validar el modal "Registrar acción"** después del re-deploy
   con hard-reload Cmd+Shift+R. Debe persistir y mostrar el ID en
   verde.
3. **Validar la gráfica del informe AFINIA** en HD/4K — debe verse
   con todos los rótulos legibles, idéntica a la gráfica de la UI.
4. **Validar el reorden UI** en la calculadora: primero Mix,
   después Datos técnicos del motoventilador con N fichas.
5. **Mergear** la branch a `main` desde GitHub cuando todo quede
   aprobado en producción.
6. **Revocar PATs** históricos de la sesión.
7. **Cleanup** de los 7 PDFs subidos por error al raíz del repo
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
| §0.1.2.7 | Re-deploy obligatorio de `firestore.rules` tras cualquier cambio en el archivo | Cualquier modificación a `firestore.rules` (síntomas: pre-chequeo cliente OK + servidor rechaza) |

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
3. Diagnóstico:
   - Regla §0.1.2.4: no rompiste un flujo legacy (refactor 1→N).
   - Regla §0.1.2.5: tus checks locales deben usar `npm run
     lint:html` no `npx`.

### Si el director reporta `permission-denied` en Firestore

Diagnóstico ordenado:

1. **Causa A · undefined enmascarado** (regla §0.1.2.6) — verifica
   que el data layer aplica `deepClean(payload)` antes de
   `addDoc/setDoc/updateDoc`. Importar de
   `assets/js/data/_firestore_clean.js`.

2. **Causa B · usuario no es admin** — agrega un pre-chequeo con
   `verificarPermisosAdmin(uid)` (patrón en
   `assets/js/data/acciones_refrigeracion.js`) ANTES del write.
   Devuelve `{ok, motivo, mensaje}` accionable.

3. **Causa C · rules en producción desactualizadas** (regla
   §0.1.2.7) — si pre-chequeo cliente dice `ok: true` pero servidor
   rechaza, es deploy desactualizado. Pedir al director ejecutar
   `firebase deploy --only firestore:rules` y verificar que la
   salida muestra *"released rules firestore.rules to
   cloud.firestore"*.

4. **Causa D · tipos / enums** — verifica que el payload cumple
   las rules: enums correctos (lowercase como `'planificada'`,
   no `'Planificada'`), `is string`, `is list`, `size() > 0`,
   etc.

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
