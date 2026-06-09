# 02 · Cálculos — base común, estrella equivalente, secuencia cero, I_cc

> Reglas en `../../_conocimiento/convenciones-calculo.md §C` (por-unidad y base común). **Convertir
> SIEMPRE a base común ANTES de combinar.** Reportar fórmula + entradas + resultado.

## A) Conversión a BASE COMÚN (paso obligatorio)

```
Z_pu,new = Z_pu,old · (S_base,new / S_base,old) · (V_base,old / V_base,new)²
```

- Elegir UNA `S_base` común (típico: MVA del devanado AT) y UN lado de tensión.
- Si todo se refiere al mismo lado de tensión, el término `(V_old/V_new)² = 1` → solo escala por
  potencia: `Z_new = Z_old · (S_new/S_old)`.
- `Z(%) = Z_pu · 100`.

Ejemplo: `Z_ML = 6 %` en base 40 MVA → a base 100 MVA: `6 % · (100/40) = 15 %`.

## B) Tridevanado → estrella equivalente (3 ramas)

Con las tres impedancias de par **ya en base común**:

```
Z1 = ½ · (Z_HM + Z_HL − Z_ML)     rama AT
Z2 = ½ · (Z_HM + Z_ML − Z_HL)     rama MT
Z3 = ½ · (Z_HL + Z_ML − Z_HM)     rama BT
```

> ⚠️ Una rama **negativa es normal** (suele ser la del devanado intermedio/MT); refleja el
> acoplamiento, no un error. Solo alarma una rama **fuertemente** negativa y fuera de rango físico →
> revisar que las bases de MVA estaban bien (`04 §D`).

Verificación: las impedancias de par se reconstruyen como `Z_HM = Z1+Z2`, `Z_HL = Z1+Z3`,
`Z_ML = Z2+Z3` (sumas de las ramas del camino).

## C) Corriente de cortocircuito disponible

Cortocircuito trifásico en bornes (fuente "infinita", caso conservador):

```
I_cc ≈ I_nominal / Z_pu        (en pu de la base de la I_nominal)
I_cc(kA) ≈ S_base / (√3 · V_L · Z_pu)
```

Ejemplo `S=100 MVA`, `V_L=115 kV`, `Z=10 %` → `I_nom=502 A`; `I_cc ≈ 502/0.10 = 5.0 kA`.

> Si la fuente NO es infinita, sumar la impedancia del sistema (Thévenin) en serie antes de dividir.
> Para falla a tierra usar el modelo de secuencia (positiva+negativa+cero), §D.

## D) Secuencia cero (Z0) y falla a tierra

- `Z0` se obtiene de un **ensayo de secuencia cero** (energizar las 3 fases en paralelo contra
  neutro). Depende de conexión + aterrizamiento + delta.
- Corriente de falla monofásica a tierra (simplificada):
  `I_falla_1φ = 3·V_fase / (Z1 + Z2 + Z0)` (con Z1≈Z2 la positiva/negativa).
- Delta o 5-limb → `Z0` baja → **sube** la corriente de falla a tierra → habilita 50N/51N.

## E) Reparto de carga en paralelo

```
S_i / S_total ≈ (S_nom,i / Z%_i) / Σ(S_nom/Z%)
```

Ejemplo: dos unidades 100 MVA, `Z_A=8 %`, `Z_B=10 %` → A toma `(100/8)/((100/8)+(100/10)) = 55.6 %`,
B toma 44.4 %. **A igual MVA, la de menor Z se sobrecarga primero** (`04 §A`).
