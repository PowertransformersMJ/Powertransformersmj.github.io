# 🛰️ 15 — CONSEJO EXTERNO (red team multi-modelo · 2ª opinión adversarial)

> **Nodo neuronal: protocolo operativo.** Define CUÁNDO y CÓMO pedir una crítica
> adversarial a un modelo externo (de otra familia, no-Claude) antes de una
> decisión fuerte. NO se auto-carga; su EXISTENCIA está flagueada en
> `CLAUDE.md §0` para que cada arranque sepa que el protocolo existe.
>
> **Disparador (Trigger de Decisión Fuerte, `CLAUDE.md §G.2`)**: antes de una
> decisión **cara de revertir**.

---

## §0 — MODELO EXTERNO ACTIVO

**Provider activo**: **ChatGPT — familia GPT-5** (el director tiene acceso a
`GPT-5.5`, `GPT-5.4`, `GPT-5.3`, `GPT-5.2` y `GPT-5-mini`). Otra familia que
Claude → red team legítimo (sesgos distintos).

**Cómo llega la respuesta**:
- [x] Manual: el director pega el prompt en ChatGPT y me trae la respuesta.
- [ ] Vía MCP / tool: n/a (sin cableado de tool).

**Última verificación de disponibilidad**: `2026-06-04`.

**Mapeo de tiers a la familia GPT-5 disponible** (detalle en §3):
- **TOP (High)** → `GPT-5.5` (el más capaz para arquitectura / seguridad / legal).
- **TOP (Medium)** → `GPT-5.4` / `GPT-5.3` / `GPT-5.2` (2ª opinión sólida acotada).
- **Fast** → `GPT-5-mini` (sanity-check rápido, generar alternativas).

> Si en una sesión futura el director pierde acceso a ChatGPT: el Trigger 🛰️ degrada a
> "marcar la decisión como NO revisada externamente" + considerar la skill
> **`llm-council`** como sustituto parcial. El protocolo de §4 sigue siendo útil para
> estructurar mi propio análisis adversarial interno. Actualizar esta §0 en el mismo
> cambio (Reflejo de Frescura §G.4).

---

## §1 — Qué es y por qué lo tenemos

Acceso a un modelo de otra familia (no-Claude) como **segunda opinión adversarial**. El valor NO es "el otro modelo piensa por mí" — es **diversidad de sesgos**: Claude y Gemini/GPT/etc. fallan en cosas distintas, así que un crítico de otra familia atrapa puntos ciegos. (Mismo concepto que la skill `llm-council`, pero con humano en el medio.)

**Humano en el medio (clave)**: yo marco la decisión → el cliente corre el prompt en el modelo externo → me pega la respuesta → **yo la evalúo como peer review** (adopto lo correcto, refuto con razones lo que esté mal). NUNCA me subordino al modelo externo; es insumo, no oráculo.

---

## §2 — Cuándo consultarlo (y cuándo NO)

### §2.1 — Principios universales (siempre aplican)

**SÍ (vale la fricción + tokens):**
- 🏛️ **Arquitectura / modelo de datos** caro de revertir (esquemas, contratos de API, límites de módulos).
- 🔀 **Fork 50/50**: estoy genuinamente dividido entre 2+ enfoques viables (aviso explícito).
- ⚠️ **Operación irreversible/destructiva** (migraciones, refactor masivo, borrados de datos/estructura).
- 🔒 **Seguridad / legal** (regulaciones aplicables: GDPR, Ley 1581, HIPAA, PCI; secrets; rules backend).
- 🤔 **Incertidumbre** tuya o mía que quiera un desempate.

**NO (no malgastar tokens):**
- Trabajo rutinario, mecánico o **reversible** (fixes con RCA claro, edits triviales).
- **Hechos/código de NUESTRO repo** → el modelo externo no ve el código ni el cerebro; alucina. Eso lo verifico YO leyendo código (`CLAUDE.md §3.3`). Sirve solo para **juicio/estrategia/tradeoffs**.
- Cuando los **tokens estén bajos** → guardarlos para lo grande (§5).

### §2.2 — Decisiones de ESTE proyecto que disparan 🛰️

> Casos concretos derivados del stack (Firebase + GitHub Pages + JS vanilla) y del
> dominio (Salud de Activos MO.00418 · transformadores Afinia). Mantener vivo con §2.4.

**Casos específicos del proyecto (mínimo 3-5)**:
- **Cambiar el schema de Firestore** (mover campos entre secciones v2 / root v1, nuevas
  subcolecciones append-only, docId compuesto) — caro de migrar por las `firestore.rules`
  + índices + la convivencia v1↔v2 que ya existe. Toca `assets/js/domain/schema.js`
  (pesos HI Tabla 10 + enums canónicos), módulo de **alto blast radius**.
- **Modificar `firestore.rules` o el flujo de auth/RBAC** (`session-guard.js`, roles F28)
  — un error abre o cierra el backend a todo el equipo; el deploy es manual y el síntoma
  de un fallo (permission-denied) es engañoso (ver `30-LECCIONES` L-10/L-11).
- **Cambiar la metodología de cálculo del HI** (motor de Salud, overrides §A5/§A9,
  pesos de la Tabla 10) — es la fuente de verdad normativa del producto; un cambio mal
  hecho desalinea de MO.00418 y todas las proyecciones/alertas heredan el error.
- **Operación de migración/tipificación irreversible sobre datos de producción**
  (ej. `scripts/migrate/tipificar-suministros-fan-db.js` contra `/suministros` del
  contrato 4125000143) — escribe en Firestore real desde la Mac del director; correr
  `dryRun` primero, pero el diseño del mapeo congelado conviene revisarlo antes.
- **Diseñar una integración cross-módulo nueva** (patrón canónico L-16: dominio puro +
  idempotencia por marcador + trazabilidad bidireccional + hook no-bloqueante) — el
  contrato entre módulos es caro de rehacer si se elige mal el marcador de idempotencia.
- **Reactivar la PWA / Service Worker** (hoy `sw.js` es kill-switch a propósito) — el SW
  cache-first ya causó deploys invisibles en el pasado; volver a encenderlo es una
  decisión de arquitectura con historial doloroso.

**Decisiones legales/compliance específicas**:
- Tratamiento de datos bajo **Ley 1581 Colombia** si el sistema llega a almacenar PII
  de técnicos/brigadistas más allá de email+nombre+rol. Hoy el alcance es mínimo
  (perfiles de equipo) → **n/a en la práctica**, pero re-evaluar si se agregan datos
  personales sensibles (ubicación en tiempo real, biométricos de acceso, etc.).

**Decisiones de infra costosa**:
- **n/a** — el proyecto es sin ánimo de lucro y vive 100% en tiers gratuitos (GitHub
  Pages + Firebase Spark + Vercel Hobby). Si algún día se acerca a los límites de Spark
  (50k lecturas/día, 1 GB Firestore, 5 GB Storage) y hay que decidir upgrade vs.
  optimización de queries → eso sí dispara 🛰️.

### §2.3 — Decisiones rutinarias de ESTE proyecto que NO requieren 🛰️

> Listar para evitar sobre-consultar. Mantener vivo con §2.4.

- Ajustar copy / textos visibles de una página o de un email transaccional.
- Agregar un campo opcional a un formulario existente (sin tocar rules ni schema canónico).
- Bugfix en un handler aislado de UI con tests verdes y RCA claro.
- Refactor interno de una función pura de dominio sin cambiar su contrato (firma + tests).
- Cambios visuales del sistema AQUA LIGHT (tokens, glass, sidebar) — son reversibles y la
  prod manda (`30-LECCIONES` L-03 sobre paridad visual, no requiere 2ª opinión externa).
- Agregar un test, una lección a `30-LECCIONES`, o documentación.
- Generar/ajustar un informe imprimible reusando el patrón `.sheet` ya establecido (L-06).

### §2.4 — Reglas dinámicas (Reflejo de Frescura §G.4)

- Cuando aparezca un tipo de decisión NUEVO que pinta como 🛰️ y NO está en §2.2, **apéndalo ahí** ANTES de disparar el consejo (o ANTES de cerrar la tarea si decides no consultar). Mantiene §2.2 vivo.
- Si una decisión de §2.2 se vuelve rutinaria con el tiempo (ya tienes patrón estable), MUÉVELA a §2.3.
- Si el provider activo §0 cambia (el usuario consigue/pierde acceso a un modelo), revisar §2.2: algunos casos solo valen 🛰️ si hay un modelo TOP disponible.

---

## §3 — Selección de tier (yo decido según provider activo §0)

**Principio rector**: el costo del modelo escala con el costo de equivocarse (reversibilidad).

| Tier | Cuándo lo elijo | Modelo a usar (provider activo §0 = familia GPT-5) |
|---|---|---|
| **TOP (High)** | Decisión TOP: arquitectura/modelo de datos caro de revertir, seguridad/legal, op irreversible, fork duro | **`GPT-5.5`** (el más capaz disponible) |
| **TOP (Medium)** | Decisión importante pero acotada; 2ª opinión sólida sin gastar al máximo | **`GPT-5.4`** · `GPT-5.3` · `GPT-5.2` |
| **Fast** | Sanity-check rápido, "¿se me escapó algo obvio?", generar alternativas, crítica ligera | **`GPT-5-mini`** |

Regla simple: **irreversible/caro → `GPT-5.5`** · **importante/acotado → `GPT-5.4/5.3/5.2`** · **rápido/barato → `GPT-5-mini`**.

> 💡 Para arquitectura/seguridad de este proyecto (cambios en `firestore.rules`, schema,
> motor de HI), elegir siempre `GPT-5.5`. El costo de equivocarse (backend abierto,
> desalineación normativa, migración irreversible) justifica el tier máximo.
>
> 💡 Como el contexto del repo NO viaja al modelo externo (§6), el prompt debe ser
> autocontenido y citar la norma relevante (MO.00418, CREG 085/2018, IEEE C57.91) cuando
> la decisión dependa de ella — el modelo no la conoce a nivel de detalle del proyecto.

---

## §4 — Mecánica del consejo

1. **Marco la decisión** como 🛰️ "vale consejo externo" + elijo el tier (§3) + te entrego un **prompt autocontenido** (el modelo externo no tiene memoria de nuestro trabajo → todo el contexto va en el prompt).
2. **Anti-anclaje**: en las decisiones TOP, **fijo MI postura primero** y la omito del prompt; así el modelo externo no me ancla y comparo después. En las ligeras, el orden no importa.
3. Me pegas la respuesta → la trato como **peer review**: adopto lo correcto, **refuto con razones** lo erróneo, **sintetizo** una postura más fuerte, y te digo explícito **qué cambié y qué descarté**.
4. **El resultado** (decisión final + qué aportó/cambió el modelo externo) queda en el **ADR/lección** correspondiente → el cerebro recuerda el porqué.

### Plantilla de prompt (autocontenido)
```
[CONTEXTO] Proyecto: <1-2 frases>. Stack: <relevante>.
Decisión en juego: <qué se decide y por qué importa>.
Opciones: A) <...>  B) <...>
Restricciones: <costo / irreversibilidad / plazo / etc.>
[TAREA] Actúa como crítico adversarial. No me complazcas.
1) ¿Qué modos de fallo o riesgos NO estoy viendo?
2) ¿Qué opción es más robusta y por qué?
3) ¿Qué evidencia o pregunta cambiaría la decisión?
Sé concreto y breve.
```
(En decisiones TOP NO incluyo mi postura tentativa — anti-anclaje §4.2.)

---

## §5 — Degradación por tokens / disponibilidad

- **TOP agotado** → bajar a **Fast (High)** para una toma más ligera (mejor algo que nada).
- **Provider externo caído / sin acceso temporal** → registrar como tal y posponer la decisión si es posible; si no, marcarla con bandera roja en el ADR.
- **Todo agotado** → **sigo solo** y **marco** que la decisión NO tuvo revisión externa (bandera para revisarla si luego molesta).
- Nunca bloquear el avance esperando tokens: el consejo es un acelerador de confianza, no un requisito.

---

## §6 — Límites duros

- El modelo externo **no ve** nuestro código/cerebro → todo contexto va en el prompt; **jamás** usarlo para verificar hechos del repo.
- Es **insumo de juicio**, no autoridad: una crítica que esté mal **se refuta**, no se acata.
- **Misma familia ≠ red team**: pedir 2ª opinión a otro Claude (mismo provider) NO cuenta — mismos sesgos. Solo cuenta otra familia (Gemini/GPT/Mistral/Llama/etc.) o la skill `llm-council` que ya combina varios.
- Si el protocolo lleva tiempo sin usarse y no aporta, **revisarlo** (Reflejo de Desafío Crítico `CLAUDE.md §G.4`) — un protocolo muerto es deuda.
- Si el provider activo cambia (el usuario consigue Antigravity, pierde acceso a ChatGPT Pro, etc.), **actualizar §0** en el mismo cambio (Reflejo de Frescura).
