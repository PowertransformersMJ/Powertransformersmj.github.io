# 01 · Teoría — Corriente de excitación

## Qué mide

La prueba aplica una tensión AC (típicamente hasta **10 kV**, monofásica) a cada devanado de
AT con el secundario en circuito abierto, y mide la **corriente que el transformador absorbe
para magnetizar su núcleo** — la *corriente de excitación* (exciting current). Esa corriente
tiene dos componentes: una **magnetizante** (establece el flujo en el hierro) y una de **pérdidas**
(histéresis + Foucault). Es una "huella" del estado conjunto de **núcleo + devanado**: cualquier
alteración del camino magnético o de las espiras cambia la corriente que el núcleo demanda.

```
I_exc = I_magnetizante (flujo en el hierro) + I_pérdidas (histéresis + Foucault)
```

A diferencia de la TTR (que mira espiras vía tensión) o la R de devanados (que mira el cobre vía
DC), la excitación es **AC** y refleja el circuito magnético completo — por eso es tan sensible
a defectos sutiles del núcleo y a cortocircuitos entre espiras.

## El patrón de las 3 fases (la clave de la interpretación) ⭐

En un transformador trifásico de **núcleo de 3 columnas (3-leg core type)**, las tres fases NO
dan la misma corriente por geometría del circuito magnético: la columna **central** tiene un
camino de retorno de flujo **más corto y simétrico** que las dos columnas **externas**. El
resultado esperado es un patrón de **dos lecturas similares (fases externas) + una menor (fase
central)** — abreviado **2H-1L** o, leyendo de izquierda a derecha, un patrón **Alto-Bajo-Alto
(HLH)**. Las dos externas deben parecerse entre sí (típicamente dentro de ~5%); la central puede
ser apreciablemente menor.

> ⚠️ En conexiones **delta** o ciertos vectores el patrón puede invertirse a **Bajo-Alto-Bajo
> (LHL)** o distorsionarse — siempre verificar contra el patrón esperado del propio diseño y la
> plantilla del fabricante, no contra una regla rígida.

## Por qué NO hay un umbral % duro universal

NETA §7.2.2 e IEEE C57.152 **no fijan un porcentaje fijo de aceptación** para la excitación
como sí lo hacen para TTR (0.5%) o IR (Tabla 100.5). El criterio es **comparativo**: el patrón
2+1 esperado + la comparación contra **fábrica, ensayos previos y fases hermanas**. Un valor en
mA "alto" no es malo en sí; lo que importa es que **rompa el patrón** o se aparte de su baseline.

## Qué fallas revela

| Síntoma en excitación | Qué significa físicamente |
|---|---|
| Una fase con excitación **mucho mayor** + ratio TTR desviado | **Espiras en cortocircuito** en esa fase |
| Patrón 2+1 **roto** (las externas ya no se parecen) | Defecto de **núcleo** (laminaciones, puesta a tierra múltiple) o devanado |
| Excitación que cambia **solo en ciertos TAPs** | Problema del **cambiador de tomas** (contacto) |
| Las 3 fases **↑ uniformemente** vs previos | Posible magnetismo residual o cambio global de núcleo |
| Lecturas erráticas / no repetibles | **Magnetismo residual** (desmagnetizar) o conexión floja |

> Continúa en `02-calculos.md` (comparaciones) y `03-criterios-evaluacion.md` (criterios).
