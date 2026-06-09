# 03 · Criterios de evaluación — identificar el buje y sus accesorios

> Norma/fuente: IEEE C57.19 (bujes de potencia), IEC 60137, ABB Service Handbook, EG cap.6. Filosofía
> multi-norma en `../../_conocimiento/marco-normativo-tx.md`. **Nunca inventar** valores de placa →
> `⚠️ verificar`.

## A) Señales que delatan el tipo de buje

| Señal | Indica |
|---|---|
| Placa del buje dice "condenser" / "OIP" / "RIP" / "RBP" | buje **condensador** |
| Tiene **tap capacitivo** (tap de prueba) en la brida | buje **condensador** (el tap saca el último foil) |
| Placa con `C1`/`C2` y FP de fábrica | buje **condensador** (se puede hacer FP de buje) |
| Buje pequeño de MT/BT, sin tap | probable **no-condensador** |
| BIL alto / AT de gran tensión | casi seguro **condensador** |

## B) Datos de placa del buje (consolidar)

- **Tipo** (condensador OIP/RIP/RBP o no-condensador).
- **Tensión nominal y BIL** del buje (debe ser ≥ al del devanado que sirve).
- **`C1` y `C2` de fábrica** y **FP/`tan δ` de fábrica** (a 20 °C) → referencia de la prueba.
- **Corriente nominal** del buje (debe soportar la corriente de línea del devanado, ligado a
  `../calculos-nominales` y al sistema de refrigeración: a mayor etapa, mayor corriente).

> El BIL del buje y el del devanado se cruzan con `../construccion-nucleo-devanados` (distribución
> de impulso) y `../placa-caracteristica` (BIL del equipo).

## C) Evaluación MULTI-NORMA

```
vs PLACA del buje (precedencia 1)            → C1/C2/FP/BIL = ___
vs interno MO.00418 (precedencia 2)          → criterio de FP de buje  ⚠️ verificar
vs IEEE C57.19 / IEC 60137 (precedencia 3)   → tipos, BIL, método
vs ABB / EG (precedencia 4)                  → accesorios, modos de falla
CONSOLIDADO = placa del buje manda; lo ausente se marca ⚠️ verificar.
```

## D) Accesorios — checklist de identificación

| Accesorio | Cómo confirmarlo | Qué anotar |
|---|---|---|
| Conservador | hay tanque de expansión arriba | con/sin membrana, con desecante |
| Buchholz | relé entre tanque y conservador | presente → alarma+disparo disponibles |
| Sobrepresión súbita | válvula/relé de presión en la tapa | presente → protección ante arco |
| Imagen térmica | termómetro de devanado con image coil | gobierna ventiladores (ligar a `../sistema-refrigeracion`) |
| Indicadores | nivel + temperatura (top-oil/devanado) | umbrales de alarma `⚠️ verificar` |

## E) Valores `⚠️ verificar` (consolidar para el director)

- **Placa del buje**: tipo, C1/C2, FP de fábrica, BIL, corriente nominal — de cada buje real.
- **Referencia histórica** de FP de buje (para tendencia) — si existe.
- **Umbrales de alarma** de los accesorios (Buchholz, temperaturas) — del esquema de protecciones.
- **Criterio de aceptación** de FP/Δcap por MO.00418 — interno (precedencia 2).

→ Qué implica (modos de falla, protecciones, errores): `04-diagnostico.md`.
