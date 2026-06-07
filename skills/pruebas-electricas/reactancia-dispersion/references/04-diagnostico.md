# 04 · Diagnóstico — interpretación y troubleshooting

> La reactancia de dispersión nunca condena sola (IEEE C57.152): es un indicador de
> integridad **mecánica** que debe converger con **SFRA**, excitación y relación. Esta
> neurona traduce patrones de desviación en causas probables.
>
> 🔗 **Convergencia obligatoria**: tras identificar un patrón aquí, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` (matriz cross-test) para confirmar la
> causa. **Un solo hallazgo = INVESTIGAR; dos o más convergentes = diagnóstico.**

## Patrones típicos → causa probable

| Patrón | Causa probable | Corroborar con |
|---|---|---|
| %Z medido **↑** o **↓** > 3% vs placa (3φ) | **Deformación mecánica** general del devanado (canal de dispersión cambiado) | SFRA con desviación; histórico pre/post evento |
| Una **sola fase** desvía > 3% del promedio | Deformación **localizada** (pandeo radial / desplazamiento axial) en esa fase | SFRA de esa fase; excitación por fase; inspección |
| %Z **cae** marcadamente en una fase | **Espiras en cortocircuito** (N efectivo menor) | relación↓ en esa bobina; excitación↑; DGA (arco) |
| Cambio vs baseline **tras un cortocircuito pasante** | Daño electrodinámico (fuerzas ∝ I²) post-falla externa | SFRA pre/post; registro del evento; relación |
| %Z sin cambio pero SFRA desvía en alta f | Problema en conexiones/derivaciones, NO deformación de la bobina principal | revisar cables de prueba; conexiones del TAP |

## Factores que ensucian la medida (descartar antes de condenar)

- **Base/TAP distintos** entre medida y placa → la "desviación" es artificio. Normalizar
  a la misma base y medir en el mismo TAP.
- **Caída de tensión fuera de 30–100 VAC** → ajustar la corriente de inyección (empezar
  ~1.0 A) hasta caer en rango @ 60 Hz. ⚠️ verificar rango contra el equipo.
- **Magnetismo residual del núcleo** → desmagnetizar antes de medir si hubo DC reciente
  (IR, resistencia de devanados) — afecta la lectura.
- **Conexiones/cables de prueba** flojos → lecturas erráticas; revisar antes de condenar.

## Cómo confirmar "deformación mecánica" (convergencia)

Una deformación real se confirma cruzando, no con la reactancia sola:
1. **Desviación de reactancia** > 3% (vs placa o entre fases) o cambio vs baseline.
2. **SFRA** con desviación de huella en la banda **media** (devanados/geometría) y/o
   **baja** (núcleo/circuito magnético) vs baseline o fase hermana.
3. **Excitación / relación** anómalas en la misma fase (si hay espiras en corto).
4. **Histórico de evento**: cortocircuito pasante, transporte, sismo o impacto registrado.

Si 1+2 coinciden → **evaluación estructural** (posible reparación en fábrica) antes de
re-energizar a plena carga. Si solo 1 → INVESTIGAR + correr SFRA.

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA**: registrar %Z (3φ y por fase) + TAP como baseline de tendencia mecánica.
- **INVESTIGAR**: correr SFRA, excitación y relación; comparar con baseline; revisar
  eventos recientes de cortocircuito.
- **RECHAZA** (desviación grande + SFRA convergente): no operar a plena carga; evaluación
  estructural / inspección interna; posible reparación.

→ Para la **acción concreta, la urgencia (criticidad×severidad) y el intervalo de re-ensayo**,
cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md` (la reactancia se
re-mide tras todo cortocircuito pasante de magnitud).

## Enlace con el tablero / IA

El extractor de IA entrega impedancias crudas; el diagnóstico determinista debe:
normalizar a base de placa, calcular Δ3φ y Δ por fase, aplicar el umbral 3% (`03-…`) y
emitir el veredicto + causa. El **baseline pre-evento** (pestaña Tendencia) es el insumo
más valioso: muchas deformaciones se detectan por el cambio, no por el valor absoluto.
