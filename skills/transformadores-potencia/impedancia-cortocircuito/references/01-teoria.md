# 01 · Teoría — impedancia de dispersión, %Z y el modelo de tridevanado

> Base: IEEE C57.12.90 (ensayo de impedancia), C57.12.00 (tolerancias), IEC 60076-8 (guía de
> aplicación, tridevanado). Símbolos y por-unidad en `../../_conocimiento/convenciones-calculo.md`.

## A) Qué es la impedancia de cortocircuito

Es la impedancia vista entre dos devanados cuando uno se **cortocircuita** y el otro se energiza
hasta hacer circular la corriente nominal. Es esencialmente la **reactancia de dispersión** (el
flujo que no se acopla entre devanados) más una pequeña resistencia.

```
%Z = (V_cc / V_nominal) · 100      V_cc = tensión que hace circular I_nominal con el otro lado en corto
```

- `%Z` típico: 4–15 % en potencia (sube con la tensión y el tamaño). `⚠️ verificar` por unidad.
- **Alta %Z** → limita la corriente de cortocircuito (bueno para los esfuerzos) pero **más caída de
  tensión** bajo carga (malo para regulación). Es un compromiso de diseño.

## B) %Z y por qué importa

| Gobierna | Cómo |
|---|---|
| **Corriente de cortocircuito** | `I_cc ≈ I_nom / Z_pu` → menor Z, mayor corriente de falla |
| **Caída de tensión** | la regulación bajo carga ∝ %Z·(factor de potencia) |
| **Reparto de carga en paralelo** | inverso a Z% → la unidad de menor Z toma más carga (`04 §A`) |
| **Esfuerzos mecánicos** | fuerzas ∝ I² → menor Z = mayores fuerzas de cortocircuito |

## C) Tridevanado: tres impedancias de par, no una

Un tridevanado se caracteriza por **tres** impedancias medidas entre pares de devanados, **cada una
en la base de MVA de su par**:

```
Z_HM = impedancia AT–MT   (con BT abierto)
Z_HL = impedancia AT–BT   (con MT abierto)
Z_ML = impedancia MT–BT   (con AT abierto)
```

Para usarlas en flujo de carga / cortocircuito se convierten en un **modelo de estrella equivalente
de 3 ramas** (`Z1, Z2, Z3`) con un nudo central ficticio (`02 §B`). Es un artificio de cálculo: las
ramas no son físicas y **una puede salir negativa** — eso es **normal** (no es un error).

## D) Impedancia de secuencia cero (Z0)

`Z0` gobierna la corriente de **falla a tierra**. Depende de las conexiones, del aterrizamiento del
neutro y de la presencia de un **delta** (estabilización o terciario):

- **Y-Y sin delta**: `Z0` alta → poca corriente de falla a tierra → 50N/51N pueden no arrancar.
- **Con delta** (estabilización/terciario) o **núcleo de 5 columnas**: `Z0` baja → más corriente de
  falla a tierra (`../identificacion-tipo-transformador 03 §E`).

> El delta da un lazo para las corrientes de secuencia cero (múltiplos de 3); por eso "baja" la `Z0`
> del conjunto. Confirmar la causa (delta vs 5-limb) antes de concluir tipo.

→ Cómo se calcula todo paso a paso: `02-calculos.md`. Tolerancias y bases: `03-criterios-evaluacion.md`.
