# 04 · Diagnóstico — banda → subsistema → causa + troubleshooting

> SFRA localiza POR BANDA pero rara vez condena sola (IEEE C57.149): una deformación real
> debe converger con **reactancia de dispersión**, excitación y relación. Esta neurona
> traduce la banda que divergió en la causa probable.
>
> 🔗 **Convergencia obligatoria**: tras localizar la banda aquí, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` (matriz cross-test) para confirmar la
> causa. **Un solo hallazgo = INVESTIGAR; dos o más convergentes = diagnóstico.**

## Patrones típicos → causa probable (por banda)

| Patrón (vs baseline) | Banda | Causa probable | Corroborar con |
|---|---|---|---|
| Primera resonancia se desplaza / cambia pendiente | **Baja** | problema de **núcleo**, sujeción, o magnetismo residual | desmagnetizar + repetir; excitación; relación |
| Caída marcada de magnitud a muy baja f | **Baja** | **espiras en cortocircuito** o circuito abierto | reactancia↓ esa fase; relación↓; excitación↑ |
| Resonancias se corren / aparecen-desaparecen | **Media** | **deformación de devanado** (axial/radial) | **reactancia de dispersión** >3%; histórico de evento |
| Divergencia solo a alta f | **Alta** | **set-up** (cables/aterrizaje/conexión floja), no el tx | repetir con set-up corregido; revisar guarda |
| Una fase difiere de sus hermanas en media f | **Media** | deformación **localizada** en esa fase | reactancia por fase; excitación por fase; inspección |

## Factores que ensucian la medida (descartar antes de condenar)

- **Set-up no equivalente** (TAP distinto, otros cables, otro aterrizaje) → divergencia
  espuria, sobre todo en **alta f**. Repetir replicando exactamente el baseline.
- **Magnetismo residual del núcleo** (tras IR/resistencia de devanados con DC) → desplaza
  la **baja f**. Desmagnetizar y repetir ANTES de diagnosticar el núcleo.
- **Conexiones/guarda flojas** → resonancias falsas en alta f.
- **Baseline inadecuado** (unidad no gemela, distinto diseño) → comparar peras con peras;
  preferir time-based (misma unidad) sobre cualquier otro.

## Cómo confirmar "deformación mecánica" (convergencia)

Una deformación real se confirma cruzando, no con SFRA sola:
1. **SFRA**: divergencia reproducible en banda **media** (devanados) y/o **baja** (núcleo)
   vs baseline equivalente, con set-up verificado.
2. **Reactancia de dispersión**: desviación > 3% vs placa o entre fases (mismo subsistema).
3. **Excitación / relación**: anomalía en la misma fase (si hay espiras en corto).
4. **Histórico de evento**: cortocircuito pasante, transporte, sismo, impacto.

Si 1+2 coinciden → **evaluación estructural** (posible reparación en fábrica) antes de
re-energizar a plena carga. Si solo 1 → INVESTIGAR + correr reactancia de dispersión.

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA** (huella coincide): registrar como nuevo baseline (la huella es el activo más
  valioso para futuras comparaciones).
- **INVESTIGAR**: verificar set-up, desmagnetizar si baja f, repetir; correr reactancia de
  dispersión + excitación; comparar con time-based.
- **RECHAZA** (media f reproducible + reactancia convergente): no operar a plena carga;
  evaluación estructural / inspección interna.

→ Para la **acción concreta, la urgencia (criticidad×severidad) y el intervalo de re-ensayo**,
cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md` (SFRA: baseline +
tras todo evento mecánico o ante sospecha; es prueba de tendencia, no rutinaria frecuente).

## Enlace con el tablero / IA

El extractor de IA entrega trazas/curvas; el diagnóstico determinista debe: verificar
equivalencia de set-up, comparar por banda contra el baseline (`03-…`), localizar el
subsistema y emitir veredicto + causa. El **baseline guardado** (pestaña Tendencia / archivo
de huellas) es el insumo crítico: sin él, SFRA no diagnostica. Almacenar cada huella APROBADA.
