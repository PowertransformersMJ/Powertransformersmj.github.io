---
name: resistencia-aislamiento-nucleo
description: >-
  Calcula, evalúa y diagnostica la prueba de RESISTENCIA DE AISLAMIENTO del NÚCLEO
  a tierra (core-to-ground / core insulation resistance) de transformadores de
  potencia, medida a 500 Vdc con megóhmetro, desconectando la pletina de tierra del
  núcleo accesible. Criterio ANSI/NETA ATS-2025 §7.2.2.D.11 (comparable a fábrica,
  ≥ 500 MΩ @ 500 Vdc) e IEEE C57.152. Úsala SIEMPRE que aparezcan datos de
  aislamiento de núcleo, IR de núcleo, "core ground", "core insulation resistance",
  núcleo a tierra, pletina/strap de tierra del núcleo, medición a 500 Vdc del núcleo,
  sospecha de MÚLTIPLES PUNTOS DE TIERRA del núcleo (corrientes circulantes,
  calentamiento, gases C₂H₄/C₂H₆), o cuando haya que decidir si el aislamiento del
  núcleo "pasa", detectar una tierra accidental adicional del núcleo, o correlacionar
  con DGA un punto caliente por núcleo multi-aterrizado — aunque el usuario no nombre la norma.
---

# Resistencia de Aislamiento del Núcleo (núcleo↔tierra @ 500 Vdc) — Transformadores de potencia

Esta skill convierte la lectura de IR del núcleo a tierra en un **veredicto trazable**:
comparada contra el dato de fábrica y el mínimo normativo, y con un diagnóstico de la falla
más peligrosa que revela — un **segundo punto de tierra accidental** del núcleo, que crea
corrientes circulantes, calentamiento y gases de falla.

## Por qué importa hacerlo bien

El núcleo de un transformador se aterriza en **un solo punto** (a propósito) para fijar su
potencial sin formar una espira cerrada. Si aparece un **segundo punto de tierra** accidental
(rebaba metálica, lodo conductor, objeto caído, humedad), el flujo disperso induce una FEM
en la espira núcleo-tanque y circula una **corriente de Foucault parásita** que **calienta
localmente**, descompone aceite y papel, y genera **gases de falla térmica** (C₂H₄, C₂H₆,
CH₄). La prueba de IR del núcleo a 500 Vdc detecta ese segundo aterrizaje **antes** de que
el punto caliente dañe el transformador. Es opcional en NETA (`*`), pero solo si la **pletina
de tierra del núcleo es accesible** desde el exterior.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): IR del núcleo a tierra
   medida @ **500 Vdc**, con la **pletina de tierra del núcleo desconectada** (si no se
   desconecta, se mide ~0 por la tierra intencional); temperatura; dato de fábrica /
   commissioning del núcleo si existe; correlación con DGA reciente.
2. **Verifica el método**: confirma que se midió a 500 Vdc y con la tierra del núcleo
   **levantada**; sin eso la lectura no es válida. → `references/02-calculos.md`.
3. **(Opcional) corrige por temperatura** si se compara contra un baseline a otra T (la IR
   del núcleo es menos crítica en T que la del devanado, pero anotar T). → `references/02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): veredicto contra cada óptica aplicable
   (fábrica > clase MO.00418 > NETA §7.2.2.D.11 ≥500 MΩ > IEEE C57.152) + tendencia, y
   consolida en el peor citando el criterio. → `references/03-criterios-evaluacion.md` +
   `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica** si la IR es baja: ¿segundo punto de tierra? Confirma por **convergencia**
   (DGA con C₂H₄/C₂H₆, termografía, corriente de tierra del núcleo) →
   `references/04-diagnostico.md` + `../_conocimiento/diagnostico-integrado-bateria.md`;
   y traduce a acción + intervalo → `../_conocimiento/gestion-mantenimiento-predictivo.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: Resistencia de aislamiento del núcleo a tierra — <tag/serie del tx>
Condiciones: V prueba = 500 Vdc | T = <°C> | pletina de tierra del núcleo = [desconectada ✔]
Resultado:
  Núcleo–tierra:  R_medida = <… MΩ/GΩ>   (a 500 Vdc, tierra de núcleo levantada)
CRITERIOS APLICADOS (por óptica):
  • Fábrica/commissioning del núcleo: <baseline> → [✔/✘/—]   (precedencia 1)
  • Interno por clase (MO.00418): <umbral> → [✔/✘]           (precedencia 2)
  • NETA §7.2.2.D.11: ≥ 500 MΩ @ 500 Vdc → [✔/✘]             (precedencia 3 · piso)
  • IEEE C57.152 (interpretación + tendencia): [✔/✘]
  • Tendencia vs histórico: [estable / ↓↓ degrada]
  ⊳ Divergencias: <p.ej. supera 500 MΩ pero cae fuerte vs fábrica → segundo aterrizaje incipiente>
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>  — <criterio más conservador citado>
Diagnóstico: <p.ej. múltiple punto de tierra → corriente circulante + gases; confirmar con DGA>
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — por qué el núcleo se aterriza en 1 punto, qué pasa con 2, qué mide.
- `references/02-calculos.md` — método correcto (500 Vdc, tierra levantada), entradas, corrección.
- `references/03-criterios-evaluacion.md` — umbrales con cita normativa (matriz multi-norma).
- `references/04-diagnostico.md` — interpretación: detectar múltiples tierras + convergencia DGA.
- Compartidas: `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (criterio D.11 + contexto batería),
  `../_conocimiento/tablas-neta-referencia.md` (tablas de tx y corrección de temperatura),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test, fila núcleo) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
