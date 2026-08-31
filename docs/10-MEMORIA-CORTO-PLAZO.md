# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Lo EJECUTADO vive en `99` (vía `00`); los crudos de deliberación, en la bóveda `archiveDir`.

---

## 🎯 Foco (2026-08-30) — ÓRDENES DE MATERIALES YA ESTÁ EN PRODUCCIÓN (ADR-070)

> **ADR-070**: el módulo de órdenes de materiales SSEE es una página más del sitio, **sin las 3 firmas
> escaneadas ni las 8 cédulas** (el guard esconde la página, no el archivo). Verificado vivo en la URL
> pública. Antes: **ADR-069** (TX_Potencia da 208 válidos con salud y usuarios) y **ADR-068**
> (auditoría Nivel-2: 18 hallazgos y una neurona hija nueva).
> ⚠️ Abiertos: **TODO-44** (🔴 su firma YA publicada en otro módulo) · TODO-37 (🔴) · TODO-42 · 36/38/39/40/45.
> ✅ Cerrado de paso: **TODO-43** — el arranque reventó y se partió la cola fría a la hija `11`.

### ▶️ TAREA VIVA: el import de Salud de Activos — PASO DEL INGENIERO
> Archivo: `~/Documents/2026/PSM 2026/Salud de Activos 2026 Actualizado 01 de junio.xlsx` (ojo: se
> llama «01 de junio» pero se modificó el **2026-08-17**). Verificado abriéndolo (ADR-069): la hoja
> **TX_Potencia da 208 equipos válidos de 213 filas, 0 errores**, todos con Índice de Salud y 205 con
> usuarios (1.655.376). Falta pulsar **IMPORTAR EN FIRESTORE** en `admin/importar.html` — el
> clasificador me bloquea esa escritura. Repetirlo es seguro (busca por matrícula y fusiona).
> Cierra **TODO-34**. 📌 Pidió **resumen de pendientes en CADA turno**.

### 🔴 Solo puede hacerlo el Ingeniero (nadie más tiene la llave)
> **(A)** Pulsar IMPORTAR (arriba). **(B)** GitHub Support "remove sensitive data" + revocar los PAT
> viejos (**TODO-08**). **(C)** Entregar el capítulo PRUEBAS ELÉCTRICAS del MO (**TODO-04**).
> **(D)** Tres decisiones de ADR-063: tope en `/alertas_reconocidas`, `defer` en Chart.js, barras de
> progreso. **(E)** Proteger `main` en la configuración de GitHub. **(F)** Las tres de **TODO-42**.

### 🚫 Callejones probados (NO reintentar — cada uno con su ancla)
> De `99 §52.8-52.9`: `main` local queda stale tras un filter-repo (usar `origin/main`) · el "código
> muerto FUSIÓN" de `excitacion-panel.js` es **FALSO** · G024 "XSS en dashboards" casi todo FALSO salvo
> `bump.js`, ya corregida · `getDocs→tx.get` para movimientos atómicos es INVIABLE en el SDK Web ·
> `git-filter-repo --branch`
> reescribe SOLO esa rama, rm+gc antes (**L-25**) · reimplementar un panel "parecido a X" en vez de
> reusar el que produce X (**L-57**) · un estado consolidado para todos los chips normativos
> (**L-58**) · reintroducir "Reprocesar" (`99 §20`) · meter DGA/aceite o fabricar el dato que falta
> (`99 §27`, **L-50/L-69**) · pasar un array a `args` de Workflow como string JSON (**L-71**) · dar
> por basura un contador de "omitidos" sin abrir el archivo (**L-72**) · reabrir CONECTAR D (roles v2):
> decidido NO activar hasta que el negocio pida multi-rol real (`99 §52.14`).
> **Ya verificado SANO — no re-auditar sin motivo**: lo que las auditorías DESPEJARON vive en la
> casilla `NN.8` de su ADR (`99 §66.8`, `§68.8`) y en el crudo de la bóveda. Consúltalo ANTES de
> volver a auditar Fichas, el escapado de HTML o la doctrina CSS.

---

## 📋 Pendientes (TODO-NN) — lo ejecutado → `99` vía `00`

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **TODO-34** | 🔴 **El parque real NO tiene Índice de Salud**: `salud_actual` todo en `null` y sin usuarios → banda «Sin dato 206», matriz vacía, 0 en riesgo (degrada limpio, no inventa). **El dato ya existe y está verificado** (ADR-069): el import trae 208 con salud (muy bueno 39 · bueno 86 · medio 54 · pobre 28 · muy pobre 1) y 1.655.376 usuarios. Solo falta pulsarlo. | 🔴 |
| **TODO-44** | 🔴 **La firma escaneada del Ingeniero YA está publicada** en `assets/img/afinia/firma-miguel-jimenez.png` (PNG con transparencia, listo para recortar y pegar); la usa `calculo-refrigeracion.js:4579` y se descarga sin sesión. El argumento con el que ADR-070 retiró 3 firmas se le aplica igual. Decidir: a Storage tras sesión, o línea en blanco. `99 §70`. | 🔴 |
| **TODO-45** | `robots.txt` está al revés para este caso: `Disallow: /pages/` + `Allow: /assets/` ⇒ la página (sin datos) está bloqueada y el `.js` (con los 8 nombres) es rastreable; el `<meta robots>` no cubre a un `.js`. Valorar `Disallow: /assets/js/` o mover la lista de responsables a Firestore. `99 §70`. | 🟡 |
| **TODO-37** | 🔴 **`functions/domain/` vive SOLO en este disco**: 61 archivos gitignorados, **0 versionados**, **5 divergen** de `assets/js/domain/` → un re-clono pierde el dominio de las Cloud Functions desplegadas. Decidir espejo vs versionar vs veto. Detalle → `99 §68`. | 🔴 |
| **TODO-29** | 🔴 **Bóveda sin remoto** (decisión suya, ADR-059): UN disco con material real de cliente. Los 127 MB de fotos ya quedaron versionados (08-21): dentro del disco no falta nada; falta una copia FUERA → `lastOffsiteBackup`. | 🟡 decidido |
| **TODO-36** | Decisiones de ADR-067 (`99 §67.7`): 9 fixtures con datos REALES del TX 450108 en el repo PÚBLICO · SAIDI/SAIFI públicos · sembrarlos en Firestore · 2 páginas de desarrollo desplegadas · indicadores congelados en mayo. | 🟡 decisión |
| **TODO-42** | 🟡 **Tres decisiones del import, esperando al Ingeniero** (detalle → `99 §69.7`): **(a)** acotar el import a `TX_Potencia` y rotular las hojas excluidas — *propuesto, falta su visto bueno*; **(b)** los **57 equipos reales** de `TPT_Servicio` y `TX_Respaldo` que caen por la cabecera en fila 2 (**L-72**): incorporarlos o excluirlos por escrito; **(c)** las discrepancias `CONDICION` vs Índice de Salud (46% de acuerdo), empezando por **ASTREA** (250%, dato sospechoso — **L-73**) y las tres jóvenes sobrecargadas. | 🟡 |
| **TODO-39** | Sitio · cola de ADR-067: badge «TENDENCIA CRÍTICA» **cableado** en Indicadores de Calidad (viola L-69) · KPIs que solo muestran guiones sin decir por qué · `transformador_2048px-2.png` (334 KB, cero usos). | 🟡 |
| **TODO-40** | Gates del cerebro (`99 §68`): el `pre-commit` sale en verde si el commit no toca `docs/` ⇒ **cero escaneo de secretos/PII** · `verificado-vivo` valida la fecha, no la verificación · gate #6 por substring · gate 5c sin uso posible. | 🟡 |
| **TODO-12** | Ola 3: falta CSP en 95 HTML · **G111**: todo el sitio usa SheetJS 0.18.5 (con CVE) desde 2 CDN — decisión suya: migrar a cdn.sheetjs.com ≥0.20.2 o aceptarlo. `99 §52.12`. | 🟡 |
| **TODO-35** | **Cola completa de Fichas Técnicas** (ADR-066): lo priorizado en `99 §66.7` —vendorizar SheetJS ≥0.20.2 (CVE, cierra G111) · partir `panel.js` + `normalizarEquipo` al dominio · identidad de 2 TX en la misma subestación · aviso de trabajo sin guardar— **más lo que se había evaporado** y rescató la auditoría (`99 §68.7`): huecos literales de la norma sin nota · `montoCOP` (signo y centavos) · criterio 5 MVA→N4T1 sin escribir · carrera de 12 s que borra EDITS/DEC · paleta duplicada · código muerto · test con fecha no fijada. | 🟡 |
| **TODO-08** | 🔐 Ingeniero revoca PAT clásicos viejos de GitHub (uno de mayo 2026). | 🔲 |

> **Los pendientes FRÍOS** (decisiones de arquitectura, validaciones diferidas, colas viejas) viven
> en la hija [`11-PENDIENTES-FRIOS.md`](11-PENDIENTES-FRIOS.md): no cambian de semana en semana y no
> tienen por qué pesar en el arranque de cada sesión. Aquí solo lo que está VIVO.

---

## 📝 Bitácora (efímera)

> **Julio consolidado — no re-leer aquí**: Fase 9 + CONECTAR A-E, ADR-053→058 y el ToS del hosting
> (`99 §60`: Pages no nos prohíbe nada → no se migra). ⚠️ Decisión viva heredada de ahí: **Vercel Hobby SÍ veta el uso comercial** y hoy
> no lo consume nadie → retirarlo o dejarlo a sabiendas. NO re-analizar por calendario: solo por los
> disparadores de `60 §60.7`.
