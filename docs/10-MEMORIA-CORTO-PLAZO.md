# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Lo EJECUTADO vive en `99` (vía `00`); los crudos de deliberación, en la bóveda `archiveDir`.

---

## 🎯 Foco (al 2026-10-18) — REFRIGERACIÓN ONAN/ONAF (TODO-80) · en pausa: firmas del borrador (TODO-81) · SCADA (TODO-69) · CONTRATO (TODO-76)

> Qué pasó → `05` y `00` (**no se repite aquí**, §G.3). ⚠️ **Abiertos** = la tabla de abajo (🔴 primero) + los fríos de `11`.
> **Al retomar**: suyo → TODO-69 · TODO-76 · TODO-78; técnico en vivo → TODO-62; Fichas CF-43/44/36/35 → `99 §140`; mantenimiento del cerebro → `§162`.

### 🔴 Solo puede hacerlo el Ingeniero (nadie más tiene la llave)
> **(B)** GitHub Support "remove sensitive data" (`99 §52.8`) + revocar los PAT viejos (`_legacy/TRIAJE.md`) + purgar del historial las coordenadas de S/E (con (G), `§162.10`). **(C)** Entregar el capítulo PRUEBAS ELÉCTRICAS del MO (**TODO-04**).
> **(D)** Tres decisiones de ADR-063: tope en `/alertas_reconocidas`, `defer` en Chart.js, barras de
> progreso. **(E)** Proteger `main` en la configuración de GitHub. **(F)** Las tres de **TODO-42**.
> **(G)** **Los 9 fixtures con datos REALES del TX 450108 siguen en el repo PÚBLICO** (`TODO-36`): anonimizarlos conservando la forma del dato, o purgarlos del historial como el 2026-07-21.
> **(H)** Equipos sin medida 2025 en su hoja de cargabilidad: `T2-M/M-BEC` y `T2-M/M-SML` se deciden con los circuitos de
> TODO-69 (paso 3); `T1-M/M-CAZ` traía en la hoja la matrícula de Casacará y hoy se mide por SCADA (`§158`; re-verificar en solo lectura).
> **(I) Suyo** (de pantalla o de campo): reemitir con su nombre los 2 Excel de Carlos (`§121.8`) · que Carlos y Jorge recarguen y
> hagan su 1.er Diagrama Operativo (`§118`) · abrir el `PRUEBA_…xlsx` de `§115` (cierra `§104.5`) · 1.ª descarga real con folio
> (`§108.5`, `§114.8`/`§117.8`) · «[object Object]» en refrigeración del PI (`§103.8`) · borrar 5 copias viejas de firmas (`§100.8`) ·
> firma de Erick en un escaneo mayor (`§98.10`) · 1.er Diagrama Operativo real (`§112.8`) · firma de Juan Cardona (`§114.8`) · el sitio en su celular (`§135.3–135.4`).
> **(J)** Copia mensual de la bóveda (su decisión, `§162.10`): conectar un disco externo y correr `brain-private/respaldo-boveda.sh /Volumes/<disco>`.

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
| **TODO-81** | 🟡 **Informe de Mantenimiento Brigada** PUBLICADO (`99 §163`): F60 Applus, PDF y Word; 3 firmas centradas (§163.15). ⏸ Firmas en borrador: rama `informe-brigada-firmas-borrador`, espera su 1/2/3. Falta de él: Applus, Word en Word. | 🟡 |
| **TODO-80** | 🔄 **Refrigeración ONAN/ONAF** (W-11 paso 2): guía PDF v3, Excel de placas v2 y Excel R3 (116 ONAF) en `~/Downloads/`; sin Pk de placa: 414 FN063 vs 866; P0 sin placa: excitación calibrada (L-151). D2 suyo: reserva opcional. Suyo: D1, D3 (factor 1,13), D4–D11 (L-148–L-151). | 🟡 |
| **TODO-69** | 🟡 **Cargabilidad SCADA** (`99 §125`–`§166`; DGA, Duval: BORRADOR). **Suyo**: 8 decisiones de `§140` (la 6 la absorbió `§150`; la 9 cambió con `§158`; la 11 = TODO-71) · re-exportar sep y oct (faltan 43 S/E) y mayo (`§125`) · circuitos y arreglos de campo (pasos 3–5, `§158.8`) · corregir lo que la placa señala, uno a uno (`§166.7`) · corregir Casacará (2 MVA) en su Excel de Salud (`§158.11`). Para el área SCADA/Operación: 4 señales no válidas y 4 con P/Q ×1000 (`§158.12`), límite de 20 A de Casacará (`§158.11`). Ofrecido → `§160.7`–`.8`. Cargar un mes → `60 §W-13` (8). | 🟡 |
| **TODO-78** | 🟡 **Mapa de Colombia** (`99 §152`–`§157`). **Suyo**: revisión de TX por depto (Excel) · red UPME · zonas · `§153.9`-3 (municipios de Fichas → CF-49), -4 (depto = zona en 4 S/E), -5 (¿la matrícula sigue a la posición o al aparato?) · quitar «Borrador» (`§155`). | 🟡 |
| **TODO-76** | 🟡 **Órdenes E/S + Contrato** (`99 §141`–`§148`, `§161`; criterio → `54`). **Suyo**: ¿el termómetro MR de Talaigua y los 3 deshumidificadores ABB salieron del contrato? (el estudio recomienda dejar fuera los ABB). **Ofrecido**: aviso si una SALIDA va Bosque → S/E · familias de accesorio y % por falla (`§144.8`) · «Importar» con su Libro4 · 5 propuestas del estudio de `§161` (`§161.8`). Límites → `§146.8`. | 🟡 |
| **TODO-73** | 🟡 **Riesgos de veracidad del dominio** (`99 §137`): Fichas (`modoDegradacion` sin fuente · «ISO 55001» · municipio por NOMBRE → CF-49) → rama + ejemplos `§140`, espera su «procede» · `sobrecarga_admisible.js` («IEEE C57.91 Tabla 6») sin cotejar (detalle de Cargabilidad y TPT) · copia de Duval de Parque sin candado · 15 ppm y 0,5 ppm/día del monitoreo NO están en el MO (`§57.8`): preguntarle. | 🟡 |
| **TODO-62** | **Registro OE/OS**: falta la sesión de TÉCNICO en vivo (`§148`: su 1.ª orden con ítems del contrato deja un `oes_…` con su `createdBy`; indicio sin verificar en `§161.8`) · ¿consecutivo por ZONA? | 🟡 |
| **TODO-63** | **Cédulas**: falta su decisión: ¿rastro de quién lee cada cédula, o basta así? Cédula nueva → `guardia-cedulas.mjs --registrar`. | 🟡 |
| **TODO-66** | 🟡 **Cola de las auditorías Nivel-2** (`99 §162`) — tabla viva: `bóveda/2026-10-11-auditoria-nivel2/HALLAZGOS.md`. Hecho el 10-11: partir 00, 20/22, 30, 32 y la cola; lóbulo 54. Vivo → `§162.4`: reglas que nodos aún delegan a la memoria · copias de memoria entre slugs · OLTC → ESTADO.md · banco canónico + `launch.json` · resello de la cola de Fichas · guardia de firmas en pre-push · freno de publicar en CI (S7-07) · 36 al 83 % (corte → cabecera de `36`). | 🟡 |
| **TODO-67** | 🔴 **Candados que pueden estar apagados** (`99 §86.4`): los hooks solo corren si alguien ejecutó `git config core.hooksPath githooks` · el candado de cédulas arma las ventanas por «corrida», y una fila CSV puede esconder una · el `pre-commit` sale antes del boot-gate si no toca `docs/` · el gate #5 no mira el kernel (por eso los IDs ajenos reincidieron; ya ve L-100+, kernel 1.14). Gate #14 y freno → `§150`. Cola del kernel → `§162.4` + **PreCompact roto** (L-132). | 🔴 |
| **TODO-64** | 🔴 **Cola de `§80`**: **(a)** a los equipos que el trigger viejo pisó les borró la condición del Excel **y el rastro** ⇒ su ficha firma el número del motor; se reparan re-importando el archivo (cuántos son, solo se cuenta en Firestore). **(b)** cada muestra nueva **borra `calif_crg`** ⇒ ficha sin cargabilidad. **(c)** `test:trigger` no está en CI. | 🔴 |
| **TODO-65** | 🟡 **Puerta lateral a `§78`**: nota (el placeholder sugiere «c.c.: …»), motivo «Otro», zona y empresa de vigilancia no filtran cédulas ⇒ llegan a `ordenes_materiales`, a la copia `.json` y al PDF. Arreglo listo: `pareceDocumento` + `caracterNoImprimible` en `validar()` (`domain/ordenes_items.js`, `§141`, L-133) y quitar la sugerencia. Decisión suya. | 🟡 |
| **TODO-35/58** | **Cola de FICHAS TÉCNICAS → hoja [`cola-fichas-tecnicas.md`](cola-fichas-tecnicas.md)** (revisada al 09-27). Lo que espera respuesta suya → lista **(I)**. **CF-20..CF-31 autorizados en bloque** (09-22), salvo **CF-22** (volver a preguntar) y **CF-28** (decidido por `§103`). | 🔴 |
| **TODO-60** | 🔴 **El Plan de Inversión ignora la criticidad**: `criticidad.nivel` no lo escribe ningún módulo de producción ⇒ `critN = 0` en los 208 y **el 25 % del ranking vale cero** (y la razón «Celda matriz» nunca se imprime). El arreglo ya existe y está probado en las otras tres vistas: derivarla de los usuarios. | 🔴 |
| **TODO-55** | 🔴 **La criticidad por usuarios no distingue casi nada**: la banda «mínima» se traga **144 de 208** (147 con los 3 sin dato); 14 equipos ≥20 MVA declaran ≤10 usuarios (870 MVA) → `99 §81.1`, `§107.4`. **El dato sigue faltando**; opciones → `§74.24`. **Decide él**: (A) dato · (C) excepción «transmisión» · (F) cortes de la Tabla 9. | 🔴 |
| **TODO-54** | **Erratas ×10 en la ampacidad**: GUATAPURÍ T2 y SANTA TERESA T1 (Lorica descartada) → `99 §74.23` + su nota de corrección. Falta su visto bueno y leer producción. Otras posibles erratas vistas desde el SCADA → `53`. | 🟡 |

> **Fríos** (arquitectura, validaciones diferidas, colas viejas) → [`11-PENDIENTES-FRIOS.md`](11-PENDIENTES-FRIOS.md).
