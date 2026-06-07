---
name: relacion-transformacion
description: >-
  Calcula, evalúa y diagnostica la prueba de RELACIÓN DE TRANSFORMACIÓN (TTR ·
  turns ratio) de transformadores de potencia: relación medida vs relación
  calculada por placa en TODAS las posiciones de TAP, desviación porcentual,
  corriente de excitación y desfase, con criterio de aceptación ANSI/NETA
  ATS-2025 (≤0.5%) e IEEE C57.152 / C57.12.90. Úsala SIEMPRE que aparezcan datos
  de TTR, relación de transformación, turns ratio, ratiómetro, TTR-meter,
  "transformer turns ratio", relación de espiras, lecturas por TAP/posición del
  conmutador, %error/desviación de relación, ratio nominal, vector/grupo de
  conexión, o cuando haya que decidir si un transformador "pasa" la prueba de
  relación, detectar espiras en corto, conexiones erróneas, problemas de TAP o
  un devanado abierto — aunque el usuario no nombre la norma.
---

# Relación de Transformación (TTR) — Transformadores de potencia

Esta skill convierte lecturas crudas de ratiómetro en un **veredicto trazable**:
la relación medida por TAP comparada contra la relación calculada por placa, con
la desviación % evaluada bajo la norma que aplica y un diagnóstico de qué falla
revela una desviación.

## Por qué importa hacerlo bien

La TTR es la prueba que verifica que las espiras del transformador están **íntegras
y correctamente conectadas**. Tres errores típicos invalidan el veredicto: (1) **no
medir TODOS los TAPs** — un conmutador defectuoso o una espira en corto puede
aparecer solo en una posición; (2) **comparar contra el ratio equivocado** (línea-línea
vs fase-fase según el grupo de conexión Dyn/Yyn) — el factor √3 cambia el ratio de
placa; (3) **leer la desviación sin la corriente de excitación** que la acompaña —
una desviación con excitación alta apunta a espiras en corto, no a un simple TAP. Esta
skill te obliga a evitar los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): tensiones de placa
   AT/BT por posición de TAP, grupo de conexión (vector), relación medida por fase y por
   TAP, corriente de excitación y desfase del ratiómetro si los entrega, dato de fábrica
   si existe.
2. **Calcula la relación nominal** por TAP: `R_calc = V_AT / V_BT` (ajustada por el factor
   de conexión √3 según Dyn/Yyn/Dd). → `references/02-calculos.md`.
3. **Calcula la desviación** por fase y TAP: `%dev = (R_medida − R_calc) / R_calc × 100`.
   → `references/02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): calcula el veredicto contra cada óptica aplicable
   (fábrica > clase MO.00418 > NETA ≤0.5% > IEEE C57.152/C57.12.90) + tendencia, y consolida
   en el peor citando el criterio. → `references/03-criterios-evaluacion.md` +
   `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica** si algo no pasa: ¿espira en corto, devanado abierto, TAP, conexión errónea?
   Confirma por **convergencia** (excitación + resistencia de devanados + SFRA + DGA) →
   `references/04-diagnostico.md` + `../_conocimiento/diagnostico-integrado-bateria.md`; cierra
   con acción + intervalo → `../_conocimiento/gestion-mantenimiento-predictivo.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: Relación de transformación (TTR) — <tag/serie del tx>
Condiciones: grupo de conexión = <Dyn11…> | TAPs medidos = <n/n>
Resultados por TAP (fase A/B/C):
  TAP 1 (nominal):  R_calc=<…>  R_med A/B/C=<…>  %dev A/B/C=<…>  Iexc=<…>
  TAP n:            …
CRITERIOS APLICADOS (por óptica):
  • Fábrica/commissioning: <ratio baseline> → [✔/✘/—]      (precedencia 1)
  • Interno por clase (MO.00418): <umbral %dev> → [✔/✘]     (precedencia 2)
  • NETA ATS-2025 §7.2.2 (≤0.5%): [✔/✘]                     (precedencia 3 · piso)
  • IEEE C57.152 / C57.12.90 (±0.5%): [✔/✘]
  • Tendencia vs histórico: [estable / deriva]
  ⊳ Divergencias: <p.ej. todos los TAPs ok salvo TAP 5 → conmutador>
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>  — <criterio más conservador citado>
Diagnóstico: <causa probable + pruebas convergentes que la confirman>
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — qué mide la TTR, relación de espiras, qué fallas revela.
- `references/02-calculos.md` — fórmulas exactas (ratio por conexión, %dev) + ejemplos.
- `references/03-criterios-evaluacion.md` — todos los umbrales con cita normativa.
- `references/04-diagnostico.md` — interpretación y troubleshooting.
- Compartidas: `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (contexto de la batería completa),
  `../_conocimiento/tablas-neta-referencia.md` (tablas 100.x de referencia),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
