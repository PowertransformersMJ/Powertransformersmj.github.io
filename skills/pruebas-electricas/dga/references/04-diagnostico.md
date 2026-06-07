# 04 · Diagnóstico — patrón de gases → tipo de falla

> El DGA identifica el **tipo** de falla, pero la confirma **junto a** pruebas
> eléctricas (IEEE C57.152): un punto caliente se corrobora con R devanados y
> termografía; un arco con excitación/SFRA.
>
> 🔗 **Convergencia obligatoria**: tras ubicar el tipo de falla aquí, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` para confirmar por
> convergencia. **Un solo hallazgo = INVESTIGAR; dos o más = diagnóstico.**

## Patrones de gas → tipo de falla (convergencia de Duval + Rogers)

| Gas dominante / patrón | Zona Duval | Tipo de falla | Corroborar con (convergencia) |
|---|---|---|---|
| **H2 alto, poco más** | PD | **Descarga parcial / corona** (baja energía) | FP/tan δ↑; PD (IEC); excitación |
| H2 + **C2H2** moderado | D1 | **Descarga de baja energía** (chispa, tracking) | FP; inspección; SFRA |
| **C2H2 alto** + H2 | D2 | **Arco / descarga de alta energía** (grave) | excitación anómala; SFRA desviado; fuera de servicio |
| **CH4 + C2H6** dominantes | T1 | **Térmico < 300 °C** (sobrecalentamiento leve) | termografía; carga; conexiones |
| C2H4 aparece, CH4 alto | T2 | **Térmico 300–700 °C** | R devanados desbalanceada; termografía |
| **C2H4 dominante** (+ H2) | T3 | **Térmico > 700 °C** (punto caliente severo) | R devanados; termografía; relación de Rogers |
| **CO + CO₂ altos** (rel. CO2/CO baja) | — | **Degradación de la celulosa** (papel sobrecalentado) | furanos (2-FAL); DFR; grado de polimerización |
| C2H2 + gases térmicos mixtos | DT | **Falla térmica + eléctrica combinada** | inspección; múltiples pruebas |

> La relación **CO2/CO** ayuda: muy baja (<3) sugiere papel sobrecalentado activamente;
> muy alta (>10) sugiere oxidación lenta/normal del papel. ⚠️ Verificar cortes.

## Factores que ensucian la medida (descartar antes de condenar el tx)

- **Muestreo / transporte deficiente** (jeringa con aire, fuga) → pérdida de gases
  ligeros (H2) → falso negativo. Repetir con técnica D3612/IEC 60567.
- **Gases de un evento pasado ya resuelto** → nivel alto pero **tasa ~0** → no es
  falla activa. La tasa de generación distingue (`02-…`).
- **OLTC comunicado con la cuba** → acetileno "normal" por las maniobras del cambiador,
  no por falla del tx. Verificar el diseño del OLTC.
- **Relaciones aplicadas con gases en ruido** → diagnóstico espurio. Solo aplicar
  Duval/Rogers/Doernenburg si los gases superan los mínimos.

## Cómo confirmar el diagnóstico (convergencia por tipo)

- **Punto caliente (T1–T3)**: DGA térmico **+** resistencia de devanados desbalanceada
  **+** termografía **+** evaluación de carga → localizar y dimensionar.
- **Arco (D2)**: C2H2 **+** excitación anómala **+** SFRA con desviación → fuera de
  servicio, inspección interna.
- **Descarga parcial (PD)**: H2 **+** FP/tan δ↑ **+** PD (IEC) → vigilar/investigar.
- **Papel degradado**: CO/CO₂ **+** furanos **+** DFR (humedad acelera la hidrólisis).

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA** (Status 1, tasa estable): registrar baseline; intervalo rutinario.
- **INVESTIGAR** (Status 2 / generación moderada): **acortar el intervalo de muestreo**
  (re-DGA en semanas), correr pruebas convergentes según el tipo de falla.
- **RECHAZA** (Status 3 / C2H2 con generación activa / arco): escalar — re-muestreo
  inmediato, inspección, y si hay arco confirmado → **fuera de servicio**.

→ Para la **acción concreta, urgencia (criticidad×severidad) e intervalo de re-DGA**,
cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md` (DGA es la
prueba más frecuente: 6–12 meses, más seguido en críticos o con gases en ascenso).

## Enlace con el tablero / IA

El extractor de IA entrega los ppm crudos; el diagnóstico determinista debe: clasificar
el status (C57.104-2019), calcular la **tasa de generación** vs muestra previa, ubicar
la zona de Duval y el código de Rogers, y emitir veredicto + tipo de falla. La pestaña
**Tendencia** es central en DGA: la mayoría de condenas válidas vienen de la **pendiente
de generación**, no del valor puntual.
