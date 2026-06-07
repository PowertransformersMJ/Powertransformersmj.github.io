# 02 · Cálculos — firma DRM, tiempos, resistores y conteo

> El LTC no produce un "valor" a corregir como IR: produce **firmas dinámicas** que se leen
> y comparan vs previos/fases. Aquí va qué extraer de la firma DRM, cómo medir tiempos y
> resistores, y cómo el conteo de operaciones fija el intervalo.

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| Firma DRM por TAP y por fase | R(t) / V(t),I(t) | Sí | resistencia dinámica muestreada a alta tasa |
| Tiempos de transición por fase | t_trans | Sí | ms; comparar entre fases y vs previos |
| Valor de resistores de transición | R_tr | preferente | medido vs nominal de placa del LTC |
| Conteo de operaciones | N_op | Sí | contador del mecanismo motor-drive |
| DGA del compartimiento del LTC | — | Sí | gases del aceite del LTC (separado del tanque) |
| Ensayos previos / fase hermana | — | Sí | baseline (la firma es comparativa) |

---

## 1) Lectura de la firma DRM — continuidad ⭐ (lo primero)

Sobre la traza de resistencia dinámica durante la maniobra, verificar:

```
¿La corriente cae a CERO (o R → ∞) en algún instante de la transición?
   SÍ  → TRANSICIÓN ABIERTA (interrupción) → falla grave
   NO  → continuidad OK (siempre hubo camino: contacto o resistor)
```

La firma sana muestra **picos de resistencia momentáneos** (el resistor de transición
entrando) pero **nunca discontinuidad** total. Una caída a cero corriente = condena.

---

## 2) Valor de los resistores de transición

```
R_tr medido (de la altura del pico de la firma) ≈ R_tr nominal del LTC
```

Desviación marcada vs nominal o entre fases → resistor degradado/abierto. **Ejemplo**:
nominal 8.0 Ω; medido fase A=8.1, B=7.9, C=11.5 Ω → C anómalo (≈ +44%) → INVESTIGAR esa fase.

---

## 3) Tiempos de transición — comparación ⭐

```
Δt_fase = |t_trans(fase i) − t_trans(fase j)|       (simetría entre fases)
Δt_prev = |t_trans − t_trans_previo|                (tendencia)
```

La transición de un OLTC tipo **resistor** es ≈ **40–60 ms** (⚠️ verificar contra el tipo y
fabricante del LTC). Lo importante NO es el valor absoluto sino:
- **Simetría entre fases**: las 3 deben transitar en tiempos parecidos.
- **Estabilidad vs previos**: un tiempo que se alarga/acorta señala desgaste o desajuste de
  coordinación.

**Ejemplo**: t_trans A=52, B=53, C=68 ms → C se sale del patrón (+30%) → coordinación
errónea / contacto lento en C → INVESTIGAR.

---

## 4) Conteo de operaciones → intervalo de mantenimiento ⭐

```
N_op acumulado  →  comparar vs umbral del fabricante (p.ej. cada N operaciones, overhaul)
```

El mantenimiento del LTC se dispara por **número de maniobras** (desgaste de contactos), no
solo por calendario. ⚠️ **Verificar** el umbral de operaciones del fabricante del LTC del
director (típico: revisión cada decenas de miles de operaciones; varía por modelo). El conteo
alimenta el intervalo en `../../_conocimiento/gestion-mantenimiento-predictivo.md`.

---

## 5) DGA del compartimiento del LTC — ratios (NO límites del tanque)

```
Ratios clave: C2H2/C2H4 ,  C2H6/CH4   (tendencia más que valor absoluto)
```

El LTC arquea por diseño → C₂H₂ y C₂H₄ altos son **normales**. Diagnosticar por **cambio de
ratio / tendencia**, no por los límites del tanque principal (IEEE C57.104). ⚠️ verificar
criterio del LTC (IEC 60214 / práctica del fabricante).

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarLTC({drm, tTrans, Rtr, Rtr_nom, Nop, dgaLTC, previos}) {
  const continuidad = !drm.some(p => p.corriente === 0);        // sin transición abierta
  const RtrOK = Rtr.every(r => Math.abs(r - Rtr_nom)/Rtr_nom < 0.1);  // ⚠️ verificar tolerancia
  const simetria = (Math.max(...tTrans) - Math.min(...tTrans)) / mean(tTrans); // entre fases
  const vencido = Nop >= umbralOperacionesFabricante;           // ⚠️ verificar umbral
  // DGA LTC por RATIOS/tendencia, NO límites del tanque → ver 03/04
}
```
