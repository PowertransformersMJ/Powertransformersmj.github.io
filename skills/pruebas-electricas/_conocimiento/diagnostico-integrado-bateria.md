# Diagnóstico integrado de la batería — convergencia de evidencias

> **Neurona COMPARTIDA por las 13 skills.** Principio rector (IEEE C57.152): **ningún
> ensayo diagnostica solo.** Un veredicto robusto nace de la **convergencia** de varias
> pruebas que apuntan a la misma causa. Esta neurona es el mapa cruzado: dado un hallazgo
> en una prueba, qué OTRAS pruebas lo confirman o lo descartan. Cada skill enlaza aquí
> desde su `04-diagnostico.md`.

---

## 1) Por qué cruzar pruebas (no condenar con una sola)

- Una IR baja puede ser **humedad**, **contaminación superficial de bujes** (fuga externa,
  no del aislamiento) o **temperatura mal corregida**. Solo otras pruebas distinguen cuál.
- Un FP/tan δ alto puede ser humedad **o** envejecimiento del aceite **o** contaminación.
- La **tendencia** convierte un valor "aceptable" en una alarma si cae vs el baseline.

Regla: **una sola prueba anómala = INVESTIGAR; dos o más convergentes = diagnóstico.**

---

## 2) Matriz de convergencia (causa probable → qué pruebas la confirman)

| Causa raíz | Señal primaria | Confirman (convergencia) | Descartan |
|---|---|---|---|
| **Humedad en celulosa** | IR₂₀↓, **PI/DAR bajos** (PI<1.5) | FP/tan δ alto y creciente con T (>Tabla 100.3); **agua en aceite** (ASTM D1533); **% humedad papel por DFR**; recuperación tras secado | DGA sin gases de falla → confirma que la baja IR es humedad, no otro mecanismo |
| **Contaminación / fuga superficial bujes** | IR **inestable/fluctuante**; FP de buje alto | FP/hot-collar por buje; mejora al limpiar y usar **guarda** | IR estable con guarda → era trayectoria externa, aislamiento interno sano |
| **Defecto localizado en un devanado** | IR↓ **solo en un lazo** (p.ej. AT–tierra) | FP por devanado; relación/excitación anómala en ese devanado; inspección | otros lazos normales → localiza el defecto |
| **Problema entre devanados (CHL)** | IR AT–BT↓ con AT–tierra y BT–tierra ok | FP CHL alto; reactancia de dispersión anómala | — |
| **Falla térmica / punto caliente** | DGA: gases térmicos (CH₄, C₂H₄, C₂H₆) | **resistencia de devanados** desbalanceada; FP; termografía; relación de Rogers/Duval | IR/PI normales → no es problema del sólido seco |
| **Arco / descarga parcial** | DGA: H₂, C₂H₂ | FP↑; **excitación** anómala; SFRA con desviación; PD (IEC) | — |
| **Deformación mecánica / cortocircuito** | **SFRA** con desviación de huella; reactancia de dispersión cambiada | relación↑/↓; excitación; corriente de cortocircuito previa | SFRA coincide con baseline → sin deformación |
| **Cambiador de tomas (LTC) degradado** | resistencia de contactos↑; DGA del compartimiento LTC | relación por TAP; excitación por posición; termografía | — |
| **Envejecimiento del aceite** | FP del aceite↑; rigidez dieléctrica↓ | acidez, color, contenido de agua, furanos (papel) | DGA sin gases de falla activa |

---

## 3) Pirámide de decisión (de barato/rápido a caro/concluyente)

```
1. IR / PI / DAR        ← cribado barato (¿hay algo raro?)
2. FP / tan δ           ← estado global del aislamiento + bujes
3. Relación / Excitación / R devanados ← integridad eléctrica del núcleo/bobinas
4. Análisis de aceite + DGA            ← química: humedad, gases, envejecimiento
5. DFR (respuesta dieléctrica)         ← % humedad del papel (concluyente)
6. SFRA                                ← integridad mecánica (deformación)
```

Subir de nivel solo cuando el anterior dispara sospecha **o** la criticidad del activo lo
exige. No condenar en el nivel 1; tampoco saltar al 6 sin motivo.

---

## 4) Cómo se usa desde una skill

Cada `04-diagnostico.md` (por prueba) detecta un patrón y **viene aquí** para:
1. Buscar la fila de la causa sospechada en la matriz §2.
2. Listar las pruebas convergentes que el ingeniero debe correr/consultar para confirmar.
3. Emitir el diagnóstico solo si hay convergencia; si no, **INVESTIGAR** + qué falta medir.

> Enlace con el tablero: la pestaña **Tendencia** + el histórico de informes alimentan el
> punto §1 (muchas condenas válidas vienen de la pendiente, no del valor puntual).
