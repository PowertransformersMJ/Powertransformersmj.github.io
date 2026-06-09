# 02 · Cálculos — índice→grados, factor √3, polaridad

> Reglas en `../../_conocimiento/convenciones-calculo.md` (§A magnitudes trifásicas, §B factor √3,
> §E símbolos). Aquí se aplican al grupo de conexión. **Nunca inventar** un desfase de placa →
> `⚠️ verificar`.

## A) Índice horario → grados

```
desfase(°) = índice_horario × 30     (BT respecto a AT; horario = atraso)
```

| Índice | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grados | 0 | −30 | −60 | −90 | −120 | −150 | 180 | +150 | +120 | +90 | +60 | +30 |

> Equivalencia: índice 7..11 puede leerse como adelanto positivo (`+150…+30`) o atraso
> (`−210…−330`); es el **mismo fasor**. Para protección diferencial lo que importa es el ángulo a
> compensar = índice×30° (`04 §B`).

## B) Factor √3 en la relación de LÍNEA (según conexiones del par)

La relación de **espiras** `a = N_AT/N_BT` es de **fase**. La de **tensiones de línea** depende de
la conexión de cada lado (idéntico a `convenciones-calculo.md §B`):

| Par (AT–BT) | `V_L,AT / V_L,BT` | Por qué |
|---|---|---|
| **Y–Y** (Yy) | `a` | ambos lados llevan el mismo √3 → se cancela |
| **Δ–Δ** (Dd) | `a` | ningún lado mete √3 |
| **Δ–Y** (Dy) | `a / √3` | solo BT (Y) mete √3 → la relación de línea baja |
| **Y–Δ** (Yd) | `a · √3` | solo AT (Y) mete √3 → la relación de línea sube |

**Verificación de placa**: con las tensiones nominales de línea de placa, `a_línea = V_L,AT/V_L,BT`
debe coincidir con la fórmula del grupo. Si `230/34.5 kV` en **Dy** no reproduce `a/√3`, o el grupo
o la lectura están mal (`03 §C`).

> Tridevanado: aplicar la regla **por cada par** (AT-MT, AT-BT, MT-BT) con la conexión de cada
> devanado. Tres pares → potencialmente tres factores √3 distintos.

## C) Determinar el índice horario desde fasores (cuando la placa no lo da)

1. Dibuja el fasor de tensión de línea de AT (referencia a las 12, p.ej. `V_AB,AT`).
2. Dibuja el fasor **homólogo** de BT (`V_ab,BT`) según la conexión y el cableado de bornes.
3. El ángulo entre ambos, en pasos de 30°, da el índice (horario = atraso).

> En la práctica el índice se **lee de placa**; este método sirve para **auditar** una placa
> sospechosa o reconstruirla tras un recableado. Confirmar siempre con el ensayo de relación por
> fase (`../../pruebas-electricas/relacion-transformacion`).

## D) Polaridad (ANSI) — cálculo del ensayo

En el ensayo de polaridad por puente (H1 a X1, se mide entre H2 y X2):

```
V_medida < V_AT  → polaridad SUSTRACTIVA  (las tensiones se restan)
V_medida > V_AT  → polaridad ADITIVA      (se suman)
```

- Sustractiva ↔ índices "de fábrica" estándar (ANSI). Aditiva es la excepción (distribución pequeña).
- La polaridad debe ser **coherente con el índice** del grupo; una discrepancia indica recableado o
  error de marcado de bornes.

## E) Suma de desfases en cascada

Al encadenar transformadores, los desfases **se suman** (mod 360°):

```
desfase_total = Σ (índice_i × 30°)   (mod 360°)
```

> Útil para verificar que dos caminos paralelos de la red llegan **en fase** a un nudo común
> (si difieren, hay corriente circulante — `04 §A`).
