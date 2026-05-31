# Mantenimiento Predictivo · Pruebas Eléctricas

Refactor del tablero estático **"Tablero Dinámico de Pruebas
Eléctricas.html"** (TransformerOps) a un módulo modular, dinámico y
escalable sobre el stack del proyecto (HTML/CSS/JS vanilla + Firebase
Firestore en tiempo real + Auth + Storage), integrado al sistema de
diseño **Aqua**.

El objetivo del refactor: eliminar la dependencia del Excel/archivo
estático, separar interfaz / estilos / procesamiento de datos en
piezas reutilizables y testeables, y preservar **exactamente** el
diseño visual y la lógica del **semáforo normativo** del tablero
original.

---

## 1. Arquitectura (separación en capas)

```
┌──────────────────────────────────────────────────────────────┐
│ pages/pruebas-electricas.html        (vista · page-module Aqua)│
│   · page-guard.js  → gate de sesión Firebase Auth              │
│   · aqua-shell.js  → topbar + sidebar inyectados               │
│   · <link> assets/css/pruebas-electricas.css                   │
└───────────────┬────────────────────────────────────────────────┘
                │ importa (ESM)
                ▼
┌──────────────────────────────────────────────────────────────┐
│ assets/js/pruebas-electricas-shell.js   (CONTROLADOR/entrypoint)│
│   Orquesta: suscripciones de datos → render UI → KPIs → modal  │
│   de carga (serie → PDF → confirmar con extracción pdf.js).    │
└───┬──────────────────────┬───────────────────────┬─────────────┘
    │                      │                       │
    ▼ DOMINIO (puro)       ▼ DATOS (I/O)           ▼ UI (render)
┌───────────────────┐ ┌──────────────────────┐ ┌──────────────────┐
│ domain/           │ │ data/                │ │ ui/pruebas/      │
│  pruebas_         │ │  pruebas_            │ │  semaforo.js     │
│  electricas_      │ │  electricas.js       │ │  tabla-pruebas.js│
│  semaforo.js      │ │   · onSnapshot live  │ │  grafico-svg.js  │
│  pruebas_         │ │   · solo datos reales│ │                  │
│  electricas_      │ │   · sanitiza+deepClean│ │ (sin Firebase;   │
│  schema.js        │ │  _firestore_clean.js │ │  puro DOM/SVG)   │
│ (sin Firebase ·   │ │                      │ │                  │
│  testeable Node)  │ │ firebase-init.js     │ │                  │
└───────────────────┘ └──────────────────────┘ └──────────────────┘
```

| Capa | Archivo(s) | Responsabilidad | Dep. Firebase |
|---|---|---|---|
| **Dominio** | `assets/js/domain/pruebas_electricas_semaforo.js` | Calificadores + umbrales **congelados** del semáforo (reglas de negocio). | ❌ ninguna |
| **Dominio** | `assets/js/domain/pruebas_electricas_schema.js` | Sanitizadores y validadores de `unidad` e `informe`. | ❌ ninguna |
| **Dominio** | `assets/js/domain/pruebas_electricas_extraccion.js` | Extrae las 6 mediciones del texto del PDF (`extraerMediciones`). Política conservadora + `_diagnostico.campos`. | ❌ ninguna |
| **Datos** | `assets/js/data/pruebas_electricas.js` | Lectura realtime (`onSnapshot`), escritura (sanitiza + `deepClean`), Storage (PDF). Sin Firebase → emite vacío (solo datos reales, sin seed). | ✅ (CDN gstatic) |
| **UI** | `assets/js/ui/pruebas/{semaforo,tabla-pruebas,grafico-svg}.js` | Render puro a DOM/SVG. | ❌ ninguna |
| **Controlador** | `assets/js/pruebas-electricas-shell.js` | Entrypoint: cablea datos ↔ UI, KPIs, modal de carga. | indirecta |
| **Vista** | `pages/pruebas-electricas.html` | Marcado + carga de scripts. | — |
| **Estilos** | `assets/css/pruebas-electricas.css` | Visual del módulo (scope `.pe-scope`), idéntico al original. | — |

**Por qué esta separación:** el dominio y la UI no importan Firebase,
así que se prueban con `node --test` sin red. La capa de datos es el
único punto acoplado al SDK (importado por CDN gstatic). Es una
interfaz en tiempo real · solo datos reales: sin Firebase configurado
las suscripciones emiten listas vacías (estado vacío en la vista) y
con Firestore se llenan en vivo, sin tocar UI ni dominio.

---

## 2. Semáforo normativo (regla de negocio congelada)

Toda la lógica vive en `domain/pruebas_electricas_semaforo.js`. Los
`UMBRALES` están **congelados** por tests de regresión: cualquier
cambio de límite rompe `tests/pruebas_electricas_semaforo.test.js` a
propósito.

Estados (`ESTADOS`): `b-g` verde (0) · `b-a` ámbar (1) · `b-o` naranja
(2) · `b-r` rojo (3) · `b-n` neutral (-1, sin dato).
`estadoGlobal` = peor estado no-neutral entre todas las pruebas.

| Calificador | Regla | Límite |
|---|---|---|
| `calificarTanDelta` | ≤0.7 verde · 0.7–1.0 naranja · >1.0 rojo | `normal=0.7`, `limite=1.0` |
| `calificarExcitacion` | admisible = **10%** si I<50 mA, **5%** si I≥50 mA · ≤ mitad verde · entre mitad y límite **ámbar** · > límite rojo | `corrienteUmbralMA=50` |
| `calificarRelacion` | \|Δ\| ≤0.5% · >80% del límite ámbar · >límite rojo | `limite=0.5` |
| `calificarResistencia` | desbalance ≤5% · flag `verificar` fuerza ámbar | `limite=5` |
| `calificarAislamiento` | ≥1 GΩ verde · <1 GΩ rojo | `minGohm=1` |
| `calificarCollar` | <80 mW verde · 80–100 ámbar · ≥100 rojo | `limite=100` |

> **Sutileza clave (origen de un bug de tests):** en `calificarExcitacion`,
> al tocar **exactamente** el margen admisible (10% o 5%) el resultado
> es **ÁMBAR**, no verde, porque el valor aún supera `admisible × 0.5`.
> Verde solo se da `≤ mitad del margen`.

---

## 3. Modelo de datos Firestore

```
/pruebas_electricas/{unidadId}            ← identidad de la unidad (docId = serie)
    { serie, fabricante, ano_fabricacion, potencia, tensiones,
      grupo_conexion, refrigeracion, frecuencia, cliente,
      ubicacion, subestacion, updatedAt }

    /informes/{informeId}                 ← subcolección · un informe por año
        { unidadId, serie, ano,
          tand: [{ code, valor_pct }],     // CH, CHL, CL, CLT, CT, CHT
          excitacion:  { delta_pct, corriente_ma },
          relacion:    { desviacion_pct },
          resistencia: { desbalance_pct, verificar },
          aislamiento: { gohm },
          collar:      { mw },
          createdAt, updatedAt, createdBy }

Storage: pruebas_electricas/{unidadId}/{filename}.pdf   ← informe original
```

**Rules** (`firestore.rules`, bloque `match /pruebas_electricas/{id}`):
lectura `isTeamMember()`, escritura `isAdmin()`, con validación de
`serie` (string no vacío) y `ano`. La subcolección `informes` hereda
las mismas reglas.

> ⚠ **Requiere deploy manual** tras cualquier cambio en `firestore.rules`:
> ```bash
> firebase deploy --only firestore:rules
> ```

---

## 4. Fuente de datos: solo datos reales (interfaz en tiempo real)

La capa `data/pruebas_electricas.js` muestra **únicamente** lo que el
usuario sube; no hay dataset de demostración:

- **Firebase configurado** (`isReady()` → `isFirebaseConfigured && getDbSafe()`):
  `suscribirUnidades` / `suscribirInformes` usan `onSnapshot` en vivo.
- **Sin Firebase:** las suscripciones emiten una lista vacía una sola
  vez (`onData([])`) y devuelven un `unsubscribe` no-op; `obtenerUnidad`
  retorna `null` y `listarInformes` retorna `[]`.

Consecuencia: sin informes cargados la vista queda en estado vacío
(parque sin unidades, gráficas "Sin informes cargados", tablas e
historial vacíos). Todo lo visible se deriva de los informes reales.

---

## 5. Tests

```bash
npm run test:unit     # node --test tests/*.test.js
```

- `tests/pruebas_electricas_semaforo.test.js` — valores **límite** de
  cada calificador + `estadoGlobal` + congelado de `UMBRALES`
  (regresión de reglas de negocio).
- `tests/pruebas_electricas_data.test.js` — sanitizadores del schema y
  calificación de la UI con un fixture propio (piezas sin dependencia
  del CDN; el módulo de datos completo no se importa en Node porque
  trae el SDK Firebase desde gstatic).

---

## 6. Scripts npm

```bash
npm install        # instala devDependencies (html-validate, etc.)
npm run lint:html  # valida HTML (WCAG: H63 th scope, prefer-native-element…)
npm run lint       # alias de lint:html
npm run test:unit  # tests unitarios del dominio (node --test)
npm test           # lint + tests (gate de CI)
npm run build      # lint + tests (sitio estático · no hay bundler)
npm run serve      # http-server en :8080
npm start          # alias de serve
```

> `build` es una **compuerta de validación** (lint + tests), no un
> empaquetado: el sitio es estático y se sirve tal cual por GitHub
> Pages / http-server.

---

## 7. Sidebar Aqua

Entrada inyectada por `assets/js/aqua-shell.js`: grupo
**"Mantenimiento Predictivo"** → ítem **"Pruebas Eléctricas"**
(`data-key="pruebas-electricas"` → `pages/pruebas-electricas.html`).
`markActive()` lo resalta por nombre de archivo sin cableado extra.

---

## 8. Configuración / credenciales

El frontend NO consume `.env` en runtime: la config pública de Firebase
Web vive en `assets/js/firebase-config.js` (identificador público, no
secreto). `.env.example` documenta las variables para herramientas
server-side (firebase-admin, seeds, migraciones). Copiar a `.env`
(ignorado por git) y rellenar. Nunca subir credenciales reales.

---

## 9. Cómo extender

- **Nueva prueba/calificador:** añadir la función pura en
  `domain/pruebas_electricas_semaforo.js`, su umbral en `UMBRALES`,
  y un test de límite. Consumir desde `ui/pruebas/`.
- **Nuevo campo de informe:** extender `sanitizarInforme` +
  `validarInforme` en `domain/pruebas_electricas_schema.js`; el
  `deepClean` del data layer ya omite `undefined`/`NaN`.
- **Migrar el seed a Firestore:** poblar `/pruebas_electricas` y
  subcolección `informes`; al estar configurado Firebase, la vista
  conmuta a realtime automáticamente.

---

## 10. Extracción automática del PDF (pdf.js)

Toda la lógica de extracción vive en
`domain/pruebas_electricas_extraccion.js` (puro · sin pdf.js ni
Firebase · testeable con `node --test`). El shell extrae el texto
del PDF con **pdf.js v3.11.174** (CDN) y lo pasa a
`extraerMediciones(textoPdf)`, que devuelve las 6 mediciones más
un bloque `_diagnostico`:

```js
{
  tand: [{ code, valor_pct }, …],
  excitacion:  { delta_pct, corriente_ma },
  relacion:    { desviacion_pct },
  resistencia: { desbalance_pct, verificar },
  aislamiento: { gohm },
  collar:      { mw },
  _diagnostico: { campos: [...], traza: {...} }
}
```

> **Regla del badge "procesado":** un informe pasa a
> `estado='extraido'` (badge **procesado**) **si y solo si**
> `_diagnostico.campos.length > 0`. Si no se reconoció ninguna de
> las 6 pruebas, queda **pendiente de extracción** (mejor pendiente
> que un color equivocado en el semáforo).

### 10.1 Normalización del texto

- **`normalizar(t)`** — NFD + quita marcas combinantes (acentos),
  `\u00a0`→espacio, colapsa `[ \t\r\n]+` a un solo espacio y baja a
  minúsculas. **El parser ve una sola cadena larga**: los saltos de
  línea NO sobreviven, así que toda heurística trabaja por ventanas
  de texto, no por líneas. (Ω **no** es diacrítico → se conserva.)
- **`parseNum(s)`** — admite coma o punto decimal y desambigua
  miles (`1.234,5` y `1,234.5` → `1234.5`).
- **`NUM`** — patrón de número tolerante a separadores reutilizado
  por todas las estrategias.

### 10.2 Los 3 formatos de tan δ

El extractor de tan δ prueba en este orden de prioridad y se queda
con el primero que produzca códigos:

1. **Doble M-4100** — formato columnar detectado por el token
   `fctr`; el `%PF` es el **3.º número desde el final** de la fila.
2. **Puente / Omicron** — filas con `nF`/`pF` + `%`; el tan δ es el
   número **antes del `%`**, nunca la capacitancia (`nF`). Toma la
   **última** ocurrencia por código (la definitiva). Descarta filas
   combinadas (`CH+CHL`).
3. **Columnar genérico** — `CODE kV mA Watts %PF CorrFctr Cap`; el
   `%PF` es el 3.º desde el final. Descarta filas combinadas `X + Y`.

En todos los casos se descartan valores fuera del rango plausible
(`> 10 %` no es un tan δ creíble) y se evita confundir `cl` dentro
de palabras (`clase`, `ciclo`).

### 10.3 Relación de transformación · extractor "% dif" (column-major)

El reto de la relación es que muchos informes la presentan en
**tablas column-major**: pdftotext/pdf.js intercalan verticalmente
las relaciones (≥ 1.5) con sus desviaciones (decimales < 1.5).
Estrategia en dos fases:

1. **Etiqueta directa** — busca `relacion de transformacion … (error|
   desviacion|deviation)` y toma el valor en rango `[-10, 10]`.
2. **Tabla "% dif"** (fallback column-major) — localiza cada
   encabezado `% dif` **precedido por `relacion`**, recorre la
   región hasta `observacion`/`norma aplicable` y junta los números
   **con separador decimal** y magnitud `0 < |x| < 1.5`. La
   desviación es el **máximo** de esos candidatos.

> **Distinción clave (origen de un bug):** las tablas de relación
> usan el encabezado **`% dif`**, mientras que la **excitación** usa
> `desviacion %`. Esto separa con seguridad ambos bloques — sin esta
> ancla, la excitación de R3 (`DESVIACION %` −3.x) se colaría como
> relación. Además se exige separador decimal (excluye taps/tensiones
> enteras) y se corta antes del umbral normativo `±0,5%` para no
> contaminar con ese `0.5`.

### 10.4 Excitación, resistencia, aislamiento, collar

- **Excitación** — 5 estrategias: Δ% declarado explícito (gana sobre
  el cálculo), corrientes por fase → `deltaDosMayores` (Δ entre las
  **dos fases mayores**, no max−min), y una estrategia genérica
  `NUM mA`. La fase central cae naturalmente; el desbalance normativo
  es entre las dos mayores.
- **Resistencia** — desbalance `%` + bandera `verificar` cuando hay
  marca de "a confirmar / verificar" cerca del bloque de resistencia.
- **Aislamiento** — toma el **mínimo** en GΩ del bloque, saltando
  valores con `> < ≥ min max`; si solo hay MΩ, normaliza a GΩ
  (`÷1000`).
- **Collar caliente** — el **mayor** valor en mW del bloque (o
  Watts × 1000).

### 10.5 Calibración verificada (9 informes reales)

El extractor se calibró contra los 9 informes de campo (texto
extraído con pdftotext como proxy de pdf.js). Resultado actual:

| # | Informe | `campos` reconocidos | Badge |
|---|---|---|---|
| 1 | MPT045 DRM 2025 | (ninguno) | pendiente |
| 2 | MPT044 2025 | (ninguno) | pendiente |
| 3 | 230910 PYE 2023 (Omicron) | `tand`, `excitacion`, `aislamiento` | procesado |
| 4 | 230910 DRM 2023 | (ninguno) | pendiente |
| 5 | 230521 PYE 2023 | `tand`, `relacion` (0.19 %) | procesado |
| 6 | 210418 2021 | `relacion` (0.29 %) | procesado |
| 7 | 200622 2021 | `tand`, `relacion` (0.23 %) | procesado |
| 8 | 140609 2014 (Doble) | `tand`, `excitacion`, `aislamiento`, `collar` | procesado |
| 9 | 130823 2013 (Doble) | `tand`, `excitacion`, `collar` | procesado |

Los informes 1, 2 y 4 quedan legítimamente vacíos (su texto no
contiene las pruebas en un formato reconocible) → **pendiente**,
nunca un valor inventado.

### 10.6 Política conservadora

Ante la duda, `null`. El contrato (verificado por
`tests/pruebas_electricas_extraccion.test.js`): texto sin pistas →
todo `null`/vacío y `_diagnostico.campos = []`; texto vacío o `null`
no lanza. Cualquier ajuste a una heurística debe pasar la suite
sintética + re-verificar la tabla §10.5.
