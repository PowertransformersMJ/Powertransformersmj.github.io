# 03 · Criterios de evaluación — leer la placa de refrigeración (multi-norma)

> Norma: IEEE C57.12.00 (notación), IEC 60076-2 (calentamiento). Filosofía multi-norma en
> `../../_conocimiento/marco-normativo-tx.md`. **Nunca inventar** % de etapa ni umbrales → `⚠️ verificar`.

## A) Leer la placa de refrigeración

1. **Notación** de las etapas (ONAN/ONAF/OFAF/ODAF) en orden creciente.
2. **MVA de cada etapa**.
3. **Nº de ventiladores / bombas / radiadores**.
4. **Clase de aislamiento** y **rise** (°C) — referencia térmica.
5. **Umbrales de temperatura** de alarma/disparo (si la placa o el manual los trae).

## B) Coherencia (sanity checks)

- Las S de las etapas son crecientes y cada una tiene su modo nombrado.
- La `I_L` por etapa reproduce con `S_etapa/(√3·V_L)` (`02 §A`).
- La notación normaliza la antigua de EG (OA/FA/FOA) a la vigente IEEE.

## C) Evaluación MULTI-NORMA

```
vs PLACA (precedencia 1)                      → etapas y MVA = ___
vs interno MO.00418 (precedencia 2)           → umbrales de temperatura ___  ⚠️ verificar
vs IEEE C57.12.00 / IEC 60076-2               → notación y método de rise
CONSOLIDADO = la placa manda; umbrales internos del director si los entrega.
```

## D) Valores `⚠️ verificar` (consolidar para el director)

- **% exacto de cada etapa** de enfriamiento por unidad (placa).
- **Umbrales de temperatura** de alarma/disparo (aceite y devanado) — MO.00418 / manual.
- Nº de ventiladores/bombas y su lógica de arranque por etapa.
- Gradiente devanado-aceite de diseño (reporte de fábrica) para la imagen térmica.

→ Qué implica (termografía, fallos, errores): `04-diagnostico.md`.
