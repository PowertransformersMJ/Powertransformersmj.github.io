# 01 · Teoría — Resistencia de aislamiento (IR), absorción y polarización

## Qué mide

La prueba aplica una tensión DC conocida entre dos electrodos del transformador
(p.ej. el devanado de AT contra tierra/tanque) y mide la **corriente total** que
circula a través del sistema de aislamiento (papel + aceite). Por Ley de Ohm,
`R = V/I`: cuanto menor la corriente de fuga, mayor la resistencia, mejor el
aislamiento. Se reporta en MΩ o GΩ.

La corriente total tiene tres componentes que evolucionan en el tiempo:

1. **Corriente capacitiva** — carga la capacitancia geométrica del devanado. Es
   grande al inicio y decae en segundos. Por eso nunca se lee la IR instantánea.
2. **Corriente de absorción/polarización** — las moléculas del aislamiento sólido
   (celulosa) se reorientan con el campo. Decae lentamente, en minutos. **Es la
   base de DAR y PI.**
3. **Corriente de conducción/fuga** — la verdadera corriente que atraviesa el
   aislamiento de forma estacionaria. Es la que define la IR "real" a tiempo largo.

```
I(t) = I_capacitiva(t→0 rápido) + I_absorción(decae en min) + I_conducción(constante)
```

## Por qué la IR sube con el tiempo (y de ahí salen PI/DAR)

En un aislamiento **seco y limpio**, las corrientes capacitiva y de absorción
dominan al inicio y luego decaen, de modo que la corriente total cae y la **IR
medida crece** apreciablemente entre 1 y 10 minutos → **PI alto**.

En un aislamiento **húmedo o contaminado**, la corriente de conducción es alta y
domina desde el principio; la IR apenas sube con el tiempo → **PI cercano a 1**.
Por eso el PI/DAR son indicadores de **humedad/contaminación**, no solo del valor
absoluto de IR.

- **DAR** (Dielectric Absorption Ratio) = `R(60s) / R(30s)` — versión rápida.
- **PI** (Polarization Index) = `R(10min) / R(1min)` — versión completa.

## Por qué la IR depende fuertemente de la temperatura

La conductividad del aislamiento aumenta exponencialmente con la temperatura: en
aceite, la IR se **reduce a la mitad por cada ~10 °C** de aumento (en aislamiento
sólido, cada ~15 °C). Una IR medida a 40 °C puede ser 4× menor que la misma a 20 °C.
**Sin corregir a una temperatura de referencia (20 °C), comparar IR no tiene sentido**
— ni contra la norma, ni contra ensayos previos, ni entre devanados. Ver
`02-calculos.md` y la Tabla 100.14.

## Qué se mide en un transformador (configuraciones)

En un tx de dos devanados se miden típicamente los tres lazos de aislamiento:

| Medida | Energiza | Aterriza/guarda | Aísla |
|---|---|---|---|
| AT–tierra (H) | AT | BT a tierra | AT vs masa |
| BT–tierra (L) | BT | AT a tierra | BT vs masa |
| AT–BT (CHL) | AT | — (BT como retorno) | entre devanados |

Con el terminal de **guarda (guard)** se pueden aislar trayectorias (p.ej. excluir
la fuga superficial de los bujes para medir solo el aislamiento del devanado).

> Continúa en `02-calculos.md` (fórmulas) y `03-criterios-evaluacion.md` (umbrales).
