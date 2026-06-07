# 04 · Diagnóstico — interpretación y troubleshooting

> La excitación nunca se diagnostica sola (IEEE C57.152): un patrón roto se interpreta **junto a**
> la TTR, la resistencia de devanados, el SFRA y el histórico. Es muy sensible al **magnetismo
> residual**, que debe descartarse antes de condenar nada.
>
> 🔗 **Convergencia obligatoria**: tras identificar un patrón aquí, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` (matriz cross-test) para confirmar la
> causa con las pruebas convergentes. **Un solo hallazgo = INVESTIGAR; dos o más = diagnóstico.**

## Patrones típicos → causa probable

| Patrón | Causa probable | Corroborar con |
|---|---|---|
| Una fase con excitación **mucho mayor** + **TTR desviada** en esa fase | **Espiras en cortocircuito** | `relacion-transformacion`; R devanados; DGA (arco/térmico) |
| Patrón 2+1 **roto** (externas ya no se parecen), TTR ok | Defecto de **núcleo** (laminaciones, puesta a tierra múltiple del núcleo) | IR del núcleo @500 Vdc; SFRA; DGA |
| Excitación cambia **solo en ciertos TAPs** | **Cambiador de tomas** (contacto erosionado/sucio) | resistencia dinámica LTC; R devanados por TAP; TTR por TAP |
| Las 3 fases **↑ uniformemente** vs previos | **Magnetismo residual** (más probable) o cambio global de núcleo | desmagnetizar y repetir; SFRA |
| Lecturas **erráticas / no repetibles** | Magnetismo residual o **conexión floja** | desmagnetizar; verificar conexiones; repetir |
| Excitación ↑ vs previos, patrón aún correcto | Degradación incipiente | tendencia; TTR; repetir en próximo ciclo |

## Factores que ensucian la medida (descartar antes de condenar el tx)

- **Magnetismo residual del núcleo** ← el más común. Distorsiona el patrón y puede simular una
  falla inexistente. **Desmagnetizar** (degauss) antes de medir, sobre todo si antes se hizo una
  prueba con DC (resistencia de devanados, IR).
- **Tensión de prueba distinta** a la de la base de comparación → no comparable. Medir a la misma
  tensión que el dato de fábrica/previos (o anotar la diferencia).
- **Conexión floja / cable invertido** del equipo de prueba → lecturas erráticas.
- **Secuencia de pruebas**: hacer la excitación **antes** de las pruebas DC, o desmagnetizar entre
  ambas, para no arrastrar magnetismo residual.

## Cómo confirmar "espiras en cortocircuito" (convergencia con TTR)

Se confirma por **convergencia**, no con la excitación sola:
1. **Excitación elevada** en una fase + patrón roto.
2. **TTR desviada** (>0.5%) en esa misma fase (relación más baja).
3. **Resistencia de devanados** anómala en esa fase (si el corto altera el camino).
4. **DGA** con gases de falla (H₂/C₂H₂ de arco, o térmicos) si el corto disipa energía.

Si 1–2 coinciden → **fuera de servicio**: el corto entre espiras escala a falla. No energizar
hasta inspección interna.

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA**: registrar I_exc por fase/TAP, patrón y tensión de prueba como baseline.
- **INVESTIGAR**: desmagnetizar y repetir; medir TTR y R devanados; comparar con histórico;
  si el patrón sigue roto, escalar.
- **RECHAZA** (espira en corto / defecto de núcleo confirmado por convergencia): no energizar;
  escalar a inspección interna / reparación en fábrica.

→ Para la **acción correctiva concreta, la urgencia (criticidad×severidad) y el intervalo de
re-ensayo**, cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md`.

## Enlace con el tablero / IA

El extractor de IA del tablero entrega corrientes de excitación crudas por fase/TAP; el
diagnóstico determinista debe: identificar el patrón 2+1, comparar vs fábrica/previos a igual
tensión, y emitir veredicto + causa probable de esta tabla. El **histórico de tendencia** capta
cambios graduales antes de que el patrón se rompa del todo.
