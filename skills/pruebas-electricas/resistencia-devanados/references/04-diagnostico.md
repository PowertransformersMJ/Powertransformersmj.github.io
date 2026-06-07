# 04 · Diagnóstico — interpretación y troubleshooting

> La resistencia de devanados nunca se diagnostica sola (IEEE C57.152): una desviación se
> interpreta **junto a** la TTR, la corriente de excitación, la termografía, la resistencia
> dinámica del LTC y el histórico.
>
> 🔗 **Convergencia obligatoria**: tras identificar un patrón aquí, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` (matriz cross-test) para confirmar la
> causa con las pruebas convergentes. **Un solo hallazgo = INVESTIGAR; dos o más = diagnóstico.**

## Patrones típicos → causa probable

| Patrón | Causa probable | Corroborar con |
|---|---|---|
| Una fase con R **notablemente mayor** (>2%) en todos los TAPs | **Mala conexión / empalme flojo** en el camino de esa fase | termografía (punto caliente); inspección de terminales; DGA térmico |
| R **alta solo en ciertos TAPs** | **Contacto del cambiador de tomas (LTC/DETC)** erosionado/picado | resistencia dinámica LTC; DGA del compartimiento LTC; excitación por TAP |
| R **infinita / no se estabiliza** | **Devanado abierto** o conexión interrumpida | TTR (no medible); inspección de conexiones |
| R **menor** en una fase + TTR/excitación anómalas | Posibles **espiras en cortocircuito** | `relacion-transformacion`; `corriente-excitacion`; DGA |
| R que **crece vs histórico** en una fase | Conexión degradándose (oxidación, aflojamiento) | tendencia; termografía; reapriete y repetir |
| Lecturas que "fluyen" / no asientan | **Estabilización térmica** insuficiente o inductancia residual | esperar a estabilizar; registrar T del devanado |

## Factores que ensucian la medida (descartar antes de condenar el tx)

- **Temperatura no estabilizada / mal registrada** → corrección errónea. Medir la T **del
  devanado** (no la ambiente) con el devanado térmicamente asentado; esperar a que la lectura
  se estabilice (la inductancia del devanado hace que la R "fluya" al inicio de la inyección DC).
- **Corriente de prueba demasiado alta** (>10% In) → calienta el cobre y baja la T efectiva mal
  registrada → lectura no comparable (IEEE C57.152).
- **Conexión de los hilos sense (4 hilos) mal colocada** → incluye resistencia de contacto ajena.
  Verificar el montaje Kelvin antes de condenar una fase.
- **Magnetismo residual / energía almacenada** tras la prueba → descargar el devanado antes de
  pruebas AC posteriores (excitación) para no arrastrar magnetismo.

## Cómo confirmar "mala conexión / contacto del LTC" (el diagnóstico más común)

Se confirma por **convergencia**, no con la R sola:
1. **R desbalanceada >2%** en una fase (o alta solo en un TAP).
2. **Termografía** con punto caliente en ese terminal/conexión bajo carga.
3. **DGA** con gases de falla térmica (CH₄, C₂H₄, C₂H₆) si el punto caliente disipa energía.
4. Para el LTC: **resistencia dinámica del cambiador** anómala en esa posición.

Si 1–2 coinciden → **reapriete / mantenimiento de la conexión o del LTC**; re-medir para verificar
recuperación. Si la R sigue alta tras el reapriete → escalar a inspección interna.

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA**: registrar Rs por fase/TAP, T de medida y T ref como baseline de tendencia.
- **INVESTIGAR**: verificar montaje Kelvin y estabilización; corregir a la misma Ts; reapretar
  conexiones accesibles; termografía bajo carga; comparar con histórico antes de escalar.
- **RECHAZA** (devanado abierto / espira en corto confirmada / contacto LTC degradado): planificar
  intervención (reapriete, overhaul del LTC) o escalar a inspección interna.

→ Para la **acción correctiva concreta, la urgencia (criticidad×severidad) y el intervalo de
re-ensayo**, cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md`.

## Enlace con el tablero / IA

El extractor de IA del tablero entrega resistencias crudas por fase/TAP; el diagnóstico
determinista debe: corregir a la T de referencia (Tk según material), calcular el desbalance,
aplicar la jerarquía de criterio (`03-…`) y emitir veredicto + causa probable de esta tabla. El
**histórico de tendencia** detecta conexiones que se degradan antes de cruzar el 2%.
