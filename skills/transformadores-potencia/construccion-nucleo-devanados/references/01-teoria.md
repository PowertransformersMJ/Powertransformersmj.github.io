# 01 · Teoría — núcleo y devanados

> Base: ABB Service Handbook §1.5, IEEE/bibliografía (Harlow, Blume). Backbone en
> `../../_conocimiento/00-fundamentos-transformador.md §C`.

## A) Tipos de construcción del núcleo

- **Núcleo acorazado (shell form):** bobinas tipo "pancake" rectangulares; el núcleo rodea las
  bobinas como una coraza. Alta capacitancia bobina-bobina → distribución de impulso más uniforme.
  Robusto ante esfuerzos de cortocircuito (las fuerzas opuestas entre grupos de bobinas se cancelan
  parcialmente). Cabeza térmica ~12 °C.
- **Núcleo de columnas (core form):** bobinas cilíndricas concéntricas sobre columnas verticales; el
  devanado de menor tensión va adjunto al núcleo (potencial de tierra) y el de mayor tensión por
  fuera. Es la construcción **más común** en potencia.

## B) Número de columnas y su efecto en la secuencia cero

| Núcleo | Camino del flujo homopolar | Efecto en `Z0` |
|---|---|---|
| **3 columnas (3-limb)** | NO hay retorno magnético propio → el flujo de secuencia cero retorna por el **tanque/aceite** (alta reluctancia) | `Z0` **alta** |
| **5 columnas (5-limb)** | las **dos columnas laterales** dan retorno al flujo homopolar | `Z0` **baja**, parecida a la de un delta |

> ⚠️ Consecuencia diagnóstica: una `Z0` baja **no** implica por sí sola un delta de estabilización —
> puede ser un **núcleo de 5 columnas**. Cruzar con el patrón de excitación y el grupo
> (`../identificacion-tipo-transformador 03 §E.1/§E.2`). El 5-limb se usa **a propósito** cuando el
> diseño requiere `Z0 ≈ Z+`.

## C) Tipos de devanado

| Tipo | Características | Uso típico |
|---|---|---|
| **Capas (layer)** | espiras en capas cilíndricas; gradiente de impulso no uniforme | BT, distribución |
| **Disco continuo** | discos apilados conectados en serie; buena refrigeración | AT de potencia |
| **Disco entrelazado (interleaved)** | discos con conexiones cruzadas → alta capacitancia serie → **mejor** distribución de impulso | AT de alta tensión / BIL exigente |
| **Helicoidal** | una o varias hélices en paralelo; baja tensión por espira, alta corriente | BT de gran corriente |

> El **entrelazado** se usa para repartir mejor la onda de impulso en AT (sube la capacitancia
> serie → el gradiente inicial es menor → menos estrés en las primeras espiras).

## D) Por qué importa la construcción para el diagnóstico

- **Distribución de impulso**: la relación capacitancia-serie / capacitancia-a-tierra fija cómo se
  reparte una onda rápida (rayo, maniobra) → estrés dieléctrico en las primeras espiras (`04 §A`).
- **Fuerzas de cortocircuito**: ∝ I²; la geometría (concéntrica, altura, sujeción) decide la
  resistencia al telescopeo (axial) y pandeo (radial) → `02 §C`, `04 §B`.
- **Firma FRA/SFRA**: cada construcción tiene una firma de respuesta en frecuencia característica;
  una desviación delata deformación mecánica → `../../pruebas-electricas/sfra`.

→ Cálculos (V/espira, fuerzas): `02-calculos.md`. Identificar la construcción: `03-criterios-evaluacion.md`.
