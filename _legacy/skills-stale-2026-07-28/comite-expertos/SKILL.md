---
name: comite-expertos
description: "Monta un comité de expertos que MEJORA ×3 la última respuesta de Claude. Infiere SOLO qué expertos convienen según el tema (no son fijos), los hace criticar y debatir entre ellos, y un 'presidente' sintetiza una versión mejor en 3 rondas. En decisiones caras de revertir, suma una 2ª opinión externa (ChatGPT / familia GPT-5, vía docs/15-CONSEJO-EXTERNO.md — el modelo externo NO ve el código). GATILLOS OBLIGATORIOS (dispara sí o sí): 'monta el comité', 'comité de expertos', 'mejora esto x3', 'mejórala x3', 'aplícale el comité', 'pásale el comité', 'tribunal de expertos', 'que debatan esto', 'mejora tu respuesta', 'mejora la respuesta anterior', 'puedes mejorar esa respuesta'. GATILLOS de niveles ligeros: 'mejórala un poco' (1 ronda), 'piensa críticamente y asume que cometiste un error' (auto-crítica honesta). Úsala SIEMPRE que el usuario pida mejorar, criticar, pulir o profundizar una respuesta ya dada, o cuando una respuesta importante merezca un segundo par de ojos antes de actuar. NO disparar para datos triviales de un solo dato correcto, ni para tareas puramente mecánicas."
---

# 🧠 Comité de Expertos — mejora ×3 de una respuesta

> **Premisa (por qué existe):** Claude casi nunca da su mejor respuesta a la primera.
> Una respuesta se puede optimizar pidiéndole que la mejore. El problema: armar un
> "comité de expertos" a mano exige que el usuario decida QUÉ expertos para CADA tema,
> y eso es fricción. Esta skill lo hace sola: **infiere los expertos según el tema de
> la respuesta**, los hace debatir, y **mejora la respuesta en 3 rondas**.

Adaptada de la metodología LLM Council (Karpathy), con tres cambios deliberados respecto al original:
(1) **expertos inferidos por tema**, no 5 lentes fijos;
(2) opera sobre **la última respuesta del asistente**, no sobre una pregunta nueva; (3) **itera ×3**.

---

## Los 3 niveles de mejora (elige según lo que pida el usuario)

| Nivel | Gatillo típico | Qué hace |
|---|---|---|
| **1 · Pulido rápido** | "mejórala un poco" | 1 sola pasada de auto-revisión: corrige lo flojo y entrega. Sin comité. |
| **2 · Auto-crítica honesta** | "piensa críticamente, asume que cometiste un error y mejórala" | Una pasada crítica dura (estilo `asesor-critico-honesto`): asume que la respuesta tiene fallos, los busca, los corrige. Sin comité. |
| **3 · Comité ×3** (por defecto de esta skill) | "monta el comité", "mejora esto x3" | El procedimiento completo de abajo: expertos por tema → debate → síntesis, **3 rondas**. |

> Si el usuario no especifica nivel pero pide "mejorar/comité", asume **Nivel 3**.

---

## Sobre qué opera

Por defecto, sobre **la última respuesta sustantiva que dio el asistente** en esta conversación.
Si el usuario señala otro objetivo ("mejora el plan de arriba", "pásale el comité a ese texto"),
opera sobre eso. Si hay ambigüedad real sobre cuál respuesta, haz **una sola** pregunta y sigue.

---

## Procedimiento del Comité ×3

### Paso 0 — Inferir los expertos según el tema (la pieza nueva clave)

Analiza el TEMA de la respuesta a mejorar e infiere **3 a 5 expertos REALES del dominio**
que aportarían más valor. No son lentes genéricos: son perfiles concretos del tema.

Ejemplos (orientativos, no fijos):
- **Precio de una joya de lujo** → experto en pricing premium · gemólogo · analista de márgenes/costos · abogado de e-commerce Colombia.
- **Decisión de arquitectura de software** → arquitecto de sistemas · ingeniero de seguridad · SRE/escalabilidad · experto en costos cloud.
- **Tema legal colombiano** → abogado mercantil colombiano · experto en protección de datos (Ley 1581) · contador/experto DIAN.
- **Copy / marketing** → copywriter de conversión · experto en marca de lujo · psicólogo del consumidor.

**Regla de tensión (obligatoria):** entre los expertos elegidos, asegura **al menos uno escéptico**
(su trabajo es encontrar el fallo fatal) y **al menos uno ejecutor** (su pregunta es "¿se puede hacer
de verdad? ¿cuál es el primer paso?"). Sin tensión, el comité solo se da palmadas y no mejora nada.

Anuncia en el chat, en 1 línea, qué expertos convocaste y por qué (transparencia).

### Paso 1 — Ronda de expertos (subagentes en paralelo)

Lanza los expertos **simultáneamente** como subagentes (tool `Agent`, o un `Workflow` si son muchas
rondas). Cada experto recibe: su identidad/perfil, la respuesta a mejorar, y el contexto del tema.
Instrucción a cada uno: *critica esta respuesta desde tu especialidad, sin complacencia. Señala qué está
mal, qué falta, qué es impreciso, y propón mejoras concretas. No seas equilibrado: defiende tu ángulo a
fondo, los demás cubren el resto.* 150–300 palabras por experto.

### Paso 2 — Peer review cruzado (anónimo)

Reúne las críticas, **anonimízalas** (Aporte A…E, orden aleatorio para evitar sesgo de posición).
Lanza un subagente por experto; cada uno ve todos los aportes anónimos y responde:
1. ¿Cuál aporte es el más fuerte y por qué?
2. ¿Cuál tiene el mayor punto ciego y cuál es?
3. ¿Qué se les escapó a TODOS y el comité debería considerar?

> Este paso es lo que hace que el comité sea más que "preguntar 5 veces". No lo omitas.

### Paso 3 — Síntesis del presidente → versión mejorada

Un subagente "presidente" recibe la respuesta original + las críticas + los peer reviews y produce
**una versión MEJORADA de la respuesta** (no un informe sobre la respuesta: la respuesta mejorada en sí),
integrando lo válido, resolviendo los choques con criterio, y tapando los puntos ciegos detectados.

### Paso 4 — Iterar ×3

Repite Pasos 1–3 **tres veces**, cada ronda toma como base la versión mejorada de la ronda anterior.
Para que cada ronda aporte algo distinto (y no repita), enfoca así:
- **Ronda 1 — Exactitud:** errores, huecos, afirmaciones sin respaldo, supuestos falsos.
- **Ronda 2 — Profundidad:** alternativas no consideradas, tradeoffs, riesgos, escala/segundo orden.
- **Ronda 3 — Claridad y acción:** precisión, estructura, que sea accionable y entendible para el usuario.

Si una ronda no produce mejora real (el comité converge antes de la 3ª), dilo y detente: 3 es el techo, no la obligación.

### Paso 5 — 2ª opinión externa (CONDICIONAL — solo Decisión Fuerte)

> El cliente eligió: **Claude + 2ª opinión externa en decisiones caras de revertir.**
> Provider externo activo: **ChatGPT — familia GPT-5** (`docs/15-CONSEJO-EXTERNO.md §0`).

Si el tema es una **Decisión Fuerte** (arquitectura/modelo de datos, seguridad/legal, operación
irreversible, fork 50/50 — ver criterios en `docs/15-CONSEJO-EXTERNO.md §2`):
1. Tras el comité interno, **prepara un prompt autocontenido** para el proveedor externo (ChatGPT /
   familia GPT-5, `docs/15-CONSEJO-EXTERNO.md §0` y §4) — **el modelo externo NO ve nuestro código ni
   el cerebro**, todo el contexto va en el prompt (incluye la norma relevante: MO.00418, IEEE C57.*,
   etc., si la decisión depende de ella). Jamás lo uses para verificar hechos del repo (§6). Aplica
   **anti-anclaje** (§4.2): en decisiones TOP no incluyas tu postura. Elige el tier (§3): irreversible/
   caro → `GPT-5.5`; importante/acotado → `GPT-5.4/5.3/5.2`; rápido → `GPT-5-mini`.
2. **Pausa y entrégaselo al cliente** (humano en el medio): lo pega en ChatGPT y te trae la respuesta.
3. Integra esa respuesta como **un peer review más**: adopta lo correcto, **refuta con razones** lo que
   esté mal, y sintetiza. Nunca te subordines al modelo externo: es insumo, no oráculo.

Para temas rutinarios/reversibles, **omite el Paso 5** (el comité interno ×3 basta).

---

## Entrega final (en el chat, español)

1. **La respuesta mejorada** (es el producto principal — entrégala completa, lista para usar).
2. **Qué mejoró y por qué** — 3–6 bullets: los cambios netos más importantes que introdujeron las
   rondas (idealmente uno por punto ciego tapado). Honesto: si algo de la respuesta original estaba mal, dilo.
3. Si hubo 2ª opinión externa: 1 línea de qué aportó/cambió ChatGPT y qué refutaste.

---

## Tono de los expertos

Crítica directa y sin complacencia (estilo *asesor crítico honesto*): ir al problema,
ser específico (no "esto no sirve" sino *por qué* y *cómo* arreglarlo), nada de elogios de relleno.
Cada experto **asume que la respuesta original tiene fallos** y los busca activamente.

## Mecánica y reglas duras

- **Expertos en PARALELO**, nunca en secuencia (secuencial deja que una respuesta contamine a la siguiente).
- **Anonimiza siempre el peer review** (si saben quién dijo qué, defieren en vez de evaluar por mérito).
- El presidente **puede contradecir a la mayoría** si el razonamiento de la minoría es más fuerte.
- **Presenta el resultado en el chat con Markdown. NO generes informes HTML ni archivos** (corrige el
  bug heredado de `llm-council`: no hay "reporte visual", el usuario lo lee en la conversación).
- Para orquestar muchas rondas/expertos sin saturar, usa un `Workflow` (paralelo + bucle ×3); para casos
  chicos, subagentes `Agent` en paralelo basta.

## Cuándo NO usar esta skill

- Datos triviales de un solo dato correcto ("¿capital de Francia?").
- Tareas puramente mecánicas (renombrar, formatear) sin juicio en juego.
- Cuando el usuario ya decidió y solo quiere ejecutar — no le impongas un comité.
