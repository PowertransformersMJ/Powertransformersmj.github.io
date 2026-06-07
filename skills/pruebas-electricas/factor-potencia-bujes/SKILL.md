---
name: factor-potencia-bujes
description: >-
  Calcula, evalúa y diagnostica la prueba de FACTOR DE POTENCIA / tan δ y
  CAPACITANCIA de BUJES (bushings) de transformadores de potencia (equipo Doble /
  Megger): aislamiento principal C1 (conductor↔tap), aislamiento del tap C2
  (tap↔brida), y prueba HOT-COLLAR para bujes sólidos/sin tap, con corrección de
  temperatura a 20 °C y criterio ANSI/NETA ATS-2025 §7.2.2.D.5 (FP varía >50 % vs
  placa = investigar; capacitancia >5 % vs placa = investigar; hot-collar >0.1 W /
  100 mW). Úsala SIEMPRE que aparezcan datos de FP/tan δ de bujes, capacitancia C1
  o C2 de buje, tap capacitivo / tap de potencia, hot-collar, comparación vs placa
  del buje, %FP buje, pF, bujes condensados (OIP/RIP/RBP), "bushing power factor",
  "C1 C2 capacitance", o cuando haya que decidir si un buje "pasa", detectar un buje
  degradado con RIESGO DE EXPLOSIÓN, corregir el FP por temperatura, o interpretar
  un cambio de capacitancia — aunque el usuario no nombre la norma.
---

# Factor de Potencia / tan δ y Capacitancia de Bujes (C1 · C2 · hot-collar) — Transformadores de potencia

Esta skill convierte lecturas crudas de FP/capacitancia de bujes (Doble) en un **veredicto
trazable**: corregidas por temperatura, comparadas contra la **placa del propio buje** (el
criterio rey) y contra el límite normativo, con un diagnóstico de qué significa un FP o una
capacitancia alterada — y una alerta de **riesgo de explosión** si el buje está degradado.

## Por qué importa hacerlo bien

Los bujes son la causa #1 de **fallas catastróficas** de transformadores: un buje condensado
degradado puede **explotar**, proyectando porcelana y aceite encendido. La prueba de FP +
capacitancia detecta la degradación **antes** de la falla. Tres errores invalidan el veredicto:
(1) **comparar contra un límite genérico** en vez de la **placa del propio buje** (cada buje
trae su FP y C1 de fábrica); (2) **ignorar el cambio de capacitancia** — un ΔC1 > 5 % significa
**capas del condensador en cortocircuito**, el precursor directo de la explosión; (3) **no
medir C2** (aislamiento del tap), por donde entra humedad. Esta skill te obliga a evitar los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): por buje — %FP y
   capacitancia **C1** (conductor↔tap) y **C2** (tap↔brida) si hay tap; **valores de placa**
   del buje (FP y C1 de fábrica); temperatura; tipo de buje (OIP/RIP/RBP, sólido); si no hay
   tap → datos de **hot-collar** (pérdidas en W/mW y corriente por sección).
2. **Corrige a 20 °C** el FP de cada medición (factor del fabricante del buje si lo da).
   → `references/02-calculos.md`.
3. **Compara contra placa**: %ΔFP vs placa y **%ΔC1 vs placa** (el indicador crítico).
   → `references/02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): veredicto contra cada óptica aplicable
   (placa del buje > clase MO.00418 > NETA §7.2.2.D.5 > IEEE C57.19.01/práctica Doble) +
   tendencia, y consolida en el peor citando el criterio. → `references/03-criterios-evaluacion.md`
   + `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica** si algo no pasa: ¿humedad en C2, capas en corto en C1, contaminación?
   Confirma por **convergencia** (DGA, FP del devanado, inspección) →
   `references/04-diagnostico.md` + `../_conocimiento/diagnostico-integrado-bateria.md`;
   y traduce a acción + urgencia (riesgo de explosión) →
   `../_conocimiento/gestion-mantenimiento-predictivo.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: FP / capacitancia de bujes — <tag/serie tx> · buje <fase/posición>
Condiciones: T = <°C> | tipo buje = <OIP/RIP/RBP/sólido> | kV prueba = <kV>
Resultados (corregidos a 20 °C):
  C1 (conductor↔tap):  FP_medido=<…%> → FP₂₀=<…%>   C1=<…pF>  | placa: FP=<…%> C1=<…pF>
  C2 (tap↔brida):      FP_medido=<…%> → FP₂₀=<…%>   C2=<…pF>
  Hot-collar (si no hay tap): pérdidas=<…W> por sección
Δ vs PLACA:  ΔFP=<…%>   ΔC1=<…%>   ← ΔC1 es el indicador crítico
CRITERIOS APLICADOS (por óptica):
  • Placa del buje (fábrica): FP≤placa+? · C1±? → [✔/✘/—]     (precedencia 1)
  • Interno por clase (MO.00418): <umbral> → [✔/✘]            (precedencia 2)
  • NETA §7.2.2.D.5: ΔFP>50% placa · ΔC1>5% · HC>0.1 W → [✔/✘] (precedencia 3 · piso)
  • IEEE C57.19.01 / práctica Doble: [✔/✘]
  • Tendencia vs histórico: [estable / ↑↑ degrada]
  ⊳ Divergencias: <p.ej. FP ok pero ΔC1>5% → capas en corto, peligro>
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA · RIESGO EXPLOSIÓN>  — <criterio citado>
Diagnóstico: <causa probable + pruebas convergentes>
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — qué mide el FP/cap. de buje, C1/C2, hot-collar, mecanismo de explosión.
- `references/02-calculos.md` — fórmulas (FP, ΔC1/ΔFP vs placa, corrección temp) + ejemplos.
- `references/03-criterios-evaluacion.md` — umbrales con cita normativa (matriz multi-norma).
- `references/04-diagnostico.md` — interpretación, troubleshooting y urgencia por riesgo.
- Compartidas: `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (criterio D.5 + contexto batería),
  `../_conocimiento/tablas-neta-referencia.md` (tablas de tx y corrección),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
