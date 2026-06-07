# 04 · Diagnóstico — interpretación y troubleshooting

> La IR nunca se diagnostica sola (IEEE C57.152): se interpreta **junto a** FP/tan δ,
> DGA y el histórico. Esta neurona traduce patrones de resultado en causas probables.
>
> 🔗 **Convergencia obligatoria**: tras identificar un patrón aquí, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` (matriz cross-test) para confirmar la
> causa con las pruebas convergentes. **Un solo hallazgo = INVESTIGAR; dos o más = diagnóstico.**

## Patrones típicos → causa probable

| Patrón | Causa probable | Corroborar con |
|---|---|---|
| IR₂₀ baja + **PI bajo** (≈1) en todos los lazos | **Humedad** en el aislamiento sólido (celulosa mojada) | FP/tan δ alto; agua en aceite (D1533); DFR |
| IR₂₀ baja solo en **un** lazo (p.ej. AT–tierra) | Defecto/contaminación **localizada** en ese devanado o buje | FP por devanado; FP/hot-collar de bujes |
| IR aceptable pero **cae fuerte vs histórico** | Degradación incipiente / ingreso de humedad reciente | tendencia; FP; DGA |
| IR muy alta pero **PI bajo** | Aislamiento muy seco (PI no concluyente), NO es defecto | IR absoluta alta + FP bajo confirman sano |
| IR fluctuante/inestable durante la lectura | Fuga superficial (suciedad/humedad en bujes), mala conexión | limpiar bujes; usar terminal de guarda; repetir |
| IR baja AT–BT con AT–tierra y BT–tierra ok | Problema en el aislamiento **entre devanados** (CHL) | FP CHL; inspección |

## Factores que ensucian la medida (descartar antes de condenar el tx)

- **Temperatura no estabilizada** o mal registrada → corrección errónea. Usar
  top-oil estabilizada; anotar T real.
- **Humedad superficial en bujes** (rocío, lluvia, suciedad) → fuga externa que
  baja la lectura sin que el aislamiento interno esté mal. Limpiar y secar; usar
  **guarda** para excluir la trayectoria superficial.
- **Tiempo de descarga insuficiente** entre medidas → carga residual falsea la
  siguiente lectura. Aterrizar el devanado el tiempo suficiente (≥4× el de carga).
- **Voltaje de prueba incorrecto** (no el de Tabla 100.5 por clase) → no comparable.

## Cómo confirmar "humedad" (el diagnóstico más común)

Humedad alta se confirma con la **convergencia de evidencias**, no con la IR sola:
1. **PI/DAR bajos** (PI < 1.5, DAR < 1.25).
2. **FP/tan δ del aislamiento elevado** y creciente con temperatura (> Tabla 100.3:
   aceite mineral 0.5%).
3. **Agua en aceite** alta (ASTM D1533) y/o % humedad del papel alto vía **DFR**.
4. **DGA** sin gases de falla térmica/arco (descarta que la "baja IR" sea por otro
   mecanismo). 

Si 1–3 coinciden → **secado del transformador** (tratamiento de vacío/calor) antes
de energizar. Re-ensayar IR/PI tras el secado para verificar recuperación.

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA**: registrar IR₂₀, PI/DAR y T como nuevo baseline de tendencia.
- **INVESTIGAR**: repetir con bujes limpios y guarda; medir FP/tan δ y agua en aceite;
  comparar con histórico antes de escalar.
- **RECHAZA** (PI<1.0 / IR ≪ mínimo): no energizar; secado y reensayo; si persiste,
  escalar a inspección interna.

→ Para la **acción preventiva/correctiva concreta, la urgencia (criticidad×severidad) y el
intervalo de re-ensayo**, cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md`.

## Enlace con el tablero / IA

El extractor de IA del tablero entrega lecturas crudas; el diagnóstico determinista
debe: corregir a 20 °C, aplicar la jerarquía de criterio (`03-…`), y emitir el
veredicto + causa probable de esta tabla. El **histórico de tendencia** (pestaña
Tendencia) es insumo crítico: muchas condenas válidas vienen de la pendiente, no del
valor puntual.
