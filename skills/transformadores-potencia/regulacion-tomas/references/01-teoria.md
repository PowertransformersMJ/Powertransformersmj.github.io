# 01 · Teoría — OLTC vs DETC, devanado regulado, modos de regulación

> Base: IEEE C57.131 (OLTC), C57.12.00 (tomas en placa), IEC 60214 / 60076-1. Backbone en
> `../../_conocimiento/00-fundamentos-transformador.md`.

## A) Para qué sirve la regulación por tomas

Ajusta el número de **espiras activas** de un devanado → cambia la **relación** → corrige la
tensión de salida ante variaciones de carga o de la red. Sin tomas, la tensión secundaria caería
con la carga (por la caída en %Z).

## B) OLTC vs DETC (la distinción crítica de seguridad)

| | **OLTC** (On-Load Tap Changer) | **DETC** (De-Energized Tap Changer) |
|---|---|---|
| Cambia | **bajo carga**, sin interrumpir | **solo desenergizado** |
| Accionamiento | motorizado / automático (regulador de tensión) | manual, con el equipo fuera de servicio |
| Transición | resistencias/reactancias para no interrumpir corriente | sin transición (no hay carga) |
| Uso | regulación continua diaria | ajuste estacional / de puesta en servicio |
| Riesgo | desgaste de contactos del ruptor (arco controlado) | ⚠️ **operarlo bajo carga = arco destructivo** |

> ⚠️ **Seguridad**: un DETC NUNCA se mueve con el transformador energizado. Confundir DETC con OLTC
> es un error de operación con consecuencias graves (`04 §B`).

## C) Dónde va el devanado regulado

- Normalmente las tomas están en el **devanado de AT** (menor corriente → contactos más pequeños y
  el ajuste de espiras es más fino por tener más vueltas).
- El devanado regulado tiene un **tramo de regulación** (bobina de tomas) en serie con el principal.

## D) Modos de regulación

| Modo | Cómo |
|---|---|
| **Lineal** | la bobina de tomas se suma en serie; rango limitado (la tensión sube monótona) |
| **Puente reversible (reversing)** | un conmutador invierte la bobina de tomas → duplica el rango (±) sin duplicar espiras |
| **Grueso-fino (coarse-fine)** | una bobina "gruesa" + una "fina" → muchos pasos con pocas tomas físicas |

> El modo afecta cómo se calcula la tensión por toma y si la **%Z** varía a lo largo del rango
> (`02 §C`): en regulación lineal la Z suele variar más en los extremos.

→ Cálculos de tensión/relación/Z por toma: `02-calculos.md`. Lectura de la tabla de tomas: `03-criterios-evaluacion.md`.
