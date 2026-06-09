# 03 · Criterios de evaluación — campos obligatorios y auditoría multi-norma

> Norma: IEEE C57.12.00 (marking), IEC 60076-1 (nameplate). Filosofía multi-norma en
> `../../_conocimiento/marco-normativo-tx.md`. **Nunca rellenar** un campo ausente con un supuesto →
> marcarlo `⚠️ verificar` / "placa muda".

## A) Campos obligatorios (checklist de auditoría)

| Bloque | Campo | ¿Obligatorio? |
|---|---|---|
| Identificación | fabricante, nº serie, año, norma de diseño | sí |
| Potencia | S por etapa + tipo de enfriamiento | sí |
| Tensión | V de línea por devanado | sí |
| Tomas | rango de tomas / tabla de tensiones por toma | sí (si tiene tomas) |
| Corriente | I nominal por devanado | sí (derivable) |
| Impedancia | %Z + su base (por par en tridevanado) | sí |
| Conexión | grupo vectorial + diagrama fasorial | sí |
| Térmico | clase de aislamiento, rise °C | sí |
| Masas | aceite, total | sí |
| Aislamiento | BIL / nivel de impulso por devanado | sí |
| Ambiente | frecuencia, nº de fases, altitud | sí |

> Faltar un campo **obligatorio** = hallazgo. Un campo **ilegible** (placa desgastada) = `⚠️ verificar`,
> NO se inventa el valor.

## B) Auditoría de coherencia (cruces, ver `02`)

1. `I` reproduce con `S/(√3·V)` por devanado.
2. relación de línea reproduce con el factor √3 del grupo.
3. etapas de enfriamiento crecientes y nombradas.
4. masas internamente consistentes.
5. base de %Z explícita (y por par en tridevanado).

## C) Evaluación MULTI-NORMA

```
vs PLACA misma (precedencia 1)               → es la referencia
vs interno MO.00418 (precedencia 2)          → ___      ⚠️ verificar (clase de tensión, criterios)
vs IEEE C57.12.00 / IEC 60076-1              → campos y formato exigidos
CONSOLIDADO = la placa manda; los faltantes se piden al fabricante / se marcan.
```

## D) Valores `⚠️ verificar` (consolidar para el director)

- Campos **ilegibles** de placas reales (foto en alta resolución).
- Edición de la **norma de diseño** citada (para fijar tolerancias correctas).
- Criterios internos **MO.00418** por clase de tensión.
- Base de MVA de cada %Z de par (reporte de fábrica).

→ Qué hacer con una placa incompleta/contradictoria (diagnóstico): `04-diagnostico.md`.
