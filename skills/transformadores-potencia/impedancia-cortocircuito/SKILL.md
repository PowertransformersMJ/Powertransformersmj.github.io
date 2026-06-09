---
name: impedancia-cortocircuito
description: Calcula, convierte y evalúa la IMPEDANCIA de cortocircuito (%Z / Z de dispersión) de un transformador de potencia — conversión a base común por-unidad, modelo de estrella equivalente de 3 ramas para tridevanados a partir de las impedancias de par (Z_HM, Z_HL, Z_ML), impedancia de secuencia cero, corriente de cortocircuito disponible y reparto de carga en paralelo. Úsala SIEMPRE que el usuario mencione impedancia, %Z, reactancia de dispersión, impedancia de par, estrella equivalente, secuencia cero, corriente de cortocircuito, reparto de carga, base común o por-unidad de un transformador.
---

# Impedancia de cortocircuito (%Z)

La `%Z` gobierna la **corriente de cortocircuito**, el **reparto de carga** en paralelo y la
**caída de tensión** bajo carga. En tridevanados no hay una sola Z: hay **tres de par** que se
convierten a un modelo de **estrella equivalente de 3 ramas**. El error #1 es combinar Z en
**bases de MVA distintas** sin llevarlas a una base común.

## Cuándo se dispara

El usuario menciona %Z, reactancia de dispersión, impedancia de par, estrella equivalente,
secuencia cero, corriente de cortocircuito, reparto de carga en paralelo, base común o por-unidad.

## Workflow (6 pasos)

1. **Reúne las impedancias de placa/reporte**: bidevanado → `Z_HL`; tridevanado → `Z_HM, Z_HL, Z_ML`
   con la **base de MVA de cada par**. → `references/03-criterios-evaluacion.md`.
2. **Lleva todo a una BASE COMÚN** por-unidad ANTES de combinar (`../_conocimiento/convenciones-calculo.md §C`).
3. **Tridevanado → estrella equivalente** (3 ramas, fórmulas abajo). Una rama negativa es **normal**.
4. **Secuencia cero**: evalúa `Z0` según conexiones/aterrizamiento y presencia de delta (`02 §D`).
5. **Deriva lo aplicable**: corriente de cortocircuito disponible y/o reparto de carga en paralelo.
6. **Emite la ficha de impedancia** (formato abajo), `⚠️ verificar` bases y tolerancias no confirmadas.

## Fórmulas núcleo (detalle en `references/02-calculos.md`)

```
base común:  Z_pu,new = Z_pu,old · (S_new/S_old) · (V_old/V_new)²
estrella eq: Z1 = ½(Z_HM + Z_HL − Z_ML)   (rama AT)
             Z2 = ½(Z_HM + Z_ML − Z_HL)   (rama MT)
             Z3 = ½(Z_HL + Z_ML − Z_HM)   (rama BT)   ← una rama negativa es NORMAL
I_cc ≈ I_nominal / Z_pu     (cortocircuito en bornes, fuente infinita)
reparto: S_i/S_total ≈ (S_nom,i/Z%_i) / Σ(S_nom/Z%)
```

## Neuronas (lee según necesites)

- `references/01-teoria.md` — qué es la Z de dispersión, %Z, ensayo de cortocircuito, modelo de tridevanado.
- `references/02-calculos.md` — base común, estrella equivalente, secuencia cero, I_cc, reparto.
- `references/03-criterios-evaluacion.md` — tolerancias, base de MVA por par, multi-norma.
- `references/04-diagnostico.md` — paralelo, esfuerzos de cortocircuito, errores típicos.

Marcos compartidos: `../_conocimiento/convenciones-calculo.md`, `../_conocimiento/marco-normativo-tx.md`.

## Formato de salida (ficha de impedancia)

```
TIPO: <bidevanado | tridevanado>   BASE COMÚN ELEGIDA: ___ MVA, lado ___ kV
IMPEDANCIAS DE ENTRADA (base original): Z_HL=__ %  [Z_HM=__ %  Z_ML=__ %]
A BASE COMÚN: Z_HL=__  Z_HM=__  Z_ML=__  (pu / %)
ESTRELLA EQUIVALENTE (tridev.): Z1(AT)=__  Z2(MT)=__  Z3(BT)=__   (rama negativa: normal)
SECUENCIA CERO Z0: ___  (baja si hay delta/estabilización → afecta falla a tierra)
I CORTOCIRCUITO disponible (bornes): ___ kA   ·  REPARTO en paralelo: ___
⚠️ VERIFICAR: <base de MVA de cada Z de par · tolerancia por nº de devanados · edición de norma>
```

→ El reparto y el paralelo cruzan con `../grupo-vectorial-conexiones 04 §A`; la secuencia cero con
`../identificacion-tipo-transformador`. La Z medida se evalúa en `../../pruebas-electricas/`.
