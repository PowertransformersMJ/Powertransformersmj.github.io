# 01 · Teoría — esfuerzos, cadena de falla, familias

> Base: IEEE C57.125 (guía de investigación de fallas), CIGRE, ABB Service Handbook, EG. Backbone en
> `../../_conocimiento/00-fundamentos-transformador.md`. La interpretación de aceite/DGA/ensayos es
> del lóbulo 49 (`../../pruebas-electricas/`); aquí se ordena la **causalidad**.

## A) Los cuatro esfuerzos

| Esfuerzo | Origen | Deterioro que provoca |
|---|---|---|
| **Eléctrico** | sobretensión, impulso de rayo/maniobra, descargas parciales | estrés dieléctrico en aislamiento y primeras espiras (`../construccion-nucleo-devanados §A`) |
| **Térmico** | sobrecarga, hot-spot, refrigeración deficiente | envejecimiento del papel (`../gestion-vida-activo`) |
| **Mecánico** | fuerzas de cortocircuito ∝ I², transporte, sismo | telescopeo/pandeo/aflojamiento (`../impedancia-cortocircuito`) |
| **Químico/ambiental** | humedad, oxígeno, azufre corrosivo, contaminación | degradación de aceite y papel (lóbulo 49) |

- Los esfuerzos **interactúan**: el térmico envejece el papel → el papel frágil cede ante el
  mecánico (cortocircuito) → se abre camino dieléctrico → falla. La RCA debe ver la **cadena**, no un
  solo esfuerzo.

## B) La cadena esfuerzo → falla

```
ESFUERZO  →  DETERIORO acumulado  →  MODO DE FALLA  →  SÍNTOMA medible  →  ENSAYO que lo detecta
```

- Ejemplo: **sobrecarga sostenida** (térmico) → **papel despolimerizado** (DP baja) → **aislamiento
  frágil** → ante un **cortocircuito pasante** (mecánico) **se deforma el devanado** → **FRA/`%Z`
  desviados** → confirmación por FRA.
- La clave de gestión: **detectar el deterioro antes del modo de falla** (mantenimiento basado en
  condición), no esperar al síntoma terminal.

## C) Familias de modo de falla

| Familia | Modos típicos | Skill/lóbulo responsable |
|---|---|---|
| **Dieléctrica** | descargas parciales, perforación, tracking, falla de buje | lóbulo 49 (FP, DFR, DGA) + `../bujes-y-accesorios` |
| **Térmica** | sobrecalentamiento, hot-spot, punto caliente de conexión | lóbulo 49 (DGA) + `../sistema-refrigeracion` + `../gestion-vida-activo` |
| **Mecánica / cortocircuito** | telescopeo (axial), pandeo (radial), aflojamiento de apriete | `../construccion-nucleo-devanados` + `../impedancia-cortocircuito` (FRA, %Z) |
| **Cambiador de tomas (OLTC)** | coquización de contactos, mala conmutación, gas selectivo del OLTC | `../regulacion-tomas` + lóbulo 49 (DGA del OLTC, DRM) |
| **Bujes / accesorios** | FP creciente, tap flotante, falla del Buchholz/sobrepresión | `../bujes-y-accesorios` + lóbulo 49 (FP de buje) |

> Estadísticamente, el **OLTC** y los **bujes** concentran una fracción grande de fallas (partes con
> movimiento / puntos de paso). El cuerpo activo (devanado/núcleo) falla menos pero más caro.

## D) Por qué este lóbulo es el integrador

- Las demás skills explican **un** parámetro o subsistema. Esta los **cruza**: ante un síntoma,
  identifica el esfuerzo, la familia, el ensayo y el lóbulo. Evita el error de mirar un solo dato
  (ej. `Z0` baja) sin la cadena completa (`../identificacion-tipo-transformador 03 §E`).

→ Indicadores cuantitativos por familia: `02-calculos.md`. RCA integrada: `03-criterios-evaluacion.md`.
