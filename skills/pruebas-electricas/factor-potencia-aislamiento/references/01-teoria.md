# 01 · Teoría — Factor de potencia / tan δ del aislamiento

## Qué mide

La prueba aplica una tensión AC conocida (típ. 10 kV o hasta 125 % de la tensión de
operación del aislamiento) entre dos electrodos del transformador y mide la **corriente
que circula por el aislamiento** y las **pérdidas dieléctricas** asociadas. Un aislamiento
perfecto sería un capacitor puro: la corriente adelantaría 90° a la tensión y no habría
pérdidas. El aislamiento real tiene una componente **resistiva** (en fase con la tensión)
que representa pérdidas — y esa componente crece con la degradación.

```
I_total = I_capacitiva (90°, ideal) + I_resistiva (en fase, = pérdidas)
tan δ = I_resistiva / I_capacitiva       (δ = ángulo de pérdidas)
FP    = I_resistiva / I_total = cos θ ≈ tan δ   (para valores pequeños, FP ≈ tan δ)
```

- **tan δ** (tangente delta / factor de disipación, DF) y **FP** (factor de potencia)
  son casi iguales para aislamientos buenos (FP < ~5 %), donde `FP ≈ tan δ`. Se reportan
  en **% o por unidad**. Cuanto mayor el valor, más pérdidas → peor aislamiento.

## Qué fallas revela

Un FP/tan δ **alto o creciente** indica más pérdidas dieléctricas, causadas por:

- **Humedad** en el papel/aceite (la celulosa mojada conduce más). Es la causa más común.
- **Envejecimiento del aislamiento sólido** (despolimerización de la celulosa) y del aceite
  (acidez, oxidación, contaminación con productos polares).
- **Contaminación** (partículas conductoras, productos de descomposición, azufre corrosivo).
- **Defectos localizados** y descargas parciales / voids (revelados por el **tip-up**).

## Los tres modos CH / CL / CHL (qué aísla cada uno)

En un tx de dos devanados se miden los tres lazos de aislamiento (energizando un devanado
y combinando GST/UST/GSTg en el equipo Doble para aislar la trayectoria):

| Modo | Aislamiento que evalúa | Energiza | Configuración típica |
|---|---|---|---|
| **CH** | AT–tierra (devanado AT contra masa/tanque) | AT | GST |
| **CL** | BT–tierra (devanado BT contra masa/tanque) | BT | GST |
| **CHL** | entre devanados AT–BT | AT | UST (mide AT→BT, excluye tierra) |

Separar los modos **localiza** el defecto: un CHL alto con CH y CL sanos apunta al
aislamiento **entre devanados**, no a tierra.

## El ensayo de tip-up (FP vs tensión)

El **tip-up** mide el FP a dos o más tensiones (p.ej. 2 kV y 10 kV) y reporta la
diferencia `ΔFP = FP@V_alta − FP@V_baja`. En un aislamiento sano el FP es **independiente
de la tensión** (ΔFP ≈ 0, curva plana). Un **incremento** del FP con la tensión revela
**ionización en vacíos/voids** (descargas parciales internas) — degradación. Un raro
**tip-down** (FP que baja al subir tensión) suele indicar **humedad superficial** que se
seca, o una **tierra de núcleo faltante**. ⚠️ verificar el umbral exacto de ΔFP contra la
norma del director (la práctica Doble/IEEE usa ΔFP > ~0.1 % como señal de investigación).

## Por qué depende fuertemente de la temperatura

Las pérdidas dieléctricas crecen con la temperatura: el FP **aumenta** con T (al revés
que la IR, que baja). Por eso TODO FP debe **corregirse a 20 °C** antes de comparar contra
la norma, contra ensayos previos o entre modos. ⚠️ Importante: IEEE C57.12.90 **eliminó en
2010** la tabla genérica de factores de corrección por la gran variación de materiales
modernos → la mejor práctica es usar el **factor del fabricante del transformador**. Sin
corrección, los criterios de la Tabla 100.3 no aplican. Ver `02-calculos.md`.

> Continúa en `02-calculos.md` (fórmulas) y `03-criterios-evaluacion.md` (umbrales).
