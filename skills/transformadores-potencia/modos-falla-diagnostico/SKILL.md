---
name: modos-falla-diagnostico
description: Explica los MODOS DE FALLA del transformador de potencia y su DIAGNÓSTICO integrado — la cadena esfuerzo → deterioro → modo de falla, los cuatro esfuerzos (eléctrico, térmico, mecánico, químico/ambiental), las familias de falla (dieléctrica, térmica, mecánica/cortocircuito, del cambiador de tomas, de bujes/accesorios), y qué ensayo detecta cada una (mapa síntoma → prueba → lóbulo). Es el lóbulo INTEGRADOR que conecta los demás. Úsala SIEMPRE que el usuario mencione modos de falla, causa raíz, esfuerzos (eléctrico/térmico/mecánico/químico), falla dieléctrica/térmica/mecánica, qué prueba detecta una falla, diagnóstico integrado, o cómo se relacionan los síntomas con las pruebas.
---

# Modos de falla y diagnóstico integrado

Una falla de transformador no aparece sola: un **esfuerzo** (eléctrico, térmico, mecánico, químico)
provoca un **deterioro** que, acumulado, se vuelve un **modo de falla**. Este lóbulo es el
**integrador**: ordena las familias de falla y mapea cada una al **ensayo** que la detecta y al
lóbulo que la trata. Es el puente entre el equipo (lóbulo 50) y los ensayos (lóbulo 49).

## Cuándo se dispara

El usuario menciona modos de falla, causa raíz / RCA del transformador, los **esfuerzos** (eléctrico,
térmico, mecánico, químico/ambiental), una falla **dieléctrica / térmica / mecánica**, qué **prueba
detecta** un problema, o pide un **diagnóstico integrado** que cruce varios síntomas.

## Workflow (6 pasos)

1. **Identifica el esfuerzo dominante**: eléctrico, térmico, mecánico o químico/ambiental.
   → `references/01-teoria.md`.
2. **Sigue la cadena** esfuerzo → deterioro → modo de falla (cómo un estrés se vuelve falla).
3. **Clasifica la familia de falla**: dieléctrica, térmica, mecánica/cortocircuito, del OLTC,
   de bujes/accesorios. → `references/01-teoria.md`.
4. **Mapea al ensayo que la detecta** (síntoma → prueba): FRA, %Z, FP/tan δ, DGA, DP/furánicos,
   relación, excitación… → `references/04-diagnostico.md`.
5. **Enruta al lóbulo correcto**: el ensayo/aceite se interpreta en el lóbulo 49
   (`../../pruebas-electricas/`); el parámetro del equipo, en la skill hermana.
6. **Emite la ficha de diagnóstico** (formato abajo), `⚠️ verificar` lo no confirmado.

## Conceptos núcleo

```
CADENA:  ESFUERZO  →  DETERIORO acumulado  →  MODO DE FALLA  →  SÍNTOMA medible  →  ENSAYO
CUATRO ESFUERZOS:
  ELÉCTRICO  (sobretensión, impulso, descargas parciales) → estrés dieléctrico
  TÉRMICO    (sobrecarga, hot-spot, refrigeración deficiente) → envejecimiento del papel
  MECÁNICO   (fuerzas de cortocircuito ∝ I², transporte, sismos) → telescopeo/pandeo/aflojamiento
  QUÍMICO/AMBIENTAL (humedad, oxígeno, azufre corrosivo, contaminación) → degradación del aislamiento
FAMILIAS DE FALLA:
  DIELÉCTRICA  · TÉRMICA · MECÁNICA/CORTOCIRCUITO · CAMBIADOR DE TOMAS (OLTC) · BUJES/ACCESORIOS
```

## Mapa síntoma → ensayo (resumen)

```
deformación de devanado ......... FRA + %Z          → ../construccion-nucleo-devanados, ../impedancia-cortocircuito
punto caliente / sobrecalentar .. DGA (gases) + termografía → lóbulo 49 + ../sistema-refrigeracion
papel envejecido ................ DP / furánicos     → ../gestion-vida-activo + lóbulo 49
falla dieléctrica / humedad ..... FP/tan δ + DFR + DGA → lóbulo 49 + ../bujes-y-accesorios
problema de OLTC ................ DGA selectivo + DRM + tendencia → ../regulacion-tomas + lóbulo 49
relación / conexión errada ...... relación de transformación + excitación → ../grupo-vectorial, ../identificacion-tipo
```

## Neuronas (lee según necesites)

- `references/01-teoria.md` — esfuerzos, cadena esfuerzo→falla, familias de falla.
- `references/02-calculos.md` — indicadores cuantitativos por familia (∝I², F_AA, ΔZ%, ΔFP).
- `references/03-criterios-evaluacion.md` — RCA integrada, multi-norma, precedencia de evidencia.
- `references/04-diagnostico.md` — mapa síntoma→ensayo→lóbulo, errores de diagnóstico cruzado.

Marcos compartidos: `../_conocimiento/00-fundamentos-transformador.md`,
`../_conocimiento/convenciones-calculo.md`, `../_conocimiento/marco-normativo-tx.md`.

## Formato de salida (ficha de diagnóstico integrado)

```
SÍNTOMA reportado: <descripción>
ESFUERZO dominante: <eléctrico | térmico | mecánico | químico/ambiental>
FAMILIA de falla: <dieléctrica | térmica | mecánica | OLTC | bujes/accesorios>
CADENA probable: <esfuerzo → deterioro → modo de falla>
ENSAYO(S) que lo confirman: <FRA / %Z / FP / DGA / DP / relación / excitación>
LÓBULO/SKILL responsable: <49 pruebas-electricas | skill hermana de equipo>
ACCIÓN: <telemetría → diagnóstico → reporte → STOP → autorización → fix (§3.3)>
⚠️ VERIFICAR: <datos de fábrica, referencia histórica, criterio MO.00418>
```

→ Este lóbulo NO interpreta el aceite/DGA (eso es el lóbulo 49, `../../pruebas-electricas/`): lo
**enruta**. Ordena el "qué pudo fallar y con qué se confirma" cruzando todas las skills hermanas.
