---
name: calculos-nominales
description: Calcula y verifica las magnitudes NOMINALES de un transformador de potencia — corriente nominal de línea y de fase por devanado, potencia por etapa de enfriamiento (ONAN/ONAF/OFAF/ODAF), relación de transformación teórica con el factor √3 según el grupo, y densidad de flujo (V/espira). Úsala SIEMPRE que el usuario pida la corriente nominal, la I de plena carga, la potencia de una etapa de enfriamiento, la relación teórica, los amperios por devanado, o quiera validar un número de placa contra el cálculo — incluso si solo da S, V y la conexión.
---

# Cálculos nominales

Las magnitudes nominales (S, V, I por devanado y etapa) son la **base numérica** de todo: relación,
impedancia, protecciones, cargabilidad. El error #1 es **mezclar fase con línea** o usar el MVA de
la etapa de enfriamiento equivocada. Esta skill fija cómo se calculan con trazabilidad.

## Cuándo se dispara

El usuario pide la corriente nominal / de plena carga, los amperios por devanado, la potencia de una
etapa de enfriamiento, la relación teórica, o quiere comprobar un valor de placa. También al cargar
una placa nueva al tablero para derivar las corrientes base.

## Workflow (6 pasos)

1. **Reúne datos de placa**: S por etapa de enfriamiento, V de línea de cada devanado, conexión
   (Y/Δ) y grupo. → `../placa-caracteristica`, `../grupo-vectorial-conexiones`.
2. **Calcula la corriente de LÍNEA** por devanado: `I_L = S_3φ / (√3·V_L)`. → `references/02-calculos.md`.
3. **Deriva la corriente de FASE** según la conexión (Y: `I_fase=I_L`; Δ: `I_fase=I_L/√3`).
4. **Repite por etapa de enfriamiento** (cada etapa tiene su S → su I). ⚠️ subir de etapa NO regala MVA.
5. **Valida la relación** con el factor √3 del grupo (Yy/Dd→a; Dy→a/√3; Yd→a·√3).
6. **Emite la ficha de cálculos** (formato abajo), reportando fórmula+entradas+resultado, `⚠️ verificar` lo no confirmado.

## Fórmulas núcleo (detalle en `references/02-calculos.md` y `../_conocimiento/convenciones-calculo.md`)

```
I_L  = S_3φ / (√3 · V_L)           corriente de línea nominal por devanado
I_fase = I_L (Y)  |  I_L/√3 (Δ)    corriente de fase según conexión
S_etapa: ONAN/ONAF/OFAF/ODAF = p.ej. 60/80/100 % de la placa máxima (⚠️ verificar por unidad)
relación de línea = a · (factor √3 del grupo)
```

## Neuronas (lee según necesites)

- `references/01-teoria.md` — qué es "nominal", potencias por etapa, magnitudes de placa.
- `references/02-calculos.md` — I línea/fase, potencia por etapa, relación, V/espira (densidad de flujo).
- `references/03-criterios-evaluacion.md` — validar cálculo vs placa, tolerancias, multi-norma.
- `references/04-diagnostico.md` — errores (fase/línea, etapa≠MVA libre), implicaciones operativas.

Marcos compartidos: `../_conocimiento/convenciones-calculo.md`, `../_conocimiento/00-fundamentos-transformador.md`,
`../_conocimiento/marco-normativo-tx.md`.

## Formato de salida (ficha de cálculos)

```
DEVANADO | V_L (kV) | conexión | S (MVA) | I_L (A) | I_fase (A)
AT       |   ___    |   Y/Δ    |  ___    |  ___    |  ___
MT/BT    |   ___    |   Y/Δ    |  ___    |  ___    |  ___
POTENCIA POR ETAPA: ONAN ___ / ONAF ___ / OFAF ___ / ODAF ___ (MVA)  → I_L de cada etapa: ___
RELACIÓN: a (espiras) = ___ · factor √3 del grupo = ___ → relación de línea = ___ (vs placa: ___)
DENSIDAD DE FLUJO (si hay nº espiras): V/espira = ___
⚠️ VERIFICAR: <% exacto de cada etapa de enfriamiento · datos no confirmados en placa>
```

→ Con estas corrientes base se evalúan resistencia de devanados, cargabilidad y protecciones en
`../../pruebas-electricas/` y `../gestion-vida-activo`.
