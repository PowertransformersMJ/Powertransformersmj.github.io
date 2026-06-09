---
name: bujes-y-accesorios
description: Explica los BUJES (pasamuros) y ACCESORIOS de un transformador de potencia — bujes tipo condensador (OIP/RIP/RBP) vs no-condensador, las capacitancias C1 (núcleo) y C2 (tap de prueba), el factor de potencia / tan δ de buje como diagnóstico, el tap capacitivo, y los accesorios del equipo (tanque, conservador, relé Buchholz, válvula de sobrepresión, imagen térmica, indicadores). Úsala SIEMPRE que el usuario mencione bujes, bushings, tipo condensador/no condensador, OIP/RIP/RBP, C1/C2, tap capacitivo, factor de potencia de buje, tan δ de buje, conservador, Buchholz, sobrepresión súbita, imagen térmica, o accesorios de protección del transformador.
---

# Bujes y accesorios

El **buje** es el pasamuros aislado que lleva el potencial del devanado (AT/BT) al exterior del tanque
atravesando la tapa. Es un punto débil clásico: una fracción importante de las fallas de
transformador se origina en bujes. Los **accesorios** (conservador, Buchholz, sobrepresión, imagen
térmica) son la primera línea de protección y monitoreo del equipo.

## Cuándo se dispara

El usuario menciona un buje (condensador/no condensador, OIP/RIP/RBP), sus capacitancias `C1`/`C2`,
el **tap capacitivo** (tap de prueba), el factor de potencia / `tan δ` de buje, o un accesorio:
tanque, conservador, relé **Buchholz**, válvula de **sobrepresión súbita**, **imagen térmica**,
indicadores de nivel/temperatura.

## Workflow (5 pasos)

1. **Clasifica el buje**: condensador (tiene capas equipotenciales → `C1`/`C2` y tap de prueba) vs
   no-condensador (sólido/macizo, sin tap). → `references/01-teoria.md`.
2. **Identifica `C1` y `C2`**: `C1` = núcleo principal (conductor central ↔ tap); `C2` = tap ↔ brida
   de tierra. La prueba de FP/`tan δ` de buje mide su estado dieléctrico.
3. **Evalúa el dieléctrico**: el `tan δ` y la capacitancia se comparan con la **placa del buje** y
   la referencia histórica. Interpretación de la prueba → lóbulo 49 (`../../pruebas-electricas/`).
4. **Revisa los accesorios de protección**: Buchholz (gas/flujo), sobrepresión súbita, imagen
   térmica, conservador (con/sin membrana), indicadores. → `references/04-diagnostico.md`.
5. **Emite la ficha** (formato abajo), `⚠️ verificar` valores de placa de buje no confirmados.

## Conceptos núcleo

```
BUJE CONDENSADOR: capas conductoras concéntricas (papel-aceite OIP / papel-resina RBP /
   resina impregnada RIP) reparten el campo eléctrico → gradiente uniforme. Tiene TAP CAPACITIVO.
   C1 = capacitancia principal (conductor central ↔ último foil / tap).
   C2 = capacitancia del tap (tap ↔ brida de tierra).  ← se mide en la prueba de FP de buje.
BUJE NO-CONDENSADOR: aislamiento macizo (porcelana + aceite/aire), sin capas, sin tap.
   Solo MT/BT de baja tensión. No tiene C1/C2 medibles por separado.
TAP CAPACITIVO: punto de acceso para medir C2 / FP y para acoplar monitoreo en línea.
   Si queda flotante (no aterrizado) → puede dañar el buje. Verificar conexión a tierra.
```

## Accesorios de protección (núcleo)

```
CONSERVADOR (tanque de expansión): absorbe la dilatación del aceite. Con membrana/bolsa →
   aísla el aceite del aire (menos humedad/oxígeno). Sin membrana → respira por desecante (silica).
RELÉ BUCHHOLZ: entre tanque y conservador. Alarma por acumulación de gas (falla incipiente)
   y disparo por flujo brusco (falla violenta). Solo en equipos con conservador.
VÁLVULA DE SOBREPRESIÓN SÚBITA: alivia el pico de presión de un arco interno → evita rotura
   del tanque. (EG cap.6)
IMAGEN TÉRMICA (image coil): simula el hot-spot del devanado para mandar ventiladores/alarma.
INDICADORES: nivel de aceite, temperatura de aceite (top-oil) y de devanado (por imagen térmica).
```

## Neuronas (lee según necesites)

- `references/01-teoria.md` — tipos de buje (condensador/no), C1/C2, tap capacitivo, accesorios.
- `references/02-calculos.md` — relación de capacitancias, ΔFP/Δcap como criterio, % de cambio.
- `references/03-criterios-evaluacion.md` — identificar tipo desde placa, multi-norma (IEEE C57.19, IEC 60137).
- `references/04-diagnostico.md` — modos de falla del buje, accesorios de protección, errores.

Marcos compartidos: `../_conocimiento/00-fundamentos-transformador.md` (§A bujes, §E protecciones),
`../_conocimiento/convenciones-calculo.md`, `../_conocimiento/marco-normativo-tx.md`.

## Formato de salida (ficha de bujes y accesorios)

```
BUJE AT: tipo <condensador OIP/RIP/RBP | no-condensador> · C1=<pF ⚠️ verificar> · C2=<pF ⚠️ verificar>
   FP/tan δ de placa: <% ⚠️ verificar>   → interpretación de prueba en ../../pruebas-electricas/
TAP CAPACITIVO: <presente/ausente> · estado de aterrizaje <verificar>
ACCESORIOS: conservador <con/sin membrana> · Buchholz <sí/no> · sobrepresión <sí/no> · imagen térmica <sí/no>
PROTECCIONES ASOCIADAS: <Buchholz alarma+disparo | sobrepresión | imagen térmica>
⚠️ VERIFICAR: <placa del buje (C1/C2/FP de fábrica), referencia histórica de prueba>
```

→ La prueba de FP/`tan δ` de buje y su interpretación viven en el lóbulo 49
(`../../pruebas-electricas/`); aquí se establece QUÉ es el buje y qué se espera medir.
