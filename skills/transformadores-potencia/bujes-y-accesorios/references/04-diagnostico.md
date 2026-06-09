# 04 · Diagnóstico — modos de falla del buje, accesorios, errores

> El buje y los accesorios condicionan la seguridad operativa. Cierra el arco `01→02→03→04`. La
> **interpretación** de las pruebas (FP de buje, DGA del Buchholz) es del lóbulo 49
> (`../../pruebas-electricas/`); aquí se establece QUÉ falla y cómo se manifiesta.

## A) Modos de falla del buje

| Modo | Mecanismo | Cómo se detecta |
|---|---|---|
| **Humedad / contaminación** | ingreso de agua o degradación del papel-aceite | FP/`tan δ` creciente (`02 §B`) |
| **Cortocircuito de capas** | falla entre foils del condensador | cambio de capacitancia `ΔC%` (`02 §A`) |
| **Tap flotante** | tap capacitivo sin aterrizar | sobretensión en el tap → descargas / daño |
| **Pérdida de aceite (OIP)** | fuga / nivel bajo en el buje | inspección, FP elevado, descargas parciales |
| **Envejecimiento térmico** | sobrecarga sostenida del buje | FP creciente, decoloración |

- Una fracción importante de las fallas catastróficas de transformador (con incendio) **nace en el
  buje**. Por eso el **FP de buje** es un ensayo prioritario y la **tendencia** manda.

## B) Accesorios como protección (qué dispara qué)

```
ARCO INTERNO violento ──► Buchholz (flujo) + Sobrepresión súbita ──► DISPARO
FALLA INCIPIENTE (gas) ─► Buchholz (acumulación) ──► ALARMA ──► tomar DGA (lóbulo 49)
HOT-SPOT alto ──────────► Imagen térmica ──► ventiladores → alarma → disparo (ligar ../sistema-refrigeracion)
NIVEL de aceite bajo ───► indicador ──► ALARMA (posible fuga / contracción térmica)
```

- El **Buchholz** acumulando gas es una señal de falla incipiente: confirmar con **DGA** del gas
  atrapado (lóbulo 49) — pero su **disparo por flujo** no espera confirmación (falla violenta).
- La **sobrepresión súbita** es protección de **respaldo mecánico**: alivia el pico de un arco para
  evitar la rotura del tanque (EG cap.6).

## C) Errores típicos (y cómo se manifiestan)

1. **Juzgar el FP de buje por el valor absoluto** ignorando la tendencia → falsos OK/alarma.
   **Fix:** comparar contra placa **y** referencia histórica; corregir por temperatura (`02 §B`).
2. **Dejar el tap capacitivo flotante** tras una prueba → daño del buje. **Fix:** verificar que el
   tap queda **aterrizado** en operación (`01 §B`).
3. **Ignorar el BIL del buje vs el del devanado** → buje sub-dimensionado a impulso. **Fix:** cruzar
   con `../placa-caracteristica` y `../construccion-nucleo-devanados §A`.
4. **Confundir alarma de Buchholz con disparo** → reacción equivocada. **Fix:** alarma=gas
   (investigar/DGA); disparo=flujo (falla violenta, sacar de servicio) (`§B`).
5. **No verificar nivel del conservador / desecante** → ingreso de humedad. **Fix:** inspección del
   conservador (membrana/silica).

## D) Señales de alarma

- FP/`tan δ` de buje en aumento sostenido vs historial → degradación dieléctrica del buje.
- `ΔC%` fuera de ±5–10 % vs placa → posible cortocircuito de capas (`⚠️ verificar` umbral, lóbulo 49).
- Gas en Buchholz → falla incipiente (DGA en `../../pruebas-electricas/`).
- Silica gel saturada (rosa) / nivel de aceite bajo → riesgo de humedad / fuga.
- Tap capacitivo flotante detectado en inspección → corregir de inmediato.

## E) Cierre — del buje/accesorio a la acción

```
BUJE identificado (tipo, C1/C2, BIL)
   ├─ FP/tan δ + ΔC% vs placa/historial ....... §A + ../../pruebas-electricas/ (FP de buje)
   ├─ tap capacitivo aterrizado ............... §B + inspección
   ├─ BIL del buje ≥ BIL devanado ............. §B + ../placa-caracteristica + ../construccion-nucleo-devanados
   └─ accesorios (Buchholz/sobrepresión/imagen) §B + ../sistema-refrigeracion (imagen térmica)
```

> El FP de buje, su límite de aceptación y el DGA del gas Buchholz quedan `⚠️ verificar` hasta
> confirmar contra placa del buje, MO.00418 y el criterio del lóbulo 49.
