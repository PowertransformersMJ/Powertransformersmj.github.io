---
name: placa-caracteristica
description: Lee, interpreta y AUDITA la placa de características (nameplate) de un transformador de potencia — qué campos son obligatorios, qué norma los rige (IEEE C57.12.00 / IEC 60076-1), cómo se cruzan entre sí (S, V, I, %Z, grupo, etapas de enfriamiento, tomas, masas, aceite) y cómo detectar una placa incompleta o contradictoria. Úsala SIEMPRE que el usuario comparta o pregunte por una placa, nameplate, datos de placa, campos de la placa, o quiera validar/auditar lo que dice la placa de un equipo.
---

# Placa de características (nameplate)

La placa es la **fuente de verdad de precedencia 1** del equipo (`marco-normativo-tx.md §D`): todo
cálculo y criterio se ancla en ella. Auditarla = verificar que sus campos son **completos,
coherentes entre sí** y suficientes para tipificar y calcular. Una placa muda o contradictoria es
una señal de diagnóstico, no un detalle.

## Cuándo se dispara

El usuario comparte una placa o sus datos, pregunta qué significa un campo, o quiere auditar/validar
la placa de un equipo antes de cargarlo al tablero o de calcular sobre él.

## Workflow (6 pasos)

1. **Inventaría los campos presentes** vs los obligatorios (§lista en `references/03-criterios-evaluacion.md`).
2. **Cruza la coherencia interna**: `S = √3·V·I` por devanado; relación vs grupo (√3); etapas de
   enfriamiento; suma de masas. → `references/02-calculos.md`.
3. **Tipifica** con los campos (nº MVA, bornes, grupo) → `../identificacion-tipo-transformador`.
4. **Marca lo ausente/contradictorio** como hallazgo (`⚠️ verificar` o "placa muda").
5. **Congela la identidad por informe** si el equipo es móvil/multiconfiguración (un ensayo = una placa efectiva).
6. **Emite la ficha de placa** (formato abajo).

## Campos obligatorios (resumen — detalle en `03-criterios-evaluacion.md`)

```
Identificación: fabricante, nº de serie, año, norma de diseño
Potencia: S por etapa de enfriamiento (MVA) + tipo de enfriamiento (ONAN/ONAF/…)
Tensión: V de línea por devanado + rango de tomas (taps)
Corriente: I nominal por devanado (derivable de S y V)
Impedancia: %Z (con su base) — por par en tridevanado
Conexión: grupo vectorial (Dyn11…) + diagrama fasorial
Térmico: clase de aislamiento, rise (°C), masa de aceite, masa total, tipo de refrigerante
Otros: nivel de aislamiento (BIL), frecuencia, altitud, nº de fases
```

## Neuronas (lee según necesites)

- `references/01-teoria.md` — qué es la placa, qué norma la rige, para qué sirve cada bloque.
- `references/02-calculos.md` — cruces de coherencia que la placa debe cumplir.
- `references/03-criterios-evaluacion.md` — lista de campos obligatorios, multi-norma, auditoría.
- `references/04-diagnostico.md` — placa incompleta/contradictoria, identidad por informe, errores.

Marcos compartidos: `../_conocimiento/marco-normativo-tx.md`, `../_conocimiento/convenciones-calculo.md`,
`../_conocimiento/00-fundamentos-transformador.md`.

## Formato de salida (ficha de placa)

```
EQUIPO: fabricante ___ · serie ___ · año ___ · norma de diseño ___
POTENCIA/ENFRIAMIENTO: ___ MVA (ONAN/ONAF/OFAF/ODAF: ___)
TENSIONES: AT ___ kV · MT ___ · BT ___ · tomas ___ (rango ±__%)
CORRIENTES: AT ___ A · MT ___ · BT ___   (¿coherentes con S/(√3·V)?: sí/no)
IMPEDANCIA: %Z ___ (base ___) [tridev: Z_HM/Z_HL/Z_ML]
GRUPO: ___ → desfase ___ · √3 en relación: ___
TÉRMICO: clase ___ · rise ___°C · aceite ___ kg · masa total ___ kg
HALLAZGOS DE AUDITORÍA: <campos ausentes / incoherencias / placa muda>
⚠️ VERIFICAR: <lo no confirmable o ilegible en la placa>
```

→ La tipificación y los cálculos consumen esta ficha. Si el equipo es móvil con doble
configuración, la identidad se **congela por informe** (`04 §B`, cruza con la batería de pruebas).
