# 03 · Criterios de evaluación — cómo discriminar el tipo (multi-norma)

> Discriminar el tipo es leer **3 señales de placa** y cruzarlas. Norma: IEEE C57.12.00 (placa),
> C57.12.70 (terminales/desfase), C57.158 (terciarios); IEC 60076-1. Filosofía multi-norma y
> precedencia en `../../_conocimiento/marco-normativo-tx.md`.

## A) Las tres señales de placa (en orden de fuerza)

1. **Potencias de carga (MVA).** ¿Cuántos devanados tienen MVA propio asignado?
   - 1 → bidevanado (o bi+estabilización si hay un delta extra sin MVA).
   - 3 → tridevanado.
2. **Bornes de línea accesibles.** ¿2 (AT/BT) o 3 (AT/MT/BT)? ¿El tercer devanado saca bornes?
   - Tercer devanado **sin bornes** → estabilización (buried).
3. **Símbolo de grupo de conexión.** Nº de letras y presencia de notas:
   - 2 símbolos (`Dyn11`) → bidevanado.
   - 3 símbolos (`YNyn0d11`) → hay tercer devanado (estabilización o carga — desempata la señal 1).
   - Nota `auto` / símbolo `a` → autotransformador.
   - Texto "stabilizing winding" / "buried delta" → estabilización.

## B) Matriz de discriminación

| MVA de carga | Bornes | Símbolo / nota | → TIPO |
|---|---|---|---|
| 1 | 2 | 2 símbolos (Dyn/YNyn/…) | **Bidevanado** |
| 1 | 2 (terciario sin bornes) | 3 símbolos / "stabilizing"/"buried" | **Bi + estabilización** |
| 3 | 3 | 3 símbolos, los 3 con tensión+MVA | **Tridevanado** |
| 1–2 + terciario | AT/BT compartidos | `a`/`auto` (+ a menudo `d` terciario) | **Autotransformador** |

## C) Caso ambiguo decisivo: estabilización vs tercer devanado de carga

Cuando hay 3 símbolos en el grupo pero no es obvio si el tercero es carga o estabilización:

```
¿El tercer devanado tiene MVA de CARGA en placa?       ── no ─→ ESTABILIZACIÓN
   │ sí                                                         (delta terciario)
   ▼
¿Tiene bornes de línea accesibles?  ── no ─→ ESTABILIZACIÓN (aunque liste tensión)
   │ sí
   ▼
TRIDEVANADO de carga real
```

> El discriminador definitivo es la **línea de placa del terciario**: tensión **+ MVA de carga +
> bornes** = carga real; "stabilizing/buried" o sin MVA = estabilización.

## D) Evaluación MULTI-NORMA (registrar divergencias)

Emite la clasificación contra cada óptica disponible y consolida:

```
vs PLACA de la unidad (precedencia 1)        → tipo = ___   (la verdad del equipo)
vs criterio interno MO.00418 (precedencia 2) → ___          ⚠️ verificar con el director
vs IEEE C57.158 / C57.12.00 (precedencia 3)  → ___
vs IEC 60076-1 (notación de grupo)           → ___
CONSOLIDADO = el de mayor precedencia disponible.
  ⊳ Divergencia típica: placa antigua sin nota de "stabilizing" pero con Z0 medida muy baja
    → el ensayo revela el delta que la placa no documenta (gana la evidencia, §04).
```

## E) Verificación cruzada por cálculo (sanity check)

- La **relación de placa** debe reproducirse con el factor √3 del grupo supuesto (`02 §B`). Si
  no, el tipo/grupo está mal leído.
- En un Y-Y, una **`Z0` medida muy por debajo** de la de secuencia positiva delata un **camino de
  baja reluctancia para el flujo homopolar** → reclasificar **tras descartar el origen** (ver §E.1).

### E.1) Cuidado: `Z0` baja NO es prueba exclusiva de delta oculto (ABB Service Handbook, p.17)

Dos causas distintas **bajan `Z0`** y se confunden:

| Causa de `Z0` baja | Cómo confirmarla / descartarla |
|---|---|
| **Delta de estabilización (terciario buried)** | el grupo lista un 3.er símbolo `…d`; corriente de excitación con **lazo cerrado** (patrón de delta, §E.2); a veces nota "stabilizing" |
| **Núcleo de 5 columnas (5-limb)** | la placa/diseño indica 5 columnas; el flujo homopolar retorna por las columnas laterales **sin** delta. ABB lo usa **a propósito cuando se requiere `Z0` ≈ `Z+`** |

> ⚠️ Reclasificar a "bi + estabilización" SOLO por `Z0` baja, sin descartar un **5-limb**, es un
> falso positivo. Cruzar con: construcción del núcleo (placa) + patrón de excitación (§E.2) +
> presencia del 3.er símbolo en el grupo. La evidencia del ensayo gana a la placa muda, pero
> primero hay que **leer bien la evidencia**.

### E.2) Discriminación por corriente de excitación (ABB Tabla 3-32) — chequeo de campo

El **patrón trifásico** de corriente de excitación (sin carga) discrimina construcción y conexión
SIN abrir el equipo — útil cuando la placa es ilegible o sospechosa:

| Patrón de las 3 fases | Construcción / conexión probable |
|---|---|
| **2 altas + 1 baja** (la central) | núcleo de **3 columnas** en Y (camino magnético central más corto) |
| **3 fases similares** | núcleo de **5 columnas** o banco de 3 monofásicos |
| **2 iguales > 1 distinta** | presencia de **devanado en delta** cerrando lazo |

> No sustituye a la placa: es un **chequeo independiente** que confirma o contradice lo leído.
> Si el patrón dice "delta" y la placa no lo nota → señal fuerte de terciario/estabilización
> oculto (cruzar con `Z0`, §E.1).

## F) Valores `⚠️ verificar` (consolidar para el director)

- Rating aparente del delta de estabilización (buried) — IEEE C57.158 + paper Part I.
- Tolerancias: relación ±0.5 %, Z ±7.5 % (2 dev.) / ±10 % (3+ dev./auto) — IEEE C57.12.00 edición.
- Base de MVA exacta de cada `Z` de par — IEEE C57.12.90 / reporte de fábrica.
- Mapeo de desfase ANSI ↔ índice horario IEC — IEEE C57.12.70.
- Criterios por **clase de tensión** del interno MO.00418 (cuando el director los entregue).

→ Qué hacer con la clasificación (implicaciones, protección, errores): `04-diagnostico.md`.
