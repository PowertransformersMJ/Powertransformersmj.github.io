# 04 · Diagnóstico — priorización de flota, acción, errores

> La gestión de vida convierte condición + historia térmica + criticidad en una **decisión**: monitorear,
> secar, restringir carga o reemplazar. Cierra el arco `01→02→03→04`. Los datos de condición se
> **miden** en el lóbulo 49 (`../../pruebas-electricas/`).

## A) Matriz de priorización (condición × criticidad)

```
                 CRITICIDAD baja        CRITICIDAD alta
CONDICIÓN buena   monitoreo rutina       monitoreo + plan de contingencia
CONDICIÓN mala    reemplazo programado   ACCIÓN PRIORITARIA (reemplazo/restricción YA)
```

- **Condición** = DP/furánicos/humedad/DGA (lóbulo 49) + estrés acumulado. **Criticidad** =
  consecuencia de falla (MVA, redundancia, ubicación). El **riesgo = condición × criticidad** ordena
  la inversión de la flota (enfoque MTMP, `03 §C`).

## B) Acciones según diagnóstico

| Hallazgo | Acción |
|---|---|
| DP/furánicos en zona EOL + alta criticidad | reemplazo prioritario / unidad de respaldo |
| Hot-spot alto por carga | restringir carga o subir etapa de refrigeración (`../sistema-refrigeracion`) |
| Humedad alta en papel/aceite | secado (termovacío / Low Frequency Heating) — `⚠️ verificar` criterio |
| Oxígeno alto (conservador sin membrana) | evaluar membrana / sellado (`../bujes-y-accesorios`) |
| Historia de cortocircuitos severos | re-FRA + `%Z` (`../construccion-nucleo-devanados §B`) antes de cargar |

## C) Errores típicos (y cómo se manifiestan)

1. **Juzgar la vida por la temperatura media del aceite** en vez del hot-spot → subestimar el
   envejecimiento. **Fix:** estimar hot-spot (IEEE C57.91, `02 §A`).
2. **Creer que subir de etapa de refrigeración "regala MVA"** → sobrecarga encubierta que consume
   vida. **Fix:** la etapa evacúa calor para el MISMO límite de hot-spot (`02 §D`, EG cap.6.2).
3. **Ignorar la humedad** al evaluar vida → el papel envejece más rápido de lo estimado. **Fix:**
   incluir agua en papel/aceite como multiplicador (`01 §E`, lóbulo 49).
4. **Cargar a tope un equipo con papel envejecido** (DP bajo) → falla mecánica ante un cortocircuito
   pasante. **Fix:** cruzar DP con la exposición a fuerzas (`01 §A`, `../impedancia-cortocircuito`).
5. **Confundir un dato de aceite/DGA con un diagnóstico de vida** → cruce de dominios. **Fix:** el
   DGA/furánico se **mide** en el lóbulo 49; aquí se **interpreta para la vida** (no fabricar datos).

## D) Señales de alarma

- DP estimado (por 2-FAL) acercándose a 150–250 → fin de vida del aislamiento.
- Pérdida de vida acumulada alta por perfil de carga con picos → revisar cargabilidad.
- Tendencia creciente de CO/CO2 y furánicos (lóbulo 49) → degradación de celulosa activa.
- Hot-spot estimado por encima del límite de clase térmica → restringir carga.
- Equipo crítico + condición mala → prioridad máxima de la flota.

## E) Cierre — de la vida del activo a la acción

```
ACTIVO evaluado
   ├─ condición del papel (DP / 2-FAL / humedad) .. §A + ../../pruebas-electricas/ (lóbulo 49)
   ├─ historia térmica (hot-spot / pérdida de vida) §A + 02 (IEEE C57.91)
   ├─ estrés acumulado (cortocircuitos) ........... §B + ../impedancia-cortocircuito + ../construccion-nucleo-devanados
   └─ criticidad × condición → prioridad de flota . §A (MTMP)
```

> DP, furánicos, humedad y hot-spot de diseño quedan `⚠️ verificar` hasta confirmar contra los
> ensayos del lóbulo 49, el reporte de fábrica y los criterios de MO.00418.
