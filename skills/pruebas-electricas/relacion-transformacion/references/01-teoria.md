# 01 · Teoría — Relación de transformación (TTR)

## Qué mide

La prueba aplica una tensión conocida en el devanado de **alta tensión (AT)** y mide
la tensión inducida en el de **baja tensión (BT)**; el ratiómetro (TTR-meter) reporta
el cociente. Por la ley del transformador ideal, la relación de tensiones es igual a
la **relación de espiras**:

```
TTR = V_AT / V_BT ≈ N_AT / N_BT
```

donde `N` es el número de vueltas de cada devanado. Es una verificación directa de que
las espiras están **íntegras** (ninguna en corto ni abierta) y **bien conectadas** al
grupo vectorial de placa. Se mide en TODAS las posiciones del cambiador de tomas (TAP),
porque el conmutador inserta/retira espiras y cada posición tiene un ratio nominal distinto.

## Qué más entrega el ratiómetro (y por qué importa)

Un TTR moderno reporta junto al ratio:

1. **Corriente de excitación** — la corriente que el equipo necesita para magnetizar el
   núcleo durante la medida. Una excitación **anormalmente alta** junto a una desviación de
   ratio es la firma de **espiras en cortocircuito** (ver `corriente-excitacion`).
2. **Desfase / ángulo de fase** — debe coincidir con el desplazamiento del grupo de conexión
   (p.ej. 30° para un Dyn11). Un desfase fuera de lo esperado delata **conexión errónea**
   o vector mal declarado.

## Qué fallas revela

| Síntoma en TTR | Qué significa físicamente |
|---|---|
| %dev alta en una fase + excitación alta | **Espiras en cortocircuito** en esa fase (menos vueltas efectivas) |
| Relación que no se puede medir / fuera de rango | **Devanado abierto** o conexión interrumpida |
| %dev anómala SOLO en ciertos TAPs | Defecto del **conmutador de tomas** (contacto, posición) |
| Desfase incorrecto / ratio coherente con otro vector | **Conexión errónea** o grupo vectorial mal rotulado |
| Desviación uniforme en las 3 fases del mismo signo | Posible **error de placa** o dato de tensión equivocado, no falla |

## Por qué el grupo de conexión cambia el ratio de placa

En transformadores trifásicos, el ratio de placa se da en **tensiones de línea**, pero la
relación de espiras es **fase-a-fase**. Según la conexión (estrella Y o delta D) aparece un
factor **√3** entre ambas. El ratiómetro mide entre los terminales que dictamina la plantilla
de conexión del vector (Dyn, Yyn, Dd…); por eso comparar contra el ratio equivocado da una
desviación falsa. La fórmula correcta por conexión está en `02-calculos.md`.

> A diferencia de la IR, la TTR **no requiere corrección de temperatura** (es un cociente
> de tensiones, no una propiedad dependiente de T). Continúa en `02-calculos.md` (fórmulas)
> y `03-criterios-evaluacion.md` (umbrales).
