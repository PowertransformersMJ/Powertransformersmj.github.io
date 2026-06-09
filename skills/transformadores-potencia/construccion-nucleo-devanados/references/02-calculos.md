# 02 · Cálculos — V/espira, densidad de flujo, fuerzas de cortocircuito

> Reglas en `../../_conocimiento/convenciones-calculo.md`. Los datos de diseño (sección de núcleo,
> nº de espiras, geometría) vienen del reporte de fábrica → `⚠️ verificar` si no se tienen.

## A) Tensión por espira y densidad de flujo

```
V_fase / N = 4.44 · f · B · A_núcleo
```

- Liga el diseño magnético (`B`, `A_núcleo`) con el eléctrico (`V/espira`).
- `B` típico ~1.5–1.7 T en acero grano orientado (`⚠️ verificar` diseño). Por encima → saturación.
- A más `V/espira`, menos espiras para la misma tensión → núcleo más grande.

## B) Relación de espiras y construcción

- El devanado de **menor tensión** (más corriente) suele ser **helicoidal** (pocas espiras, gran
  sección de cobre); el de **mayor tensión**, **disco** (muchas espiras).
- La relación de espiras `a = N_AT/N_BT` se valida con la relación de placa y el grupo
  (`../calculos-nominales 02 §D`).

## C) Fuerzas de cortocircuito (∝ I²)

Durante un cortocircuito pasante, las corrientes elevadas generan fuerzas electromagnéticas en los
devanados:

```
F ∝ I²        (proporcional al cuadrado de la corriente de cortocircuito)
I_cc ≈ I_nominal / Z_pu      (../impedancia-cortocircuito 02 §C)
```

- **Fuerza radial**: tiende a comprimir el devanado interno y expandir el externo → **pandeo**.
- **Fuerza axial**: tiende a desplazar los discos verticalmente → **telescopeo**.
- Menor `%Z` → mayor `I_cc` → mayores fuerzas. Por eso la `%Z` también es un parámetro **mecánico**,
  no solo eléctrico.

> Cuantificar la fuerza exacta exige geometría de diseño (reporte de fábrica). Aquí se usa la
> proporcionalidad para **priorizar** equipos de baja `%Z` y alto `I_cc` disponible (`04 §B`).

## D) Capacitancias y distribución de impulso (cualitativo)

```
distribución inicial de impulso ∝ √(C_tierra / C_serie)
```

- Más **capacitancia serie** (devanado entrelazado) → distribución más **uniforme** → menos estrés
  en las primeras espiras.
- Es la base física de por qué el **shell form** y el **disco entrelazado** soportan mejor el
  impulso (`01 §C/§D`). Los valores de C se miden, no se asumen (`../bujes-y-accesorios` para FP).
