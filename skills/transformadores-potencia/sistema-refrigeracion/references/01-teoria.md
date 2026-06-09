# 01 · Teoría — notación IEEE, modos y etapas de enfriamiento

> Base: IEEE C57.12.00 (notación de refrigeración), IEC 60076-2 (calentamiento), EG cap. 6. El
> backbone ya está en `../../_conocimiento/00-fundamentos-transformador.md §E` — aquí se amplía.

## A) La notación de 4 letras (`XX·YY`)

```
XX = medio y circulación INTERNA (en contacto con los devanados)
YY = medio y circulación EXTERNA (disipación al ambiente)
   Medio:        O = aceite   ·  A = aire   ·  W = agua
   Circulación:  N = natural  ·  F = forzada ·  D = dirigida (forzada y guiada por los devanados)
```

| Sigla | Significado | Cómo enfría |
|---|---|---|
| **ONAN** | Oil Natural / Air Natural | convección pura, sin bombas ni ventiladores |
| **ONAF** | Oil Natural / Air Forced | ventiladores sobre los radiadores (sin bombas) |
| **OFAF** | Oil Forced / Air Forced | bombas de aceite + ventiladores |
| **ODAF** | Oil Directed / Air Forced | aceite forzado y **dirigido** dentro de los devanados |
| **OFWF / ODWF** | Oil Forced/Directed / Water Forced | intercambiador aceite-agua (centrales, sitios sin aire) |

> **Dirigido (D)** vs **Forzado (F)**: en OF el aceite se bombea pero circula libre por el tanque;
> en OD se **guía** por canales a través de los devanados → enfría mejor el punto caliente. Nota: EG
> usa notación antigua (OA/FA/FOA…); aquí se normaliza a la vigente IEEE C57.12.00.

## B) Etapas de enfriamiento = etapas de potencia

Un transformador tiene varias potencias nominales, una por etapa activa (la placa las lista en
orden creciente, p.ej. `ONAN/ONAF/OFAF = 60/80/100 MVA`):

- Las etapas se activan **automáticamente** por temperatura: a más carga/calor, arrancan
  ventiladores y luego bombas.
- Cada etapa tiene **su** corriente nominal (`I_L = S_etapa/(√3·V_L)`, `02 §A`).

> ⚠️ **Regla EG cap. 6.2 (la más importante)**: subir de etapa **NO regala MVA**. Sacar más potencia
> por refrigeración exige que el equipo **se haya diseñado** para esa potencia (más cobre/hierro,
> aislamiento dimensionado). Forzar refrigeración en un equipo no diseñado para ello solo adelanta
> el envejecimiento del papel (`../gestion-vida-activo`).

## C) Protecciones térmicas asociadas (EG cap. 6.1)

- **Termómetro de carátula** (temperatura del aceite superior) con contactos de alarma/disparo.
- **Imagen térmica** (winding temperature): estima el punto caliente del devanado sumando un
  gradiente (vía resistencia de caldeo sobre un TC) a la temperatura del aceite.
- **Fibra óptica**: sensores embebidos que miden el punto caliente directamente (equipos modernos).
- Estas protecciones también **comandan** el arranque de etapas (ventiladores/bombas) → `04`.

→ Cálculos de MVA/I por etapa y gradientes: `02-calculos.md`. Lectura de placa: `03-criterios-evaluacion.md`.
