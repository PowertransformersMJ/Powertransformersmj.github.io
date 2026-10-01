# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Lo EJECUTADO vive en `99` (vía `00`); los crudos de deliberación, en la bóveda `archiveDir`.

---

## 🎯 Foco (al 2026-09-30) — FICHAS TÉCNICAS, por partes (orden del Ingeniero)

> Qué pasó → `05` y `00` (**no se repite aquí**, §G.3). ⚠️ **Abiertos**: **TODO-67** 🔴 · **TODO-64** 🔴 · **TODO-60** 🔴 ·
> **TODO-55** 🔴 · **TODO-35/58** 🔴 · **TODO-66** · **TODO-65** · **TODO-62/63** · 70 · 54 · 56 · 57 · 61 · y los fríos de `11`.

### 🔴 Solo puede hacerlo el Ingeniero (nadie más tiene la llave)
> **(B)** GitHub Support "remove sensitive data" + revocar los PAT viejos (**TODO-08**). **(C)** Entregar el capítulo PRUEBAS ELÉCTRICAS del MO (**TODO-04**).
> **(D)** Tres decisiones de ADR-063: tope en `/alertas_reconocidas`, `defer` en Chart.js, barras de
> progreso. **(E)** Proteger `main` en la configuración de GitHub. **(F)** Las tres de **TODO-42**.
> **(G)** **Los 9 fixtures con datos REALES del TX 450108 siguen en el repo PÚBLICO** (`TODO-36`): anonimizarlos conservando la forma del dato, o purgarlos del historial como el 2026-07-21.
> **(H)** Decir qué se hace con los **3 equipos que su hoja de cargabilidad no trae**: `T1-M/M-CAZ`
> (Casa de Zinc), `T2-M/M-BEC` (Becerril) y `T2-M/M-SML` (San Martín de Loba) — sin medida 2025.
> **(I) Suyo**: permisos de Órdenes y Fichas DADOS (09-30); Carlos ya emitió 2 Excel (`§121.8`: ¿reemitir con su nombre?);
> que Carlos y Jorge recarguen · 1.er Diagrama Operativo de ellos (`§118`) · abrir en su Excel el `PRUEBA_…xlsx` de `§115` · la primera
> descarga real con folio (`§108.5`) · «[object Object]» en refrigeración del PI (`§103.8`) · borrar las 5 copias viejas de
> firmas en Storage (`§100.8`) · la firma de Erick en un escaneo mayor (`§98.10`) · el primer Diagrama Operativo real (`§112.8`) · firma de Juan Cardona (`§114.8`).

### 🚫 Callejones probados (NO reintentar)
> **Los de la Fase 9 viven en `99 §52.8-52.9`** (+ `--branch` de filter-repo → **L-25**). Los de dominio (Reprocesar `§20`,
> DGA/aceite o fabricar el dato `§27`, **L-50/L-69**) → `CLAUDE.md §3.2`. **Vivos aquí**: anteponer una redacción nueva al
> arreglo de opciones —el borrador guarda la versión por su ÍNDICE y correrían las fichas guardadas (`99 §85.3`)— ·
> `codigo` como respaldo de la matrícula: es el CODIGO SUBESTACION y nombra al equipo equivocado (`§85.3`, `§82`) · panel
> "parecido a X" en vez de reusar X (**L-57**) · estado consolidado para todos los chips (**L-58**) · `args` de Workflow
> como string JSON (**L-71**) · dar por basura un contador de "omitidos" sin abrir el archivo (**L-72**) · reabrir
> CONECTAR D (`99 §52.14`) · apóstrofo «contra fórmulas» en un `.xlsx` (se imprime, **L-100**) · redondear centavos del
> PE.02081 (`§87`) · reintentar abrir Microsoft Excel desde aquí (-1743, **L-103**) · probar «Exportar Excel» del custodio en
> producción (registra un folio, **L-94**).
> **Ya verificado SANO — no re-auditar sin motivo**: lo que las auditorías DESPEJARON vive en la
> casilla `NN.8` de su ADR (`§66.8`, `§68.8`, `§73.8`, **`§75.8`**) y en el crudo de la bóveda.
> Consúltalo ANTES de volver a auditar Fichas, el escapado de HTML, la doctrina CSS o las reglas de
> Storage (ahí están los 23 refutados: mecanismo cierto, consecuencia falsa).

---

## 📋 Pendientes (TODO-NN) — lo ejecutado → `99` vía `00`

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **TODO-70** | 🟡 **Detalle de Cargabilidad** (el clic no abría: `d.diag` indefinido, y otras cifras sin dato): arreglo EN RAMA `293d573`, **espera su «procede»** → ADR + L. Visto, NO tocado: el reloj pisa el rótulo de origen (`cargabilidad-shell.js:69`). | 🟡 |
| **TODO-69** | 🟡 **Cargabilidad SCADA PUBLICADA** (`99 §122`–`.9`). **Suyo**: antes de cargar la homologación, revisar «Parametros SCADA… FINAL.xlsx» (17 correcciones; bóveda `2026-10-01-parametros-scada`); luego homologación y meses (W-13); falta mayo. | 🟡 |
| **TODO-62** | **Registro OE/OS**: ✅ orden de PRUEBA en producción (`99 §77.5`). Falta: sesión de TÉCNICO en vivo · Gemini · ¿consecutivo por ZONA? | 🟡 |
| **TODO-63** | **Cédulas**: ✅ las 9 cargadas (`99 §78.5`). Falta su decisión: ¿rastro de quién lee cada cédula, o basta así? + Gemini. Cédula nueva → `guardia-cedulas.mjs --registrar`. | 🟡 |
| **TODO-66** | 🟡 **Cola de las auditorías Nivel-2** (`99 §86`, `§109`, `§120`) — tabla viva: `bóveda/2026-09-27-auditoria-nivel2/HALLAZGOS.md` (63 hallazgos, estado de los 53 anteriores). Vivo: reglas que solo viven en la memoria del harness · `NN.8` que faltan · enmiendas `§83`. | 🟡 |
| **TODO-67** | 🔴 **Candados que pueden estar apagados** (`99 §86.4`): los hooks solo corren si alguien ejecutó `git config core.hooksPath githooks` · el candado de cédulas arma las ventanas por «corrida», y una fila CSV puede esconder una · el `pre-commit` sale antes del boot-gate si no toca `docs/` · el gate #5 no mira el kernel (por eso los IDs ajenos reincidieron). A cambio se retira el sub-gate 5c. | 🔴 |
| **TODO-64** | 🔴 **Cola de `§80`**: **(a)** a los equipos que el trigger viejo pisó les borró la condición del Excel **y el rastro** ⇒ su ficha firma el número del motor; se reparan re-importando el archivo (cuántos son, solo se cuenta en Firestore). **(b)** cada muestra nueva **borra `calif_crg`** ⇒ ficha sin cargabilidad. **(c)** `test:trigger` no está en CI. | 🔴 |
| **TODO-65** | 🟡 **Puerta lateral a `§78`**: el `<textarea id="nota">` de órdenes sugiere «c.c.: …» (`pages/ordenes-materiales.html:243`) y `sinCedulas` no lo limpia ⇒ una cédula puede entrar a `ordenes_materiales` (lo lee cualquier miembro activo) y salir en la copia `.json` y en el PDF. Decisión: quitar la sugerencia del placeholder y/o limpiar dígitos al guardar. | 🟡 |
| **TODO-35/58** | **Cola de FICHAS TÉCNICAS → hoja [`cola-fichas-tecnicas.md`](cola-fichas-tecnicas.md)** (revisada al 09-27). Lo que espera respuesta suya → lista **(I)** de arriba. Los doce **CF-20..CF-31 ya autorizados en bloque** (09-22) entran con su tanda, salvo **CF-22** (su «dónde» ya no existe en Mantenimiento: volver a preguntar). | 🔴 |
| **TODO-61** | **«Sistema de refrigeración deficiente» no tiene señal**: es una de sus 5 condiciones (`99 §75.13`) y el registro guarda el TIPO de refrigeración, no su ESTADO, así que nunca puede declararse. Ya existen dos fuentes vivas (el veredicto de `acciones_refrigeracion` y el motivo de OE/OS «Reposición de unidad de refrigeración fallada»): **falta que él elija cuál vale** → CF-27 de la cola. | 🟡 |
| **TODO-60** | 🔴 **El Plan de Inversión ignora la criticidad**: `criticidad.nivel` no lo escribe ningún módulo de producción ⇒ `critN = 0` en los 208 y **el 25 % del ranking vale cero** (y la razón «Celda matriz» nunca se imprime). El arreglo ya existe y está probado en las otras tres vistas: derivarla de los usuarios. | 🔴 |
| **TODO-55** | 🔴 **La criticidad por usuarios no distingue casi nada**: la banda «mínima» va de 1 a 9.662 usuarios y se traga **144 de 208 equipos** (147 contando los 3 sin dato, `§107.4`); 14 equipos ≥20 MVA declaran ≤10 usuarios (870 MVA, 23 % de la potencia) y 3 traen la celda vacía (`M-BEC`, `M-GUP`, `M-SML`; desde `§107` quedan FUERA de la matriz y su ficha dice «no se puede situar», ya no «Mínima»). Atenuado en el papel por `§81`, pero **el dato sigue faltando**. Opciones y sitios donde iría la regla → `99 §74.24`. **Decide él**: (A) conseguir el dato · (C) excepción «transmisión» · (F) revisar los cortes de la Tabla 9. | 🔴 |
| **TODO-54** | **Erratas ×10 en la ampacidad**: solo **GUATAPURÍ T2** (primario 5.022 → 502) y **SANTA TERESA T1** (**secundario** 833,7 → 83,7); **Lorica queda descartada** —el ADR se equivocaba— y su primario va al 102,5 %. Hay que dividir el **PAR** (ampacidad y carga), no la ampacidad sola. Verificado contra la hoja 2025 el 09-21; falta su visto bueno y leer producción. `99 §74.23`. | 🟡 |
| **TODO-56** | **¿Se recalcula `calif_crg`?** Baja de urgencia: con el Excel mandando (`§80`) el override CRG=5 ya no sube la condición de nadie; sí mueve el causante principal. El cruce: **119 cambios sobre 193** (84 suben, 35 bajan). Exige antes/después guardado. Ojo: primero hay que arreglar `TODO-64.b`, que hoy lo BORRA. | 🟡 |

> **Los pendientes FRÍOS** (decisiones de arquitectura, validaciones diferidas, colas viejas) viven
> en la hija [`11-PENDIENTES-FRIOS.md`](11-PENDIENTES-FRIOS.md): no cambian de semana en semana y no
> tienen por qué pesar en el arranque de cada sesión. Aquí solo lo que está VIVO.
