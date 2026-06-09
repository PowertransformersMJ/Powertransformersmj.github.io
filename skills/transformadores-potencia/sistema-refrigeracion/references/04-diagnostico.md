# 04 · Diagnóstico — termografía, fallos de refrigeración, errores

> La refrigeración degradada baja la capacidad real del equipo y acelera el envejecimiento. Cierra
> el arco `01→02→03→04`. Cruce con ensayos/monitoreo en `../../pruebas-electricas/`.

## A) Diagnóstico del sistema de refrigeración

| Síntoma | Causa probable | Acción / ensayo |
|---|---|---|
| Aceite caliente con carga normal | radiadores sucios / ventiladores parados | termografía de radiadores; revisar arranque por etapa |
| Una etapa no arranca | falla de ventiladores/bombas o de la lógica térmica | inspección eléctrica del control de refrigeración |
| Gradiente devanado-aceite alto | obstrucción de canales / circulación pobre | revisar bombas (OF/OD); fibra óptica si existe |
| Punto caliente elevado vs carga | diseño insuficiente o sobrecarga | recalcular cargabilidad (`../gestion-vida-activo`, IEEE C57.91) |

> La **termografía** localiza radiadores fríos (sin circulación), conexiones calientes y ventiladores
> parados; es de campo (lóbulo 49, `../../pruebas-electricas/`).

## B) Capacidad real bajo refrigeración degradada

- Con ventiladores/bombas fuera de servicio, el MVA admisible **cae a la etapa inferior**. Mantener
  la carga de etapa alta = sobrecalentamiento → pérdida de vida del papel acelerada (Montsinger:
  ~6–8 °C de más **duplican** el envejecimiento; `../gestion-vida-activo`).
- Antes de declarar una etapa disponible, verificar que **todos** sus equipos operan.

## C) Errores típicos (y cómo se manifiestan)

1. **Creer que subir de etapa da MVA libre** → sobrecarga del cobre y del punto caliente. **Fix:**
   regla "etapa ≠ MVA libre" (`01 §B`, `02 §D`); validar contra diseño.
2. **Calcular la I nominal con el MVA de la etapa máxima cuando opera en una inferior** → ajuste de
   protección mal calibrado. **Fix:** usar el MVA de la **etapa activa** (`02 §A`).
3. **Mezclar notación antigua (FOA/OA) con la vigente** → confusión de modo. **Fix:** normalizar a
   IEEE C57.12.00 (`01 §A`).
4. **Mirar solo la temperatura del aceite** → el papel se daña por el **punto caliente del devanado**,
   no por el aceite. **Fix:** usar imagen térmica / fibra óptica (`02 §C`).
5. **Operar a etapa alta con refrigeración degradada** → sobrecalentamiento. **Fix:** bajar de etapa
   si fallan equipos (§B).

## D) Señales de alarma

- Aceite o devanado por encima de umbral con carga normal → refrigeración degradada.
- Etapa que no arranca al subir la temperatura → falla del control o de los equipos.
- Gradiente devanado-aceite creciente en el tiempo → obstrucción de canales / circulación pobre.
- Pérdida de vida acelerada (furánicos/DGA, lóbulo 49) coincidente con historial de sobrecarga.

## E) Cierre — de la refrigeración a la acción

```
REFRIGERACIÓN evaluada
   ├─ define el MVA admisible por etapa ........ ../calculos-nominales
   ├─ el punto caliente gobierna la vida ....... ../gestion-vida-activo (IEEE C57.91)
   ├─ termografía / monitoreo en línea ......... ../../pruebas-electricas/
   └─ regla "etapa ≠ MVA libre" siempre ........ 01 §B
```

> % por etapa, umbrales de temperatura y gradiente de diseño quedan `⚠️ verificar` hasta confirmar
> contra placa/manual/MO.00418.
