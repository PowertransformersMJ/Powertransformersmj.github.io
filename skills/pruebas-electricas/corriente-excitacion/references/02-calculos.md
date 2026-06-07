# 02 · Cálculos — patrón de fases, dispersión y comparación

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| Corriente de excitación por fase | I_A, I_B, I_C | Sí | en mA, misma tensión de prueba |
| Por TAP (si se mide en varias posiciones) | — | preferente | el patrón puede cambiar por TAP |
| Tensión de prueba aplicada | V_prueba | Sí | típ. 10 kV; comparar a IGUAL tensión |
| Configuración del núcleo | — | Sí | 3 columnas / 5 columnas / acorazado |
| Conexión (vector) | — | Sí | define si el patrón es HLH o LHL |
| Dato de fábrica / previos | — | preferente | base de comparación principal |

> ⚠️ **No se corrige por temperatura** como la IR, pero **sí debe compararse a IGUAL tensión de
> prueba**: la excitación de campo a 10 kV monofásica NO es comparable con la de fábrica a tensión
> nominal trifásica. Comparar solo medidas equivalentes.

---

## 1) Verificación del patrón 2+1 (núcleo de 3 columnas) ⭐

Ordenar las 3 lecturas e identificar la **menor** (debe corresponder a la fase **central**) y
las dos **mayores** (externas):

```
patrón_ok = (las dos externas se parecen entre sí) Y (la central es la menor)
```

**Dispersión entre externas** (deben parecerse):

```
Δ_externas (%) = |I_ext1 − I_ext2| / promedio(I_ext1, I_ext2) × 100
```

**Posición relativa de la central**:

```
ratio_central (%) = I_central / promedio(I_ext1, I_ext2) × 100
```

**Ejemplo (patrón sano)**: I_A = 18.0 mA, I_B = 11.5 mA, I_C = 18.4 mA →
externas A y C: `Δ = |18.0−18.4|/18.2 ×100 = 2.2%` (similares ✔); central B la menor ✔ →
**patrón 2+1 correcto**.

**Ejemplo (patrón roto)**: I_A = 18.0, I_B = 11.5, I_C = 27.6 →
`Δ_externas = |18.0−27.6|/22.8 ×100 = 42%` → externas ya **no** se parecen → patrón roto →
investigar fase C (posible espira en corto: cruzar con TTR).

---

## 2) Comparación vs fábrica / previos (la prueba real de aceptación)

```
%cambio_vs_previo = (I_actual − I_previo) / I_previo × 100   (por fase, a IGUAL tensión)
```

**Ejemplo**: I_A previa = 18.0 mA, actual = 23.4 mA → `%cambio = +30%` → cambio significativo
vs baseline → INVESTIGAR aunque el patrón 2+1 aún "parezca" correcto (tendencia, IEEE C57.152).

> No hay un % de corte normado universal; un cambio del orden de **decenas de %** vs fábrica/previos
> o una **ruptura de patrón** son las señales de alarma. ⚠️ Verificar si MO.00418 fija un % por clase.

---

## 3) Coherencia entre TAPs

La excitación puede variar legítimamente entre posiciones de TAP (cambia el número de espiras
activas). Buscar **discontinuidades** que NO sigan la tendencia suave entre posiciones → posible
defecto del conmutador en esa posición.

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarExcitacion({Iabc, Vprueba, nucleo, fabrica, previos}) {
  const [lo, mid, hi] = ordenar(Iabc);
  const dExternas = Math.abs(hi - mid?) ; // identificar externas vs central por geometría
  const patronOk = externasSimilares(Iabc) && centralEsMenor(Iabc, nucleo); // §1
  const cambio = previos ? Iabc.map((I,i)=> (I-previos[i])/previos[i]*100) : null; // §2
  // veredicto: patrón roto O cambio grande vs fábrica/previos → INVESTIGAR/RECHAZA (cruzar TTR)
}
```
