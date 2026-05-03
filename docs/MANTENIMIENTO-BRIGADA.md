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
