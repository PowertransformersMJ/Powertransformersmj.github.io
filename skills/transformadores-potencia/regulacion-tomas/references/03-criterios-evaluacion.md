# 03 · Criterios de evaluación — leer la tabla de tomas (multi-norma)

> Norma: IEEE C57.12.00 (tomas en placa), C57.131 (OLTC), IEC 60214/60076-1. Filosofía multi-norma
> en `../../_conocimiento/marco-normativo-tx.md`. **Nunca inventar** rango ni paso → `⚠️ verificar`.

## A) Leer la tabla de tomas de placa

La placa trae una tabla `posición → tensión` (y a veces `→ corriente`, `→ %Z`). Verificar:

1. **Posición nominal** (la de referencia, normalmente la central).
2. **Nº de posiciones** y **paso %** entre ellas.
3. **Rango total ±%** (tensión máx y mín).
4. **Devanado regulado** (AT/MT/BT) y si es OLTC o DETC.
5. Si la placa da **%Z por toma** (máx/nominal/mín) — clave para cortocircuito.

## B) Coherencia (sanity checks)

- Las tensiones de la tabla reproducen con `V_nom·(1±n·paso%)` (`02 §A`).
- El nº de posiciones cuadra con los pasos y el modo (lineal vs reversible, `02 §D`).
- La relación por toma valida con el grupo (factor √3) en todas las posiciones.

## C) Evaluación MULTI-NORMA

```
vs PLACA / tabla de tomas (precedencia 1)    → rango, paso, posición = ___
vs interno MO.00418 (precedencia 2)          → ___       ⚠️ verificar con el director
vs IEEE C57.12.00 / C57.131 / IEC 60214      → formato y límites
CONSOLIDADO = la placa manda; lo ausente se pide al fabricante.
```

## D) Valores `⚠️ verificar` (consolidar para el director)

- **Tabla de tomas exacta** (rango, paso %, nº posiciones) de las unidades reales.
- **%Z por toma** (máx/nominal/mín) — reporte de fábrica; no asumir Z constante.
- Tipo de cambiador (OLTC/DETC) y devanado regulado por equipo.
- Criterios de mantenimiento del OLTC (contadores de operación, intervalos) — MO.00418 / fabricante.

→ Qué implica (seguridad DETC, diagnóstico OLTC, errores): `04-diagnostico.md`.
