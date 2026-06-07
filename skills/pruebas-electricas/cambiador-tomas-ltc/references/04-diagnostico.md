# 04 · Diagnóstico — interpretación y troubleshooting

> El LTC se diagnostica cruzando firma DRM + tiempos + **DGA del compartimiento** + conteo,
> nunca con un solo eje (IEEE C57.152). Esta neurona traduce patrones de firma en causas.
>
> 🔗 **Convergencia obligatoria**: tras identificar un patrón aquí, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` (matriz cross-test, fila "Cambiador de
> tomas (LTC) degradado") para confirmar la causa. **Un hallazgo = INVESTIGAR; dos+ = diagnóstico.**

## Patrones típicos → causa probable

| Patrón | Causa probable | Corroborar con |
|---|---|---|
| Corriente **cae a cero** durante la transición | **Transición abierta** (mecanismo no puentea) | repetir DRM; inspección del desviador → RECHAZA |
| Resistencia de contacto **↑** / picos altos-anchos en la firma | **Contactos quemados/erosionados** (coquización) | DGA LTC (C₂H₂↑); termografía; nº operaciones alto |
| **Tiempos** asimétricos entre fases o alargados vs previos | **Coordinación errónea** / contacto lento / resorte débil | comparar fases; inspección del motor-drive |
| Resistor de transición **fuera de valor** en una fase | resistor degradado/abierto | medir resistor; firma de esa fase; inspección |
| **DGA del LTC** con C₂H₂/C₂H₄ en ascenso anómalo | arco anómalo (más allá del arqueo de diseño) | tendencia DGA LTC; termografía; firma DRM |
| Relación de transformación incorrecta en un TAP | TAP no asienta / coordinación | relación por TAP (TTR); excitación por posición |

## Factores que ensucian la medida (descartar antes de condenar)

- **Comparar contra un baseline inadecuado** (otro TAP, otra unidad) → la firma DRM es
  relativa; usar previos de la misma unidad / fase hermana.
- **DGA del LTC leída con límites del tanque** → falso positivo: el LTC arquea por diseño,
  C₂H₂/C₂H₄ altos son normales; diagnosticar por **ratio/tendencia**.
- **Muestreo DRM lento** → no captura la transición (≈40–60 ms); usar alta tasa de muestreo.
- **Motor-drive / mecanismo no acondicionado** (frío, lubricación) → tiempos artificialmente
  altos; operar el LTC varias veces antes de medir.

## Cómo confirmar "contactos degradados" (convergencia)

Una degradación real de contactos se confirma cruzando:
1. **Firma DRM**: resistencia de contacto en ascenso / picos anómalos vs previos.
2. **DGA del compartimiento LTC**: ratios/tendencia de gases de arco anómalos (C₂H₂↑).
3. **Termografía**: punto caliente en el compartimiento/contactos.
4. **Nº de operaciones**: conteo alto que supera el umbral de overhaul del fabricante.

Si 1+2 coinciden → **mantenimiento/overhaul del LTC** (inspección y cambio de contactos).
Si solo 1 → INVESTIGAR + DGA del LTC + termografía.

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA**: registrar firma DRM, tiempos y nº de operaciones como baseline.
- **INVESTIGAR**: repetir DRM con baseline adecuado; DGA del LTC (tendencia); termografía;
  revisar conteo vs umbral.
- **RECHAZA** (transición abierta / contactos muy degradados / DGA arco anómalo): programar
  **overhaul del LTC**; en transición abierta, restringir maniobras hasta intervención.

→ Para la **acción concreta, la urgencia (criticidad×severidad) y el intervalo** —que en el
LTC se fija por **nº de operaciones + tiempo + gases del compartimiento**— cierra el lazo en
`../../_conocimiento/gestion-mantenimiento-predictivo.md` (§4 fila LTC: "según nº de operaciones +
tiempo; se acorta si conteo alto o gases en el LTC").

## Enlace con el tablero / IA

El extractor de IA entrega firmas/tiempos/conteo crudos; el diagnóstico determinista debe:
verificar continuidad (sin transición abierta), comparar firma/tiempos vs previos y entre
fases, leer la DGA del LTC por ratios (NO límites del tanque), y emitir veredicto + causa +
intervalo por operaciones. El **conteo de operaciones** y el **histórico de firmas** (pestaña
Tendencia) son los insumos que disparan el mantenimiento predictivo del componente más activo.
