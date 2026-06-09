# 02 · Cálculos — indicadores cuantitativos por familia

> Reglas en `../../_conocimiento/convenciones-calculo.md`. Este lóbulo **no introduce fórmulas
> nuevas**: reúne las de las skills hermanas como **indicadores de cada familia de falla**. Los
> umbrales de aceptación son `⚠️ verificar` (MO.00418 / norma / lóbulo 49).

## A) Indicadores por familia (de dónde sale cada uno)

| Familia | Indicador | Fórmula / origen | Skill fuente |
|---|---|---|---|
| Mecánica | fuerza de cortocircuito | `F ∝ I²` ; `I_cc ≈ I_nom/Z_pu` | `../impedancia-cortocircuito 02`, `../construccion-nucleo-devanados 02` |
| Mecánica | desviación de impedancia | `ΔZ% = (Z_med − Z_ref)/Z_ref` | `../impedancia-cortocircuito` |
| Mecánica | banda FRA desviada | comparación por bandas vs firma de referencia | `../construccion-nucleo-devanados 04`, lóbulo 49 SFRA |
| Térmica | factor de envejecimiento | `F_AA = 2^((Θ_hs−Θ_ref)/Δ)`, Δ≈6–8 °C | `../gestion-vida-activo 02` |
| Térmica | hot-spot bajo carga | `Θ_hs = Θ_amb + ΔΘ_oil + ΔΘ_hs` | `../gestion-vida-activo 02`, IEEE C57.91 |
| Dieléctrica | factor de potencia / tan δ | `FP ≈ tan δ` ; `ΔFP` vs historial | `../bujes-y-accesorios 02`, lóbulo 49 |
| Dieléctrica | cambio de capacitancia | `ΔC% = (C_med − C_placa)/C_placa` | `../bujes-y-accesorios 02` |
| Relación/conexión | error de relación | `(a_med − a_placa)/a_placa` | `../calculos-nominales`, `../grupo-vectorial-conexiones` |
| Vida | pérdida de vida | `LOL = Σ F_AA,i · Δt_i` | `../gestion-vida-activo 02` |

## B) Cómo se combinan (ponderación cualitativa)

- Un **solo** indicador desviado rara vez basta: la RCA robusta busca **coherencia** entre varios
  (ej. FRA + `%Z` + historia de cortocircuitos para confirmar deformación mecánica).
- Regla anti-falso-positivo: antes de concluir, **descartar causas alternativas** del mismo síntoma
  (ej. `Z0` baja → ¿delta o **5-limb**? `../identificacion-tipo-transformador 03 §E.1`).

## C) Tendencia > valor absoluto

```
prioriza  d(indicador)/dt   sobre  el valor puntual
```

- Para FP de buje, DGA, DP y `%Z`, la **tendencia** vs la **referencia histórica** del propio equipo
  manda sobre el valor absoluto (que depende de diseño/temperatura). Sin referencia → establecerla
  (firma de fábrica / puesta en servicio).

> Los **umbrales numéricos** (qué `ΔZ%`, qué FP, qué NEI de DGA dispara acción) son del criterio de
> prueba (MO.00418 / IEEE) → `⚠️ verificar`, lóbulo 49. Aquí solo se listan los indicadores.

→ RCA integrada y precedencia de evidencia: `03-criterios-evaluacion.md`.
