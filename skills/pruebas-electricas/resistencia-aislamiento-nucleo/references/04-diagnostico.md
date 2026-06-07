# 04 · Diagnóstico — interpretación y troubleshooting

> La IR baja del núcleo casi siempre significa **un segundo punto de tierra**. Se confirma
> por **convergencia** con DGA y termografía (IEEE C57.152), nunca con la IR sola. Esta
> neurona traduce el patrón en causa y acción.
>
> 🔗 **Convergencia obligatoria**: tras identificar el patrón, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` (matriz cross-test, fila
> "Falla térmica / punto caliente") para confirmar. **Un solo hallazgo = INVESTIGAR; dos o
> más = diagnóstico.**

## Patrones típicos → causa probable

| Patrón | Causa probable | Corroborar con |
|---|---|---|
| IR núcleo **baja** (kΩ–pocos MΩ) @ 500 Vdc, tierra levantada | **Segundo punto de tierra** del núcleo (espira cerrada) | **DGA**: C₂H₄/C₂H₆/CH₄ ascendentes; termografía; corriente de tierra del núcleo |
| IR núcleo cae **vs fábrica** pero aún ≥500 MΩ | Aterrizaje accidental **incipiente** (lodo/humedad/rebaba migrando) | tendencia; DGA; repetir tras inspección |
| IR baja **intermitente** (cambia entre medidas) | Contacto **flotante/intermitente** (objeto suelto, partícula) | DGA con **C₂H₂** (micro-arqueo); golpear/inspeccionar; repetir |
| IR baja + **gases térmicos** (C₂H₄/C₂H₆) en DGA | Multi-tierra con **punto caliente** confirmado | localizar por termografía; corriente circulante; inspección interna |
| IR alta pero medida **inválida** (5 kV o tierra puesta) | Error de método, no del núcleo | repetir a **500 Vdc** con la **pletina levantada** |

## El diagnóstico estrella: múltiples puntos de tierra del núcleo

Es la razón de ser de esta prueba. Secuencia de confirmación:

1. **IR del núcleo baja** @ 500 Vdc con la tierra intencional **levantada** → existe un camino
   conductor núcleo↔tanque adicional.
2. **DGA** del transformador muestra **gases de falla térmica de baja/media temperatura**
   (predominan **C₂H₄ etileno** y **C₂H₆ etano**, con **CH₄ metano**); si el contacto es
   **intermitente**, aparece **C₂H₂ acetileno** por micro-arqueo.
3. **Termografía** localiza el punto caliente en el tanque/núcleo.
4. **Corriente de tierra del núcleo** elevada (orden de **~0.1 A** o más, ⚠️ límite a
   verificar) confirma la corriente circulante.

Si 1 + (2 o 4) coinciden → **múltiple punto de tierra confirmado** → corrección.

## Factores que ensucian la medida (descartar antes de condenar)

- **No desconectar la pletina de tierra del núcleo** → se mide a través de la tierra
  intencional → lectura ~0 sin significado. **El error #1**: verificar siempre.
- **Tensión de prueba equivocada** (5 kV en vez de 500 Vdc) → puede dañar el aislamiento del
  núcleo y/o no ser comparable. Usar **500 Vdc**.
- **Humedad superficial en el aislador de la pletina** → fuga externa que baja la lectura sin
  que el núcleo esté multi-aterrizado. Limpiar/secar; repetir.
- **Conexión de prueba sucia / mala** → repetir con terminales limpios.

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA** (≥500 MΩ, comparable a fábrica): registrar como baseline; correlacionar con DGA
  de rutina.
- **INVESTIGAR** (IR baja moderada / cae vs fábrica): DGA + termografía + corriente de tierra;
  inspeccionar accesos del núcleo; acortar intervalo.
- **RECHAZA** (IR ≪500 MΩ + gases térmicos): **localizar y eliminar el segundo aterrizaje**
  (limpieza de lodo/rebaba, retiro de objeto, secado); en casos severos, inspección interna /
  intervención en sitio especializado. Re-ensayar IR y DGA tras la corrección para verificar.

→ Para la **acción correctiva concreta, la urgencia (criticidad×severidad) y el intervalo de
re-ensayo**, cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md`
(fila "Gases de falla térmica → localizar punto caliente").

## Enlace con el tablero / IA

El extractor de IA entrega la IR del núcleo + las condiciones de prueba; el diagnóstico
determinista debe: **validar el método** (500 Vdc + tierra levantada), aplicar el piso de
NETA D.11 y la comparación vs fábrica (`03-…`), y si la IR es baja, **disparar la correlación
con DGA** (C₂H₄/C₂H₆) para confirmar múltiple tierra. La **tendencia** (pestaña Tendencia) +
el DGA son los insumos que convierten una IR de núcleo en un diagnóstico de punto caliente.
