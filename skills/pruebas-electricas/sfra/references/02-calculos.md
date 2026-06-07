# 02 · Cálculos — cómo se comparan y correlacionan las huellas

> SFRA no produce un "valor" a corregir como IR: produce una **curva** que se compara
> contra un baseline. Aquí va cómo prepararla, qué baseline usar y qué métricas de
> correlación cuantifican la diferencia por banda.

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| Traza de magnitud vs frecuencia | |H(f)| dB | Sí | por terminal/devanado medido |
| Traza de fase vs frecuencia | ∠H(f) | preferente | confirma resonancias |
| Rango de barrido | f_min–f_max | Sí | típ. 20 Hz–2 MHz (⚠️ verificar equipo) |
| **Baseline de comparación** | — | Sí | fábrica > previo misma unidad > fase hermana > gemela |
| TAP + configuración de medición | — | Sí | DEBE ser idéntica a la del baseline |
| Esquema de conexión / aterrizaje | — | Sí | mismos cables y guarda que el baseline |

---

## 1) Condición previa: repetibilidad del set-up ⭐ (sin esto, todo es ruido)

Antes de comparar, garantizar que el único cambio posible sea el transformador:

```
mismo TAP  ∧  mismos cables/longitud  ∧  mismo aterrizaje/guarda  ∧  misma conexión terminal
```

Una divergencia de **alta frecuencia** casi siempre es set-up (cables/aterrizaje), NO el
devanado. Repetir la medición tras corregir el montaje antes de diagnosticar (`04-…`).

---

## 2) Comparación visual por bandas (método primario)

Superponer huella nueva vs baseline y leer, **por banda**:
- **Baja** (núcleo): ¿se desplazó la primera resonancia? ¿cambió la pendiente?
- **Media** (devanados): ¿aparecieron/desaparecieron resonancias? ¿se corrieron en f?
- **Alta** (conexiones): ¿divergencia? → revisar set-up antes de condenar.

Regla: **coincidencia = sano; desplazamiento de resonancias = cambio físico** en el
subsistema de esa banda.

---

## 3) Métricas de correlación numérica (apoyo cuantitativo, por banda)

Cuando el equipo las entrega, cuantifican la similitud de dos trazas en una banda. Las más
usadas (DL/T 911 / práctica de industria; ⚠️ verificar valores de corte contra el equipo):

| Métrica | Qué es | Lectura |
|---|---|---|
| **CC** (Correlation Coefficient) | correlación lineal entre trazas (0–1) | → 1 = idénticas; baja = divergencia |
| **ASLE** (Abs. Sum of Logarithmic Error) | error logarítmico acumulado | → 0 = idénticas; sube con la diferencia |
| **MM** (Min-Max ratio) / RXY | razón de mínimos/máximos | desviación de 1 = cambio |

> ⚠️ Los **valores de corte** (p.ej. "CC ≥ 0.99 baja f = normal") provienen de guías como
> DL/T 911-2004 y de la práctica del fabricante del equipo (Megger FRAX, OMICRON, DV Power),
> **no de un consenso IEEE/IEC numérico universal**. IEEE C57.149 / IEC 60076-18 priorizan la
> **interpretación experta de la huella**, no un umbral. Usar las métricas como **apoyo**, no
> como veredicto automático. Verificar los cortes contra el equipo y la norma del director.

**Ejemplo orientativo de lectura** (no normativo): si CC(banda media) cae de 0.998 (baseline
fase hermana) a 0.92 mientras baja y alta siguen ≈1.00 → divergencia localizada en
**devanados/geometría** → sospecha de deformación axial/radial → cruzar con reactancia de
dispersión (`04-…`).

---

## 4) Qué NO se calcula (evitar el error)

- **No** existe "corrección de temperatura" de SFRA como en IR (la huella es geométrica).
- **No** se promedia entre bandas: cada banda se evalúa por separado (apuntan a subsistemas
  distintos). Un número global oculta la localización.

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarSFRA({traza, baseline, tap, setupOK}) {
  if (!setupOK || tap !== baseline.tap) return "set-up no equivalente → repetir";
  const bandas = ['baja','media','alta'];
  const corr = bandas.map(b => correlacion(traza[b], baseline[b]));   // CC/ASLE por banda
  // baja↓ → núcleo; media↓ → devanados; alta↓ → conexiones/set-up
  // veredicto multi-norma + convergencia → ver 03 y 04
}
```
