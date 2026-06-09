# 04 · Diagnóstico — qué implica el tipo (protección, ensayos, errores)

> Tipificar no es etiquetar: el tipo **cambia las protecciones de tierra, qué ensayos aplican y
> cómo se leen**. Aquí se cierra el arco `01→02→03→04`. Cruce con ensayos en
> `../../pruebas-electricas/`.

## A) Implicaciones de PROTECCIÓN (el tipo decide la coordinación de tierra)

| Tipo | Secuencia cero `Z0` | Falla monofásica a tierra | Protección habilitada |
|---|---|---|---|
| **Bidevanado Y-Y sin delta** | **alta** | corriente baja, neutro inestable | 50N/51N pueden **no arrancar**; vigilar desbalance |
| **Bi + estabilización (delta)** | **baja** | corriente **suficiente** | 50N/51N operativas; mejor desplazamiento de neutro |
| **Tridevanado** | por rama (Z1,Z2,Z3) | depende de la rama en falla | coordinar **por devanado** (3 zonas) |
| **Autotransformador** | acoplada AT-BT (cobre común) | la falla en un lado **se ve** en el otro | revisar terciario delta + protección diferencial de zona |

**Consecuencia operativa AFINIA:** en un Y-Y, antes de fijar ajustes 50N/51N hay que **saber si
lleva delta de estabilización**. Tratar un Y-Y con delta como si no lo tuviera → se **sobreestima
`Z0`**, se **subestima la corriente de falla a tierra** y las protecciones quedan **mal
coordinadas** (puede que ni arranquen o que descoordinen con aguas abajo).

## B) Qué ENSAYOS cambian con el tipo (puente a `../../pruebas-electricas/`)

| Ensayo | Bidevanado | Tridevanado | Estabilización (delta buried) |
|---|---|---|---|
| **Relación (TTR)** | 1 relación AT-BT | **3 relaciones** (AT-MT, AT-BT, MT-BT) | medir también AT-Δ si es accesible; si buried, no hay borne |
| **Impedancia/CC** | 1 `Z_HL` | **3 `Z` de par** → estrella equiv. (`02 §C`) | el delta baja `Z0`; medir secuencia cero |
| **Resistencia de devanados** | AT + BT | AT + MT + BT | + terciario si accesible |
| **Secuencia cero `Z0`** | confirma neutro | por devanado aterrizado | **clave**: `Z0` baja delata el delta (`03 §E`) |
| **Excitación / corriente sin carga** | patrón 2 altas+1 baja (3-limb Y) | leer por devanado energizado | delta cierra lazo → 2 iguales > 1 (`03 §E.2`) |

> Regla: la **ficha de tipificación** (`SKILL.md`) dicta el **alcance del plan de pruebas**. Mal
> tipificado → se piden los ensayos equivocados o se interpretan con el modelo equivocado.

## C) Errores típicos de clasificación (y cómo se manifiestan)

1. **Confundir delta de estabilización con tridevanado.** Se ve un 3.er símbolo en el grupo
   (`YNyn0d11`) y se asume carga en el terciario. → Síntoma: no aparece MVA ni bornes para ese
   devanado. **Fix:** `03 §C` (sin MVA/sin bornes = estabilización).
2. **Ignorar un delta buried no anotado en placa.** Placa antigua sin nota "stabilizing". →
   Síntoma: `Z0` medida **muy baja** para un Y-Y supuestamente sin delta. **Fix:** reclasificar a
   "bi + estabilización" **tras descartar núcleo de 5 columnas** (otra causa de `Z0` baja, `03
   §E.1`); confirmar con el patrón de excitación (`03 §E.2`). La **evidencia del ensayo gana** a la
   placa muda (`03 §D`), pero hay que leerla bien.
3. **Aplicar una sola `Z` a un tridevanado.** → Síntoma: el flujo de potencia / cortocircuito no
   cuadra entre devanados. **Fix:** medir las 3 `Z` de par y pasar a estrella equivalente (`02 §C`).
4. **Olvidar el factor √3 al validar la relación.** → Síntoma: la relación calculada no coincide
   con placa. **Fix:** revisar Y/Δ de cada lado del par (`02 §B`).
5. **Tratar un auto como bidevanado aislado.** → Síntoma: se ignora el acoplamiento galvánico
   AT-BT y el terciario delta. **Fix:** modelar serie+común y revisar el terciario (`01 §D`).
6. **Asumir base de MVA común en las `Z` de par.** Cada `Z` viene en la base de **su** par. →
   Síntoma: ramas de estrella absurdas. **Fix:** llevar todo a base común ANTES (`02 §C` regla 1).

## D) Señales de alarma que obligan a re-tipificar

- `Z0` medida ≪ `Z1` en un Y-Y "sin delta" → camino homopolar de baja reluctancia: delta oculto
  **o** núcleo de 5 columnas. Descartar el 5-limb antes de reclasificar (`03 §E.1`).
- Relación de placa que no reproduce con ningún factor √3 del grupo leído → grupo mal interpretado.
- Una rama de estrella equivalente **fuertemente** negativa y fuera de rango físico → revisar
  bases de MVA antes de culpar al modelo (la negativa leve es normal, `02 §C` regla 2).
- Tercer juego de bornes en campo que la placa no documenta → terciario accesible real.

## E) Cierre — de la tipificación a la acción

```
TIPO confirmado (SKILL.md)
   ├─ define nº de relaciones / impedancias a calcular ........ 02
   ├─ define el modelo de secuencia cero y la protección de tierra .. §A
   ├─ define el alcance del plan de ensayos .................... §B + ../../pruebas-electricas/
   └─ las divergencias multi-norma se consolidan al de mayor precedencia .. 03 §D
```

> Lo no confirmable contra placa/norma del director queda `⚠️ verificar` y se consolida para
> revisión (bases de MVA, rating del buried, tolerancias por edición, criterios MO.00418).
