# 01 · Teoría — FP/tan δ y capacitancia de bujes

## Qué es un buje y por qué se prueba aparte

Un buje (bushing) lleva el conductor de alta tensión a través del tanque aterrizado del
transformador, aislándolo. Los bujes de potencia son **condensados**: el aislamiento
(papel impregnado en aceite **OIP**, papel resina **RBP**, o resina impregnada **RIP**)
se construye con **capas de papel y láminas conductoras** que distribuyen el campo
eléctrico de forma uniforme — un condensador multicapa. Por su construcción y su exposición,
los bujes son la **causa #1 de fallas catastróficas** de transformadores, por eso se prueban
separados del aislamiento del devanado.

## Qué mide la prueba: C1, C2 y FP

El buje condensado tiene un **tap** (capacitivo o de potencial) que da acceso a la última
capa, permitiendo separar dos aislamientos:

| Medida | Aislamiento | Entre | Qué revela |
|---|---|---|---|
| **C1** | Aislamiento **principal** | conductor central ↔ tap | salud del cuerpo del condensador (capas) |
| **C2** | Aislamiento del **tap** | tap ↔ brida aterrizada | humedad / degradación en el tap |

Para cada uno se mide el **FP/tan δ** (pérdidas dieléctricas, como en el devanado) y la
**capacitancia** (C, en pF). Ambos se comparan contra los **valores de placa del propio
buje** (FP y C1 grabados de fábrica) — ese es el criterio rey.

## Por qué la capacitancia C1 es el indicador crítico (riesgo de explosión)

En un buje sano la capacitancia es **estable** en el tiempo. Si **capas conductoras del
condensador entran en cortocircuito** (por humedad, sobretensión, envejecimiento), el número
efectivo de capacitores en serie baja y la **capacitancia C1 SUBE**. Cada capa en corto
sobrecarga las restantes, acelerando el colapso en cascada → **descarga interna → explosión**
del buje (proyección de porcelana y aceite encendido). Por eso un **ΔC1 > 5–10 % vs placa**
es una alerta seria: no es "deriva", es el **precursor directo de la falla catastrófica**.

```
Buje sano:   N capas en serie → C1 estable
Capa en corto: (N−1) capas → C1 ↑  → resto sobrecargado → cascada → EXPLOSIÓN
```

## La prueba hot-collar (bujes sin tap / sólidos)

Bujes **sólidos** o sin tap capacitivo no permiten medir C1/C2 directamente. Se usa el
**hot-collar**: un collar conductor se ciñe alrededor del buje a una altura y se energiza,
midiendo pérdidas (W) y corriente en esa sección. Sirve para detectar **humedad, fisuras,
vacíos o bajo nivel de aceite** en porciones localizadas del buje. NETA: las pérdidas del
hot-collar no deben exceder **0.1 W (100 mW)** por sección. Es opcional: no se hace si hay
tap capacitivo o de potencial disponible.

## Por qué corregir por temperatura

Como todo FP dieléctrico, el FP del buje **sube con la temperatura** y debe corregirse a
**20 °C** antes de comparar contra placa o límite. La **capacitancia** es mucho menos
sensible a la temperatura (se compara casi directa). Usar el factor del **fabricante del
buje** si lo provee. ⚠️ verificar la curva de corrección aplicada.

> Continúa en `02-calculos.md` (fórmulas) y `03-criterios-evaluacion.md` (umbrales).
