# 02 · Cálculos — MVA por etapa, corriente por etapa, gradientes

> Reglas en `../../_conocimiento/convenciones-calculo.md`. **Nunca inventar** el % de cada etapa →
> leerlo de placa o marcar `⚠️ verificar`.

## A) Corriente de línea por etapa

```
I_L,etapa = S_etapa / (√3 · V_L)
```

Ejemplo `V_L = 115 kV`, etapas `60/80/100 MVA`:
`ONAN → 301 A` · `ONAF → 402 A` · `OFAF → 502 A`. (Misma tensión, la I escala con la potencia.)

## B) Relación entre etapas (porcentajes típicos)

| Configuración | % de la máxima (ejemplo) |
|---|---|
| ONAN / ONAF | 60 / 100 |
| ONAN / ONAF / ONAF | 60 / 80 / 100 |
| ONAN / ONAF / OFAF | 60 / 80 / 100 |

> ⚠️ Son **ejemplos** de la práctica; los % reales varían por unidad → `⚠️ verificar` en placa. La
> norma define el método, no un % universal.

## C) Gradientes térmicos (de aceite a punto caliente)

```
T_punto_caliente = T_ambiente + ΔT_aceite_top + ΔT_gradiente_devanado-aceite
```

- `ΔT_aceite_top` = calentamiento del aceite superior sobre el ambiente (rise de aceite).
- `ΔT_gradiente` = diferencia devanado–aceite (hot-spot gradient).
- La **imagen térmica** estima `T_punto_caliente` para proteger el papel (`../gestion-vida-activo`,
  IEEE C57.91). El punto caliente, no la temperatura media, **gobierna la vida**.

## D) Regla "etapa ≠ MVA libre" (cuantificada)

- Activar la siguiente etapa baja la temperatura del aceite, pero la corriente extra calienta el
  **cobre** (I²R) y el punto caliente. Si el equipo no se diseñó para esa I, el papel envejece más
  rápido aunque el aceite "se vea frío".
- Para evaluar si una etapa superior es segura: comparar la `I_L,etapa` con la capacidad de diseño
  del devanado (reporte de fábrica) → `../calculos-nominales`, `../gestion-vida-activo`.

## E) Capacidad de refrigeración perdida por fallo de equipos

- Si fallan ventiladores/bombas, el equipo **baja de etapa** automáticamente (o debería) → su MVA
  admisible cae a la etapa inferior. Operar a MVA de etapa alta con refrigeración degradada =
  sobrecalentamiento (`04 §A`).
