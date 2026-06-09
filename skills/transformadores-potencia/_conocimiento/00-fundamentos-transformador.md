# 00 · Fundamentos del transformador de potencia (backbone compartido)

> Neurona base de TODA la carpeta. Define el equipo, sus partes y el principio físico, para
> no repetirlo en cada skill. Las skills enlazan aquí en lugar de duplicar.

## A) Qué es

Máquina **estática** que transfiere energía eléctrica entre dos o más circuitos por
**inducción electromagnética**, a frecuencia constante (60 Hz en Colombia), cambiando el
nivel de tensión/corriente. No tiene partes giratorias; sus "pérdidas" son en el núcleo
(histéresis + Foucault) y en los devanados (I²R + parásitas).

**Principio (sin carga):** la tensión inducida por espira es proporcional al flujo y la
frecuencia (ley de Faraday). De ahí la **relación de transformación** ideal:

```
V1 / V2 = N1 / N2 = a        (relación de espiras; tensiones de FASE)
```

⚠️ Esta relación es de **fase**. La de **línea** depende de la conexión (Y/Δ) por el factor
√3 — ver `convenciones-calculo.md` y la skill `calculos-nominales`. Confundir fase con línea
es el error #1 al calcular relación en un Dyn/YNd.

## B) Partes principales (qué se inspecciona/diagnostica)

| Parte | Función | Skill / ensayo asociado |
|---|---|---|
| **Núcleo** (core/shell form) | camino magnético (acero al silicio grano orientado) | `construccion-nucleo-devanados`; IR de núcleo |
| **Devanados** (AT/MT/BT, regulación, terciario) | circuitos eléctricos acoplados | `identificacion-tipo-transformador`; relación, R devanados, FRA |
| **Aislamiento** (papel/cartón prensado + aceite) | dieléctrico + refrigerante | aceite, humedad, DGA, FP/tan δ, DFR |
| **Bujes** (condenser / no condenser) | pasamuros aislado AT↔exterior | `bujes-y-accesorios`; FP de bujes C1/C2 |
| **Cambiador de tomas** (OLTC bajo carga / DETC sin carga) | regula la relación | `regulacion-tomas`; resistencia dinámica LTC |
| **Sistema de refrigeración** (radiadores, ventiladores, bombas) | disipa el calor de pérdidas | `sistema-refrigeracion`; termografía |
| **Tanque, conservador, relé Buchholz, válvulas** | contención, expansión, protección | `bujes-y-accesorios`; inspección |

## C) Tipos de construcción (ABB Handbook §1.5)

- **Núcleo acorazado (shell form):** bobinas tipo "pancake" rectangulares; el núcleo rodea
  las bobinas como una coraza. Alta capacitancia bobina-bobina → distribución de impulso más
  uniforme. Cabeza térmica ~12 °C. Robusto ante esfuerzos de cortocircuito (fuerzas opuestas
  entre grupos de bobinas se cancelan parcialmente).
- **Núcleo de columnas (core form):** bobinas cilíndricas concéntricas sobre columnas
  verticales; el devanado de menor tensión va adjunto al núcleo (potencial de tierra) y el de
  mayor tensión por fuera. Es la construcción más común en potencia.

> Por qué importa para diagnóstico: la construcción condiciona la **distribución de impulso**
> (capacitancias), las **fuerzas de cortocircuito** (telescopeo, pandeo) y la **firma FRA**.
> Ver `pruebas-electricas/sfra` para la interpretación por bandas.

## D) Esfuerzos que sufre (entrada al diagnóstico)

Eléctricos (sobretensión, impulso, descargas parciales) · térmicos (carga, puntos calientes,
envejecimiento del papel) · mecánicos (fuerzas de cortocircuito ∝ I²) · químicos (humedad,
oxígeno, oxidación del aceite). Cada esfuerzo deja una **firma** medible → es el puente a la
batería de pruebas (`pruebas-electricas/`).

## E) Refrigeración y protecciones (EG cap. 6 · IEEE C57.12.00)

**Notación de refrigeración (4 letras `XX·YY`):** `XX` = medio/circulación INTERNA (junto a
los devanados), `YY` = medio/circulación EXTERNA (disipación). Letras: **O** aceite · **A**
aire · **W** agua · **N** natural · **F** forzada · **D** dirigida (forzada y guiada por los
devanados).

| Sigla | Significado | Cómo enfría |
|---|---|---|
| **ONAN** | Oil Natural / Air Natural | convección pura, sin bombas ni ventiladores |
| **ONAF** | Oil Natural / Air Forced | ventiladores sobre los radiadores (sin bombas) |
| **OFAF** | Oil Forced / Air Forced | bombas de aceite (2–6 HP) + ventiladores |
| **ODAF** | Oil Directed / Air Forced | aceite forzado y **dirigido** dentro de los devanados |

> Cada etapa de enfriamiento es una **etapa de potencia** (p.ej. ONAN/ONAF/OFAF = 60/80/100 %).
> ⚠️ Subir de etapa **NO** regala MVA: sacar más potencia por refrigeración exige que el equipo
> **se haya diseñado** para esa potencia adicional (EG cap. 6.2). La corriente nominal se calcula
> con el MVA de **la etapa correspondiente** (`convenciones-calculo.md`, `calculos-nominales`).
> Nota EG usa notación antigua (OAFA…); aquí se normaliza a la vigente IEEE C57.12.00.

**Protecciones (taxonomía EG cap. 6.1):** de **variables físicas** — temperatura (termómetro
de carátula / contactos alarma-disparo / **imagen térmica** = gradiente bobina-aceite vía
resistencia de caldeo sobre un TC / fibra óptica), presión (válvula de sobrepresión, **relé de
sobrepresión súbita** por rata de incremento), nivel de aceite, **gas (relé Buchholz** = burbujas
por falla interna → flotadores de alarma y disparo) — y de **variables eléctricas** —
sobretensiones (pararrayos) y sobrecorrientes (fusibles HH, cortacircuitos en distribución que
funden a 1.8–2.2× la I nominal primaria). → detalle/skill: `bujes-y-accesorios`.

## F) Cómo se conecta con el resto del cerebro

- Tablero de Pruebas Eléctricas con IA (ADR-003→ADR-010): consumidor de la tipificación y los
  cálculos de esta carpeta.
- `pruebas-electricas/` (carpeta hermana): la batería de ensayos que verifica estos esfuerzos.
- Lóbulo de dominio en `docs/` (ver `40-LOBULOS-DOMINIO`).
