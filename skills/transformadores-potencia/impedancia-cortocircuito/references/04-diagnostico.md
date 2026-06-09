# 04 · Diagnóstico — paralelo, esfuerzos de cortocircuito, errores

> La impedancia decide el reparto de carga, la severidad del cortocircuito y la coordinación de
> protecciones. Cierra el arco `01→02→03→04`. Cruce con ensayos en `../../pruebas-electricas/`.

## A) Operación en paralelo (cruce con `../grupo-vectorial-conexiones 04 §A`)

Para paralelo se exige, además de mismo grupo/relación/polaridad, **%Z igual dentro de tolerancia**:

- El reparto va **inverso a Z%** (`02 §E`). Dos unidades de igual MVA pero distinta Z **no**
  comparten carga a partes iguales → la de menor Z se **sobrecarga primero**.
- Diferencia grande de Z → una unidad llega a su límite térmico mientras la otra va holgada →
  desperdicio de capacidad y envejecimiento desigual (`../gestion-vida-activo`).

## B) Esfuerzos de cortocircuito

- Las fuerzas electromagnéticas en los devanados son **∝ I²** → menor `%Z` = mayor `I_cc` = mayores
  fuerzas (telescopeo, pandeo, desplazamiento axial) → `../construccion-nucleo-devanados`.
- Un cambio en la `%Z` medida respecto a la de fábrica puede delatar **deformación de devanados**
  tras un cortocircuito pasante → se confirma con FRA/SFRA (`../../pruebas-electricas/sfra`).

## C) Errores típicos (y cómo se manifiestan)

1. **Combinar Z en bases de MVA distintas** sin convertir → estrella equivalente absurda. Síntoma:
   rama fuertemente negativa o I_cc irreal. **Fix:** base común primero (`02 §A`, `03 §A`).
2. **Asumir base común cuando no la hay** en tridevanado → mismo síntoma. **Fix:** leer la base de
   cada Z en el reporte de fábrica.
3. **Alarmarse por una rama negativa leve** → es normal (`02 §B`). **Fix:** solo investigar las
   fuertemente negativas / fuera de rango.
4. **Usar una sola Z para un tridevanado** → flujo de potencia / cortocircuito mal repartido.
   **Fix:** las 3 Z de par → estrella equivalente (`02 §B`).
5. **Ignorar la impedancia del sistema** en el cortocircuito → I_cc sobreestimada. **Fix:** sumar
   Thévenin de red en serie (`02 §C`).
6. **Confundir Z+ con Z0** → corriente de falla a tierra mal calculada. **Fix:** `02 §D`, modelo de
   secuencia; recordar que delta/5-limb bajan Z0.

## D) Señales de alarma

- Rama de estrella equivalente fuertemente negativa y fuera de rango → bases mal aplicadas.
- `%Z` medida fuera de ±7.5 / ±10 % de placa → posible deformación de devanado (confirmar con SFRA).
- `Z0` mucho más baja de lo esperado en un Y-Y "sin delta" → delta oculto o 5-limb
  (`../identificacion-tipo-transformador 03 §E`).
- I_cc calculada físicamente imposible → revisar bases, Z_pu y la impedancia de fuente.

## E) Cierre — de la impedancia a la acción

```
IMPEDANCIA confirmada (a base común)
   ├─ reparto de carga / aptitud de PARALELO ............... §A + ../grupo-vectorial-conexiones
   ├─ corriente de cortocircuito → ajuste de protecciones .. 02 §C
   ├─ secuencia cero → falla a tierra y 50N/51N ........... 02 §D + ../identificacion-tipo-transformador
   └─ desviación vs fábrica → deformación de devanados .... §B + ../../pruebas-electricas/sfra
```

> Lo no confirmable (base de MVA por par, tolerancia por edición, impedancia de red) queda
> `⚠️ verificar` y se consolida para el director.
