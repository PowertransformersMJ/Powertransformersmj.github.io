---
name: factor-potencia-aislamiento
description: >-
  Calcula, evalúa y diagnostica la prueba de FACTOR DE POTENCIA / TANGENTE DELTA
  (tan δ, FP, factor de disipación, DF) del AISLAMIENTO de devanados de
  transformadores de potencia (equipo Doble / Megger): modos CH (AT–tierra),
  CL (BT–tierra) y CHL (entre devanados), con corrección de temperatura a 20 °C
  y criterio ANSI/NETA ATS-2025 Tabla 100.3 (aceite mineral ≤0.5 %, éster natural
  ≤1.0 %) e IEEE C57.152. Úsala SIEMPRE que aparezcan datos de tan δ, factor de
  potencia de aislamiento, factor de disipación, %FP, %DF, "power factor",
  "dissipation factor", lecturas CH/CL/CHL, mediciones Doble/DELTA/M4000, corriente
  de carga (mA) y pérdidas (mW/W), tip-up (FP vs tensión), GST/UST/GSTg, o cuando
  haya que decidir si un devanado "pasa" por humedad, envejecimiento o
  contaminación del aislamiento, corregir el FP por temperatura, o interpretar un
  tan δ alto/creciente — aunque el usuario no nombre la norma.
---

# Factor de Potencia / tan δ del aislamiento (CH · CL · CHL) — Transformadores de potencia

Esta skill convierte lecturas crudas de FP/tan δ (corriente de carga + pérdidas, o %FP
directo) en un **veredicto trazable**: corregidas por temperatura a 20 °C, comparadas
contra el criterio normativo que aplica, y con un diagnóstico de qué significa un tan δ
alto o creciente (humedad, envejecimiento, contaminación).

## Por qué importa hacerlo bien

El FP/tan δ mide la **calidad global del aislamiento** (pérdidas dieléctricas) y es la
prueba más sensible a humedad y envejecimiento del sistema papel-aceite. Tres errores
invalidan el veredicto: (1) **no corregir por temperatura** — el FP sube fuerte con la
temperatura y un 0.6 % a 35 °C puede ser un 0.4 % sano a 20 °C; (2) **comparar el FP
total sin separar los modos** CH/CL/CHL — un aislamiento entre devanados (CHL) malo se
diluye en el total; (3) **leer un valor aislado sin tendencia** — el motor de diagnóstico
es la **pendiente vs baseline**, no el número puntual. Esta skill te obliga a evitar los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): lecturas por modo
   (CH, CL, CHL) — %FP directo, o corriente de carga (mA) + pérdidas (mW) + kV de prueba;
   **temperatura del aislamiento** al ensayo; factor de corrección del fabricante del tx
   (preferente) o tabla genérica; datos de placa / commissioning si existen; tensiones de
   tip-up si se hizo barrido.
2. **Calcula el FP** desde corriente/pérdidas si no viene directo, y el **tip-up** (ΔFP
   entre dos tensiones) si hay barrido. → `references/02-calculos.md`.
3. **Corrige a 20 °C**: `FP₂₀ = FP_medido × K_T` con el factor del fabricante (preferente)
   o el genérico documentado. → `references/02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): veredicto contra cada óptica aplicable
   (fábrica > clase MO.00418 > NETA Tabla 100.3 > IEEE C57.152) + tendencia, y consolida
   en el peor citando el criterio. → `references/03-criterios-evaluacion.md` +
   `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica** si algo no pasa: ¿humedad, envejecimiento, contaminación? Confirma por
   **convergencia** (IR/PI + agua en aceite + DGA + DFR) →
   `references/04-diagnostico.md` + `../_conocimiento/diagnostico-integrado-bateria.md`;
   y traduce a acción + intervalo → `../_conocimiento/gestion-mantenimiento-predictivo.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: Factor de potencia / tan δ del aislamiento — <tag/serie del tx>
Condiciones: T aislamiento = <°C> | kV prueba = <kV> | líquido = <mineral/éster>
Resultados (corregidos a 20 °C):
  CH  (AT–tierra):   FP_medido=<…%> → FP₂₀=<…%>   [I_carga=<mA> · pérdidas=<mW>]
  CL  (BT–tierra):   …
  CHL (entre dev.):  …
Tip-up (si hay):  ΔFP=<FP@V2 − FP@V1>=<…> → [plano / sube = ionización/voids]
CRITERIOS APLICADOS (por óptica):
  • Fábrica/commissioning: <FP baseline> → [✔/✘/—]        (precedencia 1)
  • Interno por clase (MO.00418): <umbral %> → [✔/✘]       (precedencia 2)
  • NETA Tabla 100.3 (mineral ≤0.5% / éster ≤1.0%): [✔/✘]  (precedencia 3 · piso)
  • IEEE C57.152 (interpretación + tendencia): [✔/✘]
  • Tendencia vs histórico: [estable / ↑↑ degrada]
  ⊳ Divergencias: <p.ej. CH/CL ok pero CHL alto → defecto entre devanados>
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>  — <criterio más conservador citado>
Diagnóstico: <causa probable + pruebas convergentes que la confirman>
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — qué mide el FP/tan δ, pérdidas dieléctricas, modos CH/CL/CHL, tip-up.
- `references/02-calculos.md` — fórmulas (FP desde I/pérdidas, corrección de temp, tip-up) + ejemplos.
- `references/03-criterios-evaluacion.md` — todos los umbrales con cita normativa (matriz multi-norma).
- `references/04-diagnostico.md` — interpretación y troubleshooting por patrón.
- Compartidas: `../_conocimiento/tablas-neta-referencia.md` (Tabla 100.3 y 100.14),
  `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (contexto de la batería completa),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
