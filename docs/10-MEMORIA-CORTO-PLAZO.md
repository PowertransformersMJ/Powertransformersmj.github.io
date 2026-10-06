# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Lo EJECUTADO vive en `99` (vía `00`); los crudos de deliberación, en la bóveda `archiveDir`.

---

## 🎯 Foco (al 2026-10-06) — FICHAS TÉCNICAS por partes · CARGABILIDAD SCADA (TODO-69)

> Qué pasó → `05` y `00` (**no se repite aquí**, §G.3). ⚠️ **Abiertos** = la tabla de abajo (🔴 primero) + los fríos de `11`.
> **Al retomar (10-06)**: esperan SUS respuestas a dos páginas en `~/Downloads` (`99 §140`; Órdenes `§141` ya publicado): `Fichas_para_su_procede.html` (CF-43/44 en rama `fichas/cf-43-44-textos-con-fuente`; CF-36, CF-35) y `Decisiones_Cargabilidad_SCADA.html` (11 de TODO-69). CI sin consultar (el modo automático bloquea `gh run list`; lo servido sí = main, `§141.4`). Relevo anterior → bóveda `2026-10-05-documentacion-total/RELEVO.md`.

### 🔴 Solo puede hacerlo el Ingeniero (nadie más tiene la llave)
> **(B)** GitHub Support "remove sensitive data" + revocar los PAT viejos (**TODO-08**). **(C)** Entregar el capítulo PRUEBAS ELÉCTRICAS del MO (**TODO-04**).
> **(D)** Tres decisiones de ADR-063: tope en `/alertas_reconocidas`, `defer` en Chart.js, barras de
> progreso. **(E)** Proteger `main` en la configuración de GitHub. **(F)** Las tres de **TODO-42**.
> **(G)** **Los 9 fixtures con datos REALES del TX 450108 siguen en el repo PÚBLICO** (`TODO-36`): anonimizarlos conservando la forma del dato, o purgarlos del historial como el 2026-07-21.
> **(H)** Decir qué se hace con los **3 equipos que su hoja de cargabilidad no trae**: `T1-M/M-CAZ`
> (Casa de Zinc), `T2-M/M-BEC` (Becerril) y `T2-M/M-SML` (San Martín de Loba) — sin medida 2025.
> **(I) Suyo**: Carlos ya emitió 2 Excel (`§121.8`: ¿reemitir con su nombre?);
> que Carlos y Jorge recarguen · 1.er Diagrama Operativo de ellos (`§118`) · abrir en su Excel el `PRUEBA_…xlsx` de `§115` (cierra también `§104.5`) · la primera
> descarga real con folio (Fichas `§108.5`; Órdenes `§114.8`/`§117.8`) · «[object Object]» en refrigeración del PI (`§103.8`) · borrar las 5 copias viejas de
> firmas en Storage (`§100.8`) · la firma de Erick en un escaneo mayor (`§98.10`) · el primer Diagrama Operativo real (`§112.8`) · firma de Juan Cardona (`§114.8`) · recorrer el sitio en su celular con sesión iniciada: menú ☰, barra y tablas (`§135.3–135.4`).

### 🚫 Callejones probados (NO reintentar)
> **Los de la Fase 9 viven en `99 §52.8-52.9`** (+ `--branch` de filter-repo → **L-25**). Los de dominio (Reprocesar `§20`,
> DGA/aceite o fabricar el dato `§27`, **L-50/L-69**) → `CLAUDE.md §3.2`. **Vivos aquí**: anteponer una redacción nueva al
> arreglo de opciones —el borrador guarda la versión por su ÍNDICE y correrían las fichas guardadas (`99 §85.3`)— ·
> `codigo` como respaldo de la matrícula: es el CODIGO SUBESTACION y nombra al equipo equivocado (`§85.3`, `§82`) · panel
> "parecido a X" en vez de reusar X (**L-57**) · estado consolidado para todos los chips (**L-58**) · `args` de Workflow
> como string JSON (**L-71**) · dar por basura un contador de "omitidos" sin abrir el archivo (**L-72**) · apóstrofo «contra fórmulas» en un `.xlsx` (se imprime, **L-100**) · redondear centavos del
> PE.02081 (`§87`) · reintentar abrir Microsoft Excel desde aquí (-1743, **L-103**) · probar «Exportar Excel» del custodio en
> producción (registra un folio, **L-94**).
> **Ya verificado SANO — no re-auditar sin motivo** → `00` Capa 2 (casillas `NN.8` + crudo de la bóveda).

---

## 📋 Pendientes (TODO-NN) — lo ejecutado → `99` vía `00`

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **TODO-71** | 🟡 **Detalle de Cargabilidad PUBLICADO** (`99 §123`, `§124`). Suyo: escalón IEEE («después»). Menores vivos → `§124.9` (los de `§123.9` menos lo ya hecho). | 🟡 |
| **TODO-69** | 🟡 **Cargabilidad SCADA** (`99 §125`-`§134`; panel DGA, Duval y sus textos en BORRADOR). **Suyo** (en una tanda, `§140`): ¿PD → Triángulos 4/5? y los 13 PD con H2 ≥ 2.000 · criterio «no firme» 15 %/1 ppm · supuestos de `§132.8` (30 °C, papel, constantes típicas, hueco 2 h) · hallazgos `§131.9` · aprobar textos DGA (variantes con/sin ppm, `§133`) · ¿0,5 pu en otro color (`§126.8`)? · ¿«Urgente» en vez de «Inmediato» (`§127.8`)? · Gemini del `§127` · 26 pendientes (`§125.2`) y 17 correcciones (bóveda `2026-10-01-parametros-scada`) (partir de la copia v2, `§125.9`) · 104 medidas fuera de la homologación: ¿cuáles son de AFINIA? (`§138`) · re-exportar sep y mayo. Deuda: `TODO-64.b` borra `calif_crg`. | 🟡 |
| **TODO-73** | 🟡 **Riesgos de veracidad del dominio** (`99 §137`): Fichas (`modoDegradacion` sin fuente · «ISO 55001») → rama + ejemplos `§140`, espera su «procede» · `sobrecarga_admisible.js` («IEEE C57.91 Tabla 6») sin cotejar (detalle de Cargabilidad y TPT) · copia de Duval de Parque sin candado · 15 ppm y 0,5 ppm/día del monitoreo NO están en el MO (`§57.8`): preguntarle. | 🟡 |
| **TODO-62** | **Registro OE/OS**: ✅ orden de PRUEBA en producción (`99 §77.5`). Falta: sesión de TÉCNICO en vivo · Gemini · ¿consecutivo por ZONA? | 🟡 |
| **TODO-63** | **Cédulas**: ✅ las 9 cargadas (`99 §78.5`). Falta su decisión: ¿rastro de quién lee cada cédula, o basta así? + Gemini. Cédula nueva → `guardia-cedulas.mjs --registrar`. | 🟡 |
| **TODO-66** | 🟡 **Cola de las auditorías Nivel-2** (`99 §86`, `§109`, `§128`) — tabla viva: `bóveda/2026-10-02-auditoria-nivel2/HALLAZGOS.md` (59; estado de los 64 anteriores). Vivo: reglas sin dueño (harness) · casilla NN.9 de pendientes · resello de la cola de Fichas · guardia de firmas en pre-push. | 🟡 |
| **TODO-67** | 🔴 **Candados que pueden estar apagados** (`99 §86.4`): los hooks solo corren si alguien ejecutó `git config core.hooksPath githooks` · el candado de cédulas arma las ventanas por «corrida», y una fila CSV puede esconder una · el `pre-commit` sale antes del boot-gate si no toca `docs/` · el gate #5 no mira el kernel (por eso los IDs ajenos reincidieron). **Gate #14** (`§128.4`): la auditoría Nivel-2 vuelve a vencer en `§140` (aviso) y BLOQUEA el commit del cerebro desde `§146` o el 9-nov: correrla antes; su calibración la decide él. A cambio se retira el sub-gate 5c. | 🔴 |
| **TODO-64** | 🔴 **Cola de `§80`**: **(a)** a los equipos que el trigger viejo pisó les borró la condición del Excel **y el rastro** ⇒ su ficha firma el número del motor; se reparan re-importando el archivo (cuántos son, solo se cuenta en Firestore). **(b)** cada muestra nueva **borra `calif_crg`** ⇒ ficha sin cargabilidad. **(c)** `test:trigger` no está en CI. | 🔴 |
| **TODO-65** | 🟡 **Puerta lateral a `§78`**: la nota de órdenes sugiere «c.c.: …» (`pages/ordenes-materiales.html:243`) y NADA filtra cédulas en nota, motivo «Otro», zona ni empresa de vigilancia ⇒ llegan a `ordenes_materiales` (lo lee todo el equipo), a la copia `.json` y al PDF. Ya existe el detector (`pareceDocumento`, `domain/ordenes_items.js`, `§141`): aplicarlo en `validar()` y quitar la sugerencia del placeholder. Decisión suya. | 🟡 |
| **TODO-35/58** | **Cola de FICHAS TÉCNICAS → hoja [`cola-fichas-tecnicas.md`](cola-fichas-tecnicas.md)** (revisada al 09-27). Lo que espera respuesta suya → lista **(I)**. **CF-20..CF-31 autorizados en bloque** (09-22), salvo **CF-22** (volver a preguntar) y **CF-28** (decidido por `§103`). | 🔴 |
| **TODO-60** | 🔴 **El Plan de Inversión ignora la criticidad**: `criticidad.nivel` no lo escribe ningún módulo de producción ⇒ `critN = 0` en los 208 y **el 25 % del ranking vale cero** (y la razón «Celda matriz» nunca se imprime). El arreglo ya existe y está probado en las otras tres vistas: derivarla de los usuarios. | 🔴 |
| **TODO-55** | 🔴 **La criticidad por usuarios no distingue casi nada**: la banda «mínima» se traga **144 de 208** (147 con los 3 sin dato); 14 equipos ≥20 MVA declaran ≤10 usuarios (870 MVA) → `99 §81.1`, `§107.4`. **El dato sigue faltando**; opciones → `§74.24`. **Decide él**: (A) dato · (C) excepción «transmisión» · (F) cortes de la Tabla 9. | 🔴 |
| **TODO-54** | **Erratas ×10 en la ampacidad**: solo **GUATAPURÍ T2** (primario 5.022 → 502) y **SANTA TERESA T1** (**secundario** 833,7 → 83,7); **Lorica queda descartada** —el ADR se equivocaba— y su primario va al 102,5 %. Hay que dividir el **PAR** (ampacidad y carga), no la ampacidad sola. Verificado contra la hoja 2025 el 09-21; falta su visto bueno y leer producción. `99 §74.23`. | 🟡 |
| **TODO-56** | **¿Se recalcula `calif_crg`?** Baja de urgencia: con el Excel mandando (`§80`) el override CRG=5 ya no sube la condición de nadie; sí mueve el causante principal. El cruce: **119 cambios sobre 193** (84 suben, 35 bajan); 10-01: **123/199** ≠ medida (`§124.8`). ¿Avisar en la ventana si CRG del Excel ≠ medida? (`§124.9`). Exige antes/después guardado. Ojo: primero hay que arreglar `TODO-64.b`, que hoy lo BORRA. | 🟡 |

> **Fríos** (arquitectura, validaciones diferidas, colas viejas) → [`11-PENDIENTES-FRIOS.md`](11-PENDIENTES-FRIOS.md).
