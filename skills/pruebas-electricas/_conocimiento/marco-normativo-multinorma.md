# Marco normativo multi-norma — evaluar desde varias ópticas

> **Neurona COMPARTIDA por las 13 skills.** Un veredicto robusto NO sale de una sola
> norma: cada estándar mira el aislamiento desde un ángulo distinto. Esta neurona define
> **qué norma cubre qué**, **cómo se reconcilian cuando difieren**, y el **formato de
> veredicto multi-norma** que toda skill debe emitir. El objetivo (pedido del director):
> dar panorama desde distintos puntos de vista para apalancar mejor precisión diagnóstica.

---

## 1) Catálogo de normas en juego (qué aporta cada una)

| Norma / fuente | Tipo | Qué aporta a la evaluación | Qué NO da |
|---|---|---|---|
| **ANSI/NETA ATS-2025** (Aceptación) · **MTS** (Mantenimiento) | Aceptación/mantenimiento en campo | **Tablas de criterio numérico**: 100.5 (IR mín. por tensión de bobina), 100.3 (FP/tan δ), 100.4 (aceite ASTM), 100.14 (corrección de T). Pisos de aceptación claros. | No explica el "por qué" físico; criterios genéricos (no por clase fina). |
| **IEEE C57.152** | Guía de diagnóstico en campo (tx en líquido) | **Interpretación** de IR/PI/DAR, FP, excitación, DGA, DFR, SFRA; **énfasis en tendencia** y en correlacionar ensayos. Corrección de T. | Pocas tablas de "pasa/no pasa" absolutas; es guía, no límite duro. |
| **IEEE C57.12.90 / .91** | Código de ensayo / carga | Métodos de ensayo en fábrica/rutina (relación, resistencia, excitación, pérdidas). | No es criterio de campo. |
| **IEEE C57.104** | DGA | Tablas de concentración de gases / estados de riesgo. | Solo aceite/gases. |
| **IEC 60076-1/-3** | Niveles de aislamiento y **ensayos dieléctricos** (withstand, impulso, PD) | Niveles de tensión soportada, PD (≤100 pC típ.), distancias. Marco internacional. | ⚠️ **NO da umbrales de IR/PI en MΩ** — gobierna *withstand*, no resistencia de aislamiento. No esperar de IEC un mínimo de IR. |
| **Interno AFINIA — MO.00418.DE-GAC-AX.01 Ed. 02** | Norma del proyecto/cliente | Criterio **por CLASE de tensión** (más estricto que NETA genérico). Es la referencia activa del tablero. | Verificar la fuente exacta de cada umbral por clase. |
| **Dato de fábrica / placa (commissioning)** | Baseline del equipo | **Máxima precedencia**: el valor del propio tx en puesta en servicio. | Solo si existe registro; si no, caer a tablas. |
| **Práctica clásica (Megger/Doble) ≈ IEEE 43** | Industria | Escala PI/DAR (PI 2–4 "bueno", etc.), regla `kV+1`. | ⚠️ **IEEE 43 es para máquinas rotativas y EXCLUYE explícitamente los transformadores** → la escala PI se usa en tx **por analogía de industria**, no como norma de tx. Tratar como apoyo, no como criterio duro. |

---

## 2) Jerarquía de PRECEDENCIA (qué número manda cuando hay que elegir uno)

NETA es explícita: **el dato del fabricante manda**. Orden de mayor a menor:

```
(1) Dato de fábrica / commissioning del propio tx   ← el más fuerte
(2) Criterio interno por CLASE de tensión (MO.00418) ← más estricto que NETA
(3) Tabla NETA genérica (100.5 / 100.3 / 100.4)      ← piso de aceptación
(4) Práctica clásica / regla del pulgar              ← solo sanity-check
```

> La precedencia define **qué valor se cita como "el criterio"**. NO significa ignorar el
> resto: el veredicto multi-norma (§4) muestra TODAS las ópticas aunque una mande.

---

## 3) Doctrina de reconciliación (cuándo difieren)

1. **Calcula el veredicto contra CADA criterio aplicable** por separado (no mezclar).
2. **Veredicto consolidado = el PEOR (más conservador)** de los individuales, citando el
   criterio que lo determina. La seguridad del equipo pesa sobre el "pasa por poco".
3. **Marca DÓNDE divergen** las normas — esa divergencia ES información para el ingeniero
   (ej. "pasa el piso NETA pero falla el criterio por clase" = aislamiento mediocre, no
   sano: ver caso 110 kV abajo).
4. **La tendencia (histórico) puede condenar aunque todas las tablas pasen** (IEEE C57.152):
   una caída marcada vs baseline es señal de degradación. La pendiente pesa tanto como el valor.
5. **Si solo una norma cubre el fenómeno** (ej. DGA → IEEE C57.104), esa manda en su dominio.

### Caso testigo — IR de tx 110 kV (resuelve la ambigüedad de criterio)

Un valor medido de 5–6 GΩ @ 20 °C en un devanado de 110 kV:
- **vs NETA Tabla 100.5** (`>5000 V → 5 GΩ líquido`): **PASA el piso** (apenas).
- **vs criterio interno por clase** (`110 kV → 30 GΩ`, `NETA_IR_MIN_GOHM`): **FALLA** (es 1/5 del mínimo).
- **Lectura consolidada**: aislamiento **POBRE / INVESTIGAR** — supera el piso absoluto pero
  está muy por debajo de lo esperado para su clase. Mostrar **ambos** veredictos da la óptica
  completa: no es "rechazo catastrófico" (pasó NETA) pero tampoco "sano" (reprobó por clase).

> ⚠️ El `30 GΩ` por clase está **pendiente de verificar** contra la edición de norma del
> director (IEEE C57.152 por clase vs MO.00418). Hasta confirmarlo: usar el criterio por
> clase como **primario** y la Tabla 100.5 como **piso absoluto** — y reportar ambos.

---

## 4) Formato de veredicto MULTI-NORMA (toda skill lo emite)

```
CRITERIOS APLICADOS (por óptica):
  • Fábrica/commissioning: <valor baseline> → [✔/✘/—]   (precedencia 1)
  • Interno por clase (MO.00418): <umbral> → [✔/✘]        (precedencia 2)
  • NETA <tabla>: <umbral> → [✔/✘]                        (precedencia 3 · piso)
  • IEEE C57.152 (PI/DAR/interpretación): <umbral> → [✔/✘]
  • Tendencia vs histórico: [estable / ↓↓ degrada]
  ⊳ Divergencias: <dónde las normas no coinciden y qué significa>
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>
  └ determinado por: <criterio más conservador citado>
```

**Regla de oro**: nunca un solo "✔/✘" pelado. Siempre el set de ópticas + el consolidado +
la divergencia. Eso es lo que da "panorama desde distintos puntos de vista".
