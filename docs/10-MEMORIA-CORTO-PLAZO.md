# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Lo EJECUTADO vive en `99` (vía `00`); los crudos de deliberación, en la bóveda `archiveDir`.

---

## 🎯 Foco (2026-09-16) — ÓRDENES DE MATERIALES · registro del equipo

> Qué pasó → `05` y `99 §77-§78` (**no se repite aquí**, §G.3). Lecciones **L-91**, **L-93**.
> ⚠️ **Abiertos**: **TODO-62/63** (cierre en vivo) · **TODO-35/58** · **TODO-60** 🔴 ·
> **TODO-55** 🔴 · **TODO-47** · 54 · 56 · 57 · 61 · y los fríos de la hija `11`.

### ✅ CERRADOS → `99` (`§74.16-74.24`, `§75`) · lecciones L-82..L-86

### 🔴 Solo puede hacerlo el Ingeniero (nadie más tiene la llave)
> **(B)** GitHub Support "remove sensitive data" + revocar los PAT viejos (**TODO-08**). **(C)** Entregar el capítulo PRUEBAS ELÉCTRICAS del MO (**TODO-04**).
> **(D)** Tres decisiones de ADR-063: tope en `/alertas_reconocidas`, `defer` en Chart.js, barras de
> progreso. **(E)** Proteger `main` en la configuración de GitHub. **(F)** Las tres de **TODO-42**.
> **(H)** Decir qué se hace con los **3 equipos que su hoja de cargabilidad no trae**: `T1-M/M-CAZ`
> (Casa de Zinc), `T2-M/M-BEC` (Becerril) y `T2-M/M-SML` (San Martín de Loba) — sin medida 2025.

### 🚫 Callejones probados (NO reintentar)
> **Los de la Fase 9 viven en `99 §52.8-52.9`** — `main` local stale tras filter-repo · el "código
> muerto FUSIÓN" de `excitacion-panel.js` (FALSO) · G024 XSS (FALSO salvo `bump.js`, ya corregida) ·
> `getDocs→tx.get` INVIABLE en el SDK Web · `git-filter-repo --branch` (**L-25**).
> **Vivos aquí**: reimplementar un panel "parecido a X" en vez de reusar el que produce X (**L-57**) ·
> un estado consolidado para todos los chips normativos (**L-58**) · reintroducir "Reprocesar"
> (`99 §20`) · meter DGA/aceite o fabricar el dato que falta (`99 §27`, **L-50/L-69**) · pasar un
> array a `args` de Workflow como string JSON (**L-71**) · dar por basura un contador de "omitidos"
> sin abrir el archivo (**L-72**) · reabrir CONECTAR D (`99 §52.14`).
> **Ya verificado SANO — no re-auditar sin motivo**: lo que las auditorías DESPEJARON vive en la
> casilla `NN.8` de su ADR (`§66.8`, `§68.8`, `§73.8`, **`§75.8`**) y en el crudo de la bóveda.
> Consúltalo ANTES de volver a auditar Fichas, el escapado de HTML, la doctrina CSS o las reglas de
> Storage (ahí están los 23 refutados: mecanismo cierto, consecuencia falsa).

---

## 📋 Pendientes (TODO-NN) — lo ejecutado → `99` vía `00`

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **TODO-62** | **Registro OE/OS**: ✅ orden de PRUEBA en producción (crear/editar/conflicto/eliminar/lápida/bitácora, `99 §77.5`). Falta: sesión de TÉCNICO en vivo; Gemini; ¿consecutivo por ZONA? | 🟡 |
| **TODO-63** | **Cédulas**: ✅ las 9 cargadas (20-09, «formato de autorización firmado»; `99 §78.5`). Falta su decisión: ¿rastro de quién lee cada cédula (Function) o basta como está? + respuesta de Gemini. Cédula nueva → `guardia-cedulas.mjs --registrar`. | 🟡 |
| **TODO-35/58** | **Cola de Fichas Técnicas — 31 hallazgos confirmados (`99 §75`) + lo priorizado en `§66.7` y rescatado en `§68.7`.** Los dos graves: **(a)** dos TX de la misma subestación comparten **el documento entero** (la clave sale de «CODIGO SUBESTACION»); **(b)** la carga tardía pisa lo adjuntado sin preguntar (`fijarDatos(…,{forzar:true})` salta el permiso). Luego: notas del clasificador CREG que no llegan al papel · dos vigencias de pesos sumadas (2007+2017) · el aviso de «sin guardar» no cubre la ficha · el unifilar puede pintarse sobre otro equipo · vendorizar SheetJS ≥0.20.2 (cierra G111) · partir `panel.js` y bajar `normalizarEquipo` al dominio · 11,4 KB de CSS sin emisor · el 61 % de `panel.js` sin prueba posible · `montoCOP` ✅ y las 5 verdades del documento ✅ (`§75`). ✅ **los dos catálogos, unificados** (`§75.10`, L-87). Siguiente paso posible, a su criterio: que lo marcado por defecto se derive del **hallazgo** (`modoDegradacion` ya existe) en vez de la banda — hoy C3 y C5 arrancan con el texto de reserva. | 🟡 |
| **TODO-61** | **«Sistema de refrigeración deficiente» no tiene señal** — es una de las 5 condiciones que el Ingeniero definió (`99 §75.13`), pero el registro guarda el TIPO de refrigeración y las cantidades (ONAN/ONAF, radiadores, ventiladores, bombas), no su ESTADO. No se colgó del modo `termico` a propósito: eso es falla térmica INTERNA por etileno, otra cosa. Falta decidir de qué dato saldría: ¿una calificación propia en Salud de Activos, la termografía, o el delta de temperatura contra la carga? | 🟡 |
| **TODO-60** | 🔴 **El Plan de Inversión ignora la criticidad**: `criticidad.nivel` no lo escribe ningún módulo de producción ⇒ `plan_inversion.js:50-51` deja `critN = 0` en los 208 y **el 25 % del ranking vale cero**. Arreglar TODO-55 no moverá el ranking hasta cerrar esto. | 🔴 |
| **TODO-55** | 🔴 **La criticidad por usuarios no distingue casi nada** — cifras rehechas sobre el corte que calza con `05` (208 TX / 3.838,5 MVA): **14 equipos ≥20 MVA con ≤10 usuarios = 870 MVA (22,7 %)** + 3 con celda vacía (`M-BEC`, `M-GUP`, `M-SML`). El defecto de fondo: la banda «mínima» va **de 1 a 9.662 usuarios** y se traga **144 equipos (69 % del parque)**. Daño PRESENTE: la ficha firma «alcanza 1 usuarios» para 150 MVA. Latente: matriz y ranking. Opciones: (A) pedir el dato · (C) excepción «transmisión» solo a `T-KDR04/05` · **(F) revisar los cortes de la Tabla 9**. La regla iría en **3 sitios**. `99 §74.24`. | 🔴 |
| **TODO-54** | **Erratas ×10 en la ampacidad** (`T2-M/M-GUP`, `T1-M/M-STR`; `T1-M/M-LOR` ya viene corregida en la hoja 2025 y su primario va al **102,5 %**). ⚠️ La receta vieja rompía los datos: en GUP y STR la **carga también** está escalada ⇒ hay que dividir el **PAR**, no la ampacidad sola. **Antes de tocar**: leer producción — el ADR y su propia aritmética se contradicen y el script del lote no quedó versionado. `99 §74.23`. | 🟡 |
| **TODO-56** | **¿Se recalcula `calif_crg`?** ⚠️ Baja de urgencia: **no subiría el índice de salud de nadie** (la condición es la del Excel; el override CRG=5 solo mueve `hi_recalculado`, que nadie lee). Sí mueve el causante principal y la macroactividad. El cruce: **119 cambios sobre 193 — 84 suben, 35 BAJAN, 8 pierden el CRG=5**. Exige antes/después guardado. | 🟡 |
| **TODO-57** | **Versionar los assets contra la caché.** Cada despliegue le sirve una MEZCLA de viejo y nuevo (HTML nuevo + módulos ES viejos = tabla descuadrada); hoy se arregla a mano desde la extensión. `99 §74.24`, **L-85**. | 🟡 |
| **TODO-47** | 🟡 **Quedan dos huecos de `99 §73.9`, decisión suya**: **(b)** el «solo PNG» mira la etiqueta que declara el cliente, no los bytes; **(c)** cualquier miembro obtiene el inventario del almacén con `listAll`. ✅ **(a) CERRADO** (`99 §79`): degradar a técnico ya revoca. | 🟡 |

> **Los pendientes FRÍOS** (decisiones de arquitectura, validaciones diferidas, colas viejas) viven
> en la hija [`11-PENDIENTES-FRIOS.md`](11-PENDIENTES-FRIOS.md): no cambian de semana en semana y no
> tienen por qué pesar en el arranque de cada sesión. Aquí solo lo que está VIVO.
