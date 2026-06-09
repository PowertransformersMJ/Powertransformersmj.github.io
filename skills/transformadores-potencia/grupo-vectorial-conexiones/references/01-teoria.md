# 01 · Teoría — conexiones, desfase y el código del grupo vectorial

> Base: IEEE C57.12.70 (designación de terminales y desfase), IEC 60076-1 (notación de grupo).
> Backbone común en `../../_conocimiento/00-fundamentos-transformador.md`. Factor √3 y por-unidad
> en `../../_conocimiento/convenciones-calculo.md`.

## A) Las tres conexiones trifásicas básicas

| Conexión | Descripción | `V_L` vs `V_fase` | `I_L` vs `I_fase` | Neutro |
|---|---|---|---|---|
| **Estrella (Y / wye)** | un extremo de cada fase a un punto común (neutro) | `V_L = √3·V_fase` | `I_L = I_fase` | **sí** (puede salir a borne y aterrizarse) |
| **Delta (Δ / D)** | las tres fases en lazo cerrado | `V_L = V_fase` | `I_L = √3·I_fase` | no (camino para 3.er armónico / sec. cero) |
| **Zigzag (Z)** | cada fase partida en dos mitades en columnas distintas | mixta | mixta | **sí**, con baja `Z0` sin necesidad de delta |

> El **zigzag** se usa sobre todo en devanados de puesta a tierra / neutros artificiales: ofrece
> una `Z0` baja (camino para secuencia cero) **sin** un delta. Aparece como `z`/`Z` en el grupo.

## B) Qué codifica la etiqueta de grupo (notación IEC 60076-1)

Ejemplo `YNd1`, leído de izquierda a derecha:

```
Y   → devanado de MAYOR tensión (AT) en ESTRELLA        (MAYÚSCULA = AT)
N   → neutro del lado AT ACCESIBLE a borne              (N mayúscula = neutro de AT)
d   → devanado de MENOR tensión (BT) en DELTA           (minúscula = BT/MT)
1   → ÍNDICE HORARIO = 1 → BT atrasa 30° respecto a AT  (número = reloj × 30°)
```

- **Mayúscula** = devanado de mayor tensión; **minúscula** = el(los) de menor tensión.
- `N`/`n` = el **neutro de ese devanado sale a borne** (sin la letra, el neutro no es accesible).
- **Tridevanado**: tres símbolos, p.ej. `YNyn0d11` (AT estrella+neutro / MT estrella+neutro a 0° /
  terciario delta a 11). El último `d` sin pareja de carga suele ser **estabilización** (cruza con
  `../identificacion-tipo-transformador`).
- **Zigzag** se nota `z`/`ZN` (p.ej. `Dzn0`, `YNzn`).

## C) Índice horario — el reloj del desfase

El desfase angular entre AT y BT se expresa como la **posición de la aguja del reloj** que ocupa
el fasor de BT cuando el de AT apunta a las **12** (cada hora = 30°):

```
índice 0  → BT a las 12 →   0°  → AT y BT EN FASE        (Yy0, Dd0, Dz0)
índice 1  → BT a la 1   → −30°  → BT ATRASA 30°          (Yd1, Dy1, YNd1)
índice 5  → BT a las 5  → −150°
índice 6  → BT a las 6  → 180°  → OPOSICIÓN              (Yy6, Dd6)
índice 7  → BT a las 7  → +150° (equivale a −210°)
índice 11 → BT a las 11 → +30°  → BT ADELANTA 30°        (Yd11, Dy11) ← preferido IEC
```

> Convención (IEC 60076-1): el ángulo se mide **del fasor de BT respecto al de AT**, en sentido
> horario = atraso. Un índice par solo aparece con conexiones del **mismo tipo** (Yy/Dd: 0,2,4,6,8,10);
> uno impar exige **tipos distintos** (Yd/Dy: 1,3,5,7,9,11). Es un chequeo de coherencia: `Yd0` o
> `Dy6` son imposibles → etiqueta mal leída.

## D) Por qué existe el desfase (no es un capricho)

Combinar Y y Δ introduce un corrimiento de 30° **inevitable** entre las tensiones de línea de
ambos lados (la tensión de línea de la estrella va "entre fases" mientras la del delta va "sobre
fase"). Ese desfase:

1. **se acumula** al encadenar transformadores → hay que llevar la cuenta para no descoordinar la red;
2. **condiciona el paralelo**: dos unidades solo van en paralelo si su BT queda en el mismo ángulo
   (mismo índice, o grupos compatibles) → `04 §A`;
3. **se compensa en la protección diferencial** para que las corrientes de ambos lados "casen" en
   fase antes de restarlas → `04 §B`.

## E) Polaridad (concepto ANSI ligado al desfase)

- **Polaridad sustractiva**: bornes de igual marca (H1–X1) adyacentes; las tensiones se restan al
  puentearlos. Estándar ANSI para la mayoría de potencia.
- **Polaridad aditiva**: bornes cruzados; tensiones se suman. Típica solo en distribución pequeña.
- La polaridad es la versión "de un par de bobinas" del desfase de grupo; se verifica en el ensayo
  de relación/polaridad (`../../pruebas-electricas/relacion-transformacion`).

→ Cómo se traduce a números (grados, √3, polaridad): `02-calculos.md`. Cómo se lee de la placa y
se mapea ANSI↔IEC: `03-criterios-evaluacion.md`.
