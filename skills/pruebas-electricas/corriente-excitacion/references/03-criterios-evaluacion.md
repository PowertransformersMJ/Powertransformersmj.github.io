# 03 · Criterios de evaluación — umbrales con cita normativa

> Jerarquía de criterio (de mayor a menor precedencia): **(1) dato de fábrica/commissioning →
> (2) ensayos previos / tendencia → (3) NETA patrón 2+1 / IEEE C57.152**. A diferencia de TTR o
> IR, aquí **NO hay un porcentaje fijo normado**: el criterio es **comparativo** (patrón + baseline).
>
> 🔱 **Evaluación MULTI-NORMA (obligatoria)**: NO basta una norma. Calcula el veredicto
> contra CADA óptica aplicable y emite el formato multi-norma de
> `../../_conocimiento/marco-normativo-multinorma.md` (§4): per-norma + consolidado (el más
> conservador) + dónde divergen.

---

## A) Patrón de fases — criterio cualitativo NETA §7.2.2.D.6 ⭐

> NETA §7.2.2.D.6: el patrón esperado en núcleo de **3 columnas** es **2 lecturas similares +
> 1 menor** (la fase central, por su camino magnético más corto).

| Observación | Veredicto |
|---|---|
| 2 externas similares (~≤5%) + central menor | **APRUEBA** (patrón coherente) |
| Externas ya no se parecen / central no es la menor | **INVESTIGAR / RECHAZA** (patrón roto) |

> ⚠️ **No existe un umbral % duro universal** en NETA/IEEE para la excitación (a diferencia del
> 0.5% de TTR). El "~5%" entre externas y el "~30%" que la central puede diferir son **referencias
> de práctica de industria (Doble/Megger)**, NO límites normativos absolutos. Tratar como guía;
> verificar contra el patrón del propio diseño y la plantilla del fabricante. Marcar
> "⚠️ verificar contra la edición de norma del director / dato de fábrica" cualquier % project-specific.

## B) Comparación vs fábrica / previos — el criterio real (IEEE C57.152)

IEEE C57.152 enfatiza la **comparación contra fábrica, ensayos previos y fases hermanas** por
encima de cualquier número absoluto:
- **vs fábrica/commissioning** (a tensión y conexión equivalentes): la base más fuerte.
- **vs ensayos previos (tendencia)**: un cambio del orden de **decenas de %** vs baseline es
  señal de alarma aunque el patrón aún parezca correcto.
- **entre fases hermanas**: las externas deben mantener su simetría.

## C) Criterio por CLASE / interno (MO.00418)

⚠️ **Verificar** si la norma interna MO.00418.DE-GAC-AX.01 Ed. 02 fija un % de cambio admisible
por clase. Si no lo fija, prevalece el criterio comparativo de NETA/IEEE. Marcar "⚠️ verificar".

---

## Árbol de veredicto (resumen ejecutable · multi-norma)

```
Evalúa TODAS las ópticas (a IGUAL tensión/conexión de prueba):
  Patrón 2+1 (núcleo 3 columnas)                 → [✔/✘ roto]   (NETA §7.2.2.D.6)
  vs fábrica/commissioning (si existe)           → [✔/✘/—]      (precedencia 1)
  vs ensayos previos (tendencia)                 → [estable / Δ decenas %]  (precedencia 2)
  entre fases hermanas (externas similares)      → [✔/✘]
  vs criterio por CLASE (MO.00418, si hay)       → [✔/✘ ⚠️verificar]
VEREDICTO CONSOLIDADO = el PEOR de todas las ópticas, citando el criterio que lo determina.
  ⊳ Reportar SIEMPRE las divergencias (ej. patrón ok pero ↑ vs previos → vigilar).
```

> 🔁 **Regla de convergencia clave**: una excitación anómala SOLA = INVESTIGAR; se vuelve
> diagnóstico de **espira en corto** solo si converge con TTR desviada y/o R devanados anómala.

→ Formato de salida completo en `../../_conocimiento/marco-normativo-multinorma.md §4`.
→ Si el veredicto no es APRUEBA, cruza con `../../_conocimiento/diagnostico-integrado-bateria.md`
  (convergencia con TTR + R devanados + SFRA + DGA) antes de nombrar la causa.
