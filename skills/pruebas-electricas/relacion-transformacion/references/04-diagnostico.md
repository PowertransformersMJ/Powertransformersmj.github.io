# 04 · Diagnóstico — interpretación y troubleshooting

> La TTR nunca se diagnostica sola (IEEE C57.152): una desviación de ratio se interpreta
> **junto a** la corriente de excitación, la resistencia de devanados, el SFRA y el histórico.
>
> 🔗 **Convergencia obligatoria**: tras identificar un patrón aquí, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` (matriz cross-test) para confirmar la
> causa con las pruebas convergentes. **Un solo hallazgo = INVESTIGAR; dos o más = diagnóstico.**

## Patrones típicos → causa probable

| Patrón | Causa probable | Corroborar con |
|---|---|---|
| %dev > 0.5% en una fase + **excitación alta** en esa fase | **Espiras en cortocircuito** (menos vueltas efectivas) | `corriente-excitacion`; R devanados; DGA (gases de arco/térmicos) |
| Relación no medible / fuera de rango / "OL" | **Devanado abierto** o conexión interrumpida | R devanados (resistencia infinita); inspección de conexiones |
| %dev anómala **solo en ciertos TAPs** | Defecto del **conmutador de tomas** (contacto sucio/erosionado, posición) | resistencia dinámica LTC; R devanados por TAP; termografía |
| **Desfase incorrecto** / ratio coherente con otro vector | **Conexión errónea** o grupo vectorial mal rotulado | verificar plantilla de conexión; SFRA |
| %dev uniforme, mismo signo, 3 fases | Posible **error de placa / tensión mal declarada** (no falla) | recalcular R_calc con el vector correcto; dato de fábrica |
| %dev que **crece vs histórico** dentro de ±0.5% | Degradación incipiente de espira | tendencia; excitación; repetir |

## Factores que ensucian la medida (descartar antes de condenar el tx)

- **Magnetismo residual del núcleo** → distorsiona la corriente de excitación que acompaña la
  lectura (puede simular un problema inexistente). Desmagnetizar antes si la excitación parece
  rara con ratio correcto.
- **Conexiones del ratiómetro flojas / cables invertidos** → ratio o desfase falsos. Verificar
  la plantilla del vector y el apriete antes de repetir.
- **TAP mal seleccionado / conmutador entre posiciones** → ratio que no corresponde a ningún
  escalón. Asentar el conmutador firmemente en la posición.
- **Comparar contra el ratio de línea sin el factor √3** del grupo de conexión → desviación
  falsa (ver `02-calculos.md §1`).

## Cómo confirmar "espiras en cortocircuito" (el diagnóstico más severo)

Se confirma por **convergencia**, no con la TTR sola:
1. **%dev > 0.5%** en la fase afectada (relación más baja: menos vueltas efectivas).
2. **Corriente de excitación elevada** en esa misma fase (ver `corriente-excitacion`).
3. **Resistencia de devanados** anómala en esa fase (si la espira en corto altera el camino).
4. **DGA** con gases de falla (arco H₂/C₂H₂ o térmicos) si el corto disipa energía.

Si 1–2 coinciden → **fuera de servicio**: el corto entre espiras degrada rápido y puede
escalar a falla. No energizar hasta inspección interna.

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA**: registrar R_calc, %dev por fase/TAP y desfase como baseline de tendencia.
- **INVESTIGAR**: repetir con conexiones verificadas y núcleo desmagnetizado; medir excitación
  y R devanados; comparar con histórico antes de escalar.
- **RECHAZA** (espira en corto / devanado abierto / desfase errado): no energizar; escalar a
  inspección interna / reparación en fábrica.

→ Para la **acción correctiva concreta, la urgencia (criticidad×severidad) y el intervalo de
re-ensayo**, cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md`.

## Enlace con el tablero / IA

El extractor de IA del tablero entrega ratios crudos por TAP y fase; el diagnóstico
determinista debe: calcular R_calc con el factor de conexión correcto, obtener %dev, aplicar la
jerarquía de criterio (`03-…`) y emitir veredicto + causa probable de esta tabla. El **histórico
de tendencia** detecta espiras que empiezan a degradarse antes de cruzar el ±0.5%.
