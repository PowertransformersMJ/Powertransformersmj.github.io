# 🔁 Recetas con datos reales del cliente (hoja de `60-WORKFLOWS`)

> **Hoja de detalle de [`60-WORKFLOWS.md`](60-WORKFLOWS.md)** (W-13 paso 9 y W-15 paso 7). No se auto-carga.
> Nació el 2026-11-03 (auditoría de vacíos de la sesión 11-oct → 2-nov): estas tres recetas se practicaron varias veces y
> solo vivían repartidas en ADRs y en la bóveda; `60` está cerca de su tope (§G.5). Lo que ya dice `60` no se repite aquí.
> Ningún dato real entra a este archivo (repo PÚBLICO): fotos, lecturas, guiones con rutas reales → bóveda.

---

## 1. Corregir un equipo contra su placa («uno a uno»), desde su Chrome

**Disparador:** él pide revisar un equipo contra su placa. Primer caso: Lorica T1 (`99 §167`); después `§171`, `§175`–`§186`.
Sigue viva: TODO-54 y TODO-69 («corregir lo que la placa señala, uno a uno», `§166.7`).

1. **Leer** la ficha de producción (solo lectura) y la foto ORIGINAL de la placa (bóveda; nunca al repo).
2. **Tabla placa ↔ plataforma**: qué cuadra, qué difiere, qué está vacío. Comparar en amperios a la tensión de placa (L-154) y
   en profundidad (L-161).
3. **Preguntas cerradas** con la opción recomendada y su porqué (W-11); se escribe solo con su permiso para ESE equipo.
4. **Plan en seco**: obtener el documento, verificar la matrícula y el valor viejo ESPERADO de cada campo. Un choque aborta todo.
5. **Escribir** con `data/transformadores.js#actualizarCampos(id, parche, {uid, diff})` (bitácora `diff`, `§154`): marca y modelo
   en la raíz y en `placa.*`; una errata ×10 se corrige en el PAR ampacidad + carga (`53 §3`).
6. **Releer** campo por campo (N/N escritos, N/N releídos) y confirmar que lo no tocado (serie, potencia, tensiones,
   ampacidades) sigue igual.
7. **Medida u homologación**, si cambian: «Revisar» en Datos SCADA (calcula sus avisos; nota obligatoria) → `decidirFila`;
   releer con `leerHomologacion`. Nunca armar la decisión a mano (`§200.5`).
8. **En vivo, con la página recargada**: la revisión de placa (`revisionPlaca`) llega a 0 diferencias; mes vigente y conteo de
   firmes antes/después.
9. **Cierre**: nota `revision-uno-a-uno/NN-<equipo>.md` en la bóveda (`2026-10-23-diferencias-placa-ampacidad`); ADR sin claves
   SCADA (candado `guardia-scada`); TODO-54. Lo que su Excel de Salud trae distinto va a los pendientes del documento (TODO-82):
   la cifra oficial no se toca sin su pedido.

## 2. Escribir en producción con `firebase-admin` (guion local)

**Disparador:** sembrar o corregir una colección que ninguna pantalla escribe (posiciones de S/E, configuración y firmantes del
Informe Brigada, saldos del contrato): `§145`, `§153`, `§163` (siembra, personal, firmantes, firmas 163.11–.13).

1. **El guion SIMULA por defecto** y solo escribe con `--escribir` / `--aplicar`, tras su «procede» con la simulación a la vista.
2. **`create()` para lo nuevo** (falla si ya existe; no pisa nada) y **`update()` solo de los campos tocados**, con precondición
   `lastUpdateTime` (nadie lo cambió entre leer y escribir). Lo que comparte estado, en una transacción.
3. **El SDK de admin se salta las reglas**: la carga se valida con la función del dominio que espeja la regla
   (`sanitizarSuministro`/`validarSuministro`, `configParaGuardar`) y las rutas se arman como la regla las exige.
4. **Releer al terminar**: lo escrito idéntico (bytes y huella si es binario) y lo demás intacto.
5. **Archivar el guion** en la bóveda (`crudos/`) y nombrarlo en el ADR. Deshacer: un `--deshacer` cuando aplique.

Matiza el anti-patrón de `§125.5` («escribir con credenciales de admin»): para lo que SÍ tiene pantalla (meses SCADA,
importaciones) se escribe desde su Chrome, con las reglas; el guion es para lo que no la tiene, con los pasos de arriba.

## 3. Extraer VALORES de informes del cliente para un cálculo

**Disparador:** un cálculo necesita cifras leídas de cientos de informes o fotos suyas (placas 10-18, resistencias de
devanado y pérdidas en vacío 10-19; TODO-80, bóveda `2026-10-12-refrigeracion-onaf-onan`, `crudos/pruebas-2026-10-19/`).

1. **Texto** de cada PDF (`pdftotext -layout`) e **índice** por serie, matrícula y subestación; paquetes por S/E con recortes.
2. **Lectores por lotes** (~12 equipos) que guardan su JSON en la bóveda, no en `/tmp` (L-148: un workflow gigante se cayó y el
   resume rehízo casi todo).
3. **Relectura a ciegas** de lo que pesa en el cálculo y **comparador** que normaliza modos, tomas y unidades.
4. **Buscadores** para lo que falta y **árbitros** que deciden cada desacuerdo leyendo la fuente.
5. **Comprobación mecánica**: cada valor usado aparece en su línea del informe (±4 líneas; variantes Ω/mΩ, coma o punto;
   nombres en NFC) — `verificar_lineas.py`.
6. **Revisión adversaria del CÓDIGO del cálculo + un recalculador independiente.** La doble lectura NO atrapó los 6 errores
   de cálculo de la rama R3 (dos etapas, grupos con dígitos, «R corr.» sin temperatura, equipo duplicado, toma no nominal,
   errata de un equipo): solo los halló esta revisión.
7. Resultado y Excel → Descargas + bóveda; nada al repo.
