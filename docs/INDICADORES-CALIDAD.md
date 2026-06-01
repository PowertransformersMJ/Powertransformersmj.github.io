# Módulo · Indicadores de Calidad (SAIDI_E / SAIFI_E)

Dashboard de indicadores regulatorios de calidad del servicio sobre el
parque de transformadores de potencia. Cuantifica el impacto de los
grupos de causa controlables (Sobrecarga/Deslastre y
Racionamiento/Déficit) sobre los índices SAIDI_E y SAIFI_E del sistema
y proyecta el escenario Jun–Dic con regresión OLS + bandas IC95%.

> **Estado:** v1.0 (PR `claude/indicadores-calidad-refactor`).
> Refactor F40 del archivo legacy `SAIDI_SAIFI Deslastre por Capacidad
> de Transformacion.html` (4.8 MB con Plotly inline + dataset embebido)
> reescrito como arquitectura modular embebida en el shell aqua.

---

## 1. Fuentes y semántica

### 1.1 Indicadores (CREG 015/2018)

| Indicador  | Significado | Unidad | Símbolo |
|---|---|---|---|
| **SAIDI_E** | System Average Interruption Duration Index equivalente — duración promedio de interrupciones por usuario | horas-equivalentes | `h-eq` |
| **SAIFI_E** | System Average Interruption Frequency Index equivalente — frecuencia promedio de interrupciones por usuario | interrupciones-equivalentes | `int-eq` |

### 1.2 Grupos de causa (semáforo normativo)

| Grupo | Color | Significado |
|---|---|---|
| **Sobrecarga/Deslastre** | 🔴 rojo `#DC2626` | Causa controlable principal · saturación de capacidad de transformación |
| **Racionamiento/Deficit** | 🟣 púrpura `#7C3AED` | Déficit del sistema STN/STR |
| **Otras causas** | ⬜ slate `#CBD5E1` | Resto · meteorología, vegetación, terceros, etc. |

Estos colores son **invariantes** en todos los charts del módulo. El
clasificador canónico `clasificarGrupoCausa()` en
`domain/saidi_config.js` mapea cada categoría a uno de estos 3 grupos;
`categoriaColor()` y `grupoCorto()` derivan de él.

#### Criterio único de extracción de causas

Cada vez que se carga un documento, toda categoría se clasifica con
`clasificarGrupoCausa(cat)` (normaliza acentos + caja):

| Si la categoría contiene… | Grupo | Color |
|---|---|---|
| `racion` (evaluado **primero**) | Racionamiento/Deficit | 🟣 púrpura |
| `sobrecarga` o `deslastre` | Sobrecarga/Deslastre | 🔴 rojo |
| resto | Otras causas | ⬜ slate (ámbar en barras de categoría) |

`CAUSAS_CANON` (en `saidi_config.js`) lista las 13 causas oficiales de
Afinia/XM cubiertas por este criterio:

```
Deslastre de carga por capacidad de transformacion
Deslastre por Capacidad de Transformacion trafo SDL
Deslastre por capacidad SDL
Deslastre por capacidad de transporte
Deslastre por capacidad sdl
Racionamiento Programado por Deficit STN
Racionamiento de Emergencia por Deficit STN
Racionamiento de Emergencia por Deficit del STR
SOBRECARGA TRAFO SDL
Sobrecarga
Sobrecarga activo del SDL
Sobrecarga de trafo de conexion al STN
Sobrecarga del STR
```

> El orden importa: **Racionamiento se evalúa antes que Sobrecarga**
> para que `Racionamiento de Emergencia por Deficit del STR` quede en
> púrpura (antes caía en rojo por el match accidental con "STR").

**Auto-derivación al cargar (Excel + CSV).** Si un documento trae solo
filas de categoría (`cat_saidi_*` / `cat_saifi_*`) y sin filas de grupo
o total, `upload.js` agrega las categorías en sus grupos canónicos y
calcula el total, de modo que el stack, los KPIs y la proyección se
aprecian completos **sin cambiar la forma de ilustrar**. La derivación
no pisa series de grupo/total provistas explícitamente en el documento.

### 1.3 Zonas operativas

`TODAS · BOLIVAR · OCCIDENTE · ORIENTE`. Cada zona tiene su propio
`total_saidi`, `total_saifi`, `grp_*`, `cat_*` y `proj` (este último
solo precalculado para SAIDI; para SAIFI se recalcula on-the-fly).

---

## 2. Arquitectura de carpetas

```
pages/
└── indicadores-calidad.html              ← template aqua (entrypoint)

assets/css/
└── indicadores-calidad.css                ← estilos con scope .saidi-shell

assets/data/
└── indicadores-calidad-baseline.json      ← dataset Ene–May 2026 · 4 zonas ·
                                             11 cats · proyecciones OLS de
                                             SAIDI · 9.9 KB · cargado lazy

assets/js/domain/   (PURO · sin DOM ni I/O · testeable con node --test)
├── saidi_config.js                        ← constantes canónicas:
│                                            - COLORS, GCOL, GRUPOS, ZONAS_ORDEN
│                                            - METRICAS (nombre, unidad, título)
│                                            - METRIC_COLOR (azul SAIDI, ámbar SAIFI)
│                                            - categoriaColor(), grupoCorto()
│                                            - font(), layoutBase(), plotlyCfg() · FACTORIES
│                                              (Plotly muta objetos · no usar Object.freeze)
│                                            - metricaNombre(), metricaUnidad(),
│                                              metricaTitulo(), metKey()
├── saidi_calculo.js                       ← agregadores PUROS:
│                                            - sumSerie(serie)
│                                            - avgSerie(serie)
│                                            - growthPct(serie)
│                                            - varMoM(serie)      → % mes a mes
│                                            - catTotals(dataset, zona, met)
│                                            - gruposDeZona, categoriasDeZona
│                                            - totalSerieDeZona
│                                            - proyeccionDeZona
│                                            - listarZonas(dataset)
└── saidi_proyeccion.js                    ← calcularProyeccionOLS(real, N):
                                             regresión lineal mínimos cuadrados
                                             con intervalos IC95% (Student's t)
                                             y escenarios opt/pes (±10%).
                                             SAIDI usa el bloque precalculado;
                                             SAIFI se recalcula on-the-fly.

assets/js/data/
└── indicadores_calidad.js                 ← suscribirIndicadoresCalidad():
                                             onSnapshot a /indicadores_calidad/global
                                             + cargarBaselineLocal() con 3 URLs
                                             candidatas como fallback robusto
                                             (import.meta.url, pathname relativo,
                                             ruta absoluta).

assets/js/ui/calidad/
├── state.js                                ← store publish/subscribe minimal:
│                                            - dataset, zona, met, source
│                                            - gruposActivos (Set: chips filtro)
│                                            - 8 setters + notify()
├── filtros.js                              ← controlador zona + métrica + chips
│                                            grupos · sincronizarChipsGrupos()
├── upload.js                               ← carga manual JSON/Excel/CSV:
│                                            - parsearJSON(file) con validación
│                                            - parsearExcel(file) · 4 hojas
│                                              (META, KPI, ZONAS, PROYECCION)
│                                              (.xlsx/.xls/.xlsb/.xlsm)
│                                            - parsearCSV(file) · tabla ZONAS
│                                              (deriva meses/cats/proj OLS)
│                                            - SheetJS lazy CDN
│                                            - IndexedDB persistencia local
│                                              (sobrevive recargas hasta
│                                              "Reiniciar al baseline")
├── calidad-shell.js                       ← boot:
│                                            1) inicializarFiltros + bindUpload
│                                            2) loadPlotly lazy CDN
│                                            3) safeRender por chart (try/catch
│                                               por separado · un fallo no rompe
│                                               la cadena de render)
│                                            4) hidrata IndexedDB → baseline →
│                                               Firestore realtime (en orden,
│                                               cada uno como fallback del anterior)
│                                            5) muestra banner #calidad-error si
│                                               todo falla
└── renderers/                              ← 10 renderers + 1 _helpers común
    ├── _helpers.js                          ← reexports + fmt(v, d) + metricaLabel +
    │                                          metricasActivas(met) → ['saidi','saifi']
    │                                          cuando met='ambos'
    ├── meta.js                              ← (no aplica en este módulo)
    ├── kpis.js                              ← 6 tarjetas KPI con unidades correctas
    │                                          por modo de selección
    ├── insight.js                           ← párrafo ejecutivo dinámico (cambia
    │                                          vocabulario y datos según métrica)
    ├── serie.js                             ← line chart SAIDI_E o SAIFI_E del sistema
    │                                          · doble eje en modo Ambos
    ├── stack.js                             ← barras agrupadas por grupo de causa
    │                                          (filtrado por gruposActivos del store)
    ├── part.js                              ← barras h-bar por categoría · grouped
    │                                          cuando met=Ambos
    ├── varmom.js                            ← variación % mes a mes · 1 a 4 series
    │                                          según grupos activos × métricas
    ├── top.js                               ← top 8 categorías · tabla con 1 o
    │                                          2 columnas según met
    ├── heatmap.js                           ← heatmap cat × mes · paleta 7 stops
    │                                          mint → rojo · 1 div o 2 divs apilados
    │                                          según met (renderUnHeatmap +
    │                                          ensureSecondHeatDiv)
    ├── proyeccion.js                        ← OLS Jun–Dic con IC95% + 3 escenarios
    │                                          · recalcula SAIFI on-the-fly · doble
    │                                          eje Y en modo Ambos
    └── month-table.js                       ← tabla mensual agregada · filas
                                               filtradas por gruposActivos · filas
                                               duplicadas con bandas grises cuando
                                               met=Ambos

tests/
├── saidi_calculo.test.js                   ← 21 tests · agregadores + helpers
└── saidi_proyeccion.test.js                ← 10 tests · OLS vs baseline real ·
                                              R² · IC95% · escenarios ±10% ·
                                              edge cases (serie constante, nulls,
                                              <2 puntos)
```

---

## 3. Selector global de métrica

Componente clave del módulo: un único `<select id="f-met">` controla
qué métricas se muestran en TODOS los charts del dashboard.

### 3.1 Valores

| Valor | Etiqueta | Comportamiento |
|---|---|---|
| `saidi` | SAIDI_E · duración (h-eq) | Solo duración · todos los charts en `h-eq` |
| `saifi` | SAIFI_E · frecuencia (int-eq) | Solo frecuencia · todos los charts en `int-eq` |
| `ambos` | Ambos · SAIDI_E + SAIFI_E | Las dos métricas simultáneas con presentación óptima por chart |

### 3.2 Cascada de actualización

Al cambiar el selector, cada renderer se adapta:

| Chart | Modo SAIDI | Modo SAIFI | Modo Ambos |
|---|---|---|---|
| **KPI band** | 6 tarjetas h-eq | 6 tarjetas int-eq | 6 tarjetas: 2 sistema + 2 Sob/Desl × 2 métricas |
| **Insight** | vocabulario "duración / indisponibilidad" | "frecuencia / interrupciones" | menciona ambas |
| **Serie temporal** | 1 línea azul (h-eq) | 1 línea ámbar (int-eq) | doble eje Y |
| **Stack mensual** | barras apiladas h-eq | barras apiladas int-eq | barras agrupadas (offsetgroup) por métrica |
| **Participación** | h-bars h-eq | h-bars int-eq | h-bars grouped 2 series |
| **Variación %** | 2 líneas (Sob/Desl + Otras) | 2 líneas | 4 líneas con dash distintivo |
| **Top tabla** | columna Acum + % | columna Acum + % | 2 columnas (SAIDI h-eq · SAIFI int-eq) |
| **Heatmap** | 1 panel | 1 panel | **2 divs apilados verticalmente** (cada uno 420 px) |
| **Proyección OLS** | precalculada SAIDI | recalculada SAIFI on-the-fly | doble eje Y |
| **Tabla mensual** | 3 filas + total | 3 filas + total | 6 filas con bandas grises |

### 3.3 Reglas de unidades

- Las unidades aparecen en **cada eje, cada label, cada hovertemplate
  y cada delta de KPI**.
- Nunca mezclar `h-eq` con SAIFI ni `int-eq` con SAIDI.
- Cuando se calcula OLS sobre SAIFI, los `slope` y `pval` se muestran
  con `int-eq/mes`.

---

## 4. Filtro de grupos de causa

Sobre el card "Contribución mensual por grupo de causa" hay 3 chips
toggleables:

```
[ ● Sobrecarga/Deslastre ] [ ● Racionamiento/Déficit ] [ ● Otras causas ]
```

Click → toggle entre `is-on` (visible) y `is-off` (atenuado + tachado).
El estado vive en `store.state.gruposActivos` (Set inicial con los 3).

### 4.1 Charts afectados

- ✅ Contribución mensual (stack)
- ✅ Variación % mes a mes (varmom)
- ✅ Tabla mensual agregada (month-table)

### 4.2 Charts NO afectados

KPIs, insight, serie temporal, participación acumulada, top
categorías, heatmap, proyección — no dependen de grupos específicos
sino del agregado completo de cada métrica.

---

## 5. Upload manual de datos

Mini-card al inicio del dashboard. Acepta:

### 5.1 JSON (preferido)

Mismo shape que el baseline integrado:

```json
{
  "meses":      ["Ene","Feb","Mar","Abr","May"],
  "meses_full": ["Ene","Feb",...,"Nov","Dic"],
  "cats_order": ["...", "...", ...],
  "zonas": {
    "TODAS":     { "total_saidi": [...], "total_saifi": [...],
                   "grp_saidi": { "Sobrecarga/Deslastre": [...], ... },
                   "grp_saifi": { ... },
                   "cat_saidi": { "SOBRECARGA TRAFO SDL": [...], ... },
                   "cat_saifi": { ... },
                   "proj":      { "real": [...], "base": [...], "opt": [...],
                                  "pes": [...], "ci_inf": [...], "ci_sup": [...],
                                  "r2": ..., "slope": ..., "pval": ... } },
    "BOLIVAR":   { ... },
    "OCCIDENTE": { ... },
    "ORIENTE":   { ... }
  },
  "kpi":         { "saidi_tot": ..., "saifi_tot": ..., ... },
  "proj_global": { ... }
}
```

Validación obligatoria: deben existir `meses`, `meses_full`, `zonas`
(con al menos `TODAS`), y `cats_order`. Si falta algo, mensaje
accionable indicando exactamente qué.

### 5.2 Excel (.xlsx / .xls / .xlsb / .xlsm)

4 hojas con nombres fijos (case-insensitive):

| Hoja | Contenido |
|---|---|
| `META` | Fila `meses` y fila `meses_full` con valores en columnas B..N |
| `KPI` | Pares clave-valor (col A: clave · col B: valor) |
| `ZONAS` | Filas `zona | tipo | val_ene | val_feb | …` donde `tipo` ∈ {`total_saidi`, `total_saifi`, `grp_saidi_<grupo>`, `grp_saifi_<grupo>`, `cat_saidi_<cat>`, `cat_saifi_<cat>`} |
| `PROYECCION` | Filas `zona | tipo | val_ene | … | val_dic` donde `tipo` ∈ {`real`, `base`, `opt`, `pes`, `ci_inf`, `ci_sup`, `r2`, `slope`, `pval`} |

SheetJS se carga lazy desde CDN solo al primer upload de Excel. Los
`.xlsm` (Excel habilitado para macros) se leen igual que un `.xlsx`;
las macros se ignoran.

### 5.3 CSV (una sola tabla = hoja `ZONAS`)

Como un CSV no puede llevar las 4 hojas, **mantiene el mismo criterio
del módulo** usando una sola tabla plana equivalente a la hoja `ZONAS`:

```csv
zona,tipo,Ene,Feb,Mar,Abr,May
TODAS,total_saidi,1.20,1.31,1.18,1.25,1.40
TODAS,total_saifi,0.80,0.82,0.79,0.85,0.90
TODAS,grp_saidi_Sobrecarga/Deslastre,0.40,0.45,0.42,0.48,0.55
TODAS,grp_saidi_Racionamiento/Deficit,0.30,...
TODAS,cat_saidi_SOBRECARGA TRAFO SDL,...
BOLIVAR,total_saidi,...
```

- La **cabecera es opcional**: si la col A de la primera fila dice
  `zona`, se usa para nombrar los meses; si no, se infieren por
  posición (`Ene`, `Feb`, …).
- Debe existir la zona `TODAS` (col A = `TODAS`).
- `meses_full` se fija a los 12 meses canónicos.
- `cats_order` se deriva de las filas `cat_saidi_*` de `TODAS`.
- La **proyección OLS se recalcula por zona** con
  `calcularProyeccionOLS` sobre la serie SAIDI del grupo
  `Sobrecarga/Deslastre` (idéntico al criterio interno del módulo).
- `kpi` queda vacío: los renderers computan los KPIs a partir de
  `zonas`, no del bloque `kpi`.

SheetJS también parsea el CSV (`XLSX.read(text, {type:'string'})`)
para manejar el quoting correctamente.

### 5.4 Persistencia

Lo cargado se guarda en **IndexedDB** (DB `calidad_db_v1`, store `kv`,
keys `dataset` y `meta`). Sobrevive recargas hasta que el usuario:

- Carga otro archivo (lo reemplaza)
- Click en **"↺ Reiniciar al baseline"** (borra el cache y vuelve al
  dataset integrado)

### 5.5 Pill de fuente

El subtítulo del card de upload indica la fuente activa:

| Estado | Pill | Color |
|---|---|---|
| Baseline integrado | "baseline integrado" | gris |
| Upload del usuario | "archivo: NOMBRE.xlsx" | verde |
| Firestore realtime | "fuente: Firestore" | verde |
| Todo falló | "sin datos" | rojo |

---

## 6. Integración Firestore (Realtime)

`suscribirIndicadoresCalidad(onData, onError)` abre `onSnapshot` a
**`/indicadores_calidad/global`**. El shape del documento es idéntico
al baseline JSON.

### 6.1 Orden de hidratación en `calidad-shell.js`

1. **IndexedDB** — si hay un archivo previamente cargado por el
   usuario, se restaura primero (estado `source: 'upload'`).
2. **Baseline JSON** — si IndexedDB está vacío, se carga el JSON local
   (estado `source: 'baseline'`).
3. **Firestore** — siempre se suscribe; cuando llega data y
   `source !== 'upload'`, reemplaza al baseline (estado
   `source: 'firestore'`). NO pisa el upload del usuario.

### 6.2 Reglas Firestore esperadas

```javascript
match /indicadores_calidad/{id} {
  allow read:  if isTeamMember();
  allow write: if isAdmin();
}
```

Pendiente: si el director decide poblar Firestore, agregar el match
arriba a `firestore.rules`. No requiere índices nuevos.

---

## 7. Proyección OLS

`calcularProyeccionOLS(real, N=12)` ejecuta una regresión lineal por
mínimos cuadrados:

```
y = a + b·x  con x ∈ [0, N-1]
```

Sobre los valores reales (no nulos) de la serie, devolviendo:

- `base[N]` — proyección puntual
- `opt[N]` = `base × 0.9` — escenario optimista −10%
- `pes[N]` = `base × 1.1` — escenario pesimista +10%
- `ci_inf[N], ci_sup[N]` — banda IC95% con `t·sqrt(s²·(1/n + (x-x̄)²/Sxx))`
- `r2, slope, intercept, pval` — bondad de ajuste + significancia

> El bloque `proj` del baseline JSON está precalculado en Python para
> SAIDI · Sob/Desl en cada zona. Para SAIFI el módulo recalcula
> on-the-fly (los valores coinciden hasta ~3 decimales con la
> implementación Python, verificado en `tests/saidi_proyeccion.test.js`).

---

## 8. Heatmap dual (modo Ambos)

Cuando `met === 'ambos'`, `renderHeatmap()` no usa Plotly subplots
sino que **crea dinámicamente un segundo div** en el DOM:

```
chart-heat-titulo-1  ▮ SAIDI_E · duración (h-eq)
chart-heat            [heatmap SAIDI 420 px]
chart-heat-titulo-2  ▮ SAIFI_E · frecuencia (int-eq)
chart-heat-saifi      [heatmap SAIFI 420 px]
```

Cada heatmap es un `Plotly.react` independiente con su layout simple,
sin pelearse con la grilla externa del dashboard. Al volver a una sola
métrica, los nodos extras se ocultan y `#chart-heat` regresa al estado
normal.

### 8.1 Paleta de calor

7 stops para que los valores bajos sean visibles y los picos
resalten:

```
0.00  #ECFDF5  mint muy claro · "sin violaciones"
0.05  #FEF3C7  amber-50
0.20  #FDE68A  amber-200
0.40  #FBBF24  amber-400
0.60  #F97316  orange-500
0.80  #EF4444  red-500
1.00  #7F1D1D  red-900 · pico crítico
```

Separadores `xgap: 2 ygap: 2` entre celdas para distinguir cada tile.

---

## 9. Reglas técnicas relevantes

### 9.1 Plotly muta los objetos layout/font

`Object.freeze(LAYOUT_BASE)` rompe el render con
*"Attempted to assign to readonly property"*. Por eso `font()`,
`layoutBase()` y `plotlyCfg()` son **funciones factory** que devuelven
objetos frescos cada vez. Aplica a cualquier integración futura de
Plotly en el proyecto.

### 9.2 Fetch del baseline con múltiples candidatos

`cargarBaselineLocal()` prueba 3 URLs (import.meta.url relativa,
pathname relativo, ruta absoluta) hasta encontrar la que sirve.
Imprescindible en GitHub Pages bajo subrutas dinámicas.

### 9.3 safeRender por chart

`calidad-shell.js#renderAll` envuelve cada renderer en su propio
try/catch. Un fallo aislado (ej. dataset con campo faltante) no rompe
los otros renderers. Los errores se loggean en consola + banner
`#calidad-error` visible.

---

## 10. Tests

```bash
npm test                                  # lint + 752/752 tests
node --test tests/saidi_calculo.test.js   # 21 tests · agregadores
node --test tests/saidi_proyeccion.test.js # 10 tests · OLS
```

Cobertura:

- **Agregadores**: `sumSerie`, `avgSerie`, `growthPct`, `varMoM`,
  `catTotals`, `gruposDeZona`, etc. — casos felices + edge (null,
  vacío, div/0, ordenación).
- **OLS**: contra `REAL_TODAS_SOB` y `REAL_BOLIVAR` del baseline para
  reproducir `slope ≈ 0.1897` y `0.0687` respectivamente · IC95%
  encierra base · escenarios ±10% · edge cases (serie constante,
  lineal perfecta, con nulls, <2 puntos).
- **Config**: `clasificarGrupoCausa` (criterio único causa→grupo),
  `categoriaColor` (Racion→púrpura · Sobrecarga/Deslastre→rojo ·
  resto→ámbar) y `CAUSAS_CANON` (las 13 causas oficiales mapean a un
  grupo controlable).

---

## 11. Cómo extender

### 11.1 Agregar una nueva categoría

1. Agregar el nombre exacto a `dataset.cats_order` (orden canónico).
2. Agregar la serie correspondiente en `zonas.*.cat_saidi` y
   `cat_saifi` de cada zona del baseline JSON.
3. Si la categoría no encaja con el clasificador actual, ajustar
   `categoriaColor()` en `domain/saidi_config.js`.
4. Regenerar el baseline o subir Excel con la nueva categoría.

### 11.2 Agregar un cuarto grupo de causa

1. Editar `domain/saidi_config.js`:
   - Agregar al objeto `GCOL` el color del grupo
   - Agregar a `GRUPOS` el nombre en el orden de apilamiento
2. Editar `state.js`: agregar al Set `GRUPOS_CANON` inicial.
3. Editar `pages/indicadores-calidad.html`: agregar un cuarto chip
   `<button class="grp-chip" data-grp="...">`.
4. Editar `renderers/varmom.js`: agregar el grupo al loop con su
   `GRP_COLOR` y `GRP_DASH_*` correspondientes.
5. Editar `renderers/month-table.js`: agregar fila al `rowsDef`.

### 11.3 Agregar un nuevo chart

1. Crear `assets/js/ui/calidad/renderers/mi-chart.js` con función
   `renderMiChart(dataset, zona, met)`.
2. Importar en `calidad-shell.js` y agregar al `renderAll`:
   ```js
   safeRender('mi-chart', () => renderMiChart(dataset, zona, met));
   ```
3. Agregar el `<div id="chart-mi">` en `pages/indicadores-calidad.html`.
4. Considerar si necesita respetar `gruposActivos`, métricas o algún
   filtro adicional.

---

## 12. Backlog (post-v1)

- **Ranking de zonas/categorías** con sparkline de tendencia mensual
  (similar al bump chart de Seguimiento Operativo).
- **Exportar a Excel** los datos del dashboard con un formato
  consumible por reportes (botón al final de la página).
- **Comparativa interanual** cuando exista dataset de 2025 cargado.
- **Anomalía detection** en las series mensuales (alertas si un mes
  excede ±2σ vs media móvil).
- **Cloud Functions trigger** que recalcula OLS en SAIFI por zona y
  publica al doc Firestore `/indicadores_calidad/global` cuando llega
  data nueva del backend Python.

---

## 13. Referencias

- Archivo legacy: `SAIDI_SAIFI Deslastre por Capacidad de Transformacion.html`
  (conservado en raíz · 4.8 MB intactos).
- Fuente del dataset: `INTERRUPCIONES_2026_CONSOLIDADO_PRELIMINARES.xlsx`
  (137.211 registros · backend Python).
- Documentos relacionados:
  - `docs/MANTENIMIENTO-BRIGADA.md` — mismo patrón de refactor.
  - Refactor SCADA en `claude/seguimiento-operativo-refactor`.
  - Refactor Salud de Activos en `claude/salud-activos-aqua-skin`.
- Normativa:
  - CREG 015/2018 · indicadores SAIDI_E / SAIFI_E.
  - CREG 097/2008 · metodología base.
  - MO.00418.DE-GAC-AX.01 Ed. 02 (interno) · clasificación de grupos
    y categorías.
