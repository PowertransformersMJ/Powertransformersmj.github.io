---
name: sfra
description: >-
  Evalúa y diagnostica el ANÁLISIS DE RESPUESTA EN FRECUENCIA DE BARRIDO
  (SFRA / FRA) de transformadores de potencia: compara la "huella" de respuesta
  en frecuencia medida contra un baseline (fábrica, ensayo previo, fases
  hermanas o unidad gemela) para detectar deformación mecánica, desplazamiento
  axial/radial de devanados, espiras en corto y problemas de núcleo. NO hay
  umbral numérico universal — se interpreta por BANDAS de frecuencia (baja =
  núcleo/circuito magnético; media = devanados/geometría; alta =
  conexiones/derivaciones/cables de prueba), apoyado en métricas de
  correlación. Aplica IEEE C57.149 + IEC 60076-18 + ANSI/NETA ATS-2025 §7.2.2.
  Úsala SIEMPRE que aparezcan datos de SFRA, FRA, frequency response, respuesta
  en frecuencia, sweep frequency, huella/firma en frecuencia, traza/curva de
  magnitud-fase vs Hz/kHz/MHz, comparación con baseline o fase hermana, o
  sospecha de deformación mecánica de devanados — aunque no se nombre la norma.
---

# SFRA / FRA — Análisis de respuesta en frecuencia de barrido — Transformadores de potencia

Esta skill convierte la huella SFRA en un **veredicto trazable** de integridad mecánica:
comparada contra un baseline y leída por bandas de frecuencia, te dice si el núcleo, los
devanados o las conexiones cambiaron — sin necesidad de abrir el transformador.

## Por qué importa hacerlo bien

SFRA es la prueba más sensible a **deformación mecánica**, pero también la más fácil de
malinterpretar porque **no tiene un umbral de "pasa/no pasa" en un número**. Tres errores
invalidan el veredicto: (1) **comparar contra un baseline no equivalente** (otra unidad sin
ser gemela, distinto montaje, distinto TAP o cables) → divergencias artificiales; (2)
**leer la traza completa como un todo** en vez de por **bandas** (cada banda apunta a un
subsistema distinto); (3) **condenar por una divergencia de alta frecuencia** que suele ser
solo el set-up de prueba (cables/aterrizaje), no el devanado. Esta skill te obliga a evitar
los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): trazas de magnitud
   (dB) y fase vs frecuencia (típ. 20 Hz–2 MHz ⚠️ verificar rango del equipo) por terminal,
   el **baseline de comparación** (fábrica > previo de la misma unidad > fase hermana >
   unidad gemela), TAP y configuración de medición idénticos al baseline.
2. **Verifica la repetibilidad del set-up**: mismo TAP, mismos cables/aterrizaje, mismo
   esquema de conexión que el baseline (si no, divergencia espuria). → `references/02-calculos.md`.
3. **Interpreta por BANDAS** (baja/media/alta) + calcula métricas de correlación (CC/ASLE
   /MM si el equipo las da) por banda. → `references/02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): veredicto contra cada óptica aplicable (baseline de
   fábrica > clase MO.00418 > NETA §7.2.2 D.7 > IEEE C57.149 > IEC 60076-18) + tendencia,
   consolidando en el peor y citando el criterio. → `references/03-criterios-evaluacion.md` +
   `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica** la banda que divergió: ¿núcleo, devanado, conexión? Confirma por
   **convergencia** (reactancia de dispersión + excitación + relación + histórico de evento) →
   `references/04-diagnostico.md` + `../_conocimiento/diagnostico-integrado-bateria.md`.
   Acción/intervalo → `../_conocimiento/gestion-mantenimiento-predictivo.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: SFRA / FRA — <tag/serie del tx>
Condiciones: rango=<Hz–MHz> | TAP=<pos> | baseline=<fábrica/previo/fase hermana/gemela>
Trazas comparadas: <terminales/devanados medidos>
Lectura por BANDAS (vs baseline):
  • Baja (≈<20 Hz–2 kHz>) núcleo/circuito magnético:   [coincide / desvía → …]
  • Media (≈<2 kHz–20 kHz>) devanados/geometría:        [coincide / desvía → …]
  • Alta (≈<20 kHz–2 MHz>) conexiones/derivaciones/cables: [coincide / desvía → …]
  Métrica de correlación (si hay): CC/ASLE por banda = <…>
CRITERIOS APLICADOS (por óptica):
  • Baseline fábrica/commissioning: [✔ coincide / ✘ desvía]   (precedencia 1)
  • Interno por clase (MO.00418): <regla> → [✔/✘]              (precedencia 2)
  • NETA §7.2.2 D.7 (comparar vs fábrica/previos): [✔/✘]       (precedencia 3)
  • IEEE C57.149 / IEC 60076-18 (interpretación por banda): [✔/✘]
  • Tendencia vs histórico/pre-evento: [estable / cambió]
  ⊳ Divergencias: <qué banda + a qué subsistema apunta>
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>  — <criterio/banda citados>
Diagnóstico: <subsistema afectado + pruebas convergentes (reactancia/excitación/relación)>
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — qué es SFRA, por qué la huella revela mecánica, las bandas.
- `references/02-calculos.md` — cómo se compara/correlaciona huellas + métricas (CC/ASLE/MM).
- `references/03-criterios-evaluacion.md` — criterios por banda + matriz multi-norma.
- `references/04-diagnostico.md` — banda→subsistema→causa + troubleshooting de set-up.
- Compartidas: `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (batería + criterio D.7),
  `../_conocimiento/tablas-neta-referencia.md` (tablas 100.x),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
