---
name: analisis-aceite
description: >-
  Evalúa y diagnostica las PRUEBAS FÍSICO-QUÍMICAS del aceite aislante de
  transformadores de potencia: rigidez dieléctrica (ASTM D1816 / D877, kV),
  acidez o número de neutralización (D974, mg KOH/g), tensión interfacial IFT
  (D971, mN/m), contenido de agua (D1533, ppm), factor de potencia / tan δ del
  aceite (D924, %), color (D1500), gravedad específica y condición visual,
  contra ANSI/NETA ATS-2025 (Tabla 100.4) e IEEE C57.106 por clase de tensión.
  Úsala SIEMPRE que aparezcan datos de muestra de aceite, físico-químicas, oil
  quality, BDV/rigidez/breakdown, IFT/tensión interfacial, acidez/TAN/número de
  neutralización, humedad/agua/ppm en aceite, color del aceite, FP del aceite,
  éster natural vs aceite mineral, o cuando haya que decidir si el aceite "pasa",
  si está envejecido (IFT↓ + acidez↑), o necesita filtrado/regeneración —
  aunque el usuario no nombre la norma ni el método ASTM.
---

# Análisis físico-químico del aceite aislante — Transformadores de potencia

Esta skill convierte los parámetros crudos de una muestra de aceite en un
**veredicto trazable**: cada parámetro evaluado contra la tabla normativa por
clase de tensión, consolidado en multi-norma, y con un diagnóstico de qué
significa la combinación de valores (envejecimiento, humedad, contaminación).

## Por qué importa hacerlo bien

El aceite es a la vez **dieléctrico y refrigerante**, y su análisis es el
testigo más barato del envejecimiento del sistema sólido. Tres errores típicos
invalidan el veredicto: (1) **leer un parámetro aislado** — una rigidez baja sola
puede ser humedad o partículas; el patrón **IFT↓ + acidez↑ + color↑** juntos es
lo que firma el envejecimiento oxidativo; (2) **usar un límite genérico** en vez
del que corresponde a la **clase de tensión** (≤69 kV / >69–<230 kV / ≥230 kV) y
al estado (nuevo vs en servicio); (3) **comparar éster natural contra límites de
aceite mineral** — el éster tiene IFT, color y agua de saturación distintos.
Esta skill te obliga a evitar los tres.

## Workflow

1. **Reúne las entradas** (ver `references/02-calculos.md` §Entradas): valores por
   ensayo (rigidez D1816/D877 kV, acidez D974 mgKOH/g, IFT D971 mN/m, agua D1533
   ppm, FP D924 %, color D1500, gravedad específica, visual D1524), **temperatura
   de muestreo**, **clase de tensión** del tx, tipo de líquido (mineral / éster /
   silicónico) y datos previos (tendencia).
2. **Normaliza**: corrige el FP del aceite a 20 °C si aplica; calcula % de saturación
   relativa de agua (ppm vs solubilidad a la T del aceite). → `references/02-calculos.md`.
3. **Detecta el patrón de envejecimiento**: correlaciona IFT, acidez y color
   (índice de envejecimiento). → `references/01-teoria.md` + `02-calculos.md`.
4. **Evalúa MULTI-NORMA** (no una sola): veredicto por parámetro contra cada óptica
   aplicable (fábrica > clase MO.00418 > NETA Tabla 100.4 > IEEE C57.106 > ASTM por método)
   + tendencia, y consolida en el peor citando la fuente. → `references/03-criterios-evaluacion.md`
   + `../_conocimiento/marco-normativo-multinorma.md`.
5. **Diagnostica y cierra el lazo**: confirma la causa por **convergencia**
   (DGA + DFR + IR/FP) → `../_conocimiento/diagnostico-integrado-bateria.md`; y
   traduce el veredicto en acción (filtrado/regeneración/cambio) + intervalo →
   `../_conocimiento/gestion-mantenimiento-predictivo.md`. → `references/04-diagnostico.md`.
6. **Reporta** con el formato de salida de abajo.

## Formato de salida (multi-norma)

```
PRUEBA: Análisis físico-químico de aceite — <tag/serie del tx>
Condiciones: T muestreo = <°C> | clase = <kV> | líquido = <mineral/éster>
Parámetros:
  Rigidez (D1816 @2mm): <kV>     Agua (D1533): <ppm> (<% sat>)
  Acidez (D974): <mgKOH/g>       IFT (D971): <mN/m>
  FP (D924 @25°C/100°C): <%>     Color (D1500): <…>   GE: <…>
Índice de envejecimiento: IFT↓ + acidez↑ + color↑ → [sano / oxidación incipiente / avanzado]
CRITERIOS APLICADOS (por óptica):
  • Fábrica/commissioning: <…> → [✔/✘/—]            (precedencia 1)
  • Interno por clase (MO.00418): <umbral> → [✔/✘]    (precedencia 2)
  • NETA Tabla 100.4 / IEEE C57.106 por clase: <umbral> → [✔/✘]  (precedencia 3)
  • ASTM por método (límite de servicio): [✔/✘]
  • Tendencia vs histórico: [estable / ↓↓ degrada]
  ⊳ Divergencias: <p.ej. rigidez pasa pero IFT+acidez condenan → "envejecido">
VEREDICTO CONSOLIDADO: <APRUEBA / INVESTIGAR / RECHAZA>  — <criterio más conservador citado>
Diagnóstico: <causa probable + pruebas convergentes (DGA/DFR/IR-FP) que la confirman>
Acción: <filtrado / regeneración / cambio / secado> + intervalo de re-ensayo
```

## Conocimiento de soporte (leer on-demand)

- `references/01-teoria.md` — qué mide cada ensayo, química del aceite, fallas que revela.
- `references/02-calculos.md` — fórmulas (índice de envejecimiento, % saturación de agua, corrección FP) + ejemplos.
- `references/03-criterios-evaluacion.md` — matriz multi-norma con cita por método ASTM y clase.
- `references/04-diagnostico.md` — patrón→causa→convergencia + troubleshooting.
- Compartidas: `../_conocimiento/tablas-neta-referencia.md` (Tabla 100.4 por clase),
  `../_conocimiento/00-BATERIA-NETA-7.2.2.md` (contexto de la batería completa),
  `../_conocimiento/marco-normativo-multinorma.md` (varias ópticas + reconciliación),
  `../_conocimiento/diagnostico-integrado-bateria.md` (convergencia cross-test) y
  `../_conocimiento/gestion-mantenimiento-predictivo.md` (veredicto → acción + intervalo).
