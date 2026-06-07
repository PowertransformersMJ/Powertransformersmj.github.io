# 01 · Teoría — Resistencia de aislamiento del núcleo a tierra

## Por qué el núcleo se aterriza en UN solo punto

El núcleo de acero al silicio de un transformador está expuesto al **flujo magnético
disperso** y a campos eléctricos. Si quedara flotante, acumularía carga y alcanzaría
potenciales altos que provocarían **descargas** hacia las partes aterrizadas. Para evitarlo,
el núcleo (y sus estructuras de sujeción) se conecta a tierra/tanque en **un único punto**,
fijando su potencial a 0 V de forma segura.

La clave es **un solo punto**: el núcleo está aislado del tanque por todas partes salvo esa
conexión intencional. Así NO se forma una espira conductora cerrada que enlace el flujo.

## Qué pasa con un SEGUNDO punto de tierra (la falla que la prueba detecta)

Si aparece una **segunda conexión accidental** a tierra (una rebaba metálica que toca el
tanque, lodo o partículas conductoras, un objeto caído, humedad puenteando), el núcleo queda
aterrizado en **dos puntos** → se cierra una **espira** entre esos puntos y el tanque. El
flujo disperso enlaza esa espira e induce una **FEM**; como la espira es de muy baja
resistencia, circula una **corriente parásita (de Foucault / circulante) grande**:

```
1 punto de tierra (sano):  núcleo a potencial fijo, sin espira → sin corriente circulante
2 puntos de tierra (falla): espira cerrada + flujo disperso → FEM → corriente circulante ↑
                            → calentamiento local → descomposición de aceite/papel → gases
```

Esa corriente **calienta localmente** el punto de contacto, **carboniza** papel y **descompone
aceite**, generando un **punto caliente** y **gases de falla térmica** detectables por DGA
(predominan **C₂H₄ etileno** y **C₂H₆ etano**, con **CH₄**; si el contacto es intermitente
aparece **C₂H₂ acetileno** por micro-arqueo). La industria fija un límite práctico de
corriente de tierra del núcleo del orden de **~0.1 A** (⚠️ verificar contra la norma del
director). Sin tratar, el punto caliente degrada el transformador.

## Qué mide la prueba

Se mide la **resistencia de aislamiento entre el núcleo y tierra** con un megóhmetro a
**500 Vdc**. Para que la medida tenga sentido hay que **desconectar la pletina (strap) de
tierra intencional del núcleo** — accesible desde el exterior en muchos diseños. Si NO se
desconecta, el megóhmetro lee a través de la tierra intencional (~0 Ω) y la prueba no informa
nada.

- **Aislamiento sano**: el núcleo está aislado del tanque salvo por la pletina (ya levantada)
  → IR **alta** (cientos de MΩ a GΩ).
- **Segundo punto de tierra**: existe un camino conductor núcleo↔tanque adicional → IR **baja**
  (de kΩ a pocos MΩ, o casi cero si el contacto es franco).

## Por qué se usan solo 500 Vdc (no 5 kV)

El aislamiento núcleo-tierra es de **baja tensión** (no soporta el servicio de alta tensión
del devanado): un ensayo a 5 kV podría **dañarlo**. NETA especifica **500 Vdc** para esta
prueba. La corrección de temperatura es menos crítica que en el devanado (el dato sirve sobre
todo para **tendencia** y para comparar contra fábrica), pero conviene anotar T.

> Continúa en `02-calculos.md` (método y entradas) y `03-criterios-evaluacion.md` (umbrales).
