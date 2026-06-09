# 01 · Teoría — qué es la placa y qué norma la rige

> Base: IEEE C57.12.00 §ratings/marking, IEC 60076-1 §nameplate. La placa es **precedencia 1** en
> `../../_conocimiento/marco-normativo-tx.md §D`.

## A) Qué es y para qué sirve

La placa de características (nameplate) es la declaración del fabricante de las condiciones
nominales y constructivas del equipo, fijada al tanque de forma permanente. Es la **fuente de
verdad** para tipificar, calcular y evaluar: cuando la norma genérica y la placa difieren, **gana
la placa** (es el equipo real, no un promedio).

## B) Bloques de información (qué responde cada uno)

| Bloque | Responde | Skill que lo consume |
|---|---|---|
| **Identificación** | quién/cuándo/bajo qué norma | trazabilidad, garantía |
| **Potencia + enfriamiento** | cuánta carga y con qué refrigeración | `../calculos-nominales`, `../sistema-refrigeracion` |
| **Tensiones + tomas** | niveles y rango de regulación | `../regulacion-tomas`, `../grupo-vectorial-conexiones` |
| **Corriente** | I nominal (derivable) | `../calculos-nominales` |
| **Impedancia (%Z)** | cortocircuito, paralelo, caída | `../impedancia-cortocircuito` |
| **Grupo vectorial** | conexión y desfase | `../grupo-vectorial-conexiones` |
| **Térmico/masas/aceite** | clase, rise, refrigerante, peso | `../gestion-vida-activo`, logística |
| **Aislamiento (BIL)** | nivel de impulso soportado | dieléctricos, `../bujes-y-accesorios` |

## C) Por qué auditarla (no solo leerla)

Una placa puede estar **incompleta** (campos borrados por intemperie), **contradictoria** (la I no
cuadra con S/V), o **ambigua** (equipo móvil con dos configuraciones). Auditar = verificar que los
campos **cierran entre sí** (`02`) y son suficientes para operar. Los hallazgos son señales de
diagnóstico, no detalles cosméticos (`04`).

## D) Norma de diseño vs norma de evaluación

- La placa cita la **norma de diseño** (la vigente cuando se fabricó). Una placa de 1985 puede
  responder a una edición antigua de C57.12.00 → las tolerancias de **esa** edición aplican.
- La evaluación multi-norma (`03 §C`) considera la norma de diseño + la interna MO.00418 + la
  pública vigente, consolidando en la de mayor precedencia.

→ Cómo se cruzan los campos (coherencia): `02-calculos.md`. Lista obligatoria y auditoría: `03-criterios-evaluacion.md`.
