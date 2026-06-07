# 01 · Teoría — SFRA / FRA, la huella en frecuencia y las bandas

## Qué mide

SFRA (Sweep Frequency Response Analysis) inyecta una señal sinusoidal de **baja tensión**
en un terminal del transformador y **barre la frecuencia** (típicamente 20 Hz a 2 MHz,
⚠️ verificar rango del equipo), midiendo la **función de transferencia** (magnitud en dB y
fase) de la respuesta en otro terminal. El resultado es una **huella/firma** (curva
magnitud-vs-frecuencia) única de la geometría interna del transformador.

```
H(f) = V_salida(f) / V_entrada(f)   →  |H| en dB y ∠H en grados, barrido en f
```

El transformador, a alta frecuencia, se comporta como una **red distribuida de R-L-C**
(inductancias de devanado, capacitancias entre espiras / a tierra / entre devanados). Cada
resonancia y anti-resonancia de la huella corresponde a una combinación L-C concreta fijada
por la **geometría física** interna. Si la geometría cambia, los R-L-C cambian, y la huella
**se desplaza** — esa es la base del diagnóstico.

## Por qué NO hay umbral numérico universal (se compara, no se "mide")

A diferencia de IR o reactancia, SFRA **no tiene un valor de aceptación absoluto**. Su
potencia es **comparativa**: la huella nueva se contrasta contra una referencia conocida.
Cuatro bases de comparación, en orden de confianza (`03-…`):

1. **Time-based** — la misma unidad vs su huella anterior (la más confiable).
2. **Type-based** — vs una unidad **gemela** (mismo diseño/fabricante).
3. **Construction-based / fase hermana** — entre las 3 fases del mismo tx (deben parecerse).
4. **vs fábrica/commissioning** — la huella de referencia tomada al energizar.

Una huella sin baseline equivalente es casi inservible: SFRA es una prueba de **tendencia/
comparación**, no de valor puntual.

## Las BANDAS de frecuencia → cada una mira un subsistema (clave del diagnóstico)

La huella se interpreta por **bandas**, porque distintos rangos de frecuencia son
dominados por distintos elementos físicos. Los límites **no son fijos**: dependen del
diseño, tamaño y potencia del tx; se definen por la **forma** de la respuesta (IEEE
C57.149 / IEC 60076-18). Guía orientativa (⚠️ verificar bandas contra el equipo/norma):

| Banda | Rango típico orientativo | Dominada por | Detecta |
|---|---|---|---|
| **Baja** | ≈ 20 Hz – 2 kHz | inductancia magnetizante / **núcleo** y circuito magnético | magnetismo residual, problemas de núcleo, espiras en corto, circuito abierto |
| **Media** | ≈ 2 kHz – 20 kHz | interacción entre **devanados** / geometría global | desplazamiento axial/radial, deformación de devanados |
| **Alta** | ≈ 20 kHz – 2 MHz | **conexiones, derivaciones, cables de prueba** y capacitancias finas | problemas de conexión/aterrizaje del set-up; a muy alta f domina el montaje |

> ⚠️ Los límites exactos de banda **no son universales**: IEEE C57.149 advierte que se
> definen por la forma de la curva, no por un Hz fijo. Las cifras de arriba son una guía
> de industria; verificar contra el reporte del equipo y la edición de norma del director.

## Qué fallas detecta

- **Deformación mecánica de devanados** (axial/radial), típicamente tras un cortocircuito
  pasante → desviación en banda **media**.
- **Problemas de núcleo** (sujeción, laminaciones, magnetismo residual) → banda **baja**.
- **Espiras en cortocircuito / circuito abierto** → cambio marcado a baja frecuencia.
- **Conexiones flojas / mal aterrizaje** → banda **alta** (a menudo es el set-up, no el tx).

## Relación con la reactancia de dispersión (complementarias)

SFRA (cualitativa, amplio espectro) y reactancia de dispersión (cuantitativa, un número
comparable a placa) miran lo mismo: integridad mecánica. Su **convergencia** es lo que
confirma una deformación (ver `04-diagnostico.md`).

> Continúa en `02-calculos.md` (cómo comparar/correlacionar) y `03-criterios-evaluacion.md`.
