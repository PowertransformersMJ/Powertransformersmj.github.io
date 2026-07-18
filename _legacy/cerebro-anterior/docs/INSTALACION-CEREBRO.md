# 🧠 CEREBRO NUEVO — Protocolo de instalación

<!-- brain-template-version: 1.0.0 -->

> **PARA QUIEN LEE ESTO**: si eres **Claude Code**, este archivo es tu **prompt
> ejecutable**. Sigue el protocolo de las FASES 0-7 al pie, sin saltarte ninguna.
> Si eres **humano**, este archivo describe cómo Claude va a instalar el cerebro
> en tu proyecto cuando le digas: *"Revisa el archivo de instalación del cerebro
> neuronal e instálalo en este repositorio"*.
>
> **Versión del template**: 1.0.0 (ver `package.json` del paquete origen). Esta
> versión queda marcada como comentario en el `CLAUDE.md` instalado para que en
> el futuro se pueda comparar contra una versión nueva del template y migrar.

---

## 🎯 Objetivo

Trasplantar el cerebro neuronal (este paquete) al **directorio raíz del proyecto destino**, adaptándolo a lo que ese proyecto YA es (no a un proyecto vacío). El proyecto destino puede estar en **cualquier estado**:

- 🆕 Proyecto recién iniciado (cero código aún).
- 🏗️ Proyecto en desarrollo activo (con commits, código, configs).
- 🔄 Proyecto con un `CLAUDE.md` simple previo (típico de `/init`).
- 🧱 Proyecto con sus propias docs/, hooks, settings.

En TODOS los casos, el cerebro debe **adaptarse al proyecto, no al revés**. No pisar nada del trabajo previo.

---

## 📂 Inventario del paquete (qué vas a copiar)

```
CEREBRO NUEVO/   ← esta carpeta (origen)
├── CLAUDE.md                        Router neuronal (auto-carga)
├── docs/
│   ├── 00-INDICE.md                 Mapa sináptico
│   ├── 05-ESTADO-GLOBAL.md          Signos vitales (auto-carga, tope 25)
│   ├── 10-MEMORIA-CORTO-PLAZO.md    WIP (auto-carga, tope 110)
│   ├── 15-CONSEJO-EXTERNO.md        Red team (Trigger 🛰️)
│   ├── 20-MEMORIA-ESPACIAL.md       Arquitectura del proyecto
│   ├── 30-LECCIONES.md              Recetas + meta (L-NN/M-NN)
│   ├── 40-LOBULOS-DOMINIO.md        Registry de dominios + cableado a skills
│   ├── 99-HISTORIAL-ADR.md          Largo plazo (vacío al inicio)
│   └── skills-inventory.md          Catálogo de skills
├── scripts/brain-check.mjs          Linter del cerebro
├── githooks/pre-commit              Bloquea commit con cerebro roto
├── .claude/settings.json            Hook SessionStart
├── skills/                          74 skills portables (~3.4 MB)
├── _legacy/README.md                Cuarentena reversible
├── package.json                     Solo declara `brain:check`
└── INSTALACION.md                   Este archivo
```

---

# 🤖 PROTOCOLO PARA CLAUDE CODE (ejecutar en orden)

> **Antes de empezar**: confirma que estás corriendo en el directorio raíz del
> proyecto destino (NO en la carpeta `CEREBRO NUEVO`). Si no, dilo y para.

---

## FASE 0 — Descubrimiento del proyecto actual (NO escribir todavía)

Tu objetivo aquí es **leer el proyecto antes de tocarlo**. Esto alimenta lo que vas a escribir en `§1` del `CLAUDE.md`, en `05`, y en `20-ESPACIAL`. **No inventes datos**: si no los puedes verificar, los marcas como "pendiente de confirmar" y los preguntas al final.

### 0.1 — Detección de estado base

Ejecuta estas comprobaciones (en paralelo cuando puedas) y guarda los resultados mentalmente:

```
- ls / Glob de la raíz: ¿qué hay?
- ¿existe .git/?           → ¿es repo git? → git remote -v, git branch --show-current, git log --oneline -5
- ¿existe package.json?    → leerlo: name, type, scripts, dependencies, devDependencies
- ¿existe requirements.txt / pyproject.toml / Cargo.toml / go.mod / composer.json?  → leerlo (stack)
- ¿existe README.md?       → leer hasta 100 líneas (negocio + cómo correrlo)
- ¿existe CLAUDE.md previo? → leerlo entero
- ¿existe .claude/settings.json? → leerlo entero (hooks existentes)
- ¿existe .claude/launch.json? → leerlo (no conflictúa, dejar)
- ¿existe docs/ propio?    → ls de su contenido
- ¿existe scripts/ propio? → ls
- ¿existe githooks/ propio? → ls + leer cada hook (no pisar)
- ¿existe service-worker.js?  → leerlo (cache bump §4 aplica)
- ¿hay .github/workflows/?  → ls (CI/CD)
- ¿hay .env.example / .env.template? → leer (qué secrets espera)
```

### 0.2 — Inferir el stack y deploy

Con lo leído arriba, construye en tu cabeza:
- **Lenguaje principal** (JS/TS, Python, Go, Rust, PHP, etc.)
- **Framework** (Next, React, Vue, Svelte, Django, FastAPI, Express, etc.)
- **Tipo de proyecto** (sitio estático, SPA, SSR, API, CLI, librería, mobile)
- **Base de datos** si la hay (Postgres, Firestore, Mongo, SQLite, etc.)
- **Hosting / deploy** (Vercel, Netlify, Cloudflare Pages, GitHub Pages, Docker, AWS, etc.)
- **Branch de producción** (`main`/`master`/`production`)
- **¿Tiene service-worker?** (sí/no → decide si §4 del CLAUDE.md aplica)
- **Áreas/módulos principales** (público / admin / API / etc.)

### 0.3 — Detectar conflictos (archivos que existen y vamos a tocar)

Marca con ⚠️ los conflictos que necesitarán mergeo (NO pisar):

| Archivo del cerebro | ¿Existe ya en el proyecto? | Estrategia |
|---|---|---|
| `CLAUDE.md` | Si SÍ → ⚠️ MERGEAR | Cuarentenar el viejo en `_legacy/CLAUDE-previo.md` y construir el nuevo, **rescatando datos útiles del viejo en `§1`** y **decisiones históricas como ADRs en `99`** |
| `.claude/settings.json` | Si SÍ → ⚠️ MERGEAR | Añadir el hook `SessionStart` sin borrar los existentes |
| `package.json` | Si SÍ → ⚠️ MERGEAR | Añadir `"brain:check": "node scripts/brain-check.mjs"` a `scripts` sin tocar el resto |
| `scripts/brain-check.mjs` | Improbable → si SÍ pregunta | — |
| `githooks/pre-commit` | Si SÍ → ⚠️ COMPONER | Combinar ambos hooks (el viejo + el del cerebro) en un solo `pre-commit` que llame a los dos |
| `docs/` (con contenido) | Si SÍ → ⚠️ COEXISTIR | Las docs existentes NO se borran; se referencian desde `20-MEMORIA-ESPACIAL.md` como hojas de detalle |
| `_legacy/` | Si SÍ → ⚠️ MERGEAR | Apender una sección al README existente |
| `.gitignore` | Si SÍ → no tocar | El cerebro no genera artefactos a ignorar |

### 0.4 — STOP point: reportar lo descubierto

Antes de seguir, **imprime al usuario** un resumen breve (≤15 líneas):

```
🔍 DESCUBRIMIENTO DEL PROYECTO
- Nombre: <name del package.json o nombre de la carpeta>
- Stack: <lenguaje + framework + DB>
- Hosting: <inferido o "no detectado">
- Branch actual: <branch> / Branch prod: <main|master|?>
- Service-worker: <sí, en service-worker.js | no detectado>
- CLAUDE.md previo: <sí, X líneas | no>
- .claude/settings.json previo: <sí, con N hooks | no>
- docs/ propias: <sí, N archivos | no>
- githooks propios: <sí: [lista] | no>
- Conflictos a mergear: <lista o "ninguno">

Voy a proceder a instalar el cerebro adaptándome a este estado.
Si algún dato es incorrecto, dímelo ahora antes de seguir.
```

**NO esperes respuesta**: si el usuario no interrumpe, sigue. Pero si en el descubrimiento detectaste una pieza ambigua (ej. dos posibles branches de prod, o un `CLAUDE.md` previo extenso con información valiosa que no sabes si rescatar), **PREGUNTA** una sola vez con opciones concretas (no abiertas).

---

## FASE 0.5 — Preguntas al usuario (lo que NO se puede detectar leyendo el repo)

> Hay piezas que **ningún `Glob`/`Read` te puede decir**: dependen del usuario y sus
> herramientas, no del código. PREGUNTA todas juntas (UNA sola interrupción) usando
> `AskUserQuestion` con opciones concretas. NO supongas defaults silenciosos.

### 0.5.1 — Provider externo para el Trigger 🛰️ (Consejo Externo)

El cerebro tiene un protocolo de **2ª opinión adversarial** (`docs/15-CONSEJO-EXTERNO.md`)
para decisiones caras de revertir. Necesita saber qué herramienta tiene el usuario:

**Pregunta literal a hacer**:
> "¿Qué herramienta de IA usas además de Claude para pedir una segunda opinión
> en decisiones importantes (arquitectura, seguridad, refactor masivo)?"

**Opciones a presentar** (multiSelect — el usuario puede tener varias):
- 🟢 **Gemini (Antigravity, AI Studio o Gemini app)** — incluye tiers Pro/Flash.
- 🟢 **ChatGPT (Plus / Pro / Team)** — incluye familia razonamiento (o1/o3) + GPT-5.
- 🟢 **Perplexity Pro** — útil cuando la decisión depende de búsqueda web/precedentes.
- 🟢 **Modelo local (Mistral / Llama vía Ollama / LM Studio)** — para datos sensibles.
- 🟢 **Otra herramienta** — pedir nombre.
- 🔴 **Ninguna por ahora — solo Claude** — el Trigger 🛰️ se marcará como degradado.

Guarda la respuesta. La usarás en FASE 3.8 para rellenar `15-CONSEJO-EXTERNO.md §0`.

### 0.5.2 — Casos ambiguos detectados en FASE 0

Si tu descubrimiento dejó dudas concretas que afectan la instalación, agrupa esas
preguntas aquí. **Solo preguntas con opciones cerradas**, no abiertas. Ejemplos:

- "Detecté 2 branches candidatas a producción: `main` y `release`. ¿Cuál es la
  de prod ahora mismo?"
- "Encontré `CLAUDE.md` previo de 300 líneas con info de arquitectura. ¿Lo
  cosechamos completo al nuevo CLAUDE.md+ADRs, o solo extraemos lo esencial?"
- "El proyecto tiene `core.hooksPath` configurado a `.husky`. ¿Mantenemos esa
  ruta y movemos nuestro pre-commit allí, o cambiamos a `githooks/`?" (ver FASE 4.1)
- "Vi `docs/` con 12 archivos propios. ¿Los archivamos en `_legacy/docs-previo/`,
  los referenciamos desde `20-ESPACIAL`, o ambos?"

Si NO hay ambigüedades, **no preguntes por preguntar**. La 0.5.1 va sí o sí; las
demás solo si aparecieron.

### 0.5.3 — STOP point real

Aquí SÍ esperas respuesta. Una vez la tengas, sigue a FASE 1 con todas las
decisiones tomadas. No vuelvas a interrumpir al usuario salvo que rompas algo.

---

## FASE 1 — Copiar la estructura base (archivos sin conflicto)

Copia desde `CEREBRO NUEVO/` al raíz del proyecto destino. **Solo los que NO marcaste como conflicto en 0.3**. Los conflictivos los manejas en FASE 2.

Archivos siempre nuevos (copiar tal cual si no existían):
```
docs/00-INDICE.md
docs/05-ESTADO-GLOBAL.md
docs/10-MEMORIA-CORTO-PLAZO.md
docs/15-CONSEJO-EXTERNO.md
docs/20-MEMORIA-ESPACIAL.md
docs/30-LECCIONES.md
docs/40-LOBULOS-DOMINIO.md
docs/99-HISTORIAL-ADR.md
docs/skills-inventory.md
scripts/brain-check.mjs
skills/   (carpeta entera, 74 skills)
```

> ⚠️ **Si `docs/` ya existía con contenido**: NO crees `docs/` nuevo; agrega los 9 archivos del cerebro DENTRO del `docs/` existente. Las docs viejas quedan intactas. Las referenciarás luego desde `20-ESPACIAL` como hojas.

> ⚠️ **Si `skills/` ya existía**: improbable, pero si pasa, pregunta antes de tocar nada (no pisar curaduría del usuario).

---

## FASE 2 — Mergeo seguro de archivos conflictivos

### 2.1 — `CLAUDE.md` previo

Si existe `CLAUDE.md` en la raíz:

1. **Mover el viejo** a `_legacy/CLAUDE-previo.md`. Añadir entrada en `_legacy/README.md`:
   > `CLAUDE-previo.md` — versión anterior del CLAUDE.md (pre-cerebro neuronal). Conservada para rescatar info no migrada. Fecha: YYYY-MM-DD.
2. **Copiar el nuevo** `CLAUDE.md` desde `CEREBRO NUEVO/`.
3. **Cosechar datos del viejo** (importante): leer `_legacy/CLAUDE-previo.md` y trasladar:
   - Identidad/stack/áreas → `§1` del nuevo `CLAUDE.md`.
   - Decisiones técnicas con razón documentada → ADR § en `99-HISTORIAL-ADR.md` (formato `CLAUDE.md §2`), con fila en `00-INDICE`.
   - Gotchas o "no hacer X" → lección en `30-LECCIONES.md` (formato `L-NN`).
   - Comandos / scripts útiles → mantenerlos referenciados en `20-ESPACIAL`.

### 2.2 — `.claude/settings.json` previo

Si existe:

1. Leerlo entero.
2. Si **NO** tiene un hook `SessionStart`: añadir el del cerebro al objeto `hooks` (mergear sin pisar otros eventos).
3. Si **SÍ** tiene un hook `SessionStart`: añadir el `brain:check` como una entrada más dentro del array de hooks, sin borrar las existentes.

Ejemplo de mergeo correcto cuando ya hay otros hooks:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "<hook-existente>" } ] },
      { "hooks": [ { "type": "command", "command": "node scripts/brain-check.mjs", "timeout": 30, "statusMessage": "Auto-auditoria del cerebro (brain:check)…" } ] }
    ],
    "<otros-eventos-si-existen>": [ ... ]
  }
}
```

### 2.3 — `package.json` previo

Si existe:

1. Añadir a `scripts`:
   ```json
   "brain:check": "node scripts/brain-check.mjs"
   ```
   sin borrar ni renombrar los scripts existentes.
2. Asegurar que tiene `"type": "module"` (necesario para que `brain-check.mjs` corra). Si no lo tiene Y el proyecto usa CommonJS por defecto, renombrar `scripts/brain-check.mjs` a `scripts/brain-check.js` con la misma extensión `.mjs` para forzar ESM independientemente del package.json. (Si ya es `.mjs`, no hace falta tocar `"type"`.)
3. NO sobrescribir `name`, `version`, `dependencies`, `devDependencies`. NO copiar nuestro `package.json` entero.

### 2.4 — `githooks/pre-commit` previo

Si existe:

1. Renombrar el viejo a `githooks/pre-commit.previo`.
2. Escribir un nuevo `githooks/pre-commit` que ejecute AMBOS en serie:

```sh
#!/bin/sh
# Hook compuesto: ejecuta el pre-commit previo + brain:check del cerebro neuronal.

# 1) Hook previo del proyecto (si existía).
if [ -x "$(dirname "$0")/pre-commit.previo" ]; then
  "$(dirname "$0")/pre-commit.previo" || exit $?
fi

# 2) brain:check (solo si el commit toca CLAUDE.md o docs/).
staged=$(git diff --cached --name-only)
echo "$staged" | grep -qE '^(CLAUDE\.md|docs/)' || exit 0
command -v node >/dev/null 2>&1 || { echo "⚠️  node no en PATH → salto brain:check"; exit 0; }
echo "🧠 brain:check (pre-commit)…"
if ! node scripts/brain-check.mjs; then
  echo ""
  echo "❌ COMMIT BLOQUEADO: el cerebro tiene problemas (ver arriba)."
  echo "   Corrígelos, o usa 'git commit --no-verify' si es intencional."
  exit 1
fi
exit 0
```

### 2.5 — `_legacy/README.md` previo

Si existe (improbable pero posible si el proyecto ya cuarentenaba): apender la tabla del cerebro al README existente, no pisarlo.

---

## FASE 3 — Adaptar el cerebro al proyecto descubierto

> Este es el paso que diferencia "copiar archivos" de "instalar un cerebro". Rellena los placeholders con datos **REALES** leídos en FASE 0, NO con texto genérico.

### 3.1 — `CLAUDE.md §1` (Identidad y arquitectura)

Reemplaza el bloque "PLANTILLA" con datos verificados:

```markdown
## §1 — Identidad y arquitectura

- **Negocio**: <lo que el README/package.json describen, 1 frase>.
- **Stack**: <lenguaje + framework + libs clave + DB>.
- **Hosting / Deploy**: <inferido: GitHub Pages, Vercel, Cloudflare, Docker, etc. + comando de deploy>.
- **Project IDs / namespaces**: <Firebase project id, AWS account, etc. — si aplica>.
- **Áreas**: <público / admin / API / etc. — 1 línea por área detectada en la estructura>.
- **Secretos esperados** (de .env.example si existe): <lista de env vars; NO copiar valores reales>.
- **Deploys** (manuales o automáticos): <pipeline CI detectado o comando manual>.

Detalle profundo de cualquier subsistema → `docs/20-MEMORIA-ESPACIAL.md` + ADRs vía `docs/00-INDICE.md`.
```

**Regla de honestidad**: si NO pudiste detectar algún campo con seguridad, escribe `<pendiente: confirmar con el cliente>`. NO inventes.

### 3.2 — `CLAUDE.md §4` (Cache bump) — adaptación condicional

- Si el proyecto **TIENE service-worker** (detectado en 0.1): deja el `§4` tal cual está en la plantilla.
- Si el proyecto **NO tiene service-worker**: **borra el `§4` entero** del CLAUDE.md (incluyendo el header). Esto evita que el `brain-check` busque cache versions inexistentes y reduce ruido cognitivo en el agente.

### 3.3 — `CLAUDE.md §3` (Doctrinas) — adaptación al stack

Las doctrinas actuales de la plantilla son universales pero algunas tienen sabor "web frontend":
- §3.1 (Performance) habla de `transition:all`, `<picture>`, etc. → solo aplica si hay frontend web. Si el proyecto es backend puro o CLI, REEMPLAZA §3.1 con doctrinas equivalentes del stack (ej. para Python: "evitar `from x import *`", "no `eval`/`exec` con input no validado"; para Go: "no `interface{}` cuando se puede tipar"; etc.).
- §3.2 (HTML/CSS) → renombra a "API/contratos estables" si no hay HTML.
- §3.3 (Verifica no asumas), §3.4 (IAP) → **UNIVERSALES, nunca borrar**.
- §3.5 (anti-MO/pointermove) → solo si hay DOM. Si no, borrar.

### 3.4 — `docs/05-ESTADO-GLOBAL.md` (signos vitales)

Rellena la tabla con datos reales leídos en FASE 0:

```markdown
| Señal | Valor |
|---|---|
| **Build** | 🟢 cerebro recién instalado en proyecto existente. Próximo paso: <lo que el usuario haya dicho querer hacer / "esperar instrucciones">. |
| **Versión / Cache** | <si hay SW: v<timestamp leído>. Si no: n/a> |
| **Branch activa** | <branch leído de git branch --show-current> |
| **Producción** | <branch detectado: main/master/production> + último commit conocido `<sha corto>` |
| **Deploys backend pendientes** | <si hay rules/functions: detectar. Si no: ninguno> |
```

**Tope 25 líneas**. Si lo excedes, recorta los valores (no las filas).

### 3.5 — `docs/20-MEMORIA-ESPACIAL.md` (arquitectura)

Rellena el mapa de "dónde vive cada cosa" con la estructura REAL de carpetas detectada en FASE 0:

- Tabla "Si buscas…" con las carpetas principales y qué hay en cada una.
- Tabla "Estructura de carpetas" con propósito y modo de carga.
- Si encontraste docs propias del proyecto en `docs/`, referenciarlas como hojas de detalle.
- Si el proyecto tiene una `db schema` declarada (Prisma, SQLAlchemy, Firestore rules), añadir sección "Schema de datos" con resumen.

**Tope 280 líneas**. Si te pasas, ya hay que shard — déjalo al usuario.

### 3.6 — `docs/10-MEMORIA-CORTO-PLAZO.md` (WIP)

Actualiza el "Foco actual":

```markdown
## 🎯 Foco actual

> 🏗️ **Cerebro neuronal recién instalado en proyecto existente** (YYYY-MM-DD).
> Estado del proyecto al instalar: <build + branch + commit corto>.
> Estructura mapeada en `20-ESPACIAL`. §1 del CLAUDE.md rellenado con
> datos detectados (verificar con cliente si algún campo es ambiguo).
>
> **🚫 Callejones sin salida**: ninguno aún.
```

Y actualiza los TODOs con lo que quedó pendiente (si rescataste algo del CLAUDE.md viejo que requiere migración manual, ponlo como TODO).

### 3.7 — Cosechar lecciones del repo (opcional, solo si es barato)

Si el proyecto tiene un README extenso, commits con mensajes detallados, o comentarios `// TODO:` / `// FIXME:` recurrentes, considera apender 1-3 lecciones iniciales en `30-LECCIONES.md`. **Solo si son obvias y verificables**. NO inventes lecciones.

### 3.8 — Adaptar `docs/15-CONSEJO-EXTERNO.md` (§0 + §2.2 + §2.3) al proyecto + provider

> Este es el corazón del cableado del red team. Si lo dejas genérico, el Trigger 🛰️
> nunca se dispara en el momento correcto y se pierde la mitad de la utilidad estratégica
> del cerebro. Aquí hay que escribir cosas concretas DEL PROYECTO, no abstractas.

#### 3.8.A — Rellenar `§0 — MODELO EXTERNO ACTIVO` (con respuesta de 0.5.1)

**Campo "Provider activo"**: lista los providers seleccionados, separados por ` + ` si son varios. Ejemplos válidos:

- Una sola herramienta: `Gemini (Antigravity)`, o `ChatGPT (Pro)`, o `Perplexity Pro`.
- Varias: `Gemini (Antigravity) + ChatGPT (Pro)`.
- Modelo local: `Mistral (Ollama local)` o `Llama 3.x (LM Studio)`.
- Sin herramienta externa: `Ninguno (solo-Claude)`.

**Campo "Cómo llega la respuesta"**: marca con `[x]` la(s) opción(es) aplicable(s):
- `[x] Manual: el cliente pega el prompt en la herramienta y me trae la respuesta.` (default si no hay MCP cableado)
- `[x] Vía MCP / tool: <nombre>` (solo si detectaste un MCP server en `.claude/settings.json` que conecte a un provider externo — improbable en instalación nueva).

**Campo "Última verificación de disponibilidad"**: fecha de hoy (YYYY-MM-DD).

**Casos especiales**:

- Si el usuario eligió **"Ninguna por ahora — solo Claude"**: además de rellenar `§0` con "Ninguno (solo-Claude)", agrega esta línea al final del §0:
  > ⚠️ **Modo degradado activo**: el Trigger 🛰️ no tiene 2ª familia disponible. Considera la skill `llm-council` como sustituto parcial cuando dispares una decisión TOP. Marca la decisión como NO revisada externamente en el ADR correspondiente.

- Si el usuario eligió **"Otra herramienta"**: pídele el nombre exacto y rellena `§0` con ese nombre. NO inventes una matriz de tier — deja una nota en `§3` del archivo: "Tier-equivalencia para <herramienta> pendiente de calibrar — usar criterio del cliente sobre cuál modelo de esta herramienta es 'TOP' vs 'Fast'".

- Si el usuario eligió **varias herramientas**: la matriz de tier `§3` ya cubre las equivalencias por provider; no toca nada más. Solo deja claro en `§0` cuál es el **provider preferido por default** (pregunta breve si no quedó claro: "¿Cuál usas primero cuando ambas están disponibles?").

#### 3.8.B — Rellenar `§2.2 — Decisiones de ESTE proyecto que disparan 🛰️`

> Aquí tienes que pensar como arquitecto del proyecto: ¿qué decisiones reales,
> concretas, del stack y del dominio detectado, serían caras de revertir?
> Mínimo 3 entradas, máximo 7. Sustituye TODOS los `<rellenar>` por casos reales.

**Cómo derivar los casos** (combina las 3 dimensiones):

1. **Stack** (de FASE 0.2): para cada pieza del stack, ¿qué decisión arquitectónica sería irreversible? Ejemplos por tipo de proyecto:
   - **Web frontend con backend Firebase**: schema Firestore, reglas de seguridad, cloud functions con triggers, dominio de auth.
   - **API REST/GraphQL**: contrato de endpoints públicos, versionado, esquema de base de datos relacional, autenticación de terceros.
   - **Mobile app**: target de SDK, framework cross-platform vs nativo, esquema offline-first.
   - **Landing/marketing**: motor SSR/SSG, estrategia SEO, sistema de CMS.
   - **CLI / librería pública**: API pública, política de versionado semántico, breaking changes.
   - **E-commerce**: pasarela de pago, manejo de inventario, fiscalidad por jurisdicción.

2. **Dominio** (de FASE 0.1 leyendo README): ¿qué problemas del negocio son sensibles?
   - **Salud**: HIPAA, cumplimiento de protocolos clínicos.
   - **Finanzas**: PCI-DSS, reconciliación, auditoría.
   - **CRM/ventas**: gestión de PII (GDPR/Ley 1581/CCPA), pipeline de leads.
   - **Educación**: protección de menores (COPPA), accesibilidad obligatoria.
   - **Vehículos/comercio físico**: trazabilidad legal, contratos.

3. **Provider activo** (de 0.5.1): si el provider es **"Ninguno"**, REDUCE la lista a 2-3 casos (solo lo más crítico — la fricción de no tener red team hace que cada consulta cueste más).

**Decisiones legales/compliance**: si el dominio del proyecto toca PII / datos sensibles / regulaciones aplicables, rellénalo. Si NO toca → poner literalmente `n/a` (no dejar `<rellenar>` ambiguo).

**Decisiones de infra costosa**: si el proyecto tiene infra escalable con potencial de costos divergentes (hosting, DB managed, CDN), rellénalo. Si es estático o local → `n/a`.

#### 3.8.C — Rellenar `§2.3 — Decisiones rutinarias que NO requieren 🛰️`

> Igual de importante que §2.2: si no listas explícitamente lo rutinario, hay riesgo de
> sobre-consultar y desgastar el protocolo. Mínimo 4 entradas concretas del stack.

Ejemplos por tipo:
- Bugfix con causa raíz clara (verificada con `CLAUDE.md §3.3`).
- Refactor interno sin cambiar contrato exportado.
- Ajustes de copy / textos visibles.
- Agregar campos opcionales a una entidad existente.
- A/B tests menores con rollback fácil.
- Actualizaciones de dependencias minor/patch.
- Estilos visuales / micro-interacciones.

#### 3.8.D — Verificación final del archivo 15

Relee `15-CONSEJO-EXTERNO.md` entero y confirma:
- `§0` rellenado, sin `<rellenar>`.
- `§2.2` con 3-7 casos concretos del proyecto, sin `<rellenar>` (lo que NO aplica debe estar como `n/a` explícito).
- `§2.3` con mínimo 4 casos rutinarios concretos.
- `§3` matriz de tier intacta (no la tocaste).

Si quedó algún `<rellenar>` sin sustituir, vuelve y termínalo. Esta sección NO se pasa medio rellena.

---

## FASE 3.9 — Barrido anti-vacíos (escaneo final del cerebro)

> **Razón de existir**: los placeholders están dispersos en distintas notaciones
> (`<rellenar>`, `_(rellenar)_`, `_(ej. ...)_`, `<NOMBRE-PROYECTO>`, `<pendiente>`).
> Es fácil dejar uno olvidado tras rellenar el bloque "obvio". Este barrido los
> cosecha todos antes de la validación.

### 3.9.1 — Grep exhaustivo de todo lo que parece template

Corre este grep desde la raíz del proyecto (ajustar el comando según el shell):

```bash
grep -rn -E '_\(rellenar|<rellenar>|_\(ej\.|<NOMBRE-PROYECTO>|<pendiente|PLANTILLA|RELLENAR AL INSTALAR' \
  CLAUDE.md docs/ 2>/dev/null
```

> En PowerShell:
> ```powershell
> Get-ChildItem -Path CLAUDE.md, docs -Recurse -Include *.md | Select-String -Pattern '_\(rellenar|<rellenar>|_\(ej\.|<NOMBRE-PROYECTO>|<pendiente|PLANTILLA|RELLENAR AL INSTALAR'
> ```

### 3.9.2 — Tabla de decisión por cada match

Para CADA línea que devuelva el grep, decide UNO de estos 3 caminos:

| Caso del match | Acción |
|---|---|
| **Es un dato que SÍ puedes verificar leyendo el repo** (stack, branch, framework, archivos) | Reemplaza el placeholder con el dato real. |
| **Es un dato que NO puedes verificar solo** (decisión del cliente, propósito de negocio, criterio editorial) | Reemplaza con `<pendiente: confirmar con el cliente — <qué falta>>` Y añade a `10-CORTO-PLAZO` como TODO-NN explícito. |
| **Es legítimamente vacío** (tabla de ADRs, lecciones, cuarentena) | Déjalo como está. Estos son los aceptables: `_(sin entradas — primera tarea aún no cerrada)_`, `_(vacío)_` en tablas de `_legacy/README` y `99-HISTORIAL`, `_(vacío — apender lecciones a medida que surjan)_` en `30-LECCIONES`. |

### 3.9.3 — Placeholders concretos esperados (lista de control)

Los siguientes están en el template y todos deben quedar resueltos:

| Archivo | Línea aprox. | Qué sustituir |
|---|---|---|
| `CLAUDE.md` | Título | `<NOMBRE-PROYECTO>` → nombre real del proyecto |
| `CLAUDE.md` | §1 entero | Bloque PLANTILLA → datos verificados de FASE 0 |
| `docs/05-ESTADO-GLOBAL.md` | Tabla | 4 `_(rellenar)_` → valores reales (versión/cache, branch, prod, deploys) |
| `docs/20-MEMORIA-ESPACIAL.md` | Toda la tabla "Si buscas" | Mínimo 5 filas reales, NO ejemplos genéricos |
| `docs/20-MEMORIA-ESPACIAL.md` | "Estructura del repo" | Bullets `_(ej. ...)_` → bullets reales |
| `docs/20-MEMORIA-ESPACIAL.md` | "Estructura de carpetas" | Tabla con carpetas reales del proyecto |
| `docs/20-MEMORIA-ESPACIAL.md` | "Flujos de datos" | Diagrama real o `_(pendiente de mapear — sin código aún)_` explícito |
| `docs/20-MEMORIA-ESPACIAL.md` | "Módulos de alto blast radius" | Lista real o `n/a` si proyecto pequeño |
| `docs/20-MEMORIA-ESPACIAL.md` | "Schema de datos" | Si hay DB: tablas/colecciones reales. Si no: `n/a` explícito |
| `docs/20-MEMORIA-ESPACIAL.md` | "Convenciones espaciales" | Mínimo 2 convenciones reales o `n/a` |
| `docs/15-CONSEJO-EXTERNO.md` | §0 | Provider activo (FASE 3.8.A) |
| `docs/15-CONSEJO-EXTERNO.md` | §2.2 | 3-7 casos concretos (FASE 3.8.B) |
| `docs/15-CONSEJO-EXTERNO.md` | §2.3 | Mínimo 4 casos rutinarios (FASE 3.8.C) |

**Re-corre el grep tras los edits**. Si vuelve a devolver matches que no sean los legítimamente vacíos de la columna 3, hay trabajo pendiente.

### 3.9.4 — Coherencia entre nodos (chequeo manual final)

Antes de pasar a FASE 4, confirma:

- ¿`CLAUDE.md §1` y `20-ESPACIAL "Estructura del repo"` cuentan la MISMA historia sobre el stack? (Si difieren, una está stale.)
- ¿`05` declara la branch correcta según lo detectado en FASE 0? (Verifica con `git branch --show-current`.)
- ¿`15 §2.2` menciona decisiones que sí tienen sentido en el stack de `§1`? (Si §1 dice "landing estática" pero §2.2 habla de "schema de base de datos", hay desconexión.)
- ¿`10` `Foco actual` describe el estado actual real, no la plantilla de bootstrap?

---

## FASE 4 — Cableado de hooks y git

### 4.1 — Activar el hook git (con detección de config previa)

**ANTES de configurar nada**, leer la config actual:

```bash
git config --get core.hooksPath
```

Tres casos posibles:

**Caso A — devuelve vacío (no configurado)**: el camino limpio. Setear sin más:
```bash
git config core.hooksPath githooks
```

**Caso B — devuelve `githooks`**: ya estaba configurado a la ruta que queremos. No hacer nada.

**Caso C — devuelve otra cosa** (ej. `.husky`, `.git-hooks`, `hooks/`): **PARAR y preguntar al usuario** (no pisar config previa). Opciones a presentar:

- **Mantener su ruta** (`<ruta-detectada>`): mover nuestro `githooks/pre-commit` a `<ruta-detectada>/pre-commit`, aplicando la lógica de mergeo de FASE 2.4 si ya había un `pre-commit` allí. No tocar `core.hooksPath`.
- **Cambiar a `githooks/`**: el usuario asume que los hooks previos en `<ruta-detectada>` dejan de ejecutarse hasta que los migre. Solo elegir esto si el usuario lo confirma explícitamente.

Si la respuesta no es trivial, **escribir el cambio en `10-MEMORIA-CORTO-PLAZO.md`** como TODO-NN: "verificar que los hooks de `<ruta-detectada>` siguen ejecutándose tras la migración".

**Si el proyecto NO es repo git aún**: NO hagas `git init` solo. Avisa al usuario y deja `githooks/pre-commit` en su sitio para cuando él inicialice git.

### 4.2 — Verificar permisos del pre-commit (Unix/Mac)

```bash
chmod +x githooks/pre-commit
```

En Windows no hace falta — Git for Windows ejecuta el script vía `sh`.

### 4.3 — Verificar que `node` está en PATH

```bash
node --version
```

Si no está disponible, el hook se salta (no rompe), pero el cerebro pierde su validación automática. Avisa al usuario.

---

## FASE 5 — Validación obligatoria

Corre el linter:

```bash
node scripts/brain-check.mjs
```

Salida esperada: `✅ CEREBRO SANO`. Si hay warnings:

- **"huérfana"** → la neurona no está registrada en `CLAUDE.md §0` (o en `40-LOBULOS` si es lóbulo hijo). Añadir fila.
- **"capacidad excedida"** → alguna neurona pasó el tope (§G.5). Recortar.
- **"hojas inexistentes"** → el `CLAUDE.md` referencia un `docs/X.md` que no existe. Crear o quitar la ref.
- **"L-NN colgante"** → una ref usada no está definida en `30-LECCIONES`. Definir.

**No declares la instalación completa hasta que `brain:check` salga SANO.** Itera hasta lograrlo.

---

## FASE 6 — Limpieza

- **Mover `INSTALACION.md` a `docs/INSTALACION-CEREBRO.md`** (NO borrarlo): así queda como referencia en el cerebro para futuras reinstalaciones, comparaciones de versión, o auditoría de "¿qué hizo Claude cuando instaló esto?". Añadir su fila al final de la tabla §0 de `CLAUDE.md`:
  ```
  | 📖 **Manual del cerebro** | `docs/INSTALACION-CEREBRO.md` | ❌ on-demand | Protocolo de instalación + reinstalación + migración entre versiones del template. Consulta al actualizar la versión del cerebro. |
  ```
- Si copiaste el `package.json` de la plantilla por error (proyecto ya tenía uno), restaurar el original con el script `brain:check` añadido.
- **Verificar que `<!-- brain-template-version: 1.0.0 -->` quedó como primera línea del `CLAUDE.md` instalado** (sin él, no hay forma de saber qué versión está instalada en una futura migración).

---

## FASE 7 — Reporte final al usuario

Imprime un resumen claro:

```
✅ CEREBRO NEURONAL INSTALADO (template v1.0.0)

📁 Archivos nuevos:
   - CLAUDE.md (con §1 rellenado: <stack detectado>)
   - docs/{00,05,10,15,20,30,40,99}-*.md + skills-inventory.md
   - docs/INSTALACION-CEREBRO.md (manual de referencia, movido)
   - scripts/brain-check.mjs
   - githooks/pre-commit
   - skills/ (74 skills portables)
   - .claude/settings.json (hook SessionStart agregado)

🛰️ Provider externo configurado (Trigger 🛰️): <lo respondido en 0.5.1>
   → registrado en `docs/15-CONSEJO-EXTERNO.md §0`.

🔄 Archivos mergeados (no pisados):
   - <lista si aplica>

📦 Archivos cuarentenados en _legacy/:
   - <lista si aplica>

🪝 Hook git: <Caso A: configurado a githooks/ | Caso B: ya estaba | Caso C: mantuvimos <ruta-previa>>

🧠 Validación: brain:check → ✅ SANO

⚠️ Pendiente de tu confirmación:
   - <campos del §1 que quedaron como <pendiente>>
   - <decisiones que difiero al cliente>

🚀 Próximos pasos sugeridos:
   1. Revisa `CLAUDE.md §1` y completa los campos pendientes.
   2. Verifica `docs/20-ESPACIAL` (el mapa de arquitectura que armé).
   3. Si necesitas reinstalar o migrar a una versión nueva del template: `docs/INSTALACION-CEREBRO.md`.
   4. Para usar el cerebro: abre una sesión nueva, Claude leerá CLAUDE.md+05+10 automáticamente.
```

---

# 🚨 REGLAS DURAS — VIOLAR CUALQUIERA ABORTA LA INSTALACIÓN

1. **NO pises** un `CLAUDE.md`, `package.json`, `.claude/settings.json`, `githooks/*` o `docs/*.md` existente sin haberlo cuarentenado primero.
2. **NO inventes** datos para `§1`, `05`, `20`, `15 §2.2/§2.3`. Si no los puedes verificar leyendo el repo, marca `<pendiente: confirmar — qué falta>` Y crea un TODO-NN en `10`.
3. **NO crees** lóbulos hijos vacíos (`41`/`42`/…). Nacen on-demand con contenido real (§G.4).
4. **NO copies** historial, lecciones, ADRs o referencias a OTROS proyectos. El cerebro arranca limpio.
5. **NO toques** `node_modules/`, `.git/`, `.env*` (excepto `.env.example` para LEER), `dist/`, `build/`.
6. **NO ejecutes** `npm install`, `git init`, `git commit`, `git push` sin consentimiento explícito del usuario.
7. **NO modifiques** `git config` más allá de `core.hooksPath` (que es local al repo) — y solo si FASE 4.1 caso A/B lo permite.
8. **NO declares "instalado"** sin que: (a) el barrido anti-vacíos FASE 3.9 esté limpio (cero `<rellenar>` no resueltos), (b) `brain:check` haya impreso `✅ CEREBRO SANO`. Ambas obligatorias.
9. **Si dudas** entre 2+ opciones no triviales (ej. "el proyecto tiene 2 posibles branches de prod"), **PREGUNTA** una vez con opciones concretas. NO supongas.
10. **Si el proyecto está vacío del todo** (sin código, sin git, sin nada), avisa al usuario: el cerebro se instala igual, pero `§1`/`20`/`15 §2.2` quedarán mayormente como `<pendiente: confirmar>` hasta que haya proyecto que describir. NO inventes contenido por la presión de "completar".
11. **El cerebro debe quedar adaptado, no plantilla**: tras la instalación, si alguien lee `CLAUDE.md §1`, `docs/20-ESPACIAL`, `docs/15 §2.2` debe entender el proyecto SIN haber leído el código. Si esos archivos siguen sonando a "ejemplos genéricos de cualquier proyecto", fallaste.

---

# 🧬 Filosofía del cerebro (contexto para entender qué hace)

Este cerebro NO es burocracia documental. Es una herramienta de **economía de
contexto**: hace que Claude (que olvida todo entre sesiones) gaste sus tokens
en RESOLVER en vez de en RE-INVESTIGAR. Cada neurona tiene un trigger
preciso para que solo se cargue cuando realmente aporta. Cada lección
escrita HOY le ahorra al próximo "tú" repetir el error mañana.

**Boot de cada sesión** (`CLAUDE.md §G.1`): solo se auto-cargan `CLAUDE.md` + `05` + `10`. El resto está on-demand por triggers (§G.2). Lo verificable se delega al linter (`brain:check` corre en SessionStart + pre-commit). La doctrina sola no basta — el determinismo del linter es el respaldo.

**Triggers** (§G.2): 🔴 error/saturación → `99` · 🟡 desorientación → `20` · 🧪 op riesgosa → `30` · 🟢 "por qué" histórico → `00`→`99` · 🔵 auditoría especializada → Skill → `40` → lóbulo hijo · 🛰️ decisión cara de revertir → `15` (red team).

**Reflejos** (§G.4, vinculantes): Captura · Neurogénesis · Frescura · Higiene (GC) · Auto-auditoría · Auto-mejora · Autocrítica · Desafío Crítico · Cierre · Sugerencia de Skills.

**Límite de guardián** (§G.4): apendar antes que sobrescribir; verificar antes que asumir; cuarentenar antes que borrar. Un cerebro equivocado es peor que uno incompleto.

---

> Fin del protocolo. Si llegaste aquí ejecutando: deberías estar en FASE 7 con
> el cerebro validado. Si llegaste leyendo: ya conoces el plan completo.
