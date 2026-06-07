# 04 · Diagnóstico — interpretación y troubleshooting

> El FP/tan δ nunca se diagnostica solo (IEEE C57.152): se interpreta **junto a** IR/PI,
> agua en aceite, DGA y el histórico. Esta neurona traduce patrones de resultado en causas.
>
> 🔗 **Convergencia obligatoria**: tras identificar un patrón aquí, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` (matriz cross-test) para confirmar la
> causa con las pruebas convergentes. **Un solo hallazgo = INVESTIGAR; dos o más = diagnóstico.**

## Patrones típicos → causa probable

| Patrón | Causa probable | Corroborar con |
|---|---|---|
| FP₂₀ alto y **creciente con T** en todos los modos | **Humedad** en el aislamiento sólido (celulosa mojada) | IR/PI bajos; agua en aceite (D1533); % humedad papel por DFR |
| FP₂₀ alto **uniforme**, líquido oscuro/ácido | **Envejecimiento / contaminación del aceite** | FP del aceite (D924); acidez (D974); color (D1500); IFT (D971) |
| FP₂₀ alto solo en **CHL** | Defecto/humedad **entre devanados** (AT–BT) | IR AT–BT; reactancia de dispersión; inspección |
| FP₂₀ alto solo en **un modo a tierra** (CH o CL) | Contaminación/defecto **localizado** en ese devanado o sus bujes | FP por buje; hot-collar; IR de ese lazo |
| **Tip-up positivo** (FP sube con tensión) | **Ionización en voids** / descargas parciales internas | PD (IEC 60076-3); DGA con H₂/C₂H₂; SFRA |
| **Tip-down** (FP baja con tensión) | Humedad **superficial** que se seca, o tierra de núcleo faltante | limpiar/secar bujes; verificar tierra de núcleo; repetir |
| FP estable pero **capacitancia cambió** vs histórico | Alteración geométrica del aislamiento (desplazamiento) | SFRA; reactancia de dispersión |
| FP normal pero **sube fuerte vs baseline** | Degradación incipiente / humedad reciente | tendencia; IR/PI; agua en aceite |

## Factores que ensucian la medida (descartar antes de condenar el tx)

- **Temperatura no estabilizada o mal registrada** → corrección errónea (usar factor del
  fabricante; IEEE C57.12.90 retiró el genérico en 2010). Anotar T real del aislamiento.
- **Humedad superficial / suciedad en bujes** → fuga externa que sube el FP sin que el
  aislamiento interno esté mal. Limpiar y secar; usar modos UST/GST para aislar la trayectoria.
- **Interferencia electrostática** del entorno (líneas energizadas cercanas) → usar la
  supresión del equipo y, si aplica, medir en otra frecuencia.
- **Conexiones / guarda mal aplicadas** → modo Doble incorrecto (GST vs UST) falsea qué se
  mide. Verificar la configuración antes de condenar.

## Cómo confirmar "humedad" (el diagnóstico más común)

Humedad se confirma con la **convergencia de evidencias**, no con el FP solo:
1. **FP₂₀ alto y creciente con la temperatura** (> Tabla 100.3: 0.5 % mineral).
2. **IR/PI bajos** (PI < 1.5, DAR < 1.25) — el FP alto y la IR baja por humedad coinciden.
3. **Agua en aceite** alta (ASTM D1533) y/o **% humedad del papel** alto vía **DFR**.
4. **DGA** sin gases de falla térmica/arco → confirma que es humedad, no otro mecanismo.

Si 1–3 coinciden → **secado del transformador** (vacío/calor) antes de cargar plenamente.
Re-ensayar FP/IR tras el secado para verificar recuperación.

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA**: registrar FP₂₀ por modo, capacitancia y T como nuevo baseline de tendencia.
- **INVESTIGAR**: repetir con bujes limpios; medir IR/PI y agua en aceite; comparar con
  histórico; correr tip-up si no se hizo, antes de escalar.
- **RECHAZA** (FP₂₀ ≫ límite / tip-up fuerte / tendencia adversa): tratamiento (secado o
  regeneración de aceite según causa); si persiste, escalar a inspección interna.

→ Para la **acción preventiva/correctiva concreta, la urgencia (criticidad×severidad) y el
intervalo de re-ensayo**, cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md`.

## Enlace con el tablero / IA

El extractor de IA del tablero entrega lecturas crudas (FP/tan δ, corriente, pérdidas por
modo); el diagnóstico determinista debe: corregir a 20 °C (factor del fabricante), aplicar
la jerarquía de criterio (`03-…`), separar CH/CL/CHL, y emitir el veredicto + causa probable
de esta tabla. El **histórico de tendencia** (pestaña Tendencia) es insumo crítico: muchas
condenas válidas vienen de la pendiente del FP, no del valor puntual.
