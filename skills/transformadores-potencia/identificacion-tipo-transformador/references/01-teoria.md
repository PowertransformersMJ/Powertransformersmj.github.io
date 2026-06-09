# 01 · Teoría — los cuatro tipos y por qué importan

> Base: ABB Service Handbook §1 (construcción) y §3 (modelo de capacitancias/excitación para
> diagnóstico); IEEE C57.158 (terciarios); IEC 60076-1/-8. Backbone común en
> `../../_conocimiento/00-fundamentos-transformador.md`.

## A) Bidevanado simple (AT + BT)

Dos devanados galvánicamente **aislados** por fase, acoplados solo magnéticamente. Toda la
potencia S pasa de AT a BT por inducción. Es el caso canónico:

- **Una** potencia nominal por etapa de enfriamiento.
- **Una** impedancia de cortocircuito `Z_HL`.
- Grupo de **dos** símbolos (p.ej. `Dyn11`, `YNyn0`).
- Bornes AT (H1-H2-H3, neutro H0) y BT (X1-X2-X3, neutro X0) — nomenclatura ANSI.

## B) Bidevanado con devanado de COMPENSACIÓN / ESTABILIZACIÓN (delta terciario)

Circuito principal **Y-Y (YNyn)** + un **tercer devanado en delta (Δ)** que **no alimenta
carga externa**: su función es electromagnética. Es el caso que más se confunde con el
tridevanado real.

**Por qué se añade el delta de estabilización** (IEEE C57.158):

1. **Supresión del 3.er armónico.** El delta ofrece un lazo cerrado donde circulan las
   corrientes de 3.er armónico (y múltiplos de 3 = secuencia cero), manteniendo el flujo más
   senoidal y reduciendo las tensiones de 3.er armónico.
2. **Estabilización del neutro / reducción de `Z0`.** Permite circular corrientes de secuencia
   cero → **baja fuertemente la impedancia de secuencia cero** del banco Y-Y. Esto (a) limita
   el desplazamiento del neutro y el desbalance de tensión bajo carga desequilibrada, y (b)
   **habilita corriente de falla a tierra** suficiente para las protecciones (50N/51N).
3. **Servicios auxiliares** (solo si el terciario es accesible): puede alimentar SSAA o reactores.

**Accesible vs ENTERRADO (buried delta):** si el delta solo sirve para acomodar armónicos,
**no necesita terminales fuera del tanque** (IEEE C57.158) → en placa aparece como nota
("stabilizing winding" / "buried delta" / "Δ embedded") y **sin** MVA de carga. Si es
accesible, sí tiene bornes (Y1-Y2-Y3) y tensión nominal.

> **Criterio discriminante clave:** un tercer devanado **sin bornes accesibles** o **sin MVA de
> carga** asignado = **estabilización**, NO tridevanado. El rating del delta de estabilización se
> dimensiona por la potencia aparente de armónicos/desbalance que circula, no por carga útil
> (porcentaje exacto → `⚠️ verificar` IEEE C57.158 / paper "Tertiary Stabilizing Windings Part I").

**Por qué un terciario buried es "invisible" a la prueba de factor de potencia (ABB Service
Handbook §3, modelo de 6 capacitancias):** un tridevanado se modela con **6 capacitancias** — 3
a tierra (`C_H`, `C_L`, `C_T`) y 3 entre devanados (`C_HL`, `C_LT`, `C_HT`). La prueba de FP/tan δ
solo puede **energizar y aislar** el terciario `C_T`/`C_LT`/`C_HT` **si tiene bornes accesibles**.
Si el delta es **buried**, no hay terminal donde conectar → el terciario **no aparece** en el set
de medidas de FP, aunque exista. Corolario diagnóstico: la ausencia del terciario en el plan de FP
**no prueba** que no exista; cruzar con `Z0` y excitación (`03 §E`). Detalle de la prueba de FP →
`../../pruebas-electricas/` (lóbulo 49).

## C) Tridevanado de carga real (AT / MT / BT)

Tres devanados aislados, **los tres con carga útil real** (p.ej. 230 / 115 / 34.5 kV). Se modela
como tres transformadores de dos devanados acoplados.

- **Tres** potencias nominales, una por devanado (pueden diferir).
- **Tres** juegos de bornes accesibles, cada uno con tensión y corriente nominal.
- **Tres** impedancias de par `Z_HM, Z_HL, Z_ML` (no una sola).
- Grupo de **tres** símbolos (p.ej. `YNyn0d11`).

**Regla discriminante:** tercer devanado **con MVA de carga + bornes accesibles** = tridevanado
real; **sin** ello = terciario de estabilización (caso B).

## D) Autotransformador

AT y BT **comparten** parte del devanado (serie + común) → **no** hay aislamiento pleno AT-BT.
Solo se transforma por inducción una fracción de la potencia; el resto pasa **conductivamente**
(ventaja: menor tamaño/costo por MVA "transmitida").

- En placa: nota **`auto`** o símbolo `a` en el grupo (p.ej. `YNa0d1`).
- Distinción de potencias: **nominal de placa** vs **potencia equivalente/"built"**
  `S_eq = V·I` del devanado serie/común (esta última, menor).
- Los autos de transmisión suelen llevar **terciario delta** (a menudo enterrado): cambia el
  modelo de secuencia cero → revisar siempre.

## E) Tabla de discriminación práctica

| Señal | Bidevanado | Bi + estabilización | Tridevanado | Autotransformador |
|---|---|---|---|---|
| Nº MVA de carga | 1 | 1 (terciario sin MVA) | 3 | 1–2 (+terciario) |
| Nº bornes de línea | 2 | 2 (terciario sin bornes a menudo) | 3 | AT/BT compartidos +terciario |
| Nº de %Z | 1 (Z_HL) | 1 (+ Z0 baja) | 3 (Z_HM,Z_HL,Z_ML) | depende; +terciario |
| Símbolo de grupo | 2 símbolos | `YNyn0(d)` / "stabilizing" | 3 símbolos | contiene `a`/`auto` |
| Aislamiento AT-BT | pleno | pleno | pleno | **parcial (galvánico)** |

→ Cómo cambia cada cálculo: `02-calculos.md`. Cómo discriminar paso a paso desde la placa:
`03-criterios-evaluacion.md`.
