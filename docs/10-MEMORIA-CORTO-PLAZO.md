# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Lo EJECUTADO vive en `99` (vía `00`); los crudos de deliberación, en la bóveda `archiveDir`.

---

## 🎯 Foco (2026-09-01) — LAS REGLAS YA NO SE CREEN BAJO PALABRA (ADR-073)

> **ADR-073**: `firebase deploy` solo COMPILA — las reglas de `firmas/{uid}` llevaban 24 h dadas por
> buenas sin una prueba. Ahora hay 43, con los dos emuladores y también en CI. La auditoría
> adversarial que siguió dejó 3 hallazgos vivos de 26. Antes: **ADR-071** (firmas a la cuenta de cada
> quien), **ADR-070** (port de Órdenes de Materiales), **ADR-069** (TX_Potencia da 208 válidos).
> ⚠️ Abiertos: **TODO-53** (siguiente) · **TODO-52** (🔴) · **TODO-47** (🔴) · **TODO-37** (🔴) · 29/33/41.
> ✅ **TODO-44 cerrado (ADR-071)**: la firma del Ingeniero salió de la web (404 en producción) y pasó
> a su cuenta; cada quien sube la suya en «Mi firma» y solo se estampa en SU línea. Antes, TODO-43.
> ✅ **TODO-46 cerrado (ADR-073)**: `storage.rules` pasa de 0 a **43 pruebas** y `test:rules` levanta
> los dos emuladores (Storage pregunta en Firestore quién es el usuario). Verificado también en CI.
> La auditoría adversarial que vino detrás (26 hallazgos, 23 refutados) dejó **3 confirmados** →
> **TODO-47**, con el grave esperando tu decisión.
> ✅ **ADR-074 (09-08)**: las 39 discrepancias de UUCC eran 6. La terciaria vivía en una ruta que
> nadie miraba (30 falsas), el catálogo tiene 3 familias y el clasificador sabía 2 (3
> autotransformadores acusados en falso), y cada importación borraba la UUCC en silencio — los tres
> arreglados. **39 discrepancias → 0**: 7 documentos corregidos en producción con auditoría, y las
> 3 sin banda en la norma (NLTC > 6 MVA en nivel 3) asignadas por capacidad a `N3T3` por decisión
> suya, con la excepción escrita en cada registro. **TODO-49 y TODO-50 cerrados.**

### ✅ CERRADO: el import de Salud de Activos (2026-09-08, `99 §74.11`)
> El parque tiene salud por primera vez: **208 equipos, 208 con condición** (39·86·54·28·1).
> No funcionaba por una línea: las 4 subidas de Excel del sitio pasaban un `ArrayBuffer` donde
> SheetJS espera `Uint8Array` — parseaba mal **en silencio**. No era el archivo del Ingeniero.

### 🔴 Solo puede hacerlo el Ingeniero (nadie más tiene la llave)
> **(A)** ~~Pulsar IMPORTAR~~ ✅ hecho 09-08. **(B)** GitHub Support "remove sensitive data" + revocar los PAT
> viejos (**TODO-08**). **(C)** Entregar el capítulo PRUEBAS ELÉCTRICAS del MO (**TODO-04**).
> **(D)** Tres decisiones de ADR-063: tope en `/alertas_reconocidas`, `defer` en Chart.js, barras de
> progreso. **(E)** Proteger `main` en la configuración de GitHub. **(F)** Las tres de **TODO-42**.
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
| **TODO-53** | 🟢 **Construir el documento «Mantenimiento Especializado · Salud de Activos»**, el segundo que se emite desde un equipo. Hoy el selector ya lo ofrece y declara que está en construcción (`99 §74.16`). A diferencia del PI —que propone INVERSIÓN, reponer el activo— este programará MANTENIMIENTO sobre el equipo en servicio a partir de su condición. Falta definirlo con el Ingeniero: qué hojas, qué datos y si tiene formato oficial. | 🟢 |
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
