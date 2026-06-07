# 04 · Diagnóstico — DFR como árbitro de humedad

> El DFR es la prueba **concluyente** de humedad del papel (IEEE C57.152): cierra o
> reabre la sospecha que dejan IR y FP/tan δ cuando son ambiguos. No diagnostica solo
> mecanismos eléctricos/mecánicos — para eso están SFRA, excitación, DGA.
>
> 🔗 **Convergencia obligatoria**: el DFR es el **vértice de humedad** de la matriz
> cross-test. Tras leer el % aquí, ve a `../../_conocimiento/diagnostico-integrado-bateria.md`
> para cerrar la causa. **Un solo hallazgo = INVESTIGAR; dos o más convergentes = diagnóstico.**

## El rol único del DFR: árbitro de "¿es humedad o no?"

IR baja y FP/tan δ alto tienen **varias causas** (humedad, contaminación de bujes,
aceite envejecido, partículas). El DFR las **desempata** porque mide la humedad del
**papel** específicamente:

| Situación previa (IR/FP) | DFR dice… | Diagnóstico |
|---|---|---|
| IR↓ + FP↑ (sospecha de humedad) | **% papel alto (>3%)** | **Humedad confirmada** → secado |
| IR↓ + FP↑ (sospecha de humedad) | **% papel bajo (<2%)** | **NO es humedad** → buscar contaminación bujes / partículas / aceite |
| IR/FP normales | % papel alto | humedad incipiente que IR/FP aún no acusan → vigilar (DFR es más sensible) |
| FP alto a baja frecuencia | conductividad aceite alta, % papel bajo | **aceite conductivo/envejecido**, no papel húmedo → `analisis-aceite` |

## Patrones DFR → causa

| Patrón de la curva / ajuste | Causa probable | Corroborar con (convergencia) |
|---|---|---|
| % papel alto + agua aceite alta | **Humedad del sistema** | D1533 (% sat); IR/PI↓; recuperación tras secado |
| % papel bajo + conductividad aceite alta | **Aceite envejecido/contaminado** | acidez D974↑; IFT↓; FP del aceite D924↑ |
| % papel alto **subiendo** vs previos | **Ingreso de humedad** (sello/respirador) | tendencia; inspección de juntas y sílica |
| Mal ajuste X-Y (residual alto) | Geometría/T mal puestas o ruido | repetir con T estabilizada y geometría correcta |

## Factores que ensucian la medida (descartar antes de condenar)

- **Temperatura no estabilizada / mal registrada** → corrección de T errónea → % falso.
  Medir con el aislamiento térmicamente estable y anotar la T real.
- **Geometría X-Y desconocida o mal asumida** → ajuste pobre → % no confiable. Usar la
  geometría del diseño si se conoce; si no, marcar la incertidumbre.
- **Ruido / interferencia a muy baja frecuencia** (el rango mHz es lento y sensible) →
  curva sucia → repetir; descartar fugas superficiales (limpiar bujes, usar guarda).
- **Aceite recién cambiado/filtrado** → el sistema aún no está en equilibrio papel-aceite.

## Cómo se usa el DFR en el diagnóstico de la batería

El DFR está en el **nivel 5** de la pirámide de decisión (concluyente, ver
`../../_conocimiento/diagnostico-integrado-bateria.md §3`): se sube a él cuando IR/FP
disparan sospecha de humedad **o** la criticidad del activo lo justifica. Su salida:
1. **Confirma humedad** → dispara **secado** (vacío/calor) y re-ensayo para verificar
   recuperación del % de humedad.
2. **Descarta humedad** → redirige el diagnóstico a contaminación de bujes, partículas
   en aceite o envejecimiento del aceite (otras skills).

## Acciones por veredicto (→ mantenimiento predictivo)

- **SECO** (<2%): registrar como baseline de humedad; intervalo rutinario.
- **HÚMEDO-VIGILAR** (2–3%): acortar intervalo; cruzar con agua en aceite y tendencia.
- **HÚMEDO-SECAR** (>3%): planificar **secado** del transformador (tratamiento de vacío/
  calor o low-frequency heating); re-ensayar DFR tras el secado para confirmar recuperación.

→ Para la **acción concreta de secado, la urgencia (criticidad×severidad) y el intervalo
de re-ensayo**, cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md`
(el DFR se corre como baseline y tras evento/sospecha de humedad, no rutinariamente).

## Enlace con el tablero / IA

El extractor de IA entrega el % de humedad y la conductividad del aceite que reporta el
equipo DFR; el diagnóstico determinista debe: verificar que el % esté **corregido a 20 °C**,
clasificar (seco/vigilar/secar, `03-…`) y, sobre todo, **cruzarlo con la sospecha de IR/FP**
para confirmar o descartar humedad. Es la prueba que convierte un "INVESTIGAR por baja IR"
en un veredicto firme.
