---
name: regulacion-tomas
description: Interpreta y calcula la REGULACIÓN por tomas (taps) de un transformador de potencia — cambiador bajo carga (OLTC) vs sin carga (DETC), rango y escalones (±%), tensión por toma, efecto de la toma en la relación y en la impedancia, y modos de regulación (lineal, puente reversible, grueso-fino). Úsala SIEMPRE que el usuario mencione tomas, taps, OLTC, DETC, cambiador de tomas, regulación de tensión, posición de toma, escalón, rango ±%, o pregunte cómo cambia la relación o la Z al cambiar de toma.
---

# Regulación por tomas (taps)

El cambiador de tomas ajusta la **relación de transformación** para mantener la tensión de salida
ante variaciones de carga/red. Cambiar de toma cambia la **relación** y, según el diseño, también
la **%Z**. Distinguir **OLTC** (bajo carga, motorizado) de **DETC** (sin carga, manual con el
equipo desenergizado) es clave: confundirlos es un riesgo de seguridad.

## Cuándo se dispara

El usuario menciona tomas/taps, OLTC/DETC, cambiador, posición de toma, rango ±%, escalón, o
pregunta cómo cambia la relación o la impedancia al regular.

## Workflow (6 pasos)

1. **Identifica el tipo de cambiador**: OLTC (bajo carga) vs DETC (sin carga). → `references/01-teoria.md`.
2. **Lee la tabla de tomas** de placa: posición nominal, nº de pasos, ±%, tensión por toma.
3. **Ubica el devanado regulado** (normalmente el de AT) y el modo (lineal/puente/grueso-fino).
4. **Calcula** tensión y relación por toma; evalúa el efecto en %Z si el diseño lo tiene. → `02-calculos.md`.
5. **Cruza con seguridad y diagnóstico**: DETC solo desenergizado; OLTC → resistencia dinámica de contactos.
6. **Emite la ficha de tomas** (formato abajo), `⚠️ verificar` lo no confirmado en placa.

## Conceptos núcleo

```
OLTC (On-Load Tap Changer): cambia bajo carga, motorizado, con resistencias/reactancias de
   transición; mantiene la corriente sin interrumpir. Mantenimiento del selector + ruptor.
DETC (De-Energized Tap Changer): cambia SOLO con el equipo desenergizado; ajuste estacional.
   ⚠️ Operar un DETC bajo carga = arco destructivo.
tensión por toma: V_toma = V_nominal · (1 ± n·paso%)
```

## Neuronas (lee según necesites)

- `references/01-teoria.md` — OLTC vs DETC, dónde va el devanado regulado, modos de regulación.
- `references/02-calculos.md` — tensión/relación por toma, % por escalón, efecto en %Z.
- `references/03-criterios-evaluacion.md` — leer la tabla de tomas, rango, multi-norma.
- `references/04-diagnostico.md` — resistencia dinámica OLTC, seguridad DETC, errores.

Marcos compartidos: `../_conocimiento/00-fundamentos-transformador.md`, `../_conocimiento/convenciones-calculo.md`,
`../_conocimiento/marco-normativo-tx.md`.

## Formato de salida (ficha de tomas)

```
CAMBIADOR: <OLTC | DETC>   DEVANADO REGULADO: <AT/MT/BT>
RANGO: ± __ %  en __ pasos de __ % c/u   ·  POSICIÓN NOMINAL: toma __
MODO: <lineal | puente reversible | grueso-fino>
TENSIÓN POR TOMA (extremos): toma_min = __ kV · nominal = __ kV · toma_max = __ kV
RELACIÓN POR TOMA: en nominal = __ · en extremos = __ / __
EFECTO EN %Z: <varía / aprox. constante según diseño> → ⚠️ verificar
SEGURIDAD: <OLTC opera bajo carga | DETC SOLO desenergizado>
⚠️ VERIFICAR: <tabla de tomas exacta · efecto en Z · datos no confirmados en placa>
```

→ La toma seleccionada cambia la relación que valida `../calculos-nominales` y puede mover la %Z de
`../impedancia-cortocircuito`. La resistencia dinámica del OLTC se ensaya en `../../pruebas-electricas/`.
