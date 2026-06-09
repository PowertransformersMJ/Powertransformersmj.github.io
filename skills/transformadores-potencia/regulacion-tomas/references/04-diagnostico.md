# 04 · Diagnóstico — OLTC, seguridad DETC, errores

> La toma cambia relación y %Z, y el OLTC es uno de los componentes que **más falla** por desgaste
> de contactos. Cierra el arco `01→02→03→04`. Cruce con ensayos en `../../pruebas-electricas/`.

## A) Diagnóstico del OLTC (componente de alto desgaste)

| Síntoma | Posible causa | Ensayo / acción |
|---|---|---|
| Contactos quemados / alta resistencia | arco repetido, falta de mantenimiento | **resistencia dinámica de contactos (DRM)**, `../../pruebas-electricas/` |
| Gas en el compartimiento del ruptor | arco anormal en la transición | DGA del compartimiento OLTC (separado del tanque principal) |
| Discrepancia de posición / no conmuta | mecanismo motriz, fin de carrera | inspección del accionamiento |
| Calentamiento localizado | mala presión de contacto | termografía |

> El OLTC suele tener su **propio compartimiento de aceite** (separado del tanque principal) → su
> DGA se analiza aparte (territorio del lóbulo 49, `../../pruebas-electricas/`).

## B) Seguridad del DETC (regla dura)

- El DETC se opera **solo con el equipo desenergizado y aislado**. Moverlo bajo carga = arco
  destructivo (no tiene resistencias de transición).
- Tras mover un DETC: **verificar relación** (TTR) en la nueva posición antes de energizar
  (`../../pruebas-electricas/relacion-transformacion`).

## C) Errores típicos (y cómo se manifiestan)

1. **Confundir OLTC con DETC** → riesgo de operar bajo carga un cambiador sin transición. **Fix:**
   identificar el tipo en placa ANTES de operar (`01 §B`).
2. **Asumir %Z constante en todo el rango** → cortocircuito/paralelo mal calculados en tomas
   extremas. **Fix:** usar la %Z de la toma en servicio (`02 §C`).
3. **Validar la relación solo en la toma nominal** → no se detecta error en posición real.
   **Fix:** validar la relación de la **toma en servicio** con TTR.
4. **Olvidar el factor √3 del grupo al calcular la relación por toma** → no cuadra. **Fix:** `02 §B`.
5. **Ignorar el DGA del compartimiento OLTC** → falla de ruptor no detectada. **Fix:** DGA separado
   del tanque principal (lóbulo 49).

## D) Señales de alarma

- Relación medida en una toma no reproduce con `V_nom·(1±n·paso%)` → tabla mal leída o devanado dañado.
- Resistencia dinámica del OLTC con picos/discontinuidades → contactos del ruptor degradados.
- Gas combustible en el compartimiento OLTC → arco anormal en la transición.
- DETC operado bajo carga (reportado) → inspección dieléctrica urgente antes de re-energizar.

## E) Cierre — de la toma a la acción

```
TOMA en servicio confirmada
   ├─ fija la relación a validar ............. ../calculos-nominales + TTR
   ├─ fija la %Z para cortocircuito/paralelo . ../impedancia-cortocircuito (Z por toma)
   ├─ OLTC → plan de mantenimiento/DRM ....... §A + ../../pruebas-electricas/
   └─ DETC → regla de seguridad (desenergizado) §B
```

> Tabla de tomas, %Z por toma y criterios de mantenimiento del OLTC quedan `⚠️ verificar` hasta
> que el director confirme contra placa/reporte/MO.00418.
