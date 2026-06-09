# 02 · Cálculos — qué fórmulas cambian con el tipo

> Convenciones base (fase vs línea, pu, base común) en
> `../../_conocimiento/convenciones-calculo.md`. Aquí solo lo que **depende del tipo**.

## A) Corriente nominal por devanado (todos los tipos)

```
I_L = S_3φ / (√3 · V_L)
```

- **Tridevanado:** cada devanado tiene su **propia** `S` y `V_L` → **tres** corrientes
  nominales distintas. Usar el MVA del devanado correcto y la **misma etapa de enfriamiento**.
- **Bidevanado / estabilización:** una `I` por lado de carga (el terciario de estabilización no
  lleva corriente de carga, solo la de armónicos/desbalance).

## B) Relación de transformación — factor √3 según conexión

Relación de espiras `a = N1/N2` (fase). La de **línea** depende del par de conexiones:

| Par AT–BT | V_L,AT / V_L,BT |
|---|---|
| Yy / Dd | `a` |
| Dy | `a / √3` |
| Yd | `a · √3` |

- **Bidevanado:** **una** relación.
- **Tridevanado:** **tres** relaciones, una por par (AT-MT, AT-BT, MT-BT), cada una con su √3
  según las conexiones de ESE par. P.ej. en `YNyn0d11` el par AT-BT es Y-Y (sin √3) y el par
  AT-terciario es Y-Δ (con √3).

> La relación calculada debe **coincidir con la de placa**; si no coincide, el grupo de conexión
> se interpretó mal (revisar Y/Δ de cada lado). Esto es lo que valida la prueba TTR
> (`../../pruebas-electricas/relacion-transformacion`, tolerancia ±0.5 % ⚠️ verificar).

## C) Impedancia — UNA (bidevanado) vs TRES → estrella equivalente (tridevanado)

**Bidevanado:** una sola `Z_HL` (%, sobre su base de MVA y V_L). Modelo serie único.

**Tridevanado:** se miden **tres** impedancias de par por ensayo de cortocircuito (dos
devanados en corto, el tercero abierto) — IEEE C57.12.90:

- `Z_HM` = AT-MT en corto, BT abierto
- `Z_HL` = AT-BT en corto, MT abierto
- `Z_ML` = MT-BT en corto, AT abierto

Conversión al **modelo estrella equivalente de 3 ramas** (Z1=AT, Z2=MT, Z3=BT), todas referidas
a una **base de potencia común** (`../../_conocimiento/convenciones-calculo.md §C`):

```
Z1 = ½ · (Z_HM + Z_HL − Z_ML)      (rama AT)
Z2 = ½ · (Z_HM + Z_ML − Z_HL)      (rama MT)
Z3 = ½ · (Z_HL + Z_ML − Z_HM)      (rama BT)
```

**Reglas obligatorias:**

1. **Base común primero.** Cada `Z` de placa está referida a la base de MVA de **su par** (a
   menudo el MVA del devanado menor del par — ⚠️ verificar en el reporte). Llevar las tres a una
   misma `S_base` con la fórmula de conversión pu **antes** de aplicar las de estrella.
2. **Una rama puede salir NEGATIVA** (típicamente la del devanado intermedio/MT o el terciario).
   **No es error**: es consecuencia geométrica del modelo de 3 ramas; se usa tal cual.
3. **Tolerancia:** ±10 % para 3+ devanados/auto vs ±7.5 % para 2 devanados (IEEE C57.12.00,
   ⚠️ verificar edición).

**Ejemplo numérico** (ilustrativo, base común ya aplicada):
`Z_HM=10 %`, `Z_HL=16 %`, `Z_ML=6 %` →
`Z1 = ½(10+16−6)=10 %` · `Z2 = ½(10+6−16)=0 %` · `Z3 = ½(16+6−10)=6 %`.
(Si los datos dieran `Z2<0`, se reporta negativa sin "corregirla".)

## D) Secuencia cero — efecto del delta de estabilización / terciario

- **Y-Y sin delta:** `Z0` **alta** (sin camino de retorno para flujo de secuencia cero, salvo
  por tanque/núcleo en core-type) → poca corriente de falla a tierra, neutro inestable.
- **Con delta (estabilización o terciario):** el delta es un lazo cerrado para secuencia cero →
  **`Z0` baja** → **sube la corriente de falla monofásica a tierra** (habilita 50N/51N) y
  **baja el desbalance de tensión**. En el circuito de secuencia cero, el delta entra como rama
  en corto a tierra; **ignorarlo sobreestima `Z0` y subestima la falla a tierra**.
- **Implicación AFINIA:** para estudios de cortocircuito y coordinación de protecciones es
  **obligatorio** saber si el Y-Y lleva delta de estabilización. Valores de `Z0` caso a caso →
  ⚠️ verificar con ensayo. (El tipo de núcleo core/shell también afecta `Z0` sin delta.)

→ Implicaciones de protección y errores típicos: `04-diagnostico.md`.
