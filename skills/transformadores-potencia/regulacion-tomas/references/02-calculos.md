# 02 · Cálculos — tensión, relación y %Z por toma

> Reglas en `../../_conocimiento/convenciones-calculo.md`. **Nunca inventar** la tabla de tomas →
> leerla de placa o marcar `⚠️ verificar`.

## A) Tensión por toma

```
V_toma(n) = V_nominal · (1 ± n · paso%)
```

- `n` = nº de pasos desde la nominal; `paso%` = % por escalón (típico 1.25 % o 1.67 %, `⚠️ verificar`).
- Ejemplo: `V_nom=115 kV`, rango `±10 %` en 8 pasos de 1.25 % → toma máxima `115·1.10 = 126.5 kV`,
  mínima `115·0.90 = 103.5 kV`.

## B) Relación por toma

La relación cambia porque cambian las espiras activas del devanado regulado:

```
a(n) = a_nominal · (1 ± n · paso%)     (si la toma está en el lado AT)
relación de línea = a(n) · k√3 (factor del grupo, ../grupo-vectorial-conexiones)
```

> Validar: la tensión del **lado no regulado** se mantiene; la relación se mueve con la toma. Si la
> placa lista una tabla `toma → V`, debe reproducir con esta fórmula.

## C) Efecto de la toma en la impedancia %Z

- En **regulación lineal**, la %Z **varía** a lo largo del rango (cambia la geometría de dispersión
  del tramo de tomas): suele ser mínima cerca de la nominal y mayor en los extremos.
- El reporte de fábrica da `%Z` en **toma máxima / nominal / mínima** (tres valores). `⚠️ verificar`
  por unidad — no asumir Z constante.

> Consecuencia: para cortocircuito y paralelo (`../impedancia-cortocircuito`) usar la `%Z` de la
> **toma en servicio**, no solo la nominal.

## D) Número de posiciones

```
nº de posiciones = 2·(pasos por lado) + 1   (lineal)     o   el doble con puente reversible
```

Ejemplo `±8 pasos` lineal → 17 posiciones; con puente reversible y una bobina, el mismo nº de
contactos físicos cubre el doble de rango.

## E) Caída de tensión y selección de toma

La toma se elige para compensar la caída bajo carga:

```
V_salida ≈ V_entrada/a(n) − I·Z_serie·(factor de potencia)
```

> Para mantener `V_salida` nominal con carga alta se sube la toma (más espiras AT → menor relación de
> salida). El regulador automático del OLTC hace esto en tiempo real.
