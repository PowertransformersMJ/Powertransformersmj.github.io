# 04 · Diagnóstico — interpretación y troubleshooting del aceite

> El aceite nunca se diagnostica solo (IEEE C57.152): la físico-química se interpreta
> **junto a** DGA (gases), DFR (humedad del papel) e IR/FP del aislamiento.
>
> 🔗 **Convergencia obligatoria**: tras identificar un patrón aquí, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` (matriz cross-test) para
> confirmar la causa. **Un solo hallazgo = INVESTIGAR; dos o más = diagnóstico.**

## Patrones típicos → causa probable

| Patrón físico-químico | Causa probable | Corroborar con (convergencia) |
|---|---|---|
| **IFT↓ + acidez↑ + color↑** (los tres juntos) | **Envejecimiento oxidativo** del aceite | tendencia; furanos (papel); DGA CO/CO₂↑ |
| **Rigidez↓ + agua↑** (ppm o % sat alto) | **Humedad** en el sistema | DFR (% humedad papel); IR/PI↓; FP/tan δ↑ |
| **Rigidez↓ con agua normal** | **Partículas / fibras** en suspensión | visual D1524 turbio; conteo de partículas; filtrar |
| **FP del aceite↑ con IFT/acidez normales** | Contaminación iónica / polares externos | repetir muestreo limpio; FP del aislamiento |
| **Acidez muy alta + color muy oscuro + sedimento** | Oxidación severa con **lodos** | inspección; regeneración urgente (obstruye enfriamiento) |
| **Agua alta solo en una muestra** | Ingreso reciente (sello, respiración, lluvia) | repetir; revisar sílica/respirador; DFR |
| Gravedad específica fuera de rango | Mezcla de líquidos / contaminación | identificar tipo de líquido; historial de rellenos |

## Factores que ensucian la medida (descartar antes de condenar el aceite)

- **Muestreo mal hecho**: jeringa/botella contaminada, exposición al aire (absorbe
  humedad), purga insuficiente del grifo → falsos positivos de agua/partículas.
  Repetir con técnica D923 antes de condenar.
- **Temperatura de muestreo no registrada** → no se puede normalizar el agua a % de
  saturación → ppm crudos engañan.
- **Método de rigidez no anotado** (D1816 vs D877, gap) → valores no comparables.
- **Aceite recién filtrado/rellenado** → la muestra no representa el estado estacionario.

## Cómo confirmar "envejecimiento del aceite" (diagnóstico más común)

Se confirma con la **convergencia interna del propio aceite + cross-test**:
1. **IFT < 25 mN/m** y/o **acidez > 0.15 mgKOH/g** (índice de envejecimiento, `02-…`).
2. **Color oscuro** (D1500 ≥ 3) y/o sedimentos en el visual.
3. **DGA**: CO y CO₂ elevados (degradación de la celulosa que el aceite ya no protege).
4. **Furanos** altos (2-FAL) si se mide → degradación del papel correlacionada.

Si 1–2 coinciden → **regeneración o cambio de aceite**; si además hay 3–4 →
evaluar el estado del **papel** (la degradación ya tocó la celulosa).

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA**: registrar todos los parámetros + T como baseline de tendencia.
- **INVESTIGAR**: repetir muestreo con técnica; cruzar con DGA/DFR; si es humedad →
  secado/filtrado; si es envejecimiento incipiente → acortar intervalo y vigilar IFT/acidez.
- **RECHAZA** (rigidez ≪ mín / acidez muy alta / lodos): **filtrado mecánico**
  (partículas/agua) o **regeneración con tierra Fuller** (oxidación), o **cambio**
  de aceite si es irrecuperable; re-ensayar tras el tratamiento.

→ Para la **acción concreta, la urgencia (criticidad×severidad) y el intervalo de
re-ensayo**, cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md`.

## Enlace con el tablero / IA

El extractor de IA entrega los parámetros crudos de la muestra; el diagnóstico
determinista debe: normalizar el agua a % de saturación, aplicar la jerarquía de
criterio por clase (`03-…`), calcular el índice de envejecimiento (IFT+acidez+color)
y emitir veredicto + causa. La **tendencia** de IFT y acidez en la pestaña Tendencia
es insumo crítico: el envejecimiento se ve en la pendiente, no en el valor puntual.
