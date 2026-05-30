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
│  pruebas_         │ │   · SEED_LOCAL fallbk│ │                  │
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
| **Datos** | `assets/js/data/pruebas_electricas.js` | Lectura realtime (`onSnapshot`), escritura (sanitiza + `deepClean`), Storage (PDF). Fallback `SEED_LOCAL`. | ✅ (CDN gstatic) |
| **UI** | `assets/js/ui/pruebas/{semaforo,tabla-pruebas,grafico-svg}.js` | Render puro a DOM/SVG. | ❌ ninguna |
| **Controlador** | `assets/js/pruebas-electricas-shell.js` | Entrypoint: cablea datos ↔ UI, KPIs, modal de carga. | indirecta |
| **Vista** | `pages/pruebas-electricas.html` | Marcado + carga de scripts. | — |
| **Estilos** | `assets/css/pruebas-electricas.css` | Visual del módulo (scope `.pe-scope`), idéntico al original. | — |

**Por qué esta separación:** el dominio y la UI no importan Firebase,
así que se prueban con `node --test` sin red. La capa de datos es el
único punto acoplado al SDK (importado por CDN gstatic), y queda
intercambiable: la vista funciona offline con `SEED_LOCAL` y en vivo
con Firestore sin tocar UI ni dominio.

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

## 4. Fuente de datos: local vs Firestore

La capa `data/pruebas_electricas.js` es **adaptable** sin cambios en la UI:

- **Firebase configurado** (`isReady()` → `isFirebaseConfigured && getDbSafe()`):
  `suscribirUnidades` / `suscribirInformes` usan `onSnapshot` en vivo.
- **Sin Firebase:** caen a `SEED_LOCAL` — la unidad real `173523-15510`
  del tablero original con 3 informes (2012, 2014, 2020), con los
  mismos números que alimentan las gráficas. El `unsubscribe` es no-op.

Esto permite (a) que la vista funcione offline sin backend, (b) que
los tests de integración usen un mock determinístico sin red.

---

## 5. Tests

```bash
npm run test:unit     # node --test tests/*.test.js
```

- `tests/pruebas_electricas_semaforo.test.js` — valores **límite** de
  cada calificador + `estadoGlobal` + congelado de `UMBRALES`
  (regresión de reglas de negocio).
- `tests/pruebas_electricas_data.test.js` — integración del `SEED_LOCAL`
  y schema (piezas sin dependencia del CDN; el módulo de datos completo
  no se importa en Node porque trae el SDK Firebase desde gstatic).

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
