---
name: sistema-refrigeracion
description: Interpreta el SISTEMA DE REFRIGERACIÓN de un transformador de potencia — la notación IEEE de 4 letras (ONAN/ONAF/OFAF/ODAF), qué medio y circulación representa cada letra, las etapas de enfriamiento y la potencia (MVA) por etapa, y la regla de que subir de etapa NO regala MVA. Úsala SIEMPRE que el usuario mencione refrigeración, enfriamiento, ONAN/ONAF/OFAF/ODAF, radiadores, ventiladores, bombas de aceite, etapas de enfriamiento, o pregunte cuánta potencia da el equipo con cada modo de refrigeración.
---

# Sistema de refrigeración

La refrigeración fija **cuánta potencia** puede entregar el equipo sin exceder el calentamiento
admisible. La notación IEEE de 4 letras codifica el medio y la circulación, interna y externa. Cada
etapa de enfriamiento es una **etapa de potencia** — pero subir de etapa exige que el equipo se
haya **diseñado** para esa potencia (no se regala MVA).

## Cuándo se dispara

El usuario menciona refrigeración/enfriamiento, las siglas ONAN/ONAF/OFAF/ODAF, radiadores,
ventiladores, bombas, etapas, o pregunta la potencia por modo de refrigeración.

## Workflow (5 pasos)

1. **Decodifica la notación** de placa (4 letras `XX·YY`): medio/circulación interna y externa. → `references/01-teoria.md`.
2. **Lista las etapas** y su MVA (la placa da p.ej. `60/80/100 MVA` para `ONAN/ONAF/OFAF`).
3. **Calcula la I de línea por etapa** (`I_L = S_etapa/(√3·V_L)`) → cruza con `../calculos-nominales`.
4. **Aplica la regla**: la etapa superior solo entrega su MVA si el diseño lo soporta (EG cap. 6.2).
5. **Emite la ficha de refrigeración** (formato abajo), `⚠️ verificar` los % por unidad.

## Notación IEEE (detalle en `references/01-teoria.md` y `../_conocimiento/00-fundamentos-transformador.md §E`)

```
4 letras XX·YY:  XX = medio/circulación INTERNA (junto a devanados) · YY = EXTERNA (disipación)
   O=aceite · A=aire · W=agua    |   N=natural · F=forzada · D=dirigida (forzada y guiada)
ONAN = aceite natural / aire natural        ONAF = aceite natural / aire forzado (ventiladores)
OFAF = aceite forzado (bombas) / aire forzado   ODAF = aceite dirigido / aire forzado
```

## Neuronas (lee según necesites)

- `references/01-teoria.md` — notación 4 letras, modos, etapas, protecciones térmicas asociadas.
- `references/02-calculos.md` — MVA por etapa, I por etapa, gradientes, regla "etapa ≠ MVA libre".
- `references/03-criterios-evaluacion.md` — leer la placa de refrigeración, multi-norma.
- `references/04-diagnostico.md` — termografía, fallos de ventiladores/bombas, errores.

Marcos compartidos: `../_conocimiento/00-fundamentos-transformador.md §E`, `../_conocimiento/convenciones-calculo.md`,
`../_conocimiento/marco-normativo-tx.md`.

## Formato de salida (ficha de refrigeración)

```
NOTACIÓN: <p.ej. ONAN/ONAF/OFAF>  (interna: __ / externa: __)
ETAPAS Y POTENCIA: ONAN __ MVA · ONAF __ MVA · OFAF/ODAF __ MVA  (% ⚠️ verificar)
I DE LÍNEA POR ETAPA (a V_L=__): ONAN __ A · ONAF __ A · OFAF __ A
EQUIPOS: nº ventiladores __ · nº bombas __ · radiadores __
PROTECCIÓN TÉRMICA: termómetro carátula / imagen térmica / fibra óptica → alarma/disparo
REGLA: subir de etapa NO regala MVA (requiere diseño) — EG cap. 6.2
⚠️ VERIFICAR: <% exacto por etapa · nº de equipos · umbrales de temperatura MO.00418>
```

→ La S por etapa alimenta `../calculos-nominales` y la cargabilidad de `../gestion-vida-activo`. La
termografía y el monitoreo en línea cruzan con `../../pruebas-electricas/`.
