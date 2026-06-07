# 01 · Teoría — Reactancia de dispersión / impedancia de cortocircuito

## Qué mide

La prueba energiza un devanado (p.ej. AT) con el devanado opuesto (BT) en
**cortocircuito** y mide la **impedancia equivalente** que ve la fuente. Con el
secundario en corto, el flujo mutuo casi se cancela y lo que domina es el **flujo
de dispersión** (leakage flux): las líneas de campo que NO enlazan ambos devanados y
se cierran por el espacio entre bobinas, el aceite y las estructuras. Por eso la
impedancia medida es esencialmente **reactiva** (`Z ≈ R + jX`, con X >> R) y se
llama *reactancia de dispersión*.

```
Z_cc = V_aplicada / I_cortocircuito   (devanado opuesto en corto)
      → predomina X (reactancia de dispersión)   → %Z = (Z_cc / Z_base) × 100
```

## Por qué la reactancia depende de la GEOMETRÍA (clave del diagnóstico)

El camino del flujo de dispersión está fijado por la **geometría física** del conjunto:
separación radial entre AT y BT, altura efectiva de los devanados, concentricidad y
posición axial. La reactancia de dispersión es proporcional a esa geometría:

```
X_dispersión ∝ (N² · área del canal de dispersión) / (altura efectiva del devanado)
```

Si la geometría no cambia, la reactancia es **estable y repetible** (de ahí que el
%Z de placa sea una huella confiable). Si un devanado se **desplaza axialmente**, se
**pandea radialmente** o pierde su sujeción mecánica, el canal de dispersión cambia y
la reactancia medida **se desvía de la placa** — antes de que el aislamiento falle.

## Qué fallas detecta (integridad mecánica)

| Mecanismo | Efecto en la reactancia |
|---|---|
| **Deformación radial** (pandeo hacia adentro/afuera) | cambia el área del canal de dispersión → %Z ↑ o ↓ |
| **Desplazamiento axial** (devanado corrido en altura) | cambia la altura efectiva → %Z ↑ |
| **Espiras en cortocircuito** | reducen N efectivo → %Z cae apreciablemente en esa fase |
| **Colapso de sujeción / aflojamiento** | desviación entre fases, a veces solo en una |

La causa típica: un **cortocircuito pasante** (falla externa) somete los devanados a
fuerzas electrodinámicas enormes (∝ I²) que los empujan radial y axialmente. La
reactancia de dispersión es el indicador eléctrico **directo** de ese daño mecánico.

## Relación con SFRA (complementarias, no redundantes)

Reactancia de dispersión y **SFRA** miran lo mismo (integridad mecánica) desde
ángulos distintos: la reactancia da **un número** comparable a placa (cuantitativo,
banda baja de frecuencia); SFRA da una **huella en frecuencia** (cualitativa,
amplio espectro). Una deformación real suele aparecer en **ambas** → su convergencia
es lo que confirma el diagnóstico (ver `04-diagnostico.md`).

> Continúa en `02-calculos.md` (fórmulas + base) y `03-criterios-evaluacion.md` (umbrales).
