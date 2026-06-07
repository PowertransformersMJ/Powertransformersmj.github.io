# 01 · Teoría — LTC/OLTC, transición sin interrupción y DRM

## Qué es y qué hace

El **cambiador de tomas bajo carga** (LTC = Load Tap Changer; OLTC = On-Load Tap Changer)
ajusta la relación de transformación **sin desenergizar** el transformador, cambiando la
toma activa del devanado de regulación para mantener la tensión de salida. A diferencia del
DETC (de-energizado), conmuta **con corriente de carga circulando** → debe pasar de un TAP
al siguiente **sin interrumpir** esa corriente.

## El principio clave: transición SIN interrupción (resistor o reactor)

Para no abrir el circuito durante el salto de TAP, el LTC inserta momentáneamente un
**resistor (o reactor) de transición** que puentea ambas tomas mientras el contacto se
mueve. La secuencia (tipo resistor, el más común):

```
TAP n  →  [contacto principal abre]  →  resistor de transición conduce (puente)
       →  [contacto del TAP n+1 cierra]  →  resistor sale  →  TAP n+1
La corriente NUNCA se interrumpe: siempre hay un camino (contacto o resistor).
```

Si en algún instante **ningún** camino conduce → **transición abierta**: se interrumpe la
corriente de carga, se forma arco y se daña el LTC. Detectar que la corriente **nunca cae a
cero** durante la maniobra es el objetivo central de la prueba dinámica.

## Resistencia dinámica de contactos (DRM / DVtest)

La **DRM** (Dynamic Resistance Measurement) inyecta una corriente DC a través del devanado y
del LTC mientras este **conmuta a través de todas sus posiciones**, registrando la
resistencia (o la tensión/corriente) a **alta tasa de muestreo**. La firma resultante
muestra:

- **Picos de resistencia** cuando el resistor de transición entra (esperado y momentáneo).
- **Continuidad**: la resistencia **nunca debe ir a infinito / la corriente nunca a cero**
  → confirma que no hubo transición abierta.
- **Valor de los resistores de transición**: comparables a su valor nominal.
- **Tiempos de transición**: la duración del evento (la transición de un OLTC tipo resistor
  es ≈ 40–60 ms; muestreo rápido es imprescindible ⚠️ verificar tipo/fabricante).

## El compartimiento del LTC: DGA SEPARADA del tanque principal (clave diagnóstica)

El LTC suele alojarse en un **compartimiento separado** (o tanque adjunto) con su **propio
aceite**. Como el contacto **arquea por diseño** en cada maniobra, ese aceite acumula gases
de arco (sobre todo **acetileno C₂H₂** y **etileno C₂H₄**) en niveles que en el **tanque
principal** indicarían falla grave, pero en el LTC son **normales** por su operación. Por eso:

- **NUNCA** interpretar la DGA del LTC con los límites del tanque principal.
- Lo que importa es la **tendencia** y los **ratios** (p.ej. C₂H₂/C₂H₄, C₂H₆/CH₄): un cambio
  marcado o un patrón anómalo señala contactos coordinando mal o un problema térmico, no el
  arqueo normal del desviador.

## Qué fallas detecta

| Mecanismo | Señal |
|---|---|
| **Contactos quemados/erosionados** | resistencia de contacto ↑; firma DRM con picos altos/anchos |
| **Transición abierta** | corriente cae a cero durante la maniobra (interrupción) |
| **Coordinación errónea** | tiempos de transición fuera de rango / asimétricos entre fases |
| **Resistor de transición fuera de valor** | resistencia del puente ≠ nominal |
| **Desgaste por nº de operaciones** | conteo alto → mantenimiento por calendario de maniobras |

> Continúa en `02-calculos.md` (lectura de firma + tiempos) y `03-criterios-evaluacion.md`.
