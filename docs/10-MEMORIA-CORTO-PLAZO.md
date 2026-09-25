# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Lo EJECUTADO vive en `99` (vía `00`); los crudos de deliberación, en la bóveda `archiveDir`.

---

## 🎯 Foco (2026-09-20) — FICHAS TÉCNICAS, por partes (orden del Ingeniero)

> Qué pasó → `05` y `99 §77-§81` (**no se repite aquí**, §G.3). Lecciones **L-91**, **L-93**, **L-96**.
> ⚠️ **Abiertos**: **TODO-64** 🔴 · **TODO-65** · **TODO-62/63** (cierre en vivo) · **TODO-35/58** · **TODO-60** 🔴 ·
> **TODO-55** 🔴 · **TODO-47** · 54 · 56 · 57 · 61 · y los fríos de la hija `11`.

### ✅ CERRADOS → `99` (`§74.16-74.24`, `§75`) · lecciones L-82..L-86

### 🔴 Solo puede hacerlo el Ingeniero (nadie más tiene la llave)
> **(B)** GitHub Support "remove sensitive data" + revocar los PAT viejos (**TODO-08**). **(C)** Entregar el capítulo PRUEBAS ELÉCTRICAS del MO (**TODO-04**).
> **(D)** Tres decisiones de ADR-063: tope en `/alertas_reconocidas`, `defer` en Chart.js, barras de
> progreso. **(E)** Proteger `main` en la configuración de GitHub. **(F)** Las tres de **TODO-42**.
> **(G)** **Los 9 fixtures con datos REALES del TX 450108 siguen en el repo PÚBLICO** (`TODO-36`, señalado hace 33 días): anonimizarlos conservando la forma del dato, o purgarlos del historial como el 2026-07-21.
> **(H)** Decir qué se hace con los **3 equipos que su hoja de cargabilidad no trae**: `T1-M/M-CAZ`
> (Casa de Zinc), `T2-M/M-BEC` (Becerril) y `T2-M/M-SML` (San Martín de Loba) — sin medida 2025.

### 🚫 Callejones probados (NO reintentar)
> **Los de la Fase 9 viven en `99 §52.8-52.9`** — `main` local stale tras filter-repo · el "código
> muerto FUSIÓN" de `excitacion-panel.js` (FALSO) · G024 XSS (FALSO salvo `bump.js`, ya corregida) ·
> `getDocs→tx.get` INVIABLE en el SDK Web · `git-filter-repo --branch` (**L-25**).
> **Vivos aquí**: anteponer una redacción nueva al arreglo de opciones —el borrador guarda la versión
> por su ÍNDICE y correrían las fichas ya guardadas (`99 §85.3`)— · usar `codigo` como respaldo de la
> matrícula: por el listado es el CODIGO SUBESTACION y nombraría al equipo equivocado (`§85.3`, `§82`) ·
> reimplementar un panel "parecido a X" en vez de reusar el que produce X (**L-57**) ·
> un estado consolidado para todos los chips normativos (**L-58**) · reintroducir "Reprocesar"
> (`99 §20`) · meter DGA/aceite o fabricar el dato que falta (`99 §27`, **L-50/L-69**) · pasar un
> array a `args` de Workflow como string JSON (**L-71**) · dar por basura un contador de "omitidos"
> sin abrir el archivo (**L-72**) · reabrir CONECTAR D (`99 §52.14`) · apóstrofo «contra fórmulas» en un
> `.xlsx` (se imprime, **L-100**) · redondear centavos del PE.02081 (`§87`).
> **Ya verificado SANO — no re-auditar sin motivo**: lo que las auditorías DESPEJARON vive en la
> casilla `NN.8` de su ADR (`§66.8`, `§68.8`, `§73.8`, **`§75.8`**) y en el crudo de la bóveda.
> Consúltalo ANTES de volver a auditar Fichas, el escapado de HTML, la doctrina CSS o las reglas de
> Storage (ahí están los 23 refutados: mecanismo cierto, consecuencia falsa).

---

## 📋 Pendientes (TODO-NN) — lo ejecutado → `99` vía `00`

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **TODO-62** | **Registro OE/OS**: ✅ orden de PRUEBA en producción (`99 §77.5`). Falta: sesión de TÉCNICO en vivo · Gemini · ¿consecutivo por ZONA? | 🟡 |
| **TODO-63** | **Cédulas**: ✅ las 9 cargadas (`99 §78.5`). Falta su decisión: ¿rastro de quién lee cada cédula, o basta así? + Gemini. Cédula nueva → `guardia-cedulas.mjs --registrar`. | 🟡 |
| **TODO-66** | 🟡 **Cola de la auditoría `99 §86`** — los 53 hallazgos, con evidencia y arreglo, en `bóveda/2026-09-23-auditoria-nivel2/HALLAZGOS.md`. Vivo: shard real de `00-INDICE` (destilar es tapón) · la memoria del harness manda al HTML v22 · tres pendientes sin nodo dueño · lecciones de `§83`-`§85` sin escribir · enmendar `§83` (el criterio de «contenido» lo redefinió `§85.4`). | 🟡 |
| **TODO-67** | 🔴 **Candados que pueden estar apagados** (`99 §86.4`): los hooks solo corren si alguien ejecutó `git config core.hooksPath githooks` · el candado de cédulas arma las ventanas por «corrida», y una fila CSV puede esconder una · el `pre-commit` sale antes del boot-gate si no toca `docs/` · el gate #5 no mira el kernel (por eso los IDs ajenos reincidieron). A cambio se retira el sub-gate 5c. | 🔴 |
| **TODO-64** | 🔴 **Cola de `§80`**: **(a)** a los equipos que el trigger viejo pisó les borró la condición del Excel **y el rastro** ⇒ su ficha firma el número del motor; se reparan re-importando el archivo (cuántos son, solo se cuenta en Firestore). **(b)** cada muestra nueva **borra `calif_crg`** ⇒ ficha sin cargabilidad. **(c)** `test:trigger` no está en CI. | 🔴 |
| **TODO-65** | 🟡 **Puerta lateral a `§78`**: el `<textarea id="nota">` de órdenes sugiere «c.c.: …» (`pages/ordenes-materiales.html:243`) y `sinCedulas` no lo limpia ⇒ una cédula puede entrar a `ordenes_materiales` (lo lee cualquier miembro activo) y salir en la copia `.json` y en el PDF. Decisión: quitar la sugerencia del placeholder y/o limpiar dígitos al guardar. | 🟡 |
| **TODO-35/58** | **Cola de FICHAS TÉCNICAS → hoja [`cola-fichas-tecnicas.md`](cola-fichas-tecnicas.md)**. ✅ **CF-01..CF-04** (`§82-§85`). ✅ **PUBLICADO 09-23/25**: `§87`-`§95` (Excel que se firma, firmantes, alcance, fechas, beneficios; `098dbff`: Valor Real en blanco, calendario de años, beneficios breves). Los doce **CF-20..CF-31 ya autorizados en bloque** (09-22) entran con su tanda. | 🔴 |
| **TODO-61** | **«Sistema de refrigeración deficiente» no tiene señal**: es una de sus 5 condiciones (`99 §75.13`) y el registro guarda el TIPO de refrigeración, no su ESTADO, así que nunca puede declararse. Ya existen dos fuentes vivas (el veredicto de `acciones_refrigeracion` y el motivo de OE/OS «Reposición de unidad de refrigeración fallada»): **falta que él elija cuál vale** → CF-27 de la cola. | 🟡 |
| **TODO-60** | 🔴 **El Plan de Inversión ignora la criticidad**: `criticidad.nivel` no lo escribe ningún módulo de producción ⇒ `critN = 0` en los 208 y **el 25 % del ranking vale cero** (y la razón «Celda matriz» nunca se imprime). El arreglo ya existe y está probado en las otras tres vistas: derivarla de los usuarios. | 🔴 |
| **TODO-55** | 🔴 **La criticidad por usuarios no distingue casi nada**: la banda «mínima» va de 1 a 9.662 usuarios y se traga **147 de 208 equipos**; 14 equipos ≥20 MVA declaran ≤10 usuarios (870 MVA, 23 % de la potencia) y 3 traen la celda vacía (`M-BEC`, `M-GUP`, `M-SML`). Atenuado en el papel por `§81`, pero **el dato sigue faltando**. Opciones y sitios donde iría la regla → `99 §74.24`. **Decide él**: (A) conseguir el dato · (C) excepción «transmisión» · (F) revisar los cortes de la Tabla 9. | 🔴 |
| **TODO-54** | **Erratas ×10 en la ampacidad**: solo **GUATAPURÍ T2** (primario 5.022 → 502) y **SANTA TERESA T1** (**secundario** 833,7 → 83,7); **Lorica queda descartada** —el ADR se equivocaba— y su primario va al 102,5 %. Hay que dividir el **PAR** (ampacidad y carga), no la ampacidad sola. Verificado contra la hoja 2025 el 09-21; falta su visto bueno y leer producción. `99 §74.23`. | 🟡 |
| **TODO-56** | **¿Se recalcula `calif_crg`?** Baja de urgencia: con el Excel mandando (`§80`) el override CRG=5 ya no sube la condición de nadie; sí mueve el causante principal. El cruce: **119 cambios sobre 193** (84 suben, 35 bajan). Exige antes/después guardado. Ojo: primero hay que arreglar `TODO-64.b`, que hoy lo BORRA. | 🟡 |
| **TODO-57** | **Versionar los assets contra la caché**: cada despliegue sirve una MEZCLA de HTML nuevo con módulos viejos. No se arregla con `?v=` en el HTML (son ~997 referencias, 487 dentro de los propios módulos): va un paso de sellado en el despliegue. `99 §74.24`, **L-85**. | 🟡 |
| **TODO-47** | 🟡 **Dos huecos de `99 §73.9`, decisión suya**: el «solo PNG» mira la etiqueta que declara el cliente, no los bytes; y cualquier miembro obtiene el inventario del almacén con `listAll`. ✅ **(a) CERRADO** (`§79`). Detalle y propuesta → CF-26 y la cola. | 🟡 |

> **Los pendientes FRÍOS** (decisiones de arquitectura, validaciones diferidas, colas viejas) viven
> en la hija [`11-PENDIENTES-FRIOS.md`](11-PENDIENTES-FRIOS.md): no cambian de semana en semana y no
> tienen por qué pesar en el arranque de cada sesión. Aquí solo lo que está VIVO.
