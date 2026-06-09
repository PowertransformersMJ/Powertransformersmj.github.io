# 03 · Criterios de evaluación — leer la placa y mapear ANSI ↔ IEC

> Norma: IEEE C57.12.70 (terminales/desfase ANSI), IEC 60076-1 (notación de grupo). Filosofía
> multi-norma y precedencia en `../../_conocimiento/marco-normativo-tx.md`. **Nunca inventar** el
> desfase estándar de la flota → `⚠️ verificar` con el director.

## A) Leer la etiqueta de grupo paso a paso

```
Y N y n 0 d 11      (ejemplo tridevanado)
│ │ │ │ │ │ └─ índice horario del 3.er devanado (terciario delta a +30°)
│ │ │ │ │ └─── 3.er devanado en DELTA (minúscula)
│ │ │ │ └───── índice horario del par AT-MT = 0 (en fase)
│ │ │ └─────── neutro del 2.º devanado (MT) accesible
│ │ └───────── 2.º devanado (MT) en estrella
│ └─────────── neutro del 1.er devanado (AT) accesible
└───────────── 1.er devanado (AT) en estrella
```

Reglas de lectura:
- Cuenta los **bloques letra(+n)(+índice)**: 2 bloques = bidevanado; 3 = tridevanado o
  bi+estabilización (desempata `../identificacion-tipo-transformador`).
- `N`/`n` presente → ese neutro **sale a borne** (relevante para aterrizamiento y `Z0`).
- **Chequeo de paridad** (`01 §C`): índice impar exige conexiones distintas (Y con Δ); índice par,
  iguales. `Yd0`, `Dy6`, `Yy3` son **imposibles** → relee.

## B) Mapeo ANSI ↔ IEC (la divergencia que más confunde)

| Concepto | IEC 60076-1 | ANSI/IEEE C57.12.70 |
|---|---|---|
| Notación | grupo + **índice horario** (Dyn11) | conexión + **ángulo** y marcado H/X |
| Referencia de fase | BT respecto a AT (horario=atraso) | tradicionalmente **AT respecto a BT** |
| Desfase estándar Δ-Y | **Dyn11** (BT adelanta 30°) | "high side leads low side by 30°" |

> ⚠️ **Trampa de signo**: IEC mide BT-vs-AT; la práctica ANSI suele enunciar AT-vs-BT. "AT
> adelanta 30° a BT" (ANSI) ≡ "BT atrasa 30°" ≡ **índice 1** (Dyn1). El **estándar ANSI clásico**
> para Δ-Y es **AT adelanta a BT** → revisar si la flota AFINIA está en **Dyn1** o **Dyn11**
> (`⚠️ verificar` con placas / MO.00418; no asumir). Ambos existen en campo.

## C) Verificación cruzada por la relación (sanity check)

- La **relación de línea de placa** debe reproducirse con el factor √3 del grupo leído (`02 §B`).
  Si `Dy` no da `a/√3`, el grupo o la lectura están mal.
- El **índice** debe ser coherente con las conexiones (paridad, §A) y con la **polaridad** medida
  (`02 §D`). Tres señales que deben concordar: conexiones, índice y polaridad.

## D) Grupos comunes en potencia (referencia de campo)

| Grupo | Uso típico | Notas |
|---|---|---|
| **Dyn1 / Dyn11** | distribución AT→BT (subestación) | delta AT, estrella BT con neutro aterrizable; `Z0` buena en BT |
| **YNd1 / YNd11** | transmisión/subtransmisión | estrella AT con neutro, delta BT (delta da camino a `Z0` de AT) |
| **YNyn0** | AT↔MT misma fase | sin delta → `Z0` alta; a menudo lleva **terciario delta** de estabilización (`YNyn0d`) |
| **Dd0** | enlaces sin neutro | ambos delta, en fase |
| **YNyn0d11** | tridevanado / auto con terciario | el `d` final = terciario delta (carga o estabilización) |
| **Dzn / YNzn** | puesta a tierra / neutro artificial | zigzag para `Z0` baja sin delta |

## E) Evaluación MULTI-NORMA (registrar divergencias)

```
vs PLACA de la unidad (precedencia 1)        → grupo = ___   (la verdad del equipo)
vs interno MO.00418 / estándar de flota      → ___          ⚠️ verificar con el director
vs IEEE C57.12.70 (ANSI, ángulo + marcado)   → ___
vs IEC 60076-1 (índice horario)              → ___
CONSOLIDADO = el de mayor precedencia disponible; mostrar divergencias ANSI/IEC de signo.
```

## F) Valores `⚠️ verificar` (consolidar para el director)

- Desfase **estándar de la flota AFINIA** para Δ-Y: ¿Dyn1 o Dyn11? (placas / MO.00418).
- Convención de marcado de bornes vigente (H/X ANSI vs 1U/1V/1W IEC) en los equipos reales.
- Polaridad estándar adoptada (sustractiva esperada en potencia) — confirmar en reportes.

→ Qué implica el grupo (paralelo, protección, errores): `04-diagnostico.md`.
