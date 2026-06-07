---
name: reactancia-dispersion
description: >-
  Calcula, evalúa y diagnostica la prueba de REACTANCIA DE DISPERSIÓN /
  IMPEDANCIA DE CORTOCIRCUITO de transformadores de potencia: compara la
  impedancia medida en campo (devanado energizado con el opuesto en
  cortocircuito) contra el valor de placa (Z% nameplate) para detectar
  deformación mecánica de devanados tras un cortocircuito pasante. Aplica el
  criterio ANSI/NETA ATS-2025 §7.2.2 (3φ equivalente: investigar si >3% vs
  placa; por fase: no desviar >3% del promedio de las 3 lecturas) + IEEE
  C57.152 + IEC 60076. Úsala SIEMPRE que aparezcan datos de leakage reactance,
  reactancia de fuga/dispersión, impedancia de cortocircuito, short-circuit
  impedance, Z%, impedancia equivalente, %X medido vs placa, desviación de
  impedancia, FRSL, o sospecha de desplazamiento/deformación de devanados,
  cortocircuito pasante o impacto mecánico — aunque no se nombre la norma.
---

# Reactancia de Dispersión / Impedancia de Cortocircuito — Transformadores de potencia

Esta skill convierte la impedancia medida en campo en un **veredicto trazable** de
integridad mecánica del devanado: comparada contra la placa y entre fases, te dice si
la geometría bobina–bobina sigue intacta o si un cortocircuito pasante la deformó.

## Por qué importa hacerlo bien

La reactancia de dispersión depende directamente de la **geometría física** del conjunto
de devanados (separación, altura, concentricidad). Si un cortocircuito pasante o un
impacto desplaza o pandea un devanado, la impedancia cambia **antes** de que falle el
aislamiento. Tres errores invalidan el veredicto: (1) **comparar %Z sin la misma base**
(kVA/tensión) que la placa; (2) **leer solo la 3φ equivalente** y perder una deformación
en una sola fase que el promedio diluye; (3) **condenar con la sola impedancia** sin
cruzar con SFRA — ambas miran integridad mecánica y deben converger. Esta skill te obliga
a evitar los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): impedancia/reactancia
   medida por fase y 3φ equivalente, **%Z de placa** (y su base kVA/kV), corriente y
   tensión de inyección (validar caída 30–100 VAC), TAP en el que se midió, y datos
   históricos/fase hermana si existen.
2. **Normaliza a la misma base**: lleva el %Z medido a la base de placa (kVA/kV) antes de
   comparar. → `references/02-calculos.md`.
3. **Calcula desviaciones**: (a) 3φ equivalente vs placa (%); (b) cada fase vs el promedio
   de las 3 lecturas (%). → `references/02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): veredicto contra cada óptica aplicable (fábrica/placa
   > clase MO.00418 > NETA §7.2.2 D.10 > IEEE C57.152 > IEC 60076) + tendencia, consolidando
   en el peor y citando el criterio. → `references/03-criterios-evaluacion.md` +
   `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica** si algo desvía: ¿deformación axial, radial, espira en corto? Confirma por
   **convergencia** (SFRA + excitación + relación + histórico de cortocircuitos) →
   `references/04-diagnostico.md` + `../_conocimiento/diagnostico-integrado-bateria.md`.
   Acción/intervalo → `../_conocimiento/gestion-mantenimiento-predictivo.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: Reactancia de dispersión / impedancia de cortocircuito — <tag/serie del tx>
Condiciones: TAP=<pos> | I iny=<A> | V caída=<VAC> | base placa=<kVA/kV>
Resultados (a base de placa):
  3φ equivalente:  %Z_medido=<…>   %Z_placa=<…>   Δ=<…%>
  Por fase:  A=<…>  B=<…>  C=<…>   promedio=<…>   Δmax fase=<…%>
CRITERIOS APLICADOS (por óptica):
  • Fábrica/placa (Z% nameplate): Δ → [✔/✘]            (precedencia 1)
  • Interno por clase (MO.00418): <umbral> → [✔/✘]      (precedencia 2)
  • NETA §7.2.2 D.10: 3φ >3% placa ✘ | fase >3% promedio ✘ → [✔/✘]  (precedencia 3)
  • IEEE C57.152 / IEC 60076: [✔/✘]
  • Tendencia vs histórico: [estable / cambió tras evento]
  ⊳ Divergencias: <p.ej. 3φ pasa pero una fase desvía >3% → deformación local>
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>  — <criterio más conservador citado>
Diagnóstico: <causa probable + pruebas convergentes (SFRA/excitación/relación)>
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — qué es la reactancia de dispersión, su vínculo con la geometría.
- `references/02-calculos.md` — fórmulas (%Z, normalización de base, desviaciones) + ejemplos.
- `references/03-criterios-evaluacion.md` — umbrales (3% NETA) con cita normativa + matriz.
- `references/04-diagnostico.md` — patrones de deformación → causa + troubleshooting.
- Compartidas: `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (batería + criterio D.10),
  `../_conocimiento/tablas-neta-referencia.md` (tablas 100.x),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
