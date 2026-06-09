# Convenciones de cálculo (marco compartido)

> Reglas transversales que TODAS las skills de cálculo deben respetar, para que los números
> sean consistentes y trazables. Evita el error #1 (mezclar fase/línea o bases distintas).

## A) Magnitudes trifásicas — fórmulas base

```
S_3φ = √3 · V_L · I_L            potencia aparente trifásica (VA)
I_L  = S_3φ / (√3 · V_L)         corriente de LÍNEA nominal por devanado
```

- `V_L` = tensión de **línea** (entre fases). `V_fase` = tensión de fase.
- En **estrella (Y)**: `V_L = √3 · V_fase` ; `I_L = I_fase`.
- En **delta (Δ)**: `V_L = V_fase` ; `I_L = √3 · I_fase`.

## B) Relación de transformación — fase vs línea (el factor √3)

La relación de **espiras** `a = N1/N2` es de **fase**. La relación de **tensiones de línea**
depende de la conexión de cada lado:

| Conexión (AT–BT) | V_L,AT / V_L,BT |
|---|---|
| Y–Y (Yy) | `a` |
| Δ–Δ (Dd) | `a` |
| Δ–Y (Dy) | `a / √3` |
| Y–Δ (Yd) | `a · √3` |

> Regla mnemónica: cada lado en **estrella** "aporta" un √3 a su tensión de línea; si solo un
> lado es Y, el √3 NO se cancela y aparece en la relación de línea.

## C) Sistema por-unidad (pu) y BASE COMÚN

Para combinar impedancias (sobre todo en tridevanado) hay que llevarlas a una **misma base**.

```
Z_pu,nueva = Z_pu,vieja · (S_base,nueva / S_base,vieja) · (V_base,vieja / V_base,nueva)²
```

- Elegir UNA `S_base` común (típico: MVA del devanado AT, o una base de sistema) y UN lado de
  tensión. Si todo se refiere al mismo lado, el término de tensión = 1 → solo escala por
  potencia.
- `Z(%) = Z_pu · 100`. Convertir SIEMPRE antes de sumar/combinar impedancias.

## D) Corrección y redondeo

- Reportar la **fórmula + las entradas + el resultado** (trazabilidad para auditoría), no solo
  el número.
- Conservar 3–4 cifras significativas en pasos intermedios; redondear solo al final.
- Toda **temperatura** de referencia y toda **base** deben quedar explícitas junto al número.

## E) Símbolos estándar (usar en todas las skills)

| Símbolo | Significado |
|---|---|
| `S, V, I` | potencia aparente, tensión, corriente (subíndice L=línea, fase=fase) |
| `a` | relación de espiras (fase) |
| `Z_HM, Z_HL, Z_ML` | impedancias de par AT-MT, AT-BT, MT-BT (tridevanado) |
| `Z1, Z2, Z3` | impedancias de rama del modelo estrella equivalente (AT, MT, BT) |
| `Z0` | impedancia de secuencia cero |
| `H / X / Y` | devanados AT / BT / terciario (nomenclatura ANSI de bornes) |

> ⚠️ Nunca inventar una base, una tolerancia o un factor de corrección: si no está en placa o
> norma, marcar `⚠️ verificar` y usar el supuesto más conservador documentándolo.
