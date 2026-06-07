---
name: resistencia-devanados
description: >-
  Calcula, evalúa y diagnostica la prueba de RESISTENCIA ÓHMICA DE DEVANADOS
  (winding resistance) de transformadores de potencia: medición Kelvin / 4 hilos
  en mΩ, corrección a temperatura de referencia (Tk=234.5 cobre / 225 aluminio),
  desbalance entre fases y comparación vs fábrica/previos, con criterio ANSI/NETA
  ATS-2025 §7.2.2 (≤2%) e IEEE C57.152 (I prueba ≤10% In) / C57.12.90. Úsala
  SIEMPRE que aparezcan datos de resistencia de devanados, winding resistance,
  resistencia óhmica, ohmímetro de baja resistencia, micro-ohmios/milliohmios,
  método de 4 hilos / Kelvin, corrección por temperatura de resistencia,
  desbalance entre fases, resistencia por TAP, estabilización térmica, o cuando
  haya que decidir si un transformador "pasa" la prueba de resistencia de
  devanados, detectar malas conexiones, contactos del LTC, espiras abiertas o en
  corto — aunque el usuario no nombre la norma.
---

# Resistencia Óhmica de Devanados — Transformadores de potencia

Esta skill convierte lecturas crudas de ohmímetro de baja resistencia en un **veredicto
trazable**: corregidas a una temperatura de referencia, comparadas contra fábrica/previos
y evaluado el desbalance entre fases bajo la norma que aplica, con un diagnóstico de qué
falla revela una desviación.

## Por qué importa hacerlo bien

La resistencia de devanados detecta **malas conexiones, contactos degradados del LTC y
espiras abiertas/en corto** — defectos del cobre que otras pruebas no ven directamente. Tres
errores típicos invalidan el veredicto: (1) **no corregir por temperatura** — la resistencia
del cobre sube ~0.4%/°C, así que comparar lecturas a distinta T no tiene sentido; (2) **medir
sin estabilización térmica** — tras energizar o tras la inyección DC el devanado no está a T
uniforme y la lectura deriva; (3) **comparar valores absolutos sin baseline** — el criterio
es el **desbalance entre fases** y la **comparación vs fábrica/previos**, no un número aislado.
Esta skill te obliga a evitar los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): resistencia medida por
   fase y por TAP (Kelvin/4 hilos), **temperatura del devanado** al medir, material (cobre/
   aluminio), dato de fábrica/previos si existen, temperatura de referencia objetivo.
2. **Corrige a la temperatura de referencia**: `Rs = Rm·(Ts+Tk)/(Tm+Tk)` con Tk=234.5 (cobre)
   o 225 (aluminio). → `references/02-calculos.md`.
3. **Calcula el desbalance** entre las 3 fases del mismo TAP y la **desviación vs fábrica/previos**
   (ya corregidas a la misma T). → `references/02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): calcula el veredicto contra cada óptica aplicable
   (fábrica > clase MO.00418 > NETA ≤2% > IEEE C57.152) + tendencia, y consolida en el peor
   citando el criterio. → `references/03-criterios-evaluacion.md` +
   `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica** si algo no pasa: ¿mala conexión, contacto del LTC, espira abierta/en corto?
   Confirma por **convergencia** (TTR + excitación + termografía + DGA) →
   `references/04-diagnostico.md` + `../_conocimiento/diagnostico-integrado-bateria.md`; cierra
   con acción + intervalo → `../_conocimiento/gestion-mantenimiento-predictivo.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: Resistencia óhmica de devanados — <tag/serie del tx>
Condiciones: T devanado = <°C> | T ref = <°C> | material = <Cu/Al, Tk=234.5/225> | I prueba = <A>
Resultados (corregidos a T ref, mΩ):
  AT  fase A/B/C:  Rm=<…> → Rs=<…>   | desbalance = <%>
  BT  fase A/B/C:  …                  | por TAP: <…>
CRITERIOS APLICADOS (por óptica):
  • Fábrica/commissioning: <Rs baseline> → [✔/✘/—]        (precedencia 1)
  • Interno por clase (MO.00418): <umbral> → [✔/✘]          (precedencia 2)
  • NETA §7.2.2 (≤2% vs fábrica o entre fases): [✔/✘]        (precedencia 3 · piso)
  • IEEE C57.152 (método, I≤10% In) / C57.12.90: [✔/✘]
  • Tendencia vs histórico: [estable / ↑ degrada]
  ⊳ Divergencias: <p.ej. dentro de 2% global pero TAP 3 alto → contacto LTC>
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>  — <criterio más conservador citado>
Diagnóstico: <causa probable + pruebas convergentes que la confirman>
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — qué mide la R de devanados, Kelvin/4 hilos, qué fallas revela.
- `references/02-calculos.md` — fórmulas exactas (corrección de T, desbalance) + ejemplos.
- `references/03-criterios-evaluacion.md` — todos los umbrales con cita normativa.
- `references/04-diagnostico.md` — interpretación y troubleshooting.
- Compartidas: `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (contexto de la batería completa),
  `../_conocimiento/tablas-neta-referencia.md` (tablas 100.x de referencia),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
