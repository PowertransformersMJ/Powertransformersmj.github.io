# 04 · Diagnóstico — errores de cálculo y sus implicaciones

> Un error en las magnitudes nominales se propaga a protecciones, cargabilidad y evaluación de
> ensayos. Cierra el arco `01→02→03→04`. Cruce con ensayos en `../../pruebas-electricas/`.

## A) Implicaciones operativas de un cálculo correcto

- La **I nominal** fija el ajuste de sobrecorriente (51) y la referencia de cargabilidad
  (`../gestion-vida-activo`).
- La **I de fase** es la referencia de la resistencia de devanados y de las fuerzas de
  cortocircuito (∝ I²) → `../construccion-nucleo-devanados`.
- La **potencia por etapa** define cuánta carga real admite el equipo con cada nivel de
  refrigeración → `../sistema-refrigeracion`.

## B) Qué cambia con el tipo (cruce con tipificación)

| Tipo | Cálculo nominal |
|---|---|
| Bidevanado | una S, dos corrientes (AT/BT) |
| Tridevanado | **una S por devanado** (pueden diferir); tres corrientes |
| Auto | distinguir S **nominal de placa** vs S **equivalente/"built"** del serie/común (menor) |

> Tipificar primero (`../identificacion-tipo-transformador`): aplicar una sola S a un tridevanado
> con devanados de distinta carga es error de modelado.

## C) Errores típicos (y cómo se manifiestan)

1. **Mezclar fase y línea** → corriente o tensión √3 veces mayor/menor de lo real. Síntoma: la I
   no cuadra con `S/(√3·V)`. **Fix:** `02 §A/§B`, separar `I_L` de `I_fase` por conexión.
2. **Usar el MVA de la etapa equivocada** → corriente nominal sobre/subestimada. Síntoma: ajuste 51
   mal calibrado. **Fix:** `02 §C`, tomar el S de la etapa de enfriamiento activa.
3. **Asumir que subir de etapa da MVA libre** → sobrecarga real. **Fix:** `01 §B` (etapa ≠ diseño).
4. **Olvidar el factor √3 del grupo en la relación** → relación calculada no cuadra con placa.
   **Fix:** `02 §D` + `../grupo-vectorial-conexiones`.
5. **Tomar la I de placa como dato independiente** → no se detecta el error de transcripción.
   **Fix:** recalcular siempre `I = S/(√3·V)` y comparar (`03 §B`).
6. **Aplicar una sola S a un tridevanado** → flujo de potencia incoherente. **Fix:** S por devanado (§B).

## D) Señales de alarma

- La corriente de placa no reproduce con `S/(√3·V)` → error de placa o de conexión leída.
- La relación de línea no cuadra con ningún factor √3 del grupo → grupo mal interpretado.
- Densidad de flujo despejada > ~1.7 T → riesgo de saturación / sobreexcitación (revisar V/Hz).

## E) Cierre — de los nominales a la acción

```
NOMINALES confirmados (S/V/I por devanado y etapa)
   ├─ alimentan ajuste de sobrecorriente y cargabilidad ........ ../gestion-vida-activo
   ├─ fijan la I de fase para resistencia y fuerzas de CC ...... ../construccion-nucleo-devanados
   ├─ la S por etapa define la carga admisible ................. ../sistema-refrigeracion
   └─ la relación valida el grupo/tipo ........................ ../grupo-vectorial-conexiones
```

> Lo no confirmable (% de etapa, tolerancia por edición, temperatura de referencia) queda
> `⚠️ verificar` y se consolida para el director.
