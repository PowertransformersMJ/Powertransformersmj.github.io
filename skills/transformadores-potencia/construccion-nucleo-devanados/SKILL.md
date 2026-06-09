---
name: construccion-nucleo-devanados
description: Explica la CONSTRUCCIÓN del núcleo y los devanados de un transformador de potencia — núcleo acorazado (shell form) vs de columnas (core form), núcleos de 3 y 5 columnas, tipos de devanado (capas, disco, helicoidal, entrelazado), y cómo la construcción condiciona la distribución de impulso, las fuerzas de cortocircuito y la firma FRA/SFRA. Úsala SIEMPRE que el usuario mencione núcleo, core/shell form, columnas, 3-limb/5-limb, tipo de devanado (disco/capa/helicoidal), fuerzas de cortocircuito, telescopeo/pandeo, distribución de impulso, o firma de respuesta en frecuencia.
---

# Construcción del núcleo y los devanados

La construcción **física** decide tres cosas medibles: cómo se reparte una onda de **impulso**
(capacitancias), qué **fuerzas de cortocircuito** soportan los devanados (∝ I²), y qué **firma
FRA/SFRA** tiene el equipo. Conocerla es el puente entre el diseño y el diagnóstico mecánico.

## Cuándo se dispara

El usuario menciona el núcleo (core/shell form, 3 o 5 columnas), el tipo de devanado, las fuerzas
de cortocircuito (telescopeo, pandeo), la distribución de impulso, o la firma de respuesta en
frecuencia (FRA/SFRA).

## Workflow (5 pasos)

1. **Identifica la construcción del núcleo**: shell vs core form; nº de columnas (3 / 5). → `references/01-teoria.md`.
2. **Identifica el tipo de devanado** (capas, disco continuo/entrelazado, helicoidal) y su posición.
3. **Deriva las implicaciones**: distribución de impulso (capacitancias), fuerzas de cortocircuito,
   firma FRA esperada. → `references/04-diagnostico.md`.
4. **Cruza con secuencia cero**: un núcleo de 5 columnas baja la `Z0` como un delta
   (`../identificacion-tipo-transformador 03 §E`).
5. **Emite la ficha de construcción** (formato abajo), `⚠️ verificar` lo no confirmado por diseño.

## Conceptos núcleo

```
SHELL FORM (acorazado): bobinas "pancake"; el núcleo rodea las bobinas. Alta capacitancia
   bobina-bobina → distribución de impulso uniforme. Robusto a cortocircuito.
CORE FORM (columnas): bobinas cilíndricas concéntricas sobre columnas; BT junto al núcleo, AT
   por fuera. Construcción más común en potencia.
3 columnas: camino de retorno de flujo homopolar por el tanque → Z0 alta.
5 columnas: columnas laterales dan retorno al flujo homopolar → Z0 BAJA (como un delta).
```

## Neuronas (lee según necesites)

- `references/01-teoria.md` — shell vs core, 3/5 columnas, tipos de devanado.
- `references/02-calculos.md` — V/espira, densidad de flujo, fuerzas de cortocircuito (∝ I²).
- `references/03-criterios-evaluacion.md` — identificar construcción desde placa/firma, multi-norma.
- `references/04-diagnostico.md` — distribución de impulso, FRA/SFRA, telescopeo/pandeo, errores.

Marcos compartidos: `../_conocimiento/00-fundamentos-transformador.md §C`, `../_conocimiento/convenciones-calculo.md`,
`../_conocimiento/marco-normativo-tx.md`.

## Formato de salida (ficha de construcción)

```
NÚCLEO: <shell form | core form>  ·  Nº COLUMNAS: <3 | 5>
DEVANADOS: tipo <capas | disco continuo | disco entrelazado | helicoidal> · disposición <concéntrica/…>
IMPLICACIÓN Z0: <3-limb: Z0 alta | 5-limb: Z0 baja como delta>
DISTRIBUCIÓN DE IMPULSO: <uniforme (shell/entrelazado) | gradiente (capas)>
ROBUSTEZ A CORTOCIRCUITO: fuerzas ∝ I² → <notas de diseño>
FIRMA FRA ESPERADA: <bandas según construcción — referencia para futura comparación>
⚠️ VERIFICAR: <datos de diseño no confirmados (reporte de fábrica)>
```

→ La construcción condiciona la interpretación de FRA/SFRA y de impulso en `../../pruebas-electricas/`,
y la `Z0` en `../identificacion-tipo-transformador` e `../impedancia-cortocircuito`.
