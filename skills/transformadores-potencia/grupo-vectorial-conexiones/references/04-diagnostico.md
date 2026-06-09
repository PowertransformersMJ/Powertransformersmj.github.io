# 04 · Diagnóstico — qué implica el grupo (paralelo, protección, errores)

> El grupo no es una etiqueta decorativa: decide si dos unidades van en **paralelo**, cómo se
> **compensa el desfase** en la protección diferencial, y es fuente de **errores de relación**.
> Cierra el arco `01→02→03→04`. Cruce con ensayos en `../../pruebas-electricas/`.

## A) Operación en PARALELO — las 4 condiciones (y qué pasa si fallan)

Para conectar dos transformadores en paralelo deben cumplirse **las cuatro**:

| # | Condición | Si NO se cumple |
|---|---|---|
| 1 | **Mismo desfase** (mismo índice horario, o grupos compatibles del mismo "color") | corriente circulante **enorme** entre fases desfasadas → daño inmediato |
| 2 | **Misma relación de transformación** (misma tensión nominal y tap) | corriente circulante por diferencia de tensión, aun en vacío |
| 3 | **Mismo %Z** (dentro de tolerancia) | reparto de carga **desigual** ∝ 1/Z → uno se sobrecarga antes |
| 4 | **Misma polaridad y secuencia de fases** | cortocircuito al cerrar |

**Compatibilidad de desfase (regla de los grupos):** solo van en paralelo los del **mismo índice**
o grupos que se pueden igualar **recableando bornes** sin cambiar el índice resultante. Los grupos
se agrupan por "familias" según el índice (0, 6 / 1, 11 / 5, 7…). Mezclar índice 1 con índice 11
(30° de diferencia) → **no** sin recableo que los lleve al mismo ángulo.

> Reparto de carga (condición 3): `S_i / S_total ≈ (S_nom,i / Z%_i) / Σ(S_nom/Z%)`. Dos unidades de
> igual MVA pero %Z distinto **no** comparten carga a partes iguales. → `calculos-nominales` /
> `impedancia-cortocircuito`.

## B) Protección diferencial — compensación del desfase

La protección diferencial (87T) resta la corriente que entra y la que sale; si AT y BT están
desfasados 30° (Δ-Y), las corrientes **no casan en fase** y aparecería una diferencia falsa.

| Era | Cómo se compensaba |
|---|---|
| Relés electromecánicos | **conexión cruzada de los TC**: TC en Δ del lado en Y y viceversa, para girar 30° y cancelar el desfase |
| Relés numéricos (hoy) | **compensación por software**: se programa el grupo (índice) y el relé gira matemáticamente las corrientes + filtra secuencia cero |

> ⚠️ Programar mal el índice en el relé numérico = diferencial que **opera en falso** (disparos
> espurios) o que **no opera** ante falla real. El grupo de la ficha (`SKILL.md`) es dato de entrada
> directo del ajuste 87T. La eliminación de secuencia cero también depende del grupo (delta filtra).

## C) Errores típicos (y cómo se manifiestan)

1. **Confundir el signo ANSI vs IEC** → se asume Dyn11 cuando es Dyn1 (o al revés). Síntoma: el
   diferencial dispara en falso tras un cambio de relé. **Fix:** `03 §B` (AT-vs-BT ANSI ≠ BT-vs-AT IEC).
2. **Olvidar el factor √3 al validar la relación** → la relación calculada no cuadra con placa.
   **Fix:** aplicar el factor del par (`02 §B`); revisar Y/Δ de cada lado.
3. **Poner en paralelo grupos de distinto índice** → corriente circulante / disparo al cerrar.
   **Fix:** verificar las 4 condiciones (§A) ANTES de cerrar el interruptor.
4. **Leer un índice imposible** (`Yy3`, `Dy0`) → etiqueta mal transcrita. **Fix:** chequeo de
   paridad (`01 §C` / `03 §A`): par↔conexiones iguales, impar↔distintas.
5. **Ignorar un `d` terciario en el grupo** (`YNyn0d`) → se trata como Y-Y puro y se calcula mal la
   `Z0`. **Fix:** el `d` es un delta (estabilización o carga) → cruza con `../identificacion-tipo-transformador`.
6. **Asumir el desfase estándar sin leer placa** → riesgo en flota mixta. **Fix:** `⚠️ verificar`
   Dyn1 vs Dyn11 contra placas reales (`03 §F`).

## D) Señales de alarma que obligan a re-verificar el grupo

- Diferencial 87T que dispara sin falla tras cambiar/parametrizar un relé → índice mal programado.
- Corriente circulante / calentamiento al paralelar dos unidades "iguales" → desfase, relación o
  %Z distintos (§A).
- Relación de placa que no reproduce con ningún factor √3 del grupo leído → grupo mal interpretado
  (`02 §B`, `03 §C`).
- Polaridad medida incoherente con el índice de placa → recableado de bornes o marcado erróneo.

## E) Cierre — del grupo a la acción

```
GRUPO confirmado (SKILL.md)
   ├─ define el factor √3 de la relación de línea ............. 02 §B → calculos-nominales
   ├─ define la compatibilidad de PARALELO ................... §A → impedancia-cortocircuito
   ├─ define la compensación del diferencial 87T ............. §B
   ├─ delata terciario delta (`…d`) → tipificación .......... ../identificacion-tipo-transformador
   └─ divergencias ANSI/IEC se consolidan al de mayor precedencia .. 03 §E
```

> Lo no confirmable contra placa/norma del director queda `⚠️ verificar` (desfase estándar de
> flota, marcado de bornes, polaridad adoptada) y se consolida para revisión.
