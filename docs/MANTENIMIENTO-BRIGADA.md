# Mantenimiento Brigada · Selección ONAF

> Módulo de calculadoras y herramientas para la brigada de
> mantenimiento especializado de transformadores de potencia.
> Primera herramienta entregada: **Selección de Sistema de
> Refrigeración (ONAN → ONAF)** conforme IEEE C57.12.00,
> ANSI C57.12.91, IEEE C57.91-2011 y Westinghouse T&D Reference.
>
> **Branch entregable:** `claude/add-calculation-tool-LSoff`
> **Commits:** `4323ac4` → `2ee9a9c` (10 commits)
> **Estado:** Producción · 497/497 tests verdes · html-validate limpio

---

## 1. Por qué este módulo existe

El director quería integrar al panel SGM una calculadora ya existente
en archivo legacy monolítico (`Calculo de Sistemas de refriegracion.html`,
1917 líneas con HTML+CSS+JS inline) que la brigada AFINIA usa para
dimensionar conversiones de enfriamiento ONAN → ONAF. El requisito:

- Misma precisión numérica que el original (verificación oficial
  AFINIA: 24 MVA × 125 % = **48.000 CFM**).
- Coherencia visual con el sistema "Aqua Liquid Glass" del resto
  de la plataforma — adaptando un rediseño dark-mode de Claude
  Design al sistema light-perla AQUA.
- Generación de informe técnico imprimible conforme a la plantilla
  oficial **Formato Afinia.docx** (Letter portrait con header
  Afinia + Grupo·epm en la cabecera y banda azul "www.afinia.com.co"
  + dirección "CaribeMar de la Costa" en el pie, repetidos en cada
  página).
- Future-proof para sumar más calculadoras de brigada sin tocar el
  sidebar.

---

## 2. Arquitectura

Patrón canónico del proyecto (igual que `Activos`, `Salud`, `Análisis`,
`Recursos`): un **módulo padre con tabs vía `module-shell`** + páginas
hijas que viven en su propio iframe lazy-load. Separación estricta
**dominio puro / data layer / UI binding**.

```
┌──────────────────────────────────────────────────────────────┐
│  Sidebar entry "Mantenimiento Brigada"                       │
│  (assets/js/aqua-shell.js · grupo Operación)                 │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│  pages/mantenimiento-brigada.html                            │
│  · módulo padre · ARIA tablist                               │
│  · 1 pestaña inicial: "Sistema de Refrigeración"             │
│  · tabs.js + module-shell.js · hash routing #tab=…           │
└─────────────────────┬────────────────────────────────────────┘
                      │ iframe lazy-load
                      ▼
┌──────────────────────────────────────────────────────────────┐
│  pages/calculo-refrigeracion.html                            │
│  · 84 IDs originales preservados                             │
│  · Maquetación Aqua Liquid Glass (CSS sólo tokens)           │
│  · Carga Chart.js 4.4.1 vía CDN                              │
└─────────────────────┬────────────────────────────────────────┘
                      │
       ┌──────────────┴──────────────┐
       ▼                              ▼
┌──────────────────┐         ┌─────────────────────────┐
│ UI binding layer │ ──────▶ │ Dominio puro (testable) │
│ calculo-         │         │ assets/js/domain/       │
│ refrigeracion.js │         │ refrigeracion.js        │
└────────┬─────────┘         └─────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│ Data files (lazy-load)                          │
│ assets/js/data/                                 │
│   refrigeracion-transformadores-afinia.js       │
│   refrigeracion-fan-db.js                       │
└─────────────────────────────────────────────────┘
```

---

## 3. Inventario de archivos

| Archivo | LOC | Rol |
|---|---:|---|
| `pages/mantenimiento-brigada.html` | 50 | Shell padre · 1 pestaña inicial · ARIA tablist + iframe |
| `pages/calculo-refrigeracion.html` | 525 | Maquetación de la calculadora · 84 IDs preservados |
| `assets/js/mantenimiento-brigada-shell.js` | 3 | One-liner `initModuleShell('brigadaTabs', { defaultTab: 'refrigeracion' })` |
| `assets/js/calculo-refrigeracion.js` | ~1750 | UI binding + Chart.js + generador de informe AFINIA |
| `assets/js/domain/refrigeracion.js` | 552 | Dominio puro · funciones testables sin DOM |
| `assets/js/data/refrigeracion-transformadores-afinia.js` | 29 | Catálogo congelado de 206 transformadores AFINIA |
| `assets/js/data/refrigeracion-fan-db.js` | 240 | Base de 13 fichas técnicas de motoventiladores |
| `assets/css/calculo-refrigeracion.css` | ~720 | Capa de estilo module-specific (100% tokens AQUA) |
| `assets/img/afinia/header.png` | binario | Logo Afinia · Grupo·epm (1273×282) |
| `assets/img/afinia/footer.png` | binario | Banda azul "www.afinia.com.co" (1284×162) |
| `tests/refrigeracion.test.js` | 350 | 44 tests `node --test` |
| `assets/js/aqua-shell.js` | +1 línea | Entrada del sidebar |

Total nuevo: **~4 450 LOC** en 11 archivos.

---

## 4. Capa dominio puro · `assets/js/domain/refrigeracion.js`

Funciones puras sin DOM ni I/O · 100% testeable con `node --test`.

### 4.1 Constantes inmutables (Object.freeze)

| Constante | Tipo | Propósito |
|---|---|---|
| `PENDIENTES_WESTINGHOUSE` | `[[%, CFM/kVA], …]` | 4 puntos calibrados oficiales: 115→1.20 · 125→2.00 · 133→2.65 · 166→4.25 |
| `FACTORES_CAUDAL` | `{m3s, m3min, m3h, cfm, cfs}` | Conversión a CFM (ft³/min) por unidad de entrada |
| `ETIQUETAS_CAUDAL` | `{m3s, m3min, …}` | Labels humanizados de cada unidad |
| `ALTURA_ESCALA_ISA` | `8500` | Altura de escala atmosférica ISA en metros |
| `EJE_X_KVA` | `[0, 500, …, 140000]` | 281 puntos del eje X canónico |
| `CURVAS_GRAFICO` | `[{pct, color, w}, …]` | 4 curvas oficiales del gráfico (Westinghouse) |
| `MS116_DB` | 13 modelos | Catálogo guardamotores ABB MS116 |
| `S203_DB` | 4 modelos | Catálogo breakers ABB S203 |
| `AUX_GUARDAMOTOR` | objeto | ABB HK1-11 (auxiliar SCADA) |
| `AUX_BREAKER` | objeto | ABB S2C-H11L (auxiliar SCADA) |
| `COMPAT_ESTADO` | `{OK, WARN, ERR, ND}` | Estados de compatibilidad mecánica |
| `DISPOSICIONES` | `{LATERAL, VERTICAL_1, VERTICAL_2}` | Disposiciones del ventilador sobre el radiador |

### 4.2 Funciones de cálculo

| Función | Firma | Devuelve |
|---|---|---|
| `interpolarPendiente(pct)` | `number → number` | Pendiente CFM/kVA interpolada linealmente entre los 4 puntos Westinghouse |
| `convertirCaudalACFM({valor, unidad})` | `({number, string}) → number\|null` | Caudal en CFM (entero redondeado) |
| `cfmAM3s(cfm)` | `number → number` | Inversa: CFM ÷ 2118.88 |
| `factorCorreccionAltitud(h_m)` | `number → number` | `e^(h/8500)`, modelo ISA exponencial |
| `calcularRefrigeracion({kva_onan, pct, alt})` | `({…}) → {onan, onaf, delta, pendiente, cfm_nivel_mar, cfm_corregido, factor_altitud}` | Núcleo del cálculo |
| `calcularUnidadesRequeridas({cfm_total, cfm_fan})` | `({…}) → {n, cfm_logrado, cobertura_pct, exceso, ok}` | N = ⌈ total / fan ⌉ |
| `generarCurva(pct, xs?)` | `(number, number[]?) → [{x,y}, …]` | Dataset de una curva |
| `deduceOnafDesdeOnanYPct(onan, pct)` | `(number, number) → number` | ONAF redondeado al kVA |
| `deducePctDesdeOnanYOnaf(onan, onaf)` | `(number, number) → number\|null` | Porcentaje con 1 decimal |
| `extraerCorrienteFan(strAmp, conexion)` | `(string, 'D'\|'Y') → number\|null` | Parser tolerante "1.60 / 0.92 A (D/Y)" |
| `seleccionarGuardamotor(amps)` | `number → object\|null` | MS116 dentro del rango (tolerancia 5%) |
| `seleccionarBreaker(amps_min)` | `number → object\|null` | S203 con `In ≥ amps_min` |
| `calcularProteccionElectrica({amps_por_fan, n_fans, factor_seguridad?})` | `({…}) → {amps_por_fan, n_fans, amps_totales, amps_min_breaker, guardamotor, breaker, aux_*}` | Sistema completo (NEC 430 ×1.25) |
| `evaluarCompatibilidad({A, B, C, diametro_mm, distancia_mm, disposicion})` | `({…}) → {c1, c2, c3, c4, resumen}` | 4 criterios geométricos C1-C4 |
| `mensajeDisposicion(disp)` | `string → string` | Texto informativo según disposición |
| `calcularYStep(yMax)` | `number → number` | Heurística del step del eje Y |
| `calcularAutoRango(kva_onan)` | `number → {xMin, xMax, yMin, yMax, yStep}` | Auto-zoom del gráfico |
| `formatearNumero(v)` | `number → string` | Formato es-CO entero |
| `escaparHtml(s)` | `string → string` | Escape básico para innerHTML |

### 4.3 Mix multi-modelo de ventiladores (2026-05-03)

A partir del refactor del 2026-05-03 el dominio acepta combinar
modelos heterogéneos en el mismo transformador (caso real de
campo: 4 × FN-050 + 8 × FN-063 + 12 × KRENZ F20 alimentando un
transformador 24 MVA). Tres funciones puras nuevas y la constante
`MIX_ESTADO`:

| Función | Firma | Devuelve |
|---|---|---|
| `evaluarMixVentiladores({items, cfm_requerido})` | `({Array<{key, modelo, marca, cfm_unitario, cantidad}>, number}) → object` | `{items[], cfm_aporte_total, deficit, exceso, cobertura_pct, n_unidades_total, aprobado, estado, mensaje}` |
| `sugerirMejoras({items, cfm_requerido, fan_db, max_sugerencias?})` | `({…, Record<string, FichaFan>, number?}) → Array<Sugerencia>` | Sugerencias ordenadas por menor exceso. Estrategias: `agregar_unidades`, `sustituir`, `agregar_modelo`. |
| `calcularProteccionMix({items, factor_seguridad?})` | `({Array<{key, modelo, marca, cantidad, amps_unitario, kw_unitario?, peso_unitario?}>, number?}) → object` | `{grupos[], n_total, amps_totales, amps_min_breaker, kw_totales, peso_total, breaker, aux_breaker}` |

`MIX_ESTADO`: `'aprobado' | 'no_aprobado' | 'sin_datos'`.

**Reglas de validación del mix:**

- Estado APROBADO: `cfm_aporte_total ≥ cfm_requerido`.
- Estado NO_APROBADO: hay items con cantidad y CFM > 0 pero la
  suma no cubre el requerido. Reporta `deficit` exacto.
- Estado SIN_DATOS: mix vacío, todas las cantidades en 0, o
  `cfm_requerido` no positivo.

**Protección eléctrica con mix heterogéneo:** cada modelo lleva
su propio guardamotor MS116 dimensionado a la corriente unitaria
del modelo (no del total), y el sistema completo lleva **un único
breaker principal S203** dimensionado a la corriente total con
factor de seguridad NEC 430 ×1.25.

**Motor de sugerencias** (3 estrategias, orden por menor exceso):

1. `agregar_unidades` · agrega N extra del modelo más eficiente
   ya en el mix.
2. `sustituir` · cambia el modelo más débil por otro mayor del
   catálogo manteniendo la cantidad.
3. `agregar_modelo` · agrega N unidades de un modelo nuevo del
   catálogo (no presente en el mix actual).

Cada sugerencia retorna `cambios[]` con `{accion, key, modelo,
marca, cantidad, cfm_unitario}` listo para aplicar al estado UI.

### 4.4 UI del mix (commit 2, 2026-05-03)

`pages/calculo-refrigeracion.html` expone los siguientes elementos
para gestionar el mix:

| Elemento | Descripción |
|---|---|
| `#mix_fan_sel` | Dropdown con los 13 modelos del catálogo agrupados por familia (ZIEHL ZN045 / FN050 / FN063 / ZN063 + KRENZ F20). |
| `#mix_fan_qty` | Input numérico (default 1, min 1, max 999). |
| `#btnAddToMix` | Botón "+ Agregar al mix". Si el modelo ya está, suma cantidades. Si no, lo agrega como nuevo item. |
| `#mix-table` | Tabla con filas dinámicas. Cada fila lleva su propio input de cantidad editable inline (`input.mix-qty`) y botón eliminar (`button.btn-rm-mix`). Pie de tabla con totales agregados (cantidad, CFM, %). |
| `#mix-status` | Banner con 3 estados: `is-aprobado` (verde), `is-no-aprobado` (rojo), `is-sin-datos` (gris). Muestra badge + mensaje + KPIs (cobertura %, exceso/déficit CFM, n total). |
| `#mix-suggestions` | Panel con 3 cards (una por estrategia). Visible solo cuando el mix está NO_APROBADO. Cada card lleva botón "Aplicar sugerencia" que muta el `state.mix`. |

**Modelo de estado** (en `assets/js/calculo-refrigeracion.js`):

```javascript
state.mix = [
  {
    id: 1,
    key: 'fn063_50',
    marca: 'ZIEHL-ABEGG',
    modelo: 'FN063-6DL.4I.A7P1',
    cfm_unitario: 5933,
    cantidad: 8,
    ficha: { /* snapshot inmutable Object.freeze del catálogo */ }
  },
  // ...
];
```

La `ficha` se congela con `Object.freeze` al agregar el item para
proteger contra mutaciones accidentales del catálogo. Cuando se
agrega un modelo, también se sincroniza la ficha técnica visible
del formulario para mantener compatibilidad mecánica + protección
eléctrica reflejando el modelo más reciente seleccionado.

**Convivencia con el selector legacy `#fan_db_sel`** (dentro de
"Datos técnicos del motoventilador"): se conserva como preview de
ficha sin agregar al mix. Útil para inspeccionar especificaciones
de un modelo antes de decidir si lo agrega.

### 4.5 Reflejo del mix en el informe AFINIA (commit 3, 2026-05-03)

El generador `generateReport()` (en `assets/js/calculo-refrigeracion.js`)
produce un HTML imprimible Letter conforme `Formato Afinia.docx`.
Desde el commit 3 cada sección refleja el mix multi-modelo:

| Sección | Contenido |
|---|---|
| **5. Datos de los motoventiladores** | Una sub-sección 5.N por cada modelo del mix con marca + modelo + cantidad. Ficha completa (12 campos identificación + 12 campos motor eléctrico) por modelo. Aporte de CFM por modelo (cantidad × cfm_unitario). Peso y kW agregados del grupo. |
| **8. Selección de motoventiladores** | Tabla del mix (#, marca, modelo, CFM/u, cantidad, aporte, aporte %) con pie de totales. Banner APROBADO/NO con cobertura + déficit/exceso. Si NO aprobado: tabla de hasta 3 sugerencias del motor `sugerirMejoras`. Fórmula `CFM_mix = Σ (cantidad × cfm_unitario)` sustituida con los valores reales. |
| **9. Circuito de protección eléctrica** | Tabla de grupos (una fila por modelo) con A/unidad, A del grupo, guardamotor MS116 sugerido, PID + setting. Pie con Σ corriente del sistema y breaker principal S203 único. Tabla complementaria con corriente total, mínima breaker, kW total, kVA aparente (Σ P_i / cosφ_i), peso total. Fórmulas: `I_total = Σ (cantidad_i × I_unitario_i)`, `I_min,breaker = 1.25 × I_total`, `P_total`, `S_total`, `W_total`. |
| **10. Lista de materiales** | BOM agrupado: por cada grupo (motoventiladores + guardamotores + auxiliares) + 1 breaker principal único + 1 auxiliar SCADA del breaker. Cada línea con cantidad + PID + especificación. |

**Reglas de paginación** se mantienen (regla CLAUDE.md §0.1.2.3 ·
paginación manual con `.sheet` divs, NO thead/tfoot ni position
fixed). El header `header_compact.png` y el footer `footer.png` se
inyectan explícitamente en cada hoja para garantizar repetición en
Safari.

### 4.6 Persistencia · acciones_refrigeracion (commit 4, 2026-05-03)

Cada cálculo ejecutado en la calculadora puede registrarse como
una "acción de mantenimiento" persistida en Firestore para
trazabilidad y consolidación posterior.

**Botón** `#btnRegistrarAccion` en la barra de exportar abre el
modal `#modalAccion` con:
- Resumen del cálculo (matrícula, subestación, mix, cobertura,
  estado APROBADO/NO).
- Descripción de la acción (textarea, mínimo 10 caracteres,
  obligatorio).
- Estado del workflow (`planificada`, `pendiente_aprobacion`,
  `aprobada`, `ejecutada`, `cancelada`).
- Fecha de la acción (obligatoria, default hoy).
- Fecha de ejecución (opcional).
- Observaciones (textarea libre).

**Colección `acciones_refrigeracion/{id}`** (ID autogenerado):

```javascript
{
  // Identificación
  transformador_id, matricula, proyecto, subestacion, zona,
  departamento, grupo, serie, refrigeracion,
  // Parámetros del cálculo
  kva_onan, kva_onaf, pct, altitud,
  cfm_requerido, cfm_corregido,
  // Snapshot completo
  mix: [{ key, marca, modelo, cfm_unitario, cantidad, ficha }],
  evaluacion: { cfm_aporte_total, cobertura_pct, deficit, exceso,
                n_unidades_total, aprobado, estado, mensaje },
  proteccion: { grupos[], n_total, amps_totales, amps_min_breaker,
                kw_totales, peso_total, breaker, aux_breaker },
  compatibilidad: { c1, c2, c3, c4, resumen },
  // Workflow
  accion_descripcion, estado_accion, fecha_accion,
  fecha_ejecucion, observaciones,
  // Responsable
  responsable_uid, responsable_nombre, responsable_email,
  // Auditoría
  createdAt, updatedAt, createdBy
}
```

**Reglas Firestore** (en `firestore.rules`):
- `read: isTeamMember()` — todo el equipo puede listar acciones.
- `create: isAdmin()` con validación server-side de campos
  obligatorios + enum `estado_accion` + `mix.size() >= 1`.
- `update: isAdmin()` solo permite cambiar campos no críticos
  (estado_accion, observaciones, fechas) — `transformador_id`
  queda inmutable.
- `delete: isAdmin()`.

**Índices compuestos** (`firestore.indexes.json`):
- `transformador_id ASC + fecha_accion DESC` (histórico por activo).
- `estado_accion ASC + fecha_accion DESC` (filtrar por estado).
- `subestacion ASC + fecha_accion DESC` (filtro geográfico).
- `responsable_uid ASC + fecha_accion DESC` (mis acciones).

**Data layer** `assets/js/data/acciones_refrigeracion.js` con
sanitización + validación cliente + CRUD + suscripción realtime.

**Deploy manual obligatorio** (regla §0.1.1):

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 4.7 Tab "Consolidado Sistemas de Refrigeración" (commit 5, 2026-05-03)

Segunda pestaña del módulo Mantenimiento Brigada (al lado de
"Sistema de Refrigeración"). Visualiza todas las acciones
registradas en realtime.

**Estructura:**
- `pages/mantenimiento-brigada.html` · tab `data-tab="consolidado"`
  → iframe lazy-load.
- `pages/consolidado-refrigeracion.html` · página dedicada.
- `assets/js/consolidado-refrigeracion.js` · UI binding +
  suscripción `onSnapshot`.

**Funcionalidades:**

| Componente | Detalle |
|---|---|
| 5 KPIs | Total acciones · Aprobadas / Ejecutadas · Planificadas / Pendientes · Σ kVA ONAF · Σ Ventiladores |
| Filtros | Búsqueda libre (matrícula / proyecto / descripción / responsable) · estado · subestación (poblada dinámicamente) · zona · rango fechas |
| Tabla | 15 columnas con sticky header · estado-pills 5 colores · OK ✓/✗ aprobado · descripción truncada con tooltip |
| Acciones admin | Cambiar estado (prompt) · Eliminar (confirm) |
| Export CSV | 28 columnas con BOM UTF-8 · BOM (mix resumen, agregados de evaluación + protección) |

**Filtros cliente-side:** la suscripción `suscribir({}, ...)` no
aplica filtros server-side; los filtros se aplican en cliente para
no requerir índices adicionales por combinación arbitraria. Los 4
índices del commit 4 cubren los casos comunes (por activo, por
estado, por subestación, por responsable). Para queries más
específicos cliente-side, los rows se mantienen en memoria (la
colección espera pocas decenas a cientos de acciones por proyecto).

**Manejo de errores:** si la suscripción cae con
`permission-denied` o `failed-precondition`, el banner de error
indica al usuario el comando exacto a ejecutar
(`firebase deploy --only firestore:rules` /
`firebase deploy --only firestore:indexes`) — útil para
recuperación cuando se olvida el deploy del commit 4.

---

## 5. Casos golden (regresión numérica)

Tests `node --test` en `tests/refrigeracion.test.js` (44 tests).
Casos críticos congelados:

| Caso | Input | Output esperado | Observación |
|---|---|---|---|
| Verificación AFINIA | 24 MVA × 125 % | **48.000 CFM** | Documentado en banda Westinghouse del original |
| Default 60 MVA × 133 % | — | **159.000 CFM** = 2.65 × 60.000 | KPI de pantalla por defecto |
| FN063 50 Hz | 2.80 m³/s → CFM | **5.933 CFM** | Catálogo Ziehl-Abegg |
| FN063 60 Hz | 3.00 m³/s → CFM | **6.357 CFM** | Catálogo Ziehl-Abegg |
| Interpolación 120 % | — | 1.60 CFM/kVA | Entre 115 (1.20) y 125 (2.00) |
| Selección N | 159.000 / 5.933 | **27 unidades** | Exceso 1.191 CFM |
| Guardamotor 1.60 A | — | **MS116-1.6** | Setting recomendado 1.60 A |
| Sistema 27×1.60 A · 1.25× | — | I_min = **54.00 A** | Excede catálogo S203 (≤ 50 A) |
| Sistema 4×1.60 A · 1.25× | — | I_min = **8.00 A** | Breaker **S203-C16 MTB** |
| Altitud 3000 m | — | F_alt ≈ **1.4239** = e^(3000/8500) | |

---

## 6. Generador de informe AFINIA

Función `generateReport()` en `assets/js/calculo-refrigeracion.js`.
Abre una nueva ventana con un documento HTML construido on-the-fly,
auto-llama `window.print()` cuando todas las imágenes (header,
footer, gráfico) terminan de cargar.

### 6.1 Plantilla oficial

Extraída del `Formato Afinia.docx` que aparece en `origin/main`:

| Atributo | Valor |
|---|---|
| Tamaño | Letter portrait (8.5″ × 11″) |
| @page margin | `0` (la tabla maestra y thead/tfoot manejan el layout) |
| Header (`thead`) | 1.55 in alto · `assets/img/afinia/header.png` |
| Footer (`tfoot`) | 1.20 in alto · `assets/img/afinia/footer.png` (banda azul) + texto dirección |
| Cuerpo (`tbody`) | padding 0.10 in × 1.18 in laterales |

### 6.2 Patrón anti-corte: `<thead>` + `<tfoot>` repeating

Reemplaza la versión `position: fixed` previa que fallaba en
Firefox/Safari. La técnica con `<table>` + `<thead>` con
`display: table-header-group` + `<tfoot>` con
`display: table-footer-group` es el **gold standard cross-navegador**
(usado por wkhtmltopdf, jsPDF, motores corporativos):

```html
<table class="report-doc">
  <thead><tr><td>… header AFINIA …</td></tr></thead>
  <tfoot><tr><td>… footer banda azul + dirección …</td></tr></tfoot>
  <tbody><tr><td>… 10 secciones del informe …</td></tr></tbody>
</table>
```

El navegador automáticamente:
1. Repite `thead` al INICIO de cada hoja impresa
2. Repite `tfoot` al FINAL de cada hoja impresa
3. Reserva el espacio en cada hoja, así que el cuerpo del `tbody`
   nunca puede traslaparse con header/footer ni cortarse ambiguamente

Ver CLAUDE.md §0.1.2.2 reglas 12 y 13 para detalle.

### 6.3 Estructura del informe (10 secciones)

| § | Sección | Contenido |
|---|---|---|
| Carátula | Bloque destacado | Proyecto · fecha · normativas IEEE/ANSI/Westinghouse |
| 1 | Identificación del transformador | 8 campos (matrícula, serie, sub, zona, depto, grupo, kVA placa, refrigeración) |
| 2 | Parámetros del cálculo | 7 filas (ONAN, ONAF, Δ, factor %, pendiente, altitud, F_corrección) + 5 KPIs |
| 3 | Curvas de enfriamiento | **Fórmulas aplicadas** (pendiente Westinghouse, CFM = m × kVA, F_alt = e^(h/8500)) + gráfico íntegro |
| 4 | Datos mecánicos del radiador | **SVG diagrama A/B/C/D** (vista frontal + perspectiva) + 8 campos |
| 5 | Datos del motoventilador | 12 campos aerodinámica + 12 campos motor eléctrico |
| 6 | Montaje sobre radiador | 8 campos (tipo fijación, dirección flujo, marco, tornillos, junta, observaciones) |
| 7 | Compatibilidad mecánica | 4 criterios C1-C4 con estado pill (ok/warn/err/nd) + diagnóstico + conclusión |
| 8 | Selección de motoventiladores | **Fórmula N = ⌈ … ⌉ aplicada** + tabla con todas las opciones + recomendación destacada |
| 9 | Protección eléctrica | **5 fórmulas aplicadas** (I_total, I_min, P_total, S_total) + tabla con MS116 / S203 / auxiliares + TODOS los totales |
| 10 | Lista de materiales | BOM con # · Cantidad · Componente · PID · Especificación |

### 6.4 Reglas de paginación

- `break-inside: avoid` en cada bloque atómico (KPI grid, gráfico,
  tabla, info-box, formula-box, rad-diagram).
- `<section class="section-anchor">` alrededor de h2 + primera tabla
  para que el título nunca quede como "viuda" al pie de una página.
- `widows: 4 / orphans: 4` en párrafos.
- **NUNCA** `page-break-after: always` salvo entre documentos
  distintos — flujo natural decidido por el navegador.
- Diagrama del radiador: SVG inline con `viewBox="0 -30 720 350"`
  (espacio en Y negativo para las cotas superiores B y D que
  antes se recortaban).

### 6.5 Fórmulas con sustitución numérica

Cada fórmula simbólica en el informe va acompañada del cálculo
aplicado con los inputs reales. Patrón `.formula-box`:

```
┌──────────────────────────────────────────────┐
│ FÓRMULA APLICADA                             │
│                                              │
│ N = ⌈ CFM_total ÷ CFM_fan ⌉   ← simbólica   │
│ N = ⌈ 159.000 ÷ 5.933 ⌉ → N = 27 unidades   │
│   (sustituido + resultado en rojo)           │
└──────────────────────────────────────────────┘
```

Aplicado a:
- §3: pendiente Westinghouse interpolada, CFM₀ = m × kVA, F_alt
- §8: N = ⌈ CFM_total ÷ CFM_fan ⌉, CFM logrado = N × CFM_fan
- §9: I_total, I_min,breaker (×1.25 NEC 430), P_total, S_total = P/cosφ

---

## 7. Diagrama del radiador

SVG inline en `radiadorDiagramSVG()` (assets/js/calculo-refrigeracion.js).
Replica el modelo de referencia AFINIA original con dos vistas:

1. **Vista frontal**: rectángulo con 22 obleas verticales paralelas +
   cabezales superior/inferior + cotas A (rojo, altura derecha) y
   B (verde, span obleas arriba).
2. **Vista en perspectiva isométrica**: cuerpo + 20 aletas + flange
   con tornillos cian + cotas C (rojo, ancho frente izquierdo) y
   D (cian, distancia centros tornillos arriba).

Cotas codificadas por color, idénticos al UI del calculador:
- A, C → rojo `#c62828`
- B → verde `#2e7d32`
- D → cian `#0288d1`

ViewBox extendido `"0 -30 720 350"` para que las anotaciones
superiores no queden recortadas.

---

## 8. Cómo extender el módulo

### Añadir una nueva calculadora de brigada

1. Crear `pages/calculo-{nuevo}.html` (página hija).
2. Añadir botón a la tablist en `pages/mantenimiento-brigada.html`:
   ```html
   <button type="button" role="tab" data-tab="nuevo">
     <span class="i"><i data-lucide="ICON"></i></span>Nombre
   </button>
   ```
3. Añadir panel:
   ```html
   <div role="tabpanel" data-tab-panel="nuevo" hidden>
     <iframe class="tab-iframe" data-src="calculo-nuevo.html" loading="lazy"></iframe>
   </div>
   ```
4. (Opcional) Actualizar `defaultTab` en `mantenimiento-brigada-shell.js`.

Cero cambios en el sidebar.

### Añadir un transformador AFINIA al catálogo

Editar `assets/js/data/refrigeracion-transformadores-afinia.js` y
agregar la entrada al array `TRANSFORMADORES_AFINIA` con la misma
forma que las existentes (campos en mayúsculas: `SERIE`,
`POTENCIA (KVA)`, `GRUPO`, `SUBESTACION`, `MATRICULA`, `ZONA`,
`DEPARTAMENTO`, `REFRIGERACION`).

### Añadir una ficha técnica de motoventilador

Editar `assets/js/data/refrigeracion-fan-db.js` y agregar una clave
nueva al objeto `FAN_DB` con el shape `VentiladorFicha` documentado
en el header del archivo (29 campos canónicos). El UI lo recogerá
automáticamente en el `<optgroup>` del selector.

### Añadir un proyecto frecuente al datalist

Editar `pages/calculo-refrigeracion.html` § datalist `proyecto_list`:
```html
<datalist id="proyecto_list">
  <option value="Actualización y Repotenciación del Sistema de Refrigeración"></option>
  <option value="Sistema de Refrigeración URE"></option>
  <option value="NUEVO PROYECTO AQUÍ"></option>
</datalist>
```

> **Nota:** `proyecto_list` sigue siendo `<datalist>` porque es un campo
> de texto libre con solo ~3 opciones sugeridas — el usuario suele
> escribir un nombre nuevo. NO confundir con el campo "Búsqueda por
> matrícula" que SÍ usa combobox custom (ver § 7.4) porque tiene 206
> opciones cerradas y `<datalist>` fallaba en Safari/iframe.

### 7.4 Combobox de matrícula AFINIA (2026-05-15)

El campo **"Búsqueda por matrícula"** del § Identificación del
transformador es un **combobox custom** (no `<datalist>`) por la
regla permanente §0.1.2.12 del CLAUDE.md.

**Arquitectura:**

- HTML: `<input type="text" id="mat_input" role="combobox">` +
  `<ul id="mat_listbox" role="listbox">` dentro de `<div class="combo-wrap">`
- CSS: `.combo-wrap` / `.combo-list` en
  `assets/css/calculo-refrigeracion.css` líneas 99-156
- JS: `initMatSelect()` en
  `assets/js/calculo-refrigeracion.js` (~ línea 125)
- Catálogo: `assets/js/data/refrigeracion-transformadores-afinia.js`
  (206 entradas, sincronizadas con `Salud de Activos 2026.xlsx` hoja
  `TX_Potencia`)

**Búsqueda multi-campo** — filtra por substring case-insensitive en:
- `MATRICULA` (ej. `T1-M/M-CHG` o solo `CHG`)
- `SUBESTACION` (ej. `chiriguana` o `chiriguán`, normalize NFD ignora acentos)
- `DEPARTAMENTO` (ej. `cesar`, `bolívar`, `magdalena`)
- `ZONA` (ej. `oriente`, `bolivar`, `occidente`)
- `SERIE` (ej. `N339380`)

**Eventos wireados:**

| Evento | Handler |
|---|---|
| `input` | filtra catálogo y rerenderea lista |
| `focus` | abre lista con primeros 30 o filtrados |
| `blur` (con 150ms delay) | cierra lista |
| `mousedown` en `<li>` | `commit()` + `dispatchEvent(change)` |
| `keydown` ↑↓ | navega por la lista (scrollIntoView) |
| `keydown` Enter | selecciona el item activo |
| `keydown` Esc | cierra lista |

**Compatibilidad con resto del módulo** — el `commit()` despacha
`new Event('change', { bubbles: true })` para que el handler existente
`onMatChange()` (registrado vía `addEventListener('change', ...)`)
autocomplete los 7 campos readonly (Serie, Subestación, Zona,
Departamento, Grupo, Potencia, Refrigeración) + recalcule los KPIs
ONAN/ONAF. Todos los call sites de `mat_input.value` (registro de
acción, exportar JSON, generar informe, anti-duplicado) siguen
funcionando idénticos.

**Tope de resultados visibles:** 30 items + indicador `… y N más ·
refiná la búsqueda` cuando hay más coincidencias. Sin tope, render
de 200+ entradas se vuelve lento en cada `input`.

**Lint exception:** el `<ul role="listbox">` dispara la regla
`prefer-native-element` de html-validate. Suprimida con comentario
inline en `pages/calculo-refrigeracion.html` línea 55:

```html
<!-- [html-validate-disable-next prefer-native-element: combobox custom...] -->
```

**Para añadir/modificar matrículas:** editar
`Salud de Activos 2026.xlsx` hoja `TX_Potencia` y luego regenerar
`assets/js/data/refrigeracion-transformadores-afinia.js` con un
script Node (referencia rápida abajo). El catálogo congelado existe
para que el módulo cargue sin depender de Firestore — los 206 trafos
son catálogo cerrado de AFINIA.

```bash
# Regenerar catálogo desde Excel
node -e "
const XLSX = require('xlsx');
const wb = XLSX.readFile('Salud de Activos 2026.xlsx');
const ws = wb.Sheets['TX_Potencia'];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
const out = rows.filter(r => r.MATRICULA && String(r.MATRICULA).trim())
  .map(r => ({
    SERIE: r.SERIE != null ? String(r.SERIE) : '',
    'POTENCIA (KVA)': r['POTENCIA (KVA)'] != null ? String(r['POTENCIA (KVA)']) : '',
    GRUPO: String(r.GRUPO || '').trim(),
    SUBESTACION: String(r.SUBESTACION || '').trim(),
    MATRICULA: String(r.MATRICULA).trim(),
    ZONA: String(r.ZONA || '').trim(),
    DEPARTAMENTO: String(r.DEPARTAMENTO || '').trim(),
    REFRIGERACION: String(r.REFRIGERACION || '').trim()
  }));
console.log('export const TRANSFORMADORES_AFINIA = Object.freeze(' + JSON.stringify(out) + ');');
"
```

---

## 9. Decisiones del director (NO re-debatir)

Memorizadas en CLAUDE.md §0.1.2.1, §0.1.2.2 y §9 (este archivo).

1. **Patrón module-shell** — el módulo padre usa el mismo shell
   genérico que `Activos`, `Salud`, `Análisis`, `Recursos`.
   No introducir framework (React/Vue/Svelte): rompería coherencia
   con los 13 módulos existentes.
2. **Dominio puro separado** — toda matemática vive en
   `assets/js/domain/refrigeracion.js`, sin DOM. Tests
   `node --test` garantizan que un refactor de UI no puede romper
   precisión numérica.
3. **AQUA Light, no dark** — adaptación obligatoria del rediseño
   dark del bundle Claude Design al sistema light-perla del proyecto.
   Tokens de `aqua-tokens.css` exclusivamente, cero hard-coding.
4. **84 IDs originales preservados** — el archivo legacy quedó como
   contrato funcional. La maquetación nueva no renombra ningún ID
   para que la lógica original migre 1:1.
5. **Cruceta roja del gráfico es invariante** — líneas rojas
   punteadas desde los ejes hasta el punto de operación + puntos
   en intersecciones + etiquetas X.X MVA y XX.XXX CFM. Es la
   lectura directa que el ingeniero usa para validar.
6. **Leyenda del gráfico abajo** (no arriba). Original Westinghouse.
7. **Plantilla "Formato Afinia.docx" como fuente de verdad** —
   header logo + footer banda azul + dirección replicados en cada
   hoja impresa vía thead/tfoot.
8. **Datalist en "Nombre del proyecto"** — dos opciones predefinidas
   ("Actualización y Repotenciación del Sistema de Refrigeración"
   y "Sistema de Refrigeración URE") con texto libre admitido.

---

## 10. Verificación

Ejecutar antes de cualquier cambio en este módulo:

```bash
# Lint HTML
node_modules/.bin/html-validate pages/mantenimiento-brigada.html pages/calculo-refrigeracion.html

# Tests dominio puro
node --test tests/refrigeracion.test.js

# Suite completa del proyecto
npm test
```

Esperado: 497/497 verdes · lint limpio.

Verificación visual local:
```bash
python3 -m http.server 8000
# luego http://localhost:8000/pages/mantenimiento-brigada.html
```

---

## 11. Historial de commits

```
2ee9a9c fix(brigada): informe AFINIA · header/footer cross-navegador via thead/tfoot
0c253d4 fix(brigada): informe AFINIA · header/footer en cada hoja + SVG D visible
7bf6ff8 fix(brigada): informe AFINIA · titulos pegados + formulas aplicadas + diagrama radiador
177584a fix(brigada): informe AFINIA · flujo natural + datos completos + BOM
3ef32db feat(brigada): informe AFINIA · plantilla oficial + gráfico íntegro + datalist proyecto
b5580a6 fix(brigada): cruceta roja + leyenda abajo · paridad visual con original
36cf721 feat(brigada): F4 · animaciones + manejo de errores + pulido Liquid Glass
ae10dca feat(brigada): F3 · migración lógica · dominio puro + cableado UI
3501a51 feat(brigada): F2 · maquetación Aqua Liquid Glass · cálculo refrigeración
4323ac4 feat(brigada): F1 · módulo Mantenimiento Brigada · skeleton + sidebar entry
```
