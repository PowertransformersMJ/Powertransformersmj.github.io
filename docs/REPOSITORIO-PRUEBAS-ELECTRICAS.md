# Repositorio digital de pruebas eléctricas · Propuesta de arquitectura

> **Objetivo.** Almacenar todas las pruebas eléctricas realizadas a cada
> transformador de potencia del parque a lo largo de su operación, con
> ficha por número de serie, historial cronológico, informes
> descargables, buscador, filtros, control de acceso, API REST y
> alertas por valores fuera de rango.
>
> **Principio rector.** Esta propuesta **extiende** el módulo existente
> *Mantenimiento Predictivo · Pruebas Eléctricas* (`pages/pruebas-electricas.html`).
> Todo lo que hoy se aprecia —selector de serie, tablero ilustrado por
> unidad, las 6 pruebas con sus gráficas de tendencia, la pestaña
> "Informes cargados", los 3 informes base de la serie `173523-15510`,
> el semáforo normativo— **se conserva tal cual**. Lo nuevo se construye
> encima en microfases con commit aislado, sin romper lo verde.

---

## 0. Qué ya existe (línea base · NO se reescribe)

| Capacidad pedida | Estado hoy | Dónde vive |
|---|---|---|
| Serie como clave primaria | ✅ | `/pruebas_electricas/{serie}` (Firestore docId = serie) |
| Historial de pruebas por unidad | ✅ | subcol `/pruebas_electricas/{serie}/informes/{id}` |
| Resultados numéricos + unidades + técnico + equipo + fecha + obs. | ✅ | `pruebas_electricas_schema.js` (6 pruebas con detalle por fase/sección/buje) |
| Detección de valores fuera de rango | ✅ | `pruebas_electricas_semaforo.js` (umbrales congelados) |
| Adjunto PDF en object storage | ✅ | Firebase Storage `pruebas_electricas/{serie}/{archivo}` |
| Vista "biblioteca" (fichas con serie + último estado) | ✅ | `#parque-grid` (tarjetas por unidad) |
| Buscador por serie | ✅ | selector `#serieSelect` (combobox/`<select>`, §0.1.2.12) |
| Gráficas de tendencia (años en X, todos los informes de la serie) | ✅ | `ui/pruebas/grafico-svg.js` |
| Autenticación + roles + auditoría | ✅ (plataforma) | `auth/session-guard.js`, `/usuarios/{uid}`, `data/auditoria.js` |
| Tiempo real | ✅ | `onSnapshot` en `data/pruebas_electricas.js` |
| Extractor de PDF conservador | ✅ | `pruebas_electricas_extraccion.js` |

**Las brechas** (lo que esta propuesta agrega) son: metadatos
operativos ampliados, más tipos de prueba (DGA aceite, puesta a tierra,
descargas parciales), pestañas Documentos/Fotos, drag-and-drop,
filtros avanzados, versionado documental, vista previa embebida, API
REST, importación masiva, exportación ZIP y dashboard de KPIs.

---

## 1. Arquitectura técnica

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND (estático · GitHub Pages)                          │
│  pages/pruebas-electricas.html  ·  shell aqua + module-shell │
│  ├─ domain/   funciones puras (schema, semáforo, extracción) │
│  ├─ data/     onSnapshot + writes (Firestore + Storage)      │
│  └─ ui/       biblioteca, ficha por tabs, gráficas, modales  │
└───────────────┬──────────────────────────────────────────────┘
                │  Firebase Web SDK (CDN, ESM)
   ┌────────────┼───────────────────────────────┐
   ▼            ▼                ▼               ▼
┌────────┐ ┌──────────┐  ┌──────────────┐  ┌──────────────────┐
│ Auth   │ │ Firestore│  │   Storage    │  │ Cloud Functions  │
│Email/  │ │ (NoSQL · │  │ (objetos:    │  │ (API REST +      │
│Pwd +   │ │ docs por │  │ PDF/CSV/img/ │  │ alertas + import │
│roles   │ │ serie)   │  │ DOCX/termo)  │  │ + export ZIP)    │
└────────┘ └──────────┘  └──────────────┘  └────────┬─────────┘
                                                     │
                                         ┌───────────┴───────────┐
                                         ▼                       ▼
                                   Resend (email)          SCADA / CMMS
                                   Slack webhook           (CSV/JSON in)
```

**Componentes:**

- **DB → Cloud Firestore** (NoSQL documental). Ya en uso. La serie es
  el `docId`; el historial es una subcolección. Escala a millones de
  documentos con índices compuestos; lecturas delta por `onSnapshot`.
- **Storage de archivos → Firebase Storage** (bucket de objetos).
  Organización por `serie/año` (ver §6). Versionado lógico por
  metadatos (ver §5).
- **API REST → Cloud Functions** (Node 20, `firebase-admin`). Stubs ya
  deployables (`functions/`). Expone consulta por serie, historial,
  subida JSON/multipart, import masivo, export ZIP.
- **Frontend → sitio estático** ya existente (HTML/CSS/ES modules, sin
  build). Patrón aqua-shell + module-shell.
- **Autenticación → Firebase Auth** Email/Password + perfiles
  `/usuarios/{uid}` con rol. Guard unificado `session-guard.js`.

**Por qué este stack y no "relacional + objetos":** el proyecto ya
corre sobre Firebase (tier gratuito Spark, sin servidor que mantener).
Firestore cubre el caso "consulta por serie → historial" de forma
nativa y en tiempo real. Migrar a Postgres+S3 duplicaría infra sin
beneficio para este volumen. Si en el futuro se requiere analítica SQL
pesada, se exporta a BigQuery (extensión oficial de Firestore) sin
tocar el frontend.

---

## 2. Modelo de datos

### 2.1 Colección `pruebas_electricas/{serie}` — identidad + metadatos

```jsonc
{
  "schema_version": 3,
  "serie": "173523-15510",          // ← CLAVE PRIMARIA (docId)
  "fabricante": "ABB",
  "modelo": "TXXX",                  // (nuevo v3)
  "ano_fabricacion": 1998,
  "potencia": "22.5 / 30 MVA",
  "tensiones": "110/34.5/13.8 kV",
  "grupo_conexion": "YNyn0d1",
  "refrigeracion": "ONAN/ONAF",
  "frecuencia": "60 Hz",
  "fases": "3φ",
  "cliente": "Afinia",
  "ubicacion": "Subestación X",      // parque/subestación
  "subestacion": "SE Chiriguaná",
  "fecha_instalacion": "2000-03-15", // (nuevo v3)
  "fecha_retiro": null,              // (nuevo v3)
  "estado_operativo": "operativo",   // operativo|mantenimiento|fuera_servicio|retirado (nuevo v3)
  "notas_operativas": "…",           // (nuevo v3)
  "nomenclatura": [ /* devanados/fases/terminales */ ],
  "transformadorId": "T-001",        // FK opcional al inventario
  "ultimo_estado": "b-a",            // peor semáforo del último informe (derivado)
  "tiene_alertas": true,             // derivado (≥1 prueba fuera de rango)
  "updatedAt": "<serverTimestamp>"
}
```

> Los campos marcados *(nuevo v3)* amplían el schema actual sin romperlo:
> `sanitizarUnidad` añade defaults, las vistas legacy siguen leyendo lo
> que ya consumían.

### 2.2 Subcolección `…/informes/{informeId}` — un informe por visita

```jsonc
{
  "schema_version": 3,
  "unidadId": "173523-15510",
  "serie": "173523-15510",
  "ano": 2020,
  "fecha": "2020-08-23",
  "tipo": "informe",                 // base | informe
  "tipo_prueba": "predictivo_completo", // discriminador de familia:
  //   predictivo_completo | tan_delta | drm_oltc | resistencia_devanados
  //   | ttr | mixto  (inferido de las mediciones presentes si no se declara)
  "ejecutante": "Applus",            // técnico/empresa responsable
  "equipo": "DOBLE M4100 · …",       // equipo utilizado
  "temperatura_c": 28,               // condiciones (nuevo v3)
  "humedad_pct": 65,
  "observaciones": "…",
  "etiquetas": ["recepción", "post-falla"],   // tagging (nuevo v3)

  // ── mediciones por prueba (detalle exhaustivo · ya existente) ──
  "tand":        [ /* por sección CH/CHL/CL/… */ ],
  "excitacion":  { /* por fase A/B/C + TAP */ },
  "relacion":    [ /* por par de devanados */ ],
  "resistencia": [ /* AT/MT/BT en mΩ */ ],
  "aislamiento": [ /* GΩ por par/tierra */ ],
  "collar":      { /* pérdida mW por buje */ },
  "drm": {                           // Resistencia Dinámica del conmutador (OLTC)
    "conmutador": { /* fabricante, tipo, serial, posiciones, operaciones,
                       pos_nominal, tension_ui_v, corriente_iu_a, r_conmutacion_ohm */ },
    "tiempo_min_ms": 56,             // ventana de transición medida (ms)
    "tiempo_max_ms": 66,             // norma: 40–70 ms · guías ámbar 45/65
    "transiciones": [ /* detalle por posición si el reporte lo publica */ ]
  },

  // ── tipos de prueba adicionales (nuevo v3) ──
  "dga_aceite":  { /* gases disueltos ppm + diagnóstico Duval */ },
  "puesta_tierra": { /* Ω malla, continuidad */ },
  "descargas_parciales": { /* pC, patrón */ },

  // ── adjuntos (nuevo v3: array versionado, multi-formato) ──
  "adjuntos": [
    { "id":"a1", "tipo":"pdf",  "filename":"…", "storagePath":"…",
      "downloadURL":"…", "size":123456, "version":2, "version_de":"a0",
      "subido_por":"uid", "subido_en":"<ts>", "estado":"cargado" }
  ],
  "pdf": { /* compat: ref del PDF principal (ya existente) */ },

  "createdAt": "<ts>", "updatedAt": "<ts>", "createdBy": "uid"
}
```

### 2.3 Colección `auditoria_pruebas/{id}` — bitácora

```jsonc
{
  "accion": "subir|descargar|editar|borrar|exportar",
  "serie": "173523-15510",
  "informeId": "…",
  "adjuntoId": "…",
  "uid": "…", "email": "…", "rol": "ingeniero",
  "at": "<serverTimestamp>",
  "diff": { "campo": { "antes": …, "despues": … } }
}
```

> Reusa el patrón de `data/auditoria.js`. Lectura solo admin; escritura
> server-side desde Functions (o reglas que validen `uid == request.auth.uid`).

### 2.4 Índices Firestore (consulta y filtros)

- `pruebas_electricas`: `estado_operativo + serie`, `fabricante + serie`,
  `tiene_alertas + serie`, `ubicacion + serie`.
- Collection group `informes`: `ano DESC`, `tipo + ano`, `etiquetas (array) + ano`.

---

## 3. Interfaz (pantallas)

### 3.1 Biblioteca (pantalla principal) — *ya existe, se enriquece*

```
┌─ Mantenimiento Predictivo · Pruebas Eléctricas ───────────────┐
│ [ Buscar serie ▾  173523-15510 ]   Filtros ▾                  │
│  ─ KPIs del parque ─  Unidades:12  Subest.:5  Alertas:3       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│ │173523-…  │ │190021-…  │ │ … ficha  │   ← tarjeta por serie  │
│ │ABB·30MVA │ │Siemens   │ │  serie   │     último estado pill │
│ │● ámbar   │ │● verde   │ │ #pruebas │     nº de pruebas      │
│ │Ver ident→│ │Ver ident→│ │          │                       │
│ └──────────┘ └──────────┘ └──────────┘                       │
└───────────────────────────────────────────────────────────────┘
```

- Buscador por serie (exacta y parcial, autocompletado) — el selector
  actual; se le añade filtrado por substring multi-campo.
- Barra de **Filtros avanzados** (nuevo): tipo de prueba · rango de
  fechas · ubicación · estado operativo · fabricante · *solo con
  alertas*. Aplica sobre la grilla y persiste en query string.

### 3.2 Ficha por transformador (vista detallada) — *tabs ampliadas*

Hoy: tabs **Tablero** + **Informes**. Propuesta de tabs finales:

| Tab | Contenido |
|---|---|
| **Metadatos** | Identidad + datos de placa + estado operativo + notas (editable por ingeniero/admin). |
| **Historial de pruebas** | Cronológico: las 6+ pruebas con sus gráficas de tendencia y tablas (el "tablero" actual). |
| **Informes** | Lista descargable (`#reportlist` actual) con vista previa PDF embebida. |
| **Documentos técnicos** | DOCX/CSV/planos versionados, con control de cambios. |
| **Fotos y evidencias** | Galería (termografía, fotos de campo) con lightbox. |

### 3.3 Carga de prueba/informe — *drag-and-drop*

Zona de arrastre + selección manual. Flujo (conserva el actual):
1. Elegir/confirmar serie. 2. Soltar archivo(s) — **PDF o imagen**. 3. El
extractor lee la serie y la fecha del informe y **confirma coincidencia**
(`confirmarSerie`, `detectarAno`). 4. Captura de mediciones (form
exhaustivo o import). 5. Guardar → `onSnapshot` refresca todo.

**Lectura del texto del informe (`extraerTexto`).** Tres rutas según el
archivo, todas alimentan al mismo extractor conservador de mediciones:
1. **PDF con capa de texto** → `pdf.js` (`getTextContent`), rápido y
   exacto.
2. **PDF escaneado** (capa de texto pobre, `<60` caracteres
   alfanuméricos) → se renderiza cada página a canvas (`escala 2.2`) y se
   aplica **OCR con Tesseract.js** (`spa`).
3. **Imagen** (jpg/png/…) → OCR directo sobre el archivo.

Tesseract.js se carga **perezosamente** desde CDN solo cuando un informe
lo necesita; el worker se reutiliza entre informes y se libera al cerrar
el modal (`liberarOCR`). El extractor de mediciones es conservador
(rótulo + rango plausible + ancla `%`): aun con ruido de OCR prefiere
dejar un valor vacío antes que asignar uno equivocado, de modo que **cada
prueba conserva su dato correspondiente**. Si el informe no trae serie,
se acepta la serie tecleada en el paso 1 (decisión explícita del
operador). La subida a Storage usa el `contentType` real del archivo.

Las tres rutas viven en una función reutilizable
`leerTextoArchivo(file, setEstado) → {texto, ocr}`, compartida por la
carga (`extraerTexto`) y por el **reprocesado** en sitio.

**Reprocesar informes ya cargados.** Un informe subido antes de que
existiera el OCR queda con `pdf.estado: 'pendiente_extraccion'` y sin
mediciones. La tabla del historial muestra entonces un botón
**↻ Reprocesar** (solo en informes vivos no-base con `downloadURL`). El
shell descarga el archivo almacenado (`fetch(pdf.downloadURL)` →
`File` con su `contentType`), lo pasa por `leerTextoArchivo`, extrae las
mediciones y actualiza el informe **en sitio** con
`actualizarInforme(unidadId, informeId, parche)` — sin borrar ni volver
a subir. Si la lectura arroja datos, `pdf.estado` pasa a `'extraido'`;
si no, se mantiene `'pendiente_extraccion'`. `onSnapshot` refresca la
tabla sola.

### 3.4 Dashboard de KPIs (nuevo)

Pruebas por periodo · transformadores con alertas · antigüedad
promedio del parque · disponibilidad operativa · top unidades por nº de
intervenciones. Reusa `kpis-render.js` (Chart.js).

---

## 4. Endpoints REST (Cloud Functions)

Base: `https://<region>-<project>.cloudfunctions.net/api`
Auth: `Authorization: Bearer <Firebase ID token>`. Rol mínimo por
endpoint entre paréntesis.

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/transformadores?serie=&estado=&fabricante=` | lector | Lista/filtra fichas |
| GET | `/transformadores/:serie` | lector | Metadatos de una unidad |
| GET | `/transformadores/:serie/informes` | lector | Historial cronológico |
| GET | `/transformadores/:serie/informes/:id` | lector | Un informe |
| POST | `/transformadores/:serie/informes` | técnico | Alta de prueba (JSON o multipart) |
| PATCH | `/transformadores/:serie/informes/:id` | ingeniero | Edita mediciones/metadatos |
| DELETE | `/transformadores/:serie/informes/:id` | admin | Borra informe |
| POST | `/import` | ingeniero | Importación masiva CSV/JSON |
| GET | `/export?serie=&desde=&hasta=` | lector | ZIP (PDFs + CSV resumen) |

### 4.1 Ejemplo — alta de prueba (request)

`POST /transformadores/173523-15510/informes`

```json
{
  "ano": 2024,
  "fecha": "2024-08-23",
  "ejecutante": "Applus",
  "equipo": "DOBLE M4100",
  "tand": [
    { "code": "CH",  "valor_pct": 0.42 },
    { "code": "CHL", "valor_pct": 0.55 }
  ],
  "aislamiento": [
    { "devanado": "AT", "asociado": "Tierra", "gohm": 2.8 }
  ],
  "observaciones": "Unidad en servicio, carga 60%.",
  "etiquetas": ["rutina"]
}
```

### 4.2 Ejemplo — respuesta

```json
{
  "ok": true,
  "serie": "173523-15510",
  "informeId": "8f3aD2",
  "ano": 2024,
  "semaforo": {
    "global": "b-a",
    "detalle": {
      "tand": "normal",
      "aislamiento": "OK"
    },
    "alertas": [
      { "prueba": "tand", "code": "CHL", "valor": 0.55,
        "estado": "normal", "mensaje": "tan δ en banda 0.5–0.7%, vigilar." }
    ]
  },
  "creado_en": "2026-05-31T14:05:11Z"
}
```

### 4.3 Ejemplo — validación rechazada

```json
{
  "ok": false,
  "errores": [
    "Año del informe fuera de rango (1950–2100).",
    "tan δ CH no puede ser negativa."
  ]
}
```

> Las Functions reusan los **mismos sanitizadores/validadores puros**
> del frontend (`pruebas_electricas_schema.js`), así la regla de
> negocio es única para web y API.

---

## 5. Gestión documental y versionado

- **Multi-formato:** PDF, DOCX, CSV, imágenes (JPG/PNG/termografía).
  Cada uno es un objeto en Storage + entrada en `adjuntos[]`.
- **Versionado lógico:** subir un archivo con el mismo rol/nombre crea
  una entrada nueva con `version: n+1` y `version_de: <idAnterior>`; la
  anterior se conserva (no se sobrescribe el objeto). La ficha muestra
  la última y permite ver el árbol de versiones.
- **Extracción de metadatos básicos:** fecha y autor desde el PDF
  (`detectarAno` + parser de `/Author`), confirmados contra la serie.
- **Vista previa integrada:** PDF en `<iframe>#view=FitH` (patrón ya
  probado en `contrato-info.html`); imágenes en lightbox; descarga
  directa por `downloadURL`.
- **Control de cambios:** cada subida/edición/borrado escribe en
  `auditoria_pruebas`.

---

## 6. Seguridad y control de acceso

| Rol | Leer | Subir | Editar metadatos | Borrar | Exportar |
|---|---|---|---|---|---|
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ingeniero** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **técnico** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **lector** | ✅ | ❌ | ❌ | ❌ | ✅ |

- Mapea sobre `/usuarios/{uid}.rol`. Reglas Firestore + Storage validan
  por `isAdmin()` / `isTeamMember()` y rol específico.
- **Auditoría** de quién subió/descargó/editó/borró y cuándo
  (`auditoria_pruebas`).

---

## 7. Validación y alertas

- **Validación de formato al subir:** unidades numéricas, rangos,
  enums — `validarInforme` / `validarUnidad` (ya existen). La API
  rechaza con `{ok:false, errores:[…]}`.
- **Fuera de rango:** el semáforo congelado clasifica cada medición.
  Si `estadoGlobal ≥ ámbar`, el informe queda marcado (`tiene_alertas`)
  y se dispara notificación.
- **Notificaciones:** Cloud Function `onCreate` del informe → email
  (Resend, ya integrado) y/o Slack webhook al destinatario configurado
  en `alertas_config/global`. La ficha muestra el pill de alerta.

---

## 8. Backup, escalabilidad y rendimiento

- **Backup:** export programado de Firestore a un bucket GCS
  (`gcloud firestore export`, cron diario vía Function) + retención 90
  días. Storage tiene versioning de objeto a nivel bucket.
- **Organización de archivos:** `pruebas_electricas/{serie}/{año}/{archivo}`.
  Un "folder" lógico por serie y año (cumple "bucket por número de serie").
- **Escalabilidad:** Firestore escala horizontalmente; índices
  compuestos para los filtros; lecturas delta por `onSnapshot`. Para
  analítica masiva, extensión Firestore→BigQuery.
- **Rendimiento de consultas:** la biblioteca pagina por serie;
  la ficha solo suscribe los informes de la serie activa (ya se hace
  con el gating de selección); tope de resultados en buscador (§0.1.2.12).

---

## 9. Importación masiva de pruebas históricas

**Formatos soportados:** CSV y JSON (y XLSX vía SheetJS, como el
importador de inventario existente).

**Requisitos / mapeo de campos (CSV plano → informe):**

| Columna CSV | Campo destino | Regla |
|---|---|---|
| `serie` | `informes.serie` + docId de unidad | obligatorio; crea la unidad si no existe |
| `fecha` (dd/mm/aaaa) | `informes.fecha` + `ano` | normaliza a ISO; `ano` derivado |
| `ejecutante` | `informes.ejecutante` | texto |
| `equipo` | `informes.equipo` | texto |
| `prueba` | enrutador | `tand|excitacion|relacion|resistencia|aislamiento|collar|drm|dga|tierra|dp` |
| `seccion`/`fase`/`devanado` | sub-llave de la prueba | según tipo |
| `valor` | medición | numérico (coma→punto) |
| `unidad` | unidad de la medición | `%`, `mΩ`, `GΩ`, `mW`, `ppm`, `Ω`, `pC` |
| `observaciones` | `informes.observaciones` | opcional |

**Proceso:** (1) **SIMULAR** (dryRun) → reporte de filas válidas /
errores / discrepancias de semáforo; (2) **IMPORTAR** → batches de 450
writes idempotentes por `(serie, año, prueba)`; (3) registro del job en
`/importaciones_pruebas/{jobId}` con las primeras 30 discrepancias.
Reusa el patrón de `domain/importador.js` + `data/importar.js`.

**Ejemplo JSON de import masivo:**

```json
{
  "dryRun": true,
  "informes": [
    { "serie":"173523-15510","ano":2012,"fecha":"2012-08-23",
      "ejecutante":"Applus",
      "aislamiento":[{"devanado":"AT","asociado":"Tierra","gohm":3.1}] },
    { "serie":"190021-22011","ano":2019,"fecha":"2019-05-10",
      "tand":[{"code":"CH","valor_pct":0.61}] }
  ]
}
```

---

## 10. Funcionalidades adicionales

- **Exportar ZIP** por transformador o rango de fechas: PDFs + un
  `resumen.csv` con todas las mediciones tabuladas (Function `/export`).
- **Dashboard de KPIs** (§3.4).
- **Etiquetado y notas internas** por prueba (`informes.etiquetas[]`,
  `observaciones`).

---

## 11. Recomendaciones de implementación (tech stack)

| Capa | Recomendado | Motivo |
|---|---|---|
| Base de datos | **Cloud Firestore** | ya en uso; consulta por serie nativa, tiempo real, tier gratuito |
| Archivos | **Firebase Storage** | objetos por serie/año; reglas por rol |
| API | **Cloud Functions** (Node 20 + Express) | mismo proyecto; reusa dominios puros |
| Frontend | **estático actual** (ES modules + aqua-shell) | sin build; ya desplegado en Pages |
| Auth | **Firebase Auth** + `/usuarios` | roles ya definidos |
| Email | **Resend** | ya integrado |
| Slack | **Incoming Webhook** | trivial desde Function |
| PDF preview | `<iframe>` nativo / pdf.js | sin dependencias pesadas |
| Import XLSX | **SheetJS** (CDN) | patrón ya usado |
| Backup | **GCS export** programado | nativo de Firestore |
| Analítica futura | **BigQuery** (extensión) | si se requiere SQL pesado |

---

## 12. Roadmap por microfases (commit aislado c/u)

| # | Microfase | Entregable | Toca |
|---|---|---|---|
| P1 | Metadatos v3 | campos operativos (modelo, fechas, estado, notas) + tab "Metadatos" editable | schema, data, UI |
| P2 | Filtros avanzados | barra de filtros sobre la biblioteca + query string | UI |
| P3 | Adjuntos multi-formato + drag-drop | `adjuntos[]` versionado, DOCX/CSV/img, zona de arrastre | schema, data, UI, Storage rules |
| P4 | Tabs Documentos + Fotos | galería + visor + versiones | UI |
| P5 | Tipos de prueba extra | DGA aceite, puesta a tierra, descargas parciales | domain (semáforo), schema, UI |
| P6 | API REST | Cloud Functions con los endpoints §4 | functions |
| P7 | Import masivo | CSV/JSON/XLSX con dryRun + mapeo §9 | domain, data, UI |
| P8 | Alertas push | email/Slack onCreate fuera de rango | functions |
| P9 | Export ZIP + Dashboard KPIs | Function `/export` + panel KPIs | functions, UI |
| P10 | Backup programado | export Firestore→GCS + retención | functions |

> Cada microfase preserva lo verde (864/864 tests + lint) y mantiene
> intacto lo que hoy se aprecia (selector de serie, tablero por unidad,
> gráficas de tendencia, informes base de `173523-15510`).
