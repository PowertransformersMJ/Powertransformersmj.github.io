# 04 · Diagnóstico — impulso, FRA, telescopeo/pandeo, errores

> La construcción condiciona cómo falla mecánicamente el equipo y cómo se interpreta su firma. Cierra
> el arco `01→02→03→04`. Cruce con ensayos mecánicos/dieléctricos en `../../pruebas-electricas/`.

## A) Distribución de impulso y estrés dieléctrico

- Una onda rápida (rayo/maniobra) se reparte según `√(C_tierra/C_serie)` (`02 §D`): los devanados de
  **baja capacitancia serie** (capas) sufren un gradiente fuerte en las **primeras espiras** → punto
  débil dieléctrico.
- El **disco entrelazado** y el **shell form** reparten mejor → mayor margen de impulso (BIL).
- Implicación: en equipos de AT con devanado de capas, vigilar el aislamiento de entrada (descargas
  parciales, `../../pruebas-electricas/`).

## B) Fuerzas de cortocircuito → telescopeo y pandeo

| Modo | Mecanismo | Cómo se detecta |
|---|---|---|
| **Pandeo (radial)** | la fuerza radial comprime el devanado interno | FRA (banda media/alta), cambio de `%Z` |
| **Telescopeo (axial)** | los discos se desplazan verticalmente | FRA, inspección, cambio de `%Z` |
| **Aflojamiento de sujeción** | pérdida de presión de apriete tras cortocircuitos | FRA (banda baja), ruido |

- Equipos de **baja `%Z`** y alto `I_cc` disponible son los más expuestos (fuerza ∝ I², `02 §C`).
- Tras un **cortocircuito pasante severo**, comparar FRA y `%Z` con la referencia → detectar
  deformación incipiente antes de la falla (`../impedancia-cortocircuito 04 §B`).

## C) Errores típicos (y cómo se manifiestan)

1. **Atribuir una `Z0` baja a un delta cuando es un 5-limb** → tipificación errada. **Fix:** cruzar
   construcción + excitación + grupo (`01 §B`, `../identificacion-tipo-transformador 03 §E.1`).
2. **Comparar FRA sin firma de referencia** → no se sabe qué es "normal". **Fix:** establecer la
   referencia de fábrica/puesta en servicio (`03 §B`).
3. **Ignorar el historial de cortocircuitos pasantes** → deformación acumulada no vigilada. **Fix:**
   re-FRA y `%Z` tras eventos severos (§B).
4. **Asumir igual robustez a impulso en todo devanado** → punto débil en capas/primeras espiras.
   **Fix:** considerar el tipo de devanado (`§A`, `01 §C`).

## D) Señales de alarma

- `%Z` medida desviada de fábrica → posible deformación de devanado (confirmar con FRA).
- Firma FRA con desviación por bandas vs referencia → telescopeo/pandeo/aflojamiento.
- Descargas parciales crecientes en AT con devanado de capas → estrés dieléctrico de impulso.
- `Z0` baja inexplicada → revisar si es 5-limb antes de concluir delta oculto.

## E) Cierre — de la construcción a la acción

```
CONSTRUCCIÓN identificada
   ├─ expectativa de distribución de impulso ... §A + ../../pruebas-electricas/
   ├─ exposición a fuerzas de cortocircuito .... §B + ../impedancia-cortocircuito
   ├─ firma FRA de referencia .................. §B + ../../pruebas-electricas/sfra
   └─ 5-limb ↔ Z0 baja → tipificación .......... 01 §B + ../identificacion-tipo-transformador
```

> Tipo de núcleo, geometría y firma FRA de referencia quedan `⚠️ verificar` hasta confirmar contra
> reporte de fábrica.
