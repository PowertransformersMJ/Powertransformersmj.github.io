# 01 · Teoría — Físico-química del aceite aislante

## Qué hace el aceite

En un transformador en líquido el aceite cumple dos funciones acopladas:
**aislar** (rigidez dieléctrica) y **refrigerar** (transporte de calor). Su
degradación afecta ambas y, además, **acelera el envejecimiento del papel**
(celulosa), que es el componente no reemplazable que define la vida del equipo.
Por eso las físico-químicas son el cribado predictivo más barato y rico.

## Qué mide cada ensayo y qué falla revela

| Ensayo | Método ASTM | Qué mide | Qué falla revela |
|---|---|---|---|
| **Rigidez dieléctrica (BDV)** | D1816 (electrodos VDE, gap 1/2 mm) · D877 (discos planos) | kV a los que el aceite rompe | **agua y partículas** (D1816 muy sensible); rigidez baja = contaminación |
| **Número de neutralización / acidez (TAN)** | D974 | mg KOH/g para neutralizar ácidos | **oxidación del aceite**: ácidos de la degradación; sube con la edad |
| **Tensión interfacial (IFT)** | D971 | mN/m (tensión aceite–agua) | productos polares de oxidación; **IFT↓ es el indicador más temprano de envejecimiento** |
| **Contenido de agua** | D1533 (Karl Fischer) | ppm de agua disuelta | **humedad** del sistema; migra al papel y baja la rigidez |
| **FP / tan δ del aceite** | D924 | pérdidas dieléctricas (%) | contaminación iónica, polares, envejecimiento, humedad |
| **Color** | D1500 | escala visual 0.5–8 | oscurecimiento = oxidación/contaminación; útil en tendencia |
| **Gravedad específica** | D1298 | densidad relativa | identifica tipo de líquido; mezclas/contaminación |
| **Condición visual** | D1524 | bright & clear / turbio | partículas, agua libre, sedimentos |

## El triángulo del envejecimiento: IFT ↓ + acidez ↑ + color ↑

El aceite mineral envejece por **oxidación**: el O₂ y el calor rompen las cadenas
de hidrocarburos generando **ácidos** (sube TAN), **compuestos polares** (bajan la
IFT porque migran a la interfaz aceite–agua) y **lodos/sedimentos** (oscurecen el
color y obstruyen el enfriamiento). Estos tres parámetros se mueven **juntos** y
de forma correlacionada: un aceite sano tiene IFT alta (>30 mN/m) y acidez baja
(<0.05); un aceite envejecido tiene **IFT baja + acidez alta + color oscuro**. La
relación inversa IFT↔acidez (curva de Myers) es el clasificador clásico del
estado del aceite. Un solo parámetro engaña; el patrón conjunto firma el envejecimiento.

## Por qué la humedad es el enemigo silencioso

El agua existe en equilibrio entre **aceite** (medida por D1533, ppm) y **papel**
(donde se concentra cientos de veces más). La solubilidad del agua en el aceite
**crece con la temperatura**, así que la misma masa de agua da ppm distintos según
la T de muestreo → hay que razonar en **% de saturación**, no en ppm crudos. El
agua baja la rigidez, sube el FP del aceite, y **acelera la hidrólisis de la
celulosa** (reduce el grado de polimerización del papel). Por eso el agua del
aceite se complementa con **DFR** (humedad del papel, concluyente).

## Mineral vs éster natural (FR3 / vegetal)

El **éster natural** tiene química distinta: mayor solubilidad de agua (tolera más
ppm sin perder rigidez), IFT y color de referencia diferentes, y es biodegradable.
**No se evalúa con los límites del aceite mineral** — comparar contra fábrica/previos
y contra la columna de éster de la Tabla 100.4 (ej. FP/tan δ máximo de éster es
mayor que mineral, ver Tabla 100.3). ⚠️ Verificar la columna de éster exacta
contra la edición de norma del director.

> Continúa en `02-calculos.md` (índice de envejecimiento, % saturación) y
> `03-criterios-evaluacion.md` (umbrales por método y clase).
