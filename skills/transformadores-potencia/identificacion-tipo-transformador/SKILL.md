---
name: identificacion-tipo-transformador
description: Identifica y clasifica el TIPO de transformador de potencia (bidevanado; bidevanado con devanado de compensación/estabilización = delta terciario; tridevanado de carga real; autotransformador) a partir de la placa, los bornes y el grupo de conexión, y deriva qué cálculos y criterios cambian con el tipo. Úsala SIEMPRE que el usuario mencione tipo de transformador, número de devanados, devanado terciario/de estabilización/compensación, delta enterrado (buried delta), tridevanado, autotransformador, o pregunte qué relación, qué impedancia o qué fórmula aplica a un equipo concreto — incluso si no dice la palabra "tipo".
---

# Identificación del tipo de transformador

Clasificar correctamente el equipo es el **paso 0** de todo cálculo y diagnóstico: el tipo
decide si hay **una o tres** relaciones, **una o tres** impedancias, y si el comportamiento de
**secuencia cero** (y por tanto las protecciones de tierra) cambia. Equivocar el tipo propaga
el error a TODA la evaluación.

## Cuándo se dispara

El usuario pregunta qué es un equipo, cuántos devanados tiene, si tiene terciario/estabilización,
si es autotransformador, o **qué relación/impedancia/fórmula** aplicarle. También cuando se va a
cargar una placa nueva al tablero y hay que tipificar.

## Workflow (6 pasos)

1. **Reúne evidencia de placa/terminales**: nº de potencias de carga (MVA), nº de juegos de
   bornes accesibles, símbolo de grupo de conexión, notas ("stabilizing", "buried delta",
   "auto"), nº de valores de %Z. → detalle en `references/03-criterios-evaluacion.md`.
2. **Cuenta devanados de CARGA** (con MVA y bornes propios) vs **terciario sin carga**.
3. **Clasifica** con el árbol de decisión (§árbol abajo).
4. **Confirma con el grupo de conexión** y, si hay duda estabilización vs carga, con el criterio
   discriminante (terciario sin MVA de carga y/o sin bornes = estabilización).
5. **Deriva las implicaciones de cálculo** del tipo (relación, impedancia, secuencia cero) →
   `references/02-calculos.md` y `04-diagnostico.md`.
6. **Emite la ficha de tipificación** (formato abajo), marcando lo no confirmable `⚠️ verificar`.

## Árbol de decisión (resumen ejecutable)

```
¿AT y BT comparten cobre (no aislados galvánicamente)?  ── sí ─→ AUTOTRANSFORMADOR
   │                                                            (revisar si lleva terciario delta)
   no
   ▼
¿Cuántos devanados tienen potencia de CARGA (MVA propio + bornes)?
   1 ──→ ¿hay un tercer devanado en delta SIN MVA de carga / sin bornes?
           sí ─→ BIDEVANADO CON DEVANADO DE ESTABILIZACIÓN (delta terciario)
           no ─→ BIDEVANADO simple
   3 ──→ TRIDEVANADO (carga real en AT/MT/BT)
```

## Neuronas (lee según necesites)

- `references/01-teoria.md` — qué es cada tipo, el porqué del delta de estabilización, el auto.
- `references/02-calculos.md` — qué fórmulas cambian con el tipo (relación √3, Z de 3 ramas, base común, secuencia cero).
- `references/03-criterios-evaluacion.md` — cómo discriminar el tipo desde placa/bornes/grupo (multi-norma).
- `references/04-diagnostico.md` — implicaciones: protecciones de tierra, qué ensayos cambian, errores típicos.

Marcos compartidos: `../_conocimiento/00-fundamentos-transformador.md`,
`../_conocimiento/marco-normativo-tx.md`, `../_conocimiento/convenciones-calculo.md`.

## Formato de salida (ficha de tipificación)

```
TIPO: <bidevanado | bi+terciario estabilización | tridevanado | autotransformador>
EVIDENCIA: nº MVA de carga = _ · nº bornes = _ · grupo = _ · notas placa = _
GRUPO DE CONEXIÓN: <p.ej. YNyn0d11> → desfase _ · √3 en relación: <sí/no por par>
DEVANADOS DE CARGA: AT (_ kV, _ MVA) · MT (_) · BT (_)
TERCIARIO: <no | estabilización buried/accesible (_ kV) | carga real (_ MVA)>
IMPLICACIONES DE CÁLCULO:
  - Relación: <1 par | 3 pares> con factor √3 = <…>
  - Impedancia: <1 Z_HL | 3 Z (Z_HM,Z_HL,Z_ML) → estrella equiv. Z1,Z2,Z3>
  - Secuencia cero: <estándar | reducida por delta de estabilización → afecta falla a tierra>
⚠️ VERIFICAR: <valores/bases no confirmados contra placa o norma del director>
```

→ Para evaluar resultados de ensayos sobre el equipo tipificado, cruza con la carpeta hermana
`../../pruebas-electricas/` (relación, impedancia/reactancia de dispersión, etc.).
