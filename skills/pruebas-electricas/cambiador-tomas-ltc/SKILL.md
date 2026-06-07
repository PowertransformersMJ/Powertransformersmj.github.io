---
name: cambiador-tomas-ltc
description: >-
  Evalúa y diagnostica el CAMBIADOR DE TOMAS BAJO CARGA (LTC / OLTC) de
  transformadores de potencia: resistencia dinámica de contactos (DRM/DVtest),
  tiempos de transición y continuidad sin interrupción al cambiar de TAP.
  Compara firmas dinámicas vs ensayos previos y entre fases, integra la DGA del
  compartimiento del LTC (separado del tanque) y el conteo de operaciones para
  fijar el intervalo. Detecta contactos quemados, coordinación errónea,
  transición abierta y resistores de transición fuera de valor. Aplica ANSI/NETA
  ATS-2025 §7.2.2 (comparar vs previos) + IEEE C57.139/C57.152 + IEC 60214.
  Úsala SIEMPRE que aparezcan datos de LTC, OLTC, cambiador de tomas bajo carga,
  tap changer, DRM, resistencia dinámica, DVtest, tiempo de transición,
  transición abierta, resistor de transición/desviador, conteo de operaciones,
  DGA del LTC/compartimiento, motor-drive, o sospecha de contactos
  quemados/coordinación — aunque no se nombre la norma.
---

# Cambiador de Tomas Bajo Carga (LTC / OLTC) — Transformadores de potencia

Esta skill convierte las firmas dinámicas del LTC en un **veredicto trazable** de salud del
mecanismo de maniobra: si los contactos conmutan limpio, sin interrumpir corriente, dentro
de tiempos sanos, y si el aceite del compartimiento delata desgaste por arco.

## Por qué importa hacerlo bien

El LTC es el **componente que más se mueve** del transformador y la causa #1 de fallas en
muchos parques. Conmuta bajo carga decenas de miles de veces; sus contactos se erosionan y
el aceite de su compartimiento acumula gases de arco **separado del tanque principal**.
Tres errores invalidan el veredicto: (1) **mezclar la DGA del LTC con la del tanque** — son
poblaciones de gas distintas, el LTC arquea por diseño; (2) **leer la resistencia dinámica
sin comparar** vs previos/fases — la firma DRM es relativa; (3) **ignorar el conteo de
operaciones** que dispara el mantenimiento por desgaste. Esta skill te obliga a evitar los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): firma de resistencia
   dinámica (DRM/DVtest) por TAP y por fase, **tiempos de transición** (ms), valor de los
   resistores de transición, conteo de operaciones, DGA del **compartimiento del LTC**,
   y ensayos previos / fases hermanas para comparar.
2. **Analiza la firma DRM**: busca **picos de resistencia sin caída a cero** (continuidad =
   sin transición abierta) y resistores dentro de valor. → `references/02-calculos.md`.
3. **Mide tiempos de transición** y compara vs previos/fases (la transición de un OLTC tipo
   resistor es ≈ 40–60 ms ⚠️ verificar tipo). → `references/02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): veredicto contra cada óptica aplicable (previos/
   fábrica > clase MO.00418 > NETA §7.2.2 D.9 > IEEE C57.139/C57.152 > IEC 60214) + tendencia,
   consolidando en el peor y citando el criterio. → `references/03-criterios-evaluacion.md` +
   `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica**: ¿contactos quemados, coordinación errónea, transición abierta? Confirma
   por **convergencia** (DGA del LTC + termografía + relación por TAP + conteo) →
   `references/04-diagnostico.md` + `../_conocimiento/diagnostico-integrado-bateria.md`.
   Acción/intervalo (por nº de operaciones) → `../_conocimiento/gestion-mantenimiento-predictivo.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: Cambiador de tomas bajo carga (LTC/OLTC) — <tag/serie del tx>
Condiciones: TAPs ensayados=<rango> | nº operaciones=<conteo> | tipo=<resistor/reactor>
Resistencia dinámica (DRM) por fase/TAP:
  Continuidad (sin transición abierta): [✔ sin caída a 0 / ✘ interrupción detectada]
  Resistores de transición: medido=<…Ω> vs esperado=<…Ω> → [✔/✘]
Tiempos de transición:  A=<…ms>  B=<…ms>  C=<…ms>   vs previos=<…>
DGA del compartimiento LTC: <gases clave: C2H2/C2H4, ratios> → [normal arqueo / anómalo]
CRITERIOS APLICADOS (por óptica):
  • Previos/fábrica (firma DRM, tiempos): [✔ coincide / ✘ desvía]   (precedencia 1)
  • Interno por clase (MO.00418): <regla> → [✔/✘]                   (precedencia 2)
  • NETA §7.2.2 D.9 (comparar vs previos): [✔/✘]                    (precedencia 3)
  • IEEE C57.139/C57.152 · IEC 60214 (interpretación): [✔/✘]
  • Conteo de operaciones vs intervalo de mantenimiento: [dentro / vencido]
  ⊳ Divergencias: <p.ej. tiempos ok pero DGA del LTC con C2H2 alto → arco anómalo>
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>  — <criterio más conservador citado>
Diagnóstico: <causa probable + pruebas convergentes (DGA LTC / termografía / relación)>
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — qué es el LTC, transición resistiva sin interrupción, DRM.
- `references/02-calculos.md` — lectura de la firma DRM, tiempos, resistores, conteo + ejemplos.
- `references/03-criterios-evaluacion.md` — criterios (vs previos) con cita normativa + matriz.
- `references/04-diagnostico.md` — patrón→causa (contactos/coordinación/transición abierta).
- Compartidas: `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (batería + criterio D.9),
  `../_conocimiento/tablas-neta-referencia.md` (tablas 100.x),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo por operaciones).
