# Gestión de mantenimiento predictivo — del veredicto a la acción

> **Neurona COMPARTIDA por las 13 skills.** Un criterio robusto no termina en "APRUEBA/
> RECHAZA": debe **apalancar la decisión** — qué acción tomar, con qué urgencia y a qué
> intervalo re-ensayar. Esta neurona traduce el veredicto multi-norma + el diagnóstico
> convergente en **acciones preventivas/correctivas** para la gestión especializada de
> mantenimiento **predictivo** (CBM/PdM) de transformadores de potencia. Cada `04-diagnostico.md`
> enlaza aquí para cerrar el lazo decisión→acción.

---

## 1) Filosofía: predictivo (CBM) sobre correctivo y sobre calendario

- **Correctivo** (reactivo): actuar tras la falla → el más caro, indeseado en activos críticos.
- **Preventivo por calendario** (TBM): intervenir cada X tiempo, falle o no → desperdicia vida útil.
- **Predictivo / basado en condición** (PdM/CBM): la **tendencia de los ensayos** anticipa la
  degradación y dispara la acción **antes** de la falla, en el momento óptimo. ← objetivo del SGM.

> El motor predictivo es la **TENDENCIA**, no el valor puntual (IEEE C57.152). Un valor que
> "pasa" pero cae sostenidamente vs baseline es la señal temprana que justifica actuar.

---

## 2) Escalera veredicto → acción (condition-based)

| Veredicto consolidado | Estado del activo | Acción | Intervalo de re-ensayo |
|---|---|---|---|
| **APRUEBA** + tendencia estable | Sano | Operación normal; registrar baseline | Rutinario (ver §4) |
| **APRUEBA** + tendencia ↓ leve | Sano con deriva | **Vigilancia**: acortar intervalo; sumar prueba convergente | Reducido (p.ej. ½ del rutinario) |
| **INVESTIGAR** | Sospecha / incipiente | **Acción preventiva**: pruebas convergentes (§diagnóstico-integrado), inspección dirigida, posible tratamiento (secado/filtrado/regeneración de aceite) | Corto (semanas–meses) hasta aclarar |
| **RECHAZA** (no crítico) | Degradado | **Correctivo planificado**: intervención programada (reacondicionamiento, cambio de componente) | Tras la intervención, re-ensayar |
| **RECHAZA** (peligroso: PI<1.0 / IR≪mín / DGA arco / SFRA deformación) | Riesgo de falla | **No energizar / sacar de servicio**: correctivo inmediato + escalamiento | Re-ensayo obligatorio post-intervención |

---

## 3) Priorización: criticidad del activo × severidad de la condición

```
PRIORIDAD = criticidad(activo) × severidad(condición)
```
- **Criticidad del activo**: potencia, rol en la red (¿radial sin respaldo?), carga servida,
  costo de indisponibilidad, antigüedad. Un tx de subestación cabecera pesa más que uno redundante.
- **Severidad de la condición**: cuán lejos del criterio + velocidad de la tendencia + nº de
  pruebas convergentes que apuntan a la misma falla.
- Dos activos "INVESTIGAR" no son iguales: el de mayor criticidad va primero en la cola de acción.

---

## 4) Intervalos de referencia (ajustar por condición y criticidad)

> Orientativos (NETA MTS / IEEE C57.152 / práctica de industria). **La condición manda sobre el
> calendario**: un hallazgo acorta el intervalo automáticamente.

| Familia de prueba | Intervalo rutinario típico | Se acorta si… |
|---|---|---|
| Visual/termografía/aceite en servicio (DGA, humedad) | 6–12 meses (DGA más frecuente en críticos) | gases en ascenso, carga alta, histórico de fallas |
| Eléctricas off-line (IR/PI, FP/tan δ, relación, excitación, R devanados) | 1–3 años (o en mantenimiento mayor) | tendencia adversa, evento (cortocircuito pasante, sobretensión) |
| SFRA / DFR | baseline + tras evento o ante sospecha mecánica/humedad | impacto mecánico, fallas cercanas, FP/humedad anómalos |
| LTC (resistencia dinámica, DGA del compartimiento) | según nº de operaciones + tiempo | conteo de maniobras alto, gases en LTC |

---

## 5) Disparadores de acción correctiva específica (catálogo)

| Hallazgo convergente | Acción correctiva típica |
|---|---|
| Humedad en celulosa (IR/PI↓ + FP↑ + agua + DFR) | **Secado** (vacío/calor); re-ensayar para verificar recuperación |
| Aceite degradado (FP aceite↑, rigidez↓, acidez↑) | **Filtrado/regeneración o cambio** de aceite |
| Gases de falla térmica (DGA) | localizar punto caliente (R devanados, termografía); evaluar carga |
| Gases de arco / PD | fuera de servicio; inspección interna |
| Deformación mecánica (SFRA/reactancia) | evaluación estructural; posible reparación en fábrica |
| Buje degradado (FP/cap. buje) | **reemplazo del buje** (riesgo de explosión) |
| LTC con contactos degradados | mantenimiento/overhaul del LTC |

---

## 6) Cómo se usa desde una skill

`04-diagnostico.md` → identifica patrón → confirma por convergencia
(`diagnostico-integrado-bateria.md`) → **viene aquí** para emitir: (a) acción
preventiva/correctiva, (b) urgencia según criticidad×severidad, (c) intervalo de re-ensayo.
Así el output no solo evalúa: **recomienda la acción y cuándo volver a medir**, alimentando la
planificación del mantenimiento predictivo (y la pestaña Tendencia del tablero).
