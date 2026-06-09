# 04 · Diagnóstico — placa incompleta, identidad por informe, errores

> Auditar la placa es el paso 0: si la base de verdad está mal leída, todo lo demás hereda el error.
> Cierra el arco `01→02→03→04`. Cruce con la batería de pruebas en `../../pruebas-electricas/`.

## A) Placa incompleta o contradictoria (cómo se trata)

| Situación | Tratamiento |
|---|---|
| Campo **ilegible** (desgaste) | `⚠️ verificar`; pedir foto alta resolución / reporte de fábrica. NO inventar. |
| Campo **ausente** obligatorio | hallazgo; usar el piso normativo más conservador mientras tanto. |
| Cruce que **no cierra** (I≠S/√3V) | documentar la incoherencia; priorizar el dato más confiable (S y V sobre I derivada). |
| Grupo sin diagrama fasorial | reconstruir el índice por fasores (`../grupo-vectorial-conexiones 02 §C`) y marcar `⚠️ verificar`. |

## B) Identidad por INFORME (equipos móviles / multiconfiguración)

Un transformador **móvil** puede operar en **dos configuraciones** (p.ej. 63.5 kV / 110 kV según el
sitio). Su "placa efectiva" **cambia entre comisiones**:

- **Congelar la identidad por informe**: cada ensayo se evalúa contra la clase/tensión del **propio
  ensayo**, no contra una placa global. Dos informes del mismo equipo pueden tener clases distintas
  y **no deben colapsarse**.
- Esto alinea con el tablero de pruebas (criterio de aislamiento por la clase del propio ensayo).
  → cruce con `../../pruebas-electricas/` (identidad/placa por informe).

> Tratar una placa multiconfiguración como una sola congela mal el criterio NETA por clase → falso
> aprobado/reprobado. La placa efectiva es **por comisión**.

## C) Errores típicos (y cómo se manifiestan)

1. **Rellenar un campo ausente con un supuesto** → criterio basado en dato inventado. **Fix:**
   `⚠️ verificar`, nunca fabricar (`03 §A`).
2. **Tomar la I de placa sin recalcular** → no se detecta una placa mal transcrita. **Fix:** cruzar
   `I = S/(√3·V)` (`02 §A`).
3. **Ignorar la base del %Z** → impedancia mal combinada aguas abajo. **Fix:** exigir base explícita (`02 §E`).
4. **Colapsar dos configuraciones de un móvil** → criterio por clase equivocado. **Fix:** identidad
   por informe (§B).
5. **Usar la norma pública vigente cuando la placa cita una antigua** → tolerancias equivocadas.
   **Fix:** usar la edición de la **norma de diseño** de la placa (`01 §D`).

## D) Señales de alarma

- La I de placa no reproduce con `S/(√3·V)` → placa mal transcrita o conexión mal leída.
- Relación de placa incompatible con el grupo declarado → grupo o tensiones erróneos.
- Mismo equipo con dos clases de tensión en informes distintos → es móvil; **no** unificar.
- Masa de aceite incompatible con el tamaño → posible error de placa o de unidad confundida.

## E) Cierre — de la placa a la acción

```
PLACA auditada (campos completos y coherentes)
   ├─ habilita tipificación ............... ../identificacion-tipo-transformador
   ├─ habilita cálculos nominales ......... ../calculos-nominales
   ├─ habilita impedancia/paralelo ........ ../impedancia-cortocircuito
   └─ identidad por informe (móvil) ....... §B + ../../pruebas-electricas/
```

> Todo campo ilegible/ausente/contradictorio queda `⚠️ verificar` y se consolida para el director;
> jamás se completa con un valor supuesto.
