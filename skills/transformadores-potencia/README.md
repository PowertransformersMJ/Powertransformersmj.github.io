# 🏭 Skills · Transformadores de Potencia — Fundamentos, Clasificación y Cálculos

> Carpeta de skills **project-specific** (AFINIA) sobre el **EQUIPO** transformador de
> potencia: qué es, cómo se **clasifica**, cómo se **calcula** y qué **particularidades**
> gobiernan su gestión, diagnóstico y mantenimiento especializado. Alimenta TODAS las
> funcionalidades de la página (en especial los cálculos y la tipificación de equipos).

## Frontera con `pruebas-electricas/`

Son carpetas **hermanas y complementarias**, NO se duplican:

| | `transformadores-potencia/` (esta) | `pruebas-electricas/` |
|---|---|---|
| Objeto | el **EQUIPO**: tipo, configuración, placa, cálculos, componentes | las **PRUEBAS**: batería NETA §7.2.2, criterio y diagnóstico de cada ensayo |
| Pregunta que responde | "¿qué es, cómo se clasifica y cómo se calcula este transformador?" | "¿este resultado de ensayo pasa o no, y qué falla revela?" |
| Ejemplo | identificar bidevanado vs tridevanado → qué relación y qué Z aplican | medir relación (TTR) → comparar vs tolerancia → veredicto |

Se **cruzan**: la tipificación de aquí define cómo se calcula y evalúa allá (p.ej. un
tridevanado tiene 3 impedancias y 3 relaciones, no una). Cada skill enlaza a la otra carpeta
cuando corresponde.

## Por qué importa (objetivo declarado por el director)

Mejorar **(1)** los cálculos matemáticos y **(2)** la identificación del tipo de
transformador — **bidevanado**, **bidevanado con devanado de compensación/estabilización**
(delta terciario) y **tridevanado** (+ autotransformador) — porque el tipo **cambia las
fórmulas** (relación con/sin √3, una vs tres impedancias, secuencia cero, protecciones).

## Arquitectura (patrón validado en `pruebas-electricas`)

```
skills/transformadores-potencia/
  README.md                          ← este índice
  _conocimiento/                     ← neuronas COMPARTIDAS (no duplicar por skill)
    00-fundamentos-transformador.md  ← backbone: qué es, partes, principio, construcción
    marco-normativo-tx.md            ← catálogo IEEE C57.* + IEC 60076.* + interno MO.00418
    convenciones-calculo.md          ← por-unidad, base común, factor √3, símbolos, redondeo
  <una-carpeta-por-tema>/
    SKILL.md                         ← trigger + workflow + salida
    references/
      01-teoria.md  02-calculos.md  03-criterios-evaluacion.md  04-diagnostico.md
```

**Patrón = 4 neuronas por skill** (teoría → cálculos → criterios → diagnóstico/implicación)
**+ los marcos compartidos**. Se reutilizan también, por cruce, los marcos de
`pruebas-electricas/_conocimiento/` (multi-norma, gestión predictiva) cuando aplica.

## Mapa de skills (11 construidas de 11 · familia completa)

> Arquitectura validada por el director (2026-06-08, aprobó replicar). ✅ = construida
> (SKILL.md + 4 neuronas). Patrón replicado de la ejemplar.

### A. Identificación y cálculos (núcleo del pedido)
| # | Skill | Estado |
|---|---|---|
| 1 | `identificacion-tipo-transformador` (bidevanado / bi+terciario estabilización / tridevanado / auto) | ✅ **ejemplar** |
| 2 | `grupo-vectorial-conexiones` (Dyn/YNd/YNyn, desfase horario, polaridad, paralelo) | ✅ |
| 3 | `calculos-nominales` (S, V, I por devanado; relación teórica con √3; corriente nominal) | ✅ |
| 4 | `impedancia-cortocircuito` (Z de par → estrella equiv. 3 ramas; base común; secuencia cero) | ✅ |
| 5 | `placa-caracteristica` (lectura de nameplate IEEE C57.12.00 / IEC 60076-1) | ✅ |
| 6 | `regulacion-tomas` (OLTC/DETC, rango, efecto en relación y %Z) | ✅ |
| 7 | `sistema-refrigeracion` (ONAN/ONAF/OFAF/ODAF, etapas, capacidad por modo) | ✅ |

### B. Construcción y componentes
| # | Skill | Estado |
|---|---|---|
| 8 | `construccion-nucleo-devanados` (shell vs core form, fuerzas, estructura) | ✅ |
| 9 | `bujes-y-accesorios` (condenser/no-condenser, C1/C2, FP de buje; tanque, conservador, Buchholz) | ✅ |

### C. Gestión / diagnóstico / mantenimiento (overview, enruta a `pruebas-electricas`)
| # | Skill | Estado |
|---|---|---|
| 10 | `gestion-vida-activo` (papel/DP, hot-spot IEEE C57.91, Montsinger, MTMP/condición) | ✅ |
| 11 | `modos-falla-diagnostico` (esfuerzos → deterioro → modos de falla; mapa síntoma→ensayo→lóbulo) | ✅ |

## Fuentes base (se ampliará con más documentos del director)

- **ABB — Service Handbook for Transformers** (V4 rev3) — diseño, construcción, riesgo (MTMP), diagnóstico, análisis de falla. Legible.
- **EG — Ernesto Gallo Martínez, "Diagnóstico y Mantenimiento a Transformadores en Campo", 3ª ed. 2021** (Transequipos S.A.) — ✅ ingerido (entregado comprimido a 39 MB). Fuente colombiana de campo. Cap. 6 (protecciones + refrigeración IEEE) ya plasmado en `_conocimiento/00-fundamentos-transformador.md §E`. Caps 1/3/4 (aceite/DGA/ensayos) → alimentan el lóbulo hermano `pruebas-electricas`. Mapa de capítulos → `docs/50-TRANSFORMADORES-POTENCIA.md`.
- **Web** (investigación propia, citada en cada neurona): IEEE C57.12.00/.12.90/.158/.12.70/.91/.104, IEC 60076-1/-2/-8, bibliografía (Harlow, Blume), fabricantes.
- **Interno**: MO.00418.DE-GAC-AX.01 Ed. 02 (criterios AFINIA — el director confirma valores).

> ⚠️ **Regla del proyecto**: nunca inventar valores normativos. Todo número no confirmable
> contra fuente pública se marca `⚠️ verificar` y usa mientras tanto el piso más conservador.
