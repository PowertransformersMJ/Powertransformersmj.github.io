# 03 · Criterios de evaluación — identificar la construcción

> Norma/fuente: ABB Service Handbook §1.5, IEC 60076-3 (impulso), IEEE C57.149 (FRA). Filosofía
> multi-norma en `../../_conocimiento/marco-normativo-tx.md`. **Nunca inventar** datos de diseño →
> `⚠️ verificar` (reporte de fábrica).

## A) Señales que delatan la construcción

| Señal | Indica |
|---|---|
| Placa / reporte dice "shell" o "core form" | construcción directa |
| `Z0` baja sin delta en el grupo | posible **núcleo de 5 columnas** (`01 §B`) |
| Patrón de excitación: 3 fases similares | 5-limb o banco de 3×1φ (`../identificacion-tipo-transformador 03 §E.2`) |
| BIL alto / AT de gran tensión | probable devanado **disco entrelazado** |
| Gran corriente en BT | probable devanado **helicoidal** |
| Firma FRA de referencia | huella de la construcción para comparación futura |

## B) La firma FRA como "huella" de construcción

- La respuesta en frecuencia (FRA/SFRA) depende de la geometría (L, C de los devanados y el núcleo).
- Se toma una **firma de referencia** (fábrica o puesta en servicio) y se compara en el tiempo: una
  desviación por bandas delata **deformación mecánica** (pandeo, telescopeo, desplazamiento).
- Interpretación por bandas → `../../pruebas-electricas/sfra` (lóbulo 49). Aquí solo se establece la
  expectativa según la construcción.

## C) Evaluación MULTI-NORMA

```
vs REPORTE de fábrica (precedencia 1)         → construcción y geometría = ___
vs interno MO.00418 (precedencia 2)           → ___       ⚠️ verificar
vs ABB / IEC 60076-3 / IEEE C57.149           → tipos y método FRA
CONSOLIDADO = reporte de fábrica manda; lo ausente se infiere y se marca.
```

## D) Valores `⚠️ verificar` (consolidar para el director)

- **Tipo de núcleo (shell/core, 3/5 columnas)** de las unidades reales — reporte de fábrica.
- Tipo de devanado por nivel de tensión — reporte de fábrica.
- Densidad de flujo de diseño `B` y margen a saturación.
- **Firma FRA de referencia** de cada equipo (si existe) — para comparación.

→ Qué implica (impulso, FRA, fuerzas, errores): `04-diagnostico.md`.
