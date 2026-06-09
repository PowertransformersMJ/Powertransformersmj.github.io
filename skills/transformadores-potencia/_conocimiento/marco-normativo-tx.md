# Marco normativo — Transformadores de potencia (catálogo compartido)

> Catálogo de normas que gobiernan el EQUIPO (no los ensayos — esos están en
> `pruebas-electricas/_conocimiento/marco-normativo-multinorma.md`). Las skills citan de aquí.
> Filosofía multi-norma idéntica: evaluar desde varias ópticas, consolidar en la más
> conservadora, mostrar divergencias. **Nunca inventar números** → `⚠️ verificar`.

## A) ANSI/IEEE (C57 series) — práctica norteamericana (aplica a AFINIA)

| Norma | Gobierna |
|---|---|
| **IEEE C57.12.00** | Requisitos generales de transformadores inmersos en líquido: ratings, tolerancias (relación, impedancia), placa, conexiones. ⚠️ verificar edición (2015/2021). |
| **IEEE C57.12.90** | **Métodos de ensayo** (relación, impedancia/cortocircuito, pérdidas, excitación) — define cómo se reporta la placa. |
| **IEEE C57.12.70** | Designación de **terminales** y marcado (H/X/Y, polaridad, desfase ANSI). |
| **IEEE C57.158** | **Devanados terciarios y de estabilización** (delta de estabilización: función, rating aparente, buried delta). Clave para distinguir terciario de carga vs estabilización. |
| **IEEE C57.105** | Guía de aplicación de conexiones trifásicas (Y/Δ, secuencia cero). |
| **IEEE C57.91** | Guía de carga (loading) — capacidad por etapa de enfriamiento, envejecimiento. |

## B) IEC (60076 series) — práctica internacional

| Norma | Gobierna |
|---|---|
| **IEC 60076-1** | General: ratings, grupo de conexión (notación Dyn11/YNd1…), placa, tolerancias. |
| **IEC 60076-2** | Calentamiento y **códigos de refrigeración** (ONAN/ONAF/OFAF/ODAF). |
| **IEC 60076-8** | **Guía de aplicación**: relación, impedancias, tridevanado, secuencia cero, paralelo. |
| **IEC 60076-3** | Niveles de aislamiento, ensayos dieléctricos (withstand/impulso). |

## C) Interno AFINIA

- **MO.00418.DE-GAC-AX.01 Ed. 02** — criterios propios (clases de tensión, aceptación). El
  director confirma los valores; mientras tanto se usa el piso normativo público.

## D) Precedencia de criterio (igual que en `pruebas-electricas`)

```
1. Dato de fábrica / placa de la propia unidad   (la verdad del equipo)
2. Interno MO.00418 (criterio AFINIA)
3. IEEE C57.* / IEC 60076.* (norma pública aplicable)
4. Bibliografía / práctica de industria (apoyo, NO criterio duro)
```

VEREDICTO/PARÁMETRO consolidado = el de mayor precedencia disponible; si dos ópticas
divergen, **mostrar ambas** y señalar la divergencia (no ocultarla).

## E) Tolerancias clave (⚠️ verificar contra edición del director)

| Magnitud | Valor citado (público) | Fuente | Marca |
|---|---|---|---|
| Relación de transformación | ±0.5 % del nominal | IEEE C57.12.00 | ⚠️ verificar edición |
| Impedancia, **2 devanados** | ±7.5 % | IEEE C57.12.00 | ⚠️ verificar |
| Impedancia, **3+ devanados / auto** | ±10 % | IEEE C57.12.00 | ⚠️ verificar |
| Base de MVA de cada Z de par | MVA del devanado menor del par (típico) | IEEE C57.12.90 | ⚠️ verificar en placa/reporte |

> Estos valores alimentan los criterios de las skills `calculos-nominales`,
> `impedancia-cortocircuito` y la prueba de relación en `pruebas-electricas/relacion-transformacion`.

## F) Bibliografía de apoyo (precedencia 4 — NO criterio duro, sí construcción/diagnóstico)

| Fuente | Aporta | Dónde se usó |
|---|---|---|
| **ABB Transformer Service Handbook** (V4 rev3) | construcción (§1), modelo de **6 capacitancias** y **patrón de excitación** para discriminar núcleo/conexión (§3), 5-limb↔`Z0` | `01 §B`, `03 §E.1/§E.2`, `00-fundamentos §C` |
| **EG — Gallo, "Diagnóstico y Mantenimiento a Transformadores en Campo" 3ª ed. 2021** | refrigeración + protecciones (cap. 6); papel/cargabilidad/vida (caps 2/5) | `00-fundamentos §E`; pendiente `gestion-vida-activo` |

> ⚠️ Estas son fuentes de **apoyo**: cuando un número de aquí choca con norma pública (A/B) o
> placa, **gana la de mayor precedencia** (§D). No se citan como criterio normativo duro.
