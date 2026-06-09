# 03 · Criterios de evaluación — RCA integrada y precedencia

> Norma/fuente: IEEE C57.125 (investigación de fallas), CIGRE TB, ABB/EG. Filosofía multi-norma en
> `../../_conocimiento/marco-normativo-tx.md`. Doctrina del cerebro: **verifica, no asumas** (§3.3) —
> telemetría → diagnóstico → reporte → STOP → autorización → fix.

## A) Análisis de causa raíz (RCA) integrado

```
1. SÍNTOMA            ¿qué se observó/midió? (no la conclusión)
2. ESFUERZO           ¿eléctrico/térmico/mecánico/químico? (01 §A)
3. CADENA             esfuerzo → deterioro → modo de falla (01 §B)
4. EVIDENCIA          ¿qué ensayos lo confirman? (varios coherentes, 02 §B)
5. ALTERNATIVAS       ¿qué otra causa daría el mismo síntoma? descartarlas
6. CAUSA RAÍZ         la explicación de FONDO, no el último eslabón
7. ACCIÓN             corrección estructural + verificación
```

- La RCA cae si se salta el paso 5 (alternativas). Ejemplo clásico del cerebro: `Z0` baja **no**
  prueba delta oculto → puede ser **5-limb** (`../identificacion-tipo-transformador 03 §E.1`).

## B) Precedencia de evidencia

```
1. MEDICIÓN directa del equipo (ensayo con referencia histórica)
2. REPORTE de fábrica (firma FRA, %Z, C1/C2, hot-spot de diseño)
3. interno MO.00418 (criterios de aceptación)              ⚠️ verificar
4. NORMA IEEE/IEC (modelo físico, métodos)
5. bibliografía ABB / EG / CIGRE (modos de falla, estadística)
CONSOLIDADO = la medición con referencia manda; la norma da el marco; nunca inventar umbrales.
```

## C) Evaluación MULTI-NORMA por familia

| Familia | Norma de método | Norma de criterio |
|---|---|---|
| Dieléctrica (FP/DFR) | IEEE C57.152 | MO.00418 `⚠️ verificar` |
| Térmica / vida | IEEE C57.91 | MO.00418 `⚠️ verificar` |
| Mecánica (FRA) | IEEE C57.149 | comparación vs referencia (no hay umbral universal) |
| DGA | IEEE C57.104-2019 | NEI / Status 1-2-3 `⚠️ verificar` (lóbulo 49) |
| OLTC | IEC 60214 | tendencia + criterio fabricante `⚠️ verificar` |

## D) Valores `⚠️ verificar` (consolidar para el director)

- **Firmas de referencia** (FRA, `%Z`, FP de buje, C1/C2) de cada unidad — reporte de fábrica / PES.
- **Umbrales de acción** por familia — MO.00418 (interno, precedencia 3).
- **Tablas DGA** IEEE C57.104-2019 y **códigos Transequipos** — `[ILEGIBLES]` en el scan, tomar de
  la norma directa o relectura HD (no fabricar) → lóbulo 49.
- **Historia de eventos** (cortocircuitos, sobrecargas) de cada equipo — bitácora operativa.

→ Qué implica (mapa síntoma→ensayo→lóbulo, errores): `04-diagnostico.md`.
