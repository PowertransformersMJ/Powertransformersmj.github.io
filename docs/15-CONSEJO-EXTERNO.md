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

**Provider activo**: **Gemini (Google) vía Antigravity** — familia distinta a Claude
(Google DeepMind vs Anthropic: otro corpus, otro entrenamiento, otros puntos ciegos)
→ red team legítimo.

**Cómo llega la respuesta**:
- [x] Manual: el Ingeniero pega el prompt en Antigravity y me trae la respuesta.
- [ ] Vía CLI / MCP: **n/a — verificado 2026-07-28**: no existe binario `antigravity`
  ni `gemini` en el PATH, y `~/.gemini/config/mcp_config.json` está vacío (0 bytes).
  Cualquier plan que asuma `antigravity --prompt …` es ficción.

**Última verificación de disponibilidad**: `2026-07-28` (app instalada, onboarding
completo, en ejecución). ⚠️ **Paso operativo previo al primer consejo**: abrir la carpeta
del repo como **workspace en Antigravity** — hoy no hay ninguno registrado, y sin eso el
prompt "apunta a rutas reales" no resuelve nada.

> **Historia (§G.4, apendar no reescribir)**: este nodo declaró ChatGPT/GPT-5 desde
> 2026-06-04, y el ADR §52.14 (2026-07-22) registró *"el Ingeniero no tiene Gemini"*.
> Ambos quedan **superados por hecho** el 2026-07-28 (ADR-058). El propio §6 de este nodo
> previó este escenario por nombre: *"si el usuario consigue Antigravity, actualizar §0"*.

**Si algún día no hay provider externo**: el Trigger 🛰️ degrada a *"marcar la decisión como
NO revisada externamente"* en el ADR + skill **`asesor-critico-honesto`** como sustituto
parcial (la skill `proceso-decision-fuerte §128` declara ESE fallback; antes aquí decía
`llm-council` — reconciliado el 2026-07-28 para no tener dos fallbacks divergentes).

## §0b — Qué modelo pedir dentro de Antigravity

> ✅ **CONFIRMADO por el Ingeniero (2026-07-28)**: su menú de Antigravity es **el mismo** del
> ecosistema de origen, así que la tabla aplica con nombres reales. Sigue siendo un **HECHO
> CADUCABLE tipo L-30** (los menús de modelos cambian solos): re-mirarlo al usarlo y corregir
> aquí en el mismo cambio.
>
> **Regla madre**: el valor está en la OTRA FAMILIA. Cada prompt al Ingeniero **nombra el modelo**.

| Modelo del menú | Cuándo pedirlo |
|---|---|
| **Gemini 3.1 Pro (High)** | ⭐ **DEFAULT de Decisión Fuerte**: crítica adversarial PROFUNDA (arquitectura, schema, `firestore.rules`, criterio normativo, op irreversible). Es el que más razona; que sea lento da igual, se corre una vez. |
| **Gemini 3.6 Flash (High)** | Barridos AMPLIOS donde pesa el volumen más que la profundidad (revisar muchos archivos, checklist largo, 2ª pasada sobre algo ya criticado). Fallback si el 3.1 Pro no está disponible. |
| Gemini 3.6/3.5 Flash (Medium/Low) · 3.1 Pro (Low) | 🚫 NO para el consejo: la crítica barata ya la da el comité interno ×3; una 2ª opinión débil **ancla sin aportar**. |
| Claude Sonnet / Opus (Thinking) del menú | ⛔ **MISMA familia que yo** → no cuenta como consejo externo: comparte sesgos de entrenamiento, sería espejo y no adversario. |
| **GPT-OSS 120B (Medium)** | **3ª familia** (OpenAI open-weights): solo para **DESEMPATE** cuando el comité interno y Gemini divergen de frente. Modelo pequeño → su voto pesa MENOS y se verifica doble (§3.3). Jamás árbitro único de arquitectura. |

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
- **Lo rutinario en general** → el comité interno ×3 basta. ⚠️ **CORREGIDO 2026-07-28**: antes esta línea decía que el modelo externo "no ve el código ni el cerebro; alucina". **Es falso con Antigravity**: SÍ ve el repo y el cerebro locales (solo-lectura), así que PUEDE revisar código y reglas reales. El motivo de no usarlo en lo rutinario es que el ida y vuelta manual no se amortiza — **no** que invente. Aun así verifico YO cada afirmación (`CLAUDE.md §3.3`): el mayor salto de valor del ecosistema hermano se desbloqueó justo al corregir este error.
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

| Tier | Cuándo lo elijo | Modelo a usar (provider activo §0 = Gemini vía Antigravity) |
|---|---|---|
| **TOP** | Decisión TOP: arquitectura/modelo de datos caro de revertir, seguridad, normativa, op irreversible, fork duro | **Gemini Pro, tier alto** (§0b) |
| **Amplio** | Barrido de volumen: muchos archivos, checklist largo, 2ª pasada sobre algo ya criticado | **Gemini Flash, tier alto** (§0b) |
| **Desempate** | Comité interno y Gemini divergen de frente | 3ª familia (§0b), voto de menor peso |

Regla simple: **irreversible/caro → Gemini Pro alto** · **volumen → Flash alto** · **tiers bajos → 🚫 no se usan**.

> 💡 Para arquitectura/seguridad de este proyecto (cambios en `firestore.rules`, schema,
> motor de HI), elegir siempre el tier máximo. El costo de equivocarse (backend abierto,
> desalineación normativa, migración irreversible) lo justifica.
>
> 💡 El repo local **sí** es visible para Antigravity (§0), así que el prompt **apunta a rutas
> y archivos reales** en vez de pegar código a mano. Lo que NO ve es lo que no está en disco:
> el **MO.00418 es interno y no público** → cuando la decisión dependa de él, el criterio
> concreto va TRANSCRITO en el prompt. Nunca dejar que lo "recuerde": lo inventaría.

---

## §4 — Mecánica del consejo

**§4.0 — ENTREGA: el prompt va SIEMPRE en el CHAT, en bloque copiable.** Archivarlo en la
bóveda es para el cerebro; **dárselo es para ti**. Jamás mandarte a abrir una carpeta a buscar
un archivo: el archivo es el respaldo, NO el canal de entrega. *(Práctica adoptada del
ecosistema hermano, donde nació como regla de su dueño; aquí se adopta por criterio propio.)*

**§4.0b — Son 3 RONDAS, no una consulta.** Una sola pasada es la forma barata de que el
consejo suene seguro y esté mal:
- **R1 — ojos frescos**: le doy el problema CRUDO, sin mi postura (anti-anclaje).
- **R2 — debate**: le muestro qué le refuto y por qué. Aquí es donde razona de verdad.
- **R3 — caza de regresiones**: sobre el texto/diseño final, con el registro de cambios.
- **Cierre**: cuando una ronda no produzca ningún hallazgo CRÍTICO ni MAYOR confirmado.

> Costo real: 3 rondas = ~6 viajes manuales tuyos. Por eso el disparador se mantiene
> ESTRECHO (§2.2/§2.3) — el consejo externo no es para lo rutinario.

1. **Marco la decisión** como 🛰️ "vale consejo externo" + elijo el tier (§3) + te entrego un **prompt autocontenido** (el modelo externo no tiene memoria de nuestro trabajo → el contexto va en el prompt, y las rutas del repo se citan porque sí las puede leer).
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

- 🚫 **ANTIGRAVITY NUNCA EDITA ESTE REPO.** Es un IDE agéntico: *puede* editar. Aquí es
  consejero de **SOLO-LECTURA** — recibe únicamente prompts de **CRÍTICA** (preguntas,
  hallazgos), JAMÁS tareas de implementación. **Ellos asesoran; quien delibera, decide,
  implementa, commitea y pushea soy yo.** Anti-patrón concreto: no entregarte mensajes de
  implementación sueltos (ni mensajes de commit) que, pegados ahí, le abran la puerta a
  editar en paralelo → dos agentes colisionando sobre el mismo árbol de trabajo.
- ⚠️ **Ve el repo, pero puede equivocarse igual.** Evidencia propia, no doctrina prestada:
  los model IDs que propuso Antigravity (`claude-4-8-opus`, `claude-4-6-sonnet`,
  `claude-3-5-sonnet-20241022`) eran **inválidos** y habrían dado 404/400 (`99 §77`).
  Verifico cada afirmación contra el código real (§3.3). **Insumo, NUNCA oráculo.**
- Es **insumo de juicio**, no autoridad: una crítica que esté mal **se refuta**, no se acata.
- **Misma familia ≠ red team**: pedir 2ª opinión a otro Claude (mismo provider) NO cuenta — mismos sesgos, sería espejo. Solo cuenta otra familia (Gemini/GPT/Mistral/Llama/etc.).
- Si el protocolo lleva tiempo sin usarse y no aporta, **revisarlo** (Reflejo de Desafío Crítico `CLAUDE.md §G.4`) — un protocolo muerto es deuda.
- Si el provider activo cambia (se pierde Antigravity, aparece un CLI/MCP que permita automatizarlo, cambia el menú de modelos), **actualizar §0 y §0b** en el mismo cambio (Reflejo de Frescura). Esta regla ya se cumplió una vez: predijo por nombre la llegada de Antigravity y disparó la actualización del 2026-07-28.

---

## §7 — Qué NO se puede automatizar (dicho sin rodeos)

- **No hay forma de invocar Antigravity desde Claude Code.** Sin binario en el PATH, sin MCP
  cableado, sin API local. El humano en el medio **no es una elección de diseño: es la única
  opción**. Verificado 2026-07-28.
- El flujo real es: yo redacto el prompt → lo imprimo en el chat en bloque copiable → tú lo
  pegas en Antigravity → me traes la respuesta → yo la verifico afirmación por afirmación.
- **Lo único que sí automatizo es el archivado**: el crudo de cada ronda va al `archiveDir`
  (`../brain-private/sgm-transpower/research-archive/`) + la síntesis enlazada, antes de cerrar
  (§G.4). Eso no depende de ti.
