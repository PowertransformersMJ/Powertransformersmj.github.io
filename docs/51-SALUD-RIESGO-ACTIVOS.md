# 🩺 51 — SALUD Y RIESGO DE LOS ACTIVOS (lóbulo de dominio)

> Lóbulo registrado en `40-LOBULOS-DOMINIO` y nombrado en `CLAUDE.md §0`. Nacido 2026-10-02 (`99 §137`).
> **Dueño del CRITERIO** de cómo AFINIA califica y prioriza el parque: índice de salud (HI) del MO.00418, condición
> oficial, criticidad, matriz criticidad × salud, estrategias por condición, plan de inversión y valoración regulatoria
> de la reposición. **Dónde vive el código** → `22`/`20`. **Los valores vigentes** los manda el archivo:constante
> citado (públicos en el código); del MO.00418 —documento del cliente— aquí NO se copia texto.
> Lo operativo de Fichas (cola, decisiones del papel) → `cola-fichas-tecnicas.md`.

---

## 1. Índice de salud (HI) — MO.00418
- Pesos de la Tabla 10 → `domain/schema.js` `PESOS_HI` (DGA 0,35 · EDAD 0,30 · ADFQ 0,15 · FUR/CRG/PYT/HER 0,05 c/u;
  suman 1, validado al cargar). Motor → `domain/salud_activos.js`: si falta una variable, su peso se **redistribuye**
  proporcionalmente entre las disponibles.
- Overrides §A5 → `umbrales_salud_baseline.js` (`overrides`): CRG = 5 ⇒ HI ≥ 4 (§4.1.3); FUR ≥ 4 aprobado = fin de vida del
  papel (§4.1.2); aceleración de C₂H₂ ⇒ HI ≥ 4 (§A9.1).
- **Ratificado TABLA POR TABLA** con el MO.00418 Ed. 02: las 9 tablas + la Tabla 10 + los 3 overrides = baseline
  (`99 §57.2 d`). Editar un umbral exige justificación del Profesional de Transformadores (cabecera del baseline);
  la UI de umbrales muestra la desviación contra el oficial.

## 2. Cortes por variable (solo punteros)
| Variable | Clave en `umbrales_salud_baseline.js` | Criterio en |
|---|---|---|
| DGA (TDGC/CO/CO₂/C₂H₂, promedio redondeado) | `dga` | `52 §1` |
| ADFQ (RD + IC) / 2 | `adfq` | `52 §9` |
| FUR (2FAL, juicio experto desde 4) | `fur` | `52 §10` |
| CRG (> 60/65/75/90 %) | `crg` | `53 §1` |
| EDAD (7/19/26/30 años; vida útil regulatoria 30 años, CREG 085/2018) | `edad` | aquí |
| HER (escala 1–5 por inspección, Tabla 9) · PYT | sin clave: se califican en `salud_activos.js` | aquí (`99 §57.2 d`) |

## 3. La condición oficial = la del Excel de Salud de Activos
- Desde 2026-09-08 **manda el Excel** (decisión del Ingeniero, `99 §74.14`, `§74.15`): el importador escribe
  `salud_actual.hi_final` = condición del Excel y deja el recálculo del MO.00418 al lado (`hi_recalculado`).
- Una muestra nueva la pisaba con el número del motor (`onMuestraCreate`); se conserva con
  `fusionarConservandoCondicion` (`99 §80`). Cola abierta → TODO-64.
- Hoja que vale: `TX_Potencia`, con la cabecera en la fila correcta (`99 §69`, L-72); qué hacer con `TPT_Servicio` y
  `TX_Respaldo` → TODO-42.

## 4. Qué significa cada banda
- Orden de lectura único 1 → 5 en todas las vistas, y una definición por banda pensada en riesgo y continuidad del
  servicio (`DEFINICION_CONDICION`, `ui/fichas/ficha-tecnica.js`), al lado de la etiqueta oficial del MO.00418, que
  NO se toca (`99 §74.21`).

## 5. La columna CAUSANTE del Excel no es confiable
- Viene copiada entre filas: el modo de falla se deduce de los VALORES medidos, no de esa columna (memoria
  `reference_salud_activos_causante_no_confiable`; caso concreto → `34` L-73).

## 6. Criticidad y matriz de riesgo
- Criticidad por usuarios aguas abajo (§4.2.1): `domain/matriz_riesgo.js` `calcularRangosCriticidad` — 5 rangos
  iguales entre 1 y el máximo (baseline 48.312 ⇒ pasos de 9.662).
- **Problema abierto**: la banda «mínima» se traga la gran mayoría del parque y hay equipos grandes que declaran
  pocos usuarios → la criticidad casi no distingue. Opciones y decisión suya → TODO-55 (`99 §81.1`, `§107.4`, `§74.24`).
- Matriz 5×5 oficial (fila = HI, columna = criticidad, MO.00418 Tabla 11) → `colorCelda`. En la hoja «Salud y
  riesgo» de Fichas: sin dato de usuarios no hay casilla (`99 §107`, `§111`).

## 7. Estrategias por condición (MO.00418 §4.3)
- `domain/estrategias.js`: condición 1–5 → macroactividad + subactividades + mitigaciones + periodicidad; alimenta la
  autogeneración de órdenes. Mapa actividad ↔ modo de degradación: `domain/acciones_tecnicas.js` (L-88; sustento en la
  bóveda `2026-09-10-sustento-tecnico-actividades`).
- La redacción firmable de los beneficios vive en el código, la bóveda y la memoria `feedback_redaccion_beneficios`:
  aquí solo se apunta.

## 8. Plan de inversión
- `domain/plan_inversion.js` `PESOS_PI_BASELINE`: HI 0,40 · criticidad 0,25 · vida utilizada 0,15 · costo de reemplazo
  (invertido) 0,10 · antigüedad/falla reciente 0,10. La cabecera los llama «oficial (prompt v2.2 F30)»: son **criterio
  interno, NO norma**. Editables por el director en `/umbrales_salud/pi`.
- 🔴 **Error abierto**: `criticidad.nivel` no lo escribe ningún módulo de producción ⇒ el 25 % del ranking vale cero
  (TODO-60). La frontera Fichas ↔ Plan de Inversión: la inversión es del PI (`99 §74.20`).

## 9. Valoración regulatoria (CREG 015/2018)
- `domain/fichas_creg_uc.js` (UC por nivel, devanados bi/tri/auto y regulación) + `fichas_evaluacion_uucc.js`.
- **Trampa de las dos tablas**: CREG 015/2018 publica los mismos códigos UC en las Tablas 15/16 (pesos dic-2017) y
  51/52 (pesos dic-2007); la ficha PE.02081 usa las de **2007** (memoria `reference_creg015_dos_juegos_tablas`).
  Ajustes de centavos: no redondear (`99 §87`, callejón en `10`).

## 10. Respaldo y servicio (TPT, OTC, MO.00418 §A9.3)
- `domain/tpt_respaldo.js`: mismas reglas de salud que POTENCIA; usa `tiempoAdmisible` de `sobrecarga_admisible.js`,
  que NO está cotejado (`53 §7`, TODO-73). Sin cotejo propio contra el MO.00418.

## 11. Trampas conocidas
- Cada muestra nueva borra `calif_crg` (TODO-64.b) → no crear `/muestras` «para tener historial».
- Matrícula repetida en el Excel = DOS equipos distintos: los planes de carga no escriben ninguno de los dos (`99 §131`).
- `MODELO-DATOS-v2.md §2.8` dice `MAX(TDGC, C2H2)`: desactualizado, manda `52 §1`.

## 12. Riesgos de veracidad abiertos (→ TODO-73)
- «ISO 55001» en textos que se FIRMAN (`fichas_diagnostico.js:327`, beneficio V2 de `ui/fichas/panel.js:240`) y en la
  bitácora de auditoría (`audit.js`, `admin/auditoria.html`: «§9.1 compliance»): afirmación de alineación sin sustento
  documentado. Fichas espera su «procede».
- Gestión de activos (CIGRE TB 761/445, ISO 55000/55001, RCM): **cero contenido verificado** en el cerebro; investigar
  y verificar en la web antes de escribir una línea (pendiente frío en `11`).

## 13. Decisiones pendientes del Ingeniero (solo el número)
TODO-55 · TODO-56 · TODO-60 · TODO-64 · TODO-42 · TODO-73.
