# 02 · Cálculos — los cruces de coherencia que la placa debe cumplir

> Una placa válida cierra internamente. Aquí están las igualdades que SIEMPRE deben verificarse.
> Detalle de cada cálculo en las skills `../calculos-nominales` e `../impedancia-cortocircuito`.

## A) Coherencia potencia–tensión–corriente

```
S_3φ = √3 · V_L · I_L     debe cumplirse para CADA devanado (con la S de su etapa)
```

- Recalcular `I_L = S/(√3·V_L)` y comparar con la I de placa. Deben coincidir (la I es **derivada**).
- En tridevanado: cada devanado lleva **su** S de carga; la suma de cargas simultáneas no excede la
  S del devanado común/AT (`../impedancia-cortocircuito`).

## B) Coherencia relación–grupo (factor √3)

```
relación de línea de placa = V_L,AT / V_L,BT  ≟  a · k√3
   Yy/Dd → k√3=1   Dy → k√3=1/√3   Yd → k√3=√3
```

Si el grupo es **Dy** pero la relación de placa reproduce como **Yy** (sin √3), el grupo o la
lectura están mal (`../grupo-vectorial-conexiones 03 §C`).

## C) Coherencia de etapas de enfriamiento

- Las S de las etapas deben ser **crecientes** (ONAN < ONAF < OFAF/ODAF) y la placa debe nombrar el
  modo de cada una. Cada etapa → su `I_L = S_etapa/(√3·V_L)` (`../calculos-nominales 02 §C`).

## D) Coherencia de masas

```
masa total ≈ masa del núcleo+devanados (active part) + masa de aceite + masa del tanque/accesorios
```

- La **masa de aceite** debe ser consistente con el volumen del tanque/radiadores; sirve para
  estimar contenido de agua en ppm y para logística de manejo (`../gestion-vida-activo`).

## E) Coherencia de impedancia y su base

- El `%Z` de placa trae (o implica) una **base de MVA**. En tridevanado, cada Z de par puede tener
  base distinta → no combinar sin convertir (`../impedancia-cortocircuito 03 §A`).

> Cualquier cruce que NO cierre es un **hallazgo de auditoría** (`04`), no un número a "ajustar a
> mano". Documentar la incoherencia y marcar `⚠️ verificar`.
