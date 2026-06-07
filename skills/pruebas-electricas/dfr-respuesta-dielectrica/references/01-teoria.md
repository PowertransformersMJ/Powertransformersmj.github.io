# 01 · Teoría — Respuesta dieléctrica en frecuencia (DFR / FDS)

## Qué mide

El DFR (Dielectric Frequency Response), también llamado **FDS** (Frequency Domain
Spectroscopy), aplica una tensión AC y **barre la frecuencia** (típicamente de ~1 mHz
a ~1 kHz) midiendo la **capacitancia** y las **pérdidas dieléctricas (tan δ / factor de
potencia)** del aislamiento en cada frecuencia. El resultado es una **curva** tan δ vs
frecuencia — una "huella dieléctrica" del sistema papel–aceite.

A diferencia de la IR (un punto DC) o el FP a 50/60 Hz (un punto AC), el DFR ve **todo el
espectro**, donde los distintos mecanismos de polarización del aislamiento se separan por
frecuencia. Esa separación es lo que permite extraer la **humedad del papel** específicamente.

## Por qué el DFR estima la humedad del SÓLIDO (no del aceite)

El sistema de aislamiento de un tx es papel (celulosa) impregnado en aceite. Cada medio
domina la respuesta en un rango de frecuencia distinto:

```
Bajas frecuencias (mHz)   → domina la conductividad del ACEITE + interfaces
Medias frecuencias        → polarización interfacial papel/aceite (geometría X-Y)
Frecuencias altas (kHz)   → capacitancia geométrica
```

La **humedad de la celulosa** desplaza y eleva la curva de tan δ de forma característica
en el rango bajo-medio. Como la celulosa concentra **cientos de veces** más agua que el
aceite, medir la humedad del **papel** es lo relevante para la vida del tx — y el DFR la
estima directamente, cosa que IR y FP no hacen (ellos ven el sistema agregado).

## El modelo X-Y: cómo se separa papel de aceite

El aislamiento real se idealiza con un **modelo X-Y**: **X** = fracción de barreras
sólidas (spacers/papel) en serie en el ducto; **Y** = fracción del ducto ocupada por
papel/cartón. Conociendo la geometría X-Y y midiendo la curva, el software **ajusta**
(fitting) la respuesta medida contra una familia de curvas modeladas que dependen de
**(a) % humedad del papel** y **(b) conductividad del aceite**. El mejor ajuste entrega
ambos valores **separados** — por eso el DFR distingue "papel húmedo" de "aceite conductivo".

> Sin separar las dos contribuciones, un aceite envejecido/contaminado (conductivo) puede
> **simular** humedad del papel. El modelo X-Y es lo que evita ese falso positivo.

## Por qué la temperatura es crítica

La respuesta dieléctrica se **desplaza en frecuencia** con la temperatura (la curva
"corre" hacia frecuencias más altas al subir la T). Un mismo aislamiento medido a 20 °C
y a 50 °C da curvas distintas. Por eso el DFR **corrige por temperatura** a una referencia
(normalmente 20 °C) antes de leer el % de humedad: sin la T del ensayo el % no es
interpretable. La temperatura también acota el rango de frecuencias útil del barrido.

## Qué falla / condición revela

- **Humedad del papel** (su uso principal y **concluyente**): % de agua en la celulosa.
- **Conductividad / envejecimiento del aceite** (subproducto del ajuste): aceite degradado.
- **Validación de IR y FP**: cuando IR/FP están ambiguos (¿es humedad o contaminación?),
  el DFR es el **árbitro**: si el % de humedad del papel sale bajo, la baja IR no es humedad.

> Continúa en `02-calculos.md` (ajuste X-Y, corrección de T, lectura del %) y
> `03-criterios-evaluacion.md` (umbrales de humedad por norma).
