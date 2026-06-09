# 03 · Criterios de evaluación — tolerancias, bases y multi-norma

> Norma: IEEE C57.12.00 (tolerancias de impedancia), C57.12.90 (ensayo/base), IEC 60076-1/-8.
> Filosofía multi-norma en `../../_conocimiento/marco-normativo-tx.md`. **Nunca inventar** una base
> de MVA o una tolerancia → `⚠️ verificar`.

## A) La base de MVA de cada Z (el dato que más se olvida)

- Cada impedancia de par viene en la **base de MVA de su par**, típicamente el **MVA del devanado
  menor** del par (`⚠️ verificar` en placa/reporte de fábrica).
- En un tridevanado con devanados de distinta potencia, `Z_HM`, `Z_HL`, `Z_ML` pueden estar en
  **bases distintas** → llevarlas a base común ANTES de la estrella equivalente (`02 §A`). Saltarse
  esto es el error #1 (`04 §D`).

## B) Tolerancias de impedancia (público, ⚠️ verificar edición)

| Caso | Tolerancia citada | Fuente | Marca |
|---|---|---|---|
| Impedancia, **2 devanados** | ±7.5 % del valor declarado | IEEE C57.12.00 | ⚠️ verificar edición |
| Impedancia, **3+ devanados / auto** | ±10 % | IEEE C57.12.00 | ⚠️ verificar |

> Tolerancia sobre el **valor declarado en placa**, no un absoluto. La Z **medida** (ensayo) se
> compara contra placa ± tolerancia en `../../pruebas-electricas/` (impedancia/reactancia de dispersión).

## C) Coherencia del modelo (sanity checks)

- Reconstruir las Z de par desde las ramas (`Z_HM=Z1+Z2`, etc.) debe devolver las de entrada.
- Una rama **levemente negativa** es normal; una **fuertemente** negativa → bases mal aplicadas (§A).
- `I_cc` resultante debe ser físicamente razonable (kA del orden de `I_nom/Z_pu`).

## D) Evaluación MULTI-NORMA (registrar divergencias)

```
vs PLACA / reporte de fábrica (precedencia 1)  → Z y su base = ___
vs interno MO.00418 (precedencia 2)            → ___        ⚠️ verificar con el director
vs IEEE C57.12.00 / IEC 60076-1 (tolerancias)  → ±7.5 / ±10 %
CONSOLIDADO = mayor precedencia disponible; mostrar divergencias.
```

## E) Valores `⚠️ verificar` (consolidar para el director)

- **Base de MVA exacta de cada Z de par** — reporte de fábrica / C57.12.90.
- Tolerancia ±7.5 % (2 dev) / ±10 % (3+/auto) — confirmar edición C57.12.00.
- Impedancia del **sistema** (Thévenin) para cortocircuito no-infinito — datos de red AFINIA.
- Temperatura de referencia de la Z (75/85 °C) — norma/placa.

→ Qué implica la impedancia (paralelo, esfuerzos, errores): `04-diagnostico.md`.
