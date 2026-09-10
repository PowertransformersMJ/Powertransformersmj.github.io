# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Lo EJECUTADO vive en `99` (vía `00`); los crudos de deliberación, en la bóveda `archiveDir`.

---

## 🎯 Foco (2026-09-10) — CARGABILIDAD: EL DATO 2025 EN PRODUCCIÓN

> **`99 §74.23-74.24`.** El tablero mostraba **1 equipo en sobrecarga**; la realidad medida son **30**
> (58 devanados · 235,8 MVA · 205.413 usuarios). Dos causas, las dos cerradas:
> **(1)** `devanado()` recibía el `crg_pct_medido` del EQUIPO y lo pintaba en sus tres devanados —de
> ahí los «96 % junto a — A» y los 74 falsos «desacuerdos» que mandaban a revisar una captura que
> estaba bien—; **(2)** producción tenía el dato viejo. Importados **205 de 208** equipos desde
> `Cargabilidad_TX_completado_v2.xlsx` (hoja `Cargabilidad_2025`) con auditoría de lote.
> La tabla ganó `MVA`, `P · S · T` y `Usuarios`, todo ordenable. Lecciones: **L-84**, **L-85**.
> ⚠️ Abiertos: **TODO-55** (🔴) · **TODO-54** · **TODO-56** · **TODO-57** · **TODO-52** (🔴) ·
> **TODO-47** (🔴) · **TODO-37** (🔴) · 29/33/41. **TODO-53 y TODO-34 cerrados.**

### ✅ CERRADOS en esta tanda (detalle en `99`, no repetir aquí)
> **Fichas Técnicas** `§74.16-74.22`: «Ficha» es una elección de documento · el de Mantenimiento
> Especializado se emite (7 hojas, alcance = plantilla + acciones escogidas, 15 textos por condición)
> · la inversión queda en el PI · escala 1→5 con definición de cada banda. Lecciones L-82, L-83.
> **Cargabilidad** `§74.22-74.24`: filtro de zona múltiple (chips) · cargabilidad por devanado ·
> tabla con potencia y usuarios.

### 🔴 Solo puede hacerlo el Ingeniero (nadie más tiene la llave)
> **(A)** ~~Pulsar IMPORTAR~~ ✅ hecho 09-08. **(B)** GitHub Support "remove sensitive data" + revocar los PAT
> viejos (**TODO-08**). **(C)** Entregar el capítulo PRUEBAS ELÉCTRICAS del MO (**TODO-04**).
> **(D)** Tres decisiones de ADR-063: tope en `/alertas_reconocidas`, `defer` en Chart.js, barras de
> progreso. **(E)** Proteger `main` en la configuración de GitHub. **(F)** Las tres de **TODO-42**.
> **(H)** Decir qué se hace con los **3 equipos que su hoja de cargabilidad no trae**: `T1-M/M-CAZ`
> (Casa de Zinc), `T2-M/M-BEC` (Becerril) y `T2-M/M-SML` (San Martín de Loba) — sin medida 2025.
> **(G)** Ver en la consola de Firebase **quién figura hoy en `/admins`** — la colección es
> `allow write: if false`, así que ni la app ni yo podemos leerla ni tocarla, y de esa lista
> depende decidir el hueco 🔴 de **TODO-47a**.

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
> casilla `NN.8` de su ADR (`99 §66.8`, `§68.8`, **`§73.8`**) y en el crudo de la bóveda. Consúltalo
> ANTES de volver a auditar Fichas, el escapado de HTML, la doctrina CSS o **las reglas de Storage**
> (ahí están los 23 hallazgos refutados: el `delete` que solo pide sesión, el comodín `if false`, las
> URLs con token, `(default)`, el tope y las subidas resumables — todos mecanismo cierto, consecuencia
> falsa).

---

## 📋 Pendientes (TODO-NN) — lo ejecutado → `99` vía `00`

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **TODO-55** | 🔴 **Nueve transformadores de 628 MVA con 1 o 0 usuarios registrados** — Bosque T4 (150), Candelaria T-KDR05 (150) y T-KDR04 (100), Chinú Planta T3 (60) y T1 (20), Coveñas T1 y T3 (60 c/u), Nueva Cospique T3 (20), Guatapurí T3 (7,9 con 0). No es campo vacío (Bayunca tiene 31.628): el «1» parece marcador de *no aplica* en unidades de transmisión. **La criticidad de la matriz MO.00418 se calcula POR USUARIOS**, así que los nueve equipos más grandes del parque caen en criticidad mínima. Decisión suya: contar usuarios aguas abajo de forma transitiva, o marcarlos «transmisión — no aplica» con criterio propio. `99 §74.24`. | 🔴 |
| **TODO-54** | **Tres erratas ×10 en la ampacidad**, PREEXISTENTES (no las trajo el import 2025): `T2-M/M-GUP`, `T1-M/M-LOR`, `T1-M/M-STR`. Ampacidad y carga escaladas JUNTAS ⇒ el **porcentaje es correcto**, solo fallan los amperios absolutos. Falta su OK para dividir entre 10. `99 §74.23`. | 🟡 |
| **TODO-56** | **¿Se recalcula `calif_crg`?** Se calculó con los amperios VIEJOS y no se tocó al importar. Con 30 equipos >100 % debería subir en varios — y con ella la condición, que es la del Excel por decisión suya (`99 §74.15`). Exige comparación antes/después. | 🟡 |
| **TODO-57** | **Versionar los assets contra la caché.** Cada despliegue le sirve una MEZCLA de viejo y nuevo (HTML nuevo + módulos ES viejos = tabla descuadrada); hoy se arregla a mano desde la extensión. `99 §74.24`, **L-85**. | 🟡 |
| **TODO-52** | 🔴 **¿Quién manda cuando el Excel y el motor discrepan?** El sistema recalcula la condición con el MO.00418 y **no copia** la columna CONDICION del Excel: discrepan en **98 de 208**. El Excel marca **9 «muy pobre»** y el motor solo **1** (los otros 8 caen a pobre/medio; 5 de ellos en HI 4,000 exacto, que es el piso del override de cargabilidad, no un tope). La causa es la ponderación: **DGA pesa 35 %**. Si los 5 del Excel recogen un juicio experto que las variables medidas no capturan, se está perdiendo esa señal. Raíz de L-73, ahora cuantificada. `99 §74.14`. | 🔴 |
| **TODO-47** | 🔴 **Tres huecos de las reglas, fijados con prueba y esperando decisión** — detalle y opciones en `99 §73.9`. **(a) EL GRAVE**: degradar a alguien de administrador a técnico NO le quita nada si su uid sigue en `/admins`, y el defecto está también en `firestore.rules` (todo el backend). Ver quién está en esa lista solo puedes tú, en la consola. **(b)** el «solo PNG» mira la etiqueta, no los bytes. **(c)** cualquier miembro obtiene el inventario del almacén con `listAll`. | 🔴 |
| **TODO-37** | 🔴 **`functions/domain/` vive SOLO en este disco**: 61 archivos gitignorados, **0 versionados**, **5 divergen** de `assets/js/domain/` → un re-clono pierde el dominio de las Cloud Functions desplegadas. Decidir espejo vs versionar vs veto. Detalle → `99 §68`. | 🔴 |
| **TODO-29** | 🔴 **Bóveda sin remoto** (decisión suya, ADR-059): UN disco con material real de cliente. Los 127 MB de fotos ya quedaron versionados (08-21): dentro del disco no falta nada; falta una copia FUERA → `lastOffsiteBackup`. | 🟡 decidido |
| **TODO-12** | Ola 3: falta CSP en 95 HTML · **G111**: todo el sitio usa SheetJS 0.18.5 (con CVE) desde 2 CDN — decisión suya: migrar a cdn.sheetjs.com ≥0.20.2 o aceptarlo. `99 §52.12`. | 🟡 |
| **TODO-35** | **Cola completa de Fichas Técnicas** (ADR-066): lo priorizado en `99 §66.7` —vendorizar SheetJS ≥0.20.2 (CVE, cierra G111) · partir `panel.js` + `normalizarEquipo` al dominio · identidad de 2 TX en la misma subestación · aviso de trabajo sin guardar— **más lo que se había evaporado** y rescató la auditoría (`99 §68.7`): huecos literales de la norma sin nota · `montoCOP` (signo y centavos) · criterio 5 MVA→N4T1 sin escribir · carrera de 12 s que borra EDITS/DEC · paleta duplicada · código muerto · test con fecha no fijada. | 🟡 |
| **TODO-08** | 🔐 Ingeniero revoca PAT clásicos viejos de GitHub (uno de mayo 2026). | 🔲 |

> **Los pendientes FRÍOS** (decisiones de arquitectura, validaciones diferidas, colas viejas) viven
> en la hija [`11-PENDIENTES-FRIOS.md`](11-PENDIENTES-FRIOS.md): no cambian de semana en semana y no
> tienen por qué pesar en el arranque de cada sesión. Aquí solo lo que está VIVO.
