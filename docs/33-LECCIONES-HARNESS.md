# 🛠️ 33 — LECCIONES · Claude Code, entorno y herramientas (shard de `30`)

> **Nodo hijo de `30-LECCIONES`** (§G.5 sharding, creado 2026-09-01 al volver a pasar el tope).
> Aquí vive lo que muerde por el ENTORNO y no por el código del proyecto: el harness de Claude Code,
> las skills, la consola de esta Mac y los workflows multi-agente (el navegador del Ingeniero y el banco → `36`, desde `§149`).
> Se lee on-demand (trigger 🧪 Experiencia) **antes de lanzar trabajo largo con agentes o de
> fiarse de un barrido por consola**.

---

### L-19 · Activar una skill repo-only = copiar su `SKILL.md` a `.claude/skills/<name>/` + reiniciar
**Disparador**: skill que solo existe en `skills/` del repo (NO es la fuente de lo cargado; el bundle `anthropic-skills:*` viene del entorno). · **Cicatriz**: `<name>` = el `name` del frontmatter, NO la carpeta fuente (ej. `brutalist-skill` → `industrial-brutalist-ui`; `grep -m1 '^name:' SKILL.md`); escaneo solo en boot → el director debe reiniciar; bundles multi-skill anidados se copian por subcarpeta; plugins (`code-modernization`) y subagentes (`code-simplifier`) sin `SKILL.md` no cargan; re-stagear skills del bundle = colisión de `name`. · **Regla**: copiar la carpeta a `.claude/skills/<name>/`, validar con `find .claude/skills -name SKILL.md` + chequear `name`+`description`. `.claude/` está gitignorado (`.gitignore:22`) → copia local-only; al re-clonar, re-correr el copy (la fuente tracked vive en `skills/`). (Ref: ADR-002, `99`.)

### L-70 · El `grep` de esta Mac es un envoltorio de **ugrep**, no GNU/BSD grep
**Disparador**: barrido por `grep` para afirmar "no queda ninguna referencia a X". · **Cicatriz**: `grep --version` → `ugrep 7.8.4`; la shell define una función `grep` que ejecuta `ARGV0=ugrep claude -G --ignore-files --hidden -I --exclude-dir=.git …`. Semántica distinta a la esperada (`-I` salta binarios, excluye VCS, otras banderas largas). · **Regla**: para un barrido del que dependa una AFIRMACIÓN, correr `/usr/bin/grep` (o `git grep`) y comparar; `command grep` también salta la función. **Verificado 2026-08-21**: la afirmación heredada de que ugrep se salta lo gitignored (2 aciertos vs 38) **NO se reprodujo** en prueba controlada — el envoltorio sí encontró el archivo ignorado. Se conserva el hecho comprobado (no es GNU grep) y se marca lo no reproducido, para no perseguir un fantasma. Ver `99 §68`. · **zsh de esta Mac** (10-05): `echo ====` («=== not found»), un comodín sin coincidencias («no matches found», p. ej. `--include=*.js`) y `$v[…]` entre comillas dobles (subíndice) cortan la cadena: citar (`'===='`, `'*.js'`, `${v}[`) o `bash -c '…'` (`99 §87`). No existen `timeout` ni `gtimeout` (código 127, `§122`): usar `run_in_background`.

### L-71 · Un array pasado a `args` de un Workflow llega SERIALIZADO como string
**Disparador**: parametrizar un workflow con una lista (rutas, dimensiones, ítems). · **Cicatriz**: se pasó el array como string JSON y en el script `args` llegó siendo UN string; `args.filter`/`args.map` revientan. Estuvo años como callejón en `10` **sin fuente** — la auditoría §68 lo obligó a nacer con ancla (M-04). · **Regla**: `args` recibe el VALOR JSON real (`args: ["a.ts","b.ts"]`), nunca su serialización; si llega un string donde esperas lista, es esto. Ver `99 §68`. · **Ojo** (`§105`): un `cd ../brain-private` en la sesión principal dejó allí la carpeta de trabajo y el siguiente workflow arrancó en la bóveda: rutas ABSOLUTAS y `git -C` para la bóveda.

### L-77 · Un workflow de horas no sobrevive: se duerme el equipo o se acaba la cuota
**Disparador**: lanzar un workflow multi-agente grande y dejarlo correr. · **Cicatriz** (2026-08/09, `99 §70/71`): **tres workflows, dos muertos**. El primero (13 agentes: 6 dimensiones × escéptico + síntesis) cayó con 7 de 9 agentes en error por el **límite MENSUAL de gasto** de la cuenta; el tercero (3 agentes de diseño) corrió **3 h 27 min** y murió entero porque **la Mac se durmió** — `API Error: Your computer went to sleep mid-response`, 0 resultados de 800 k tokens. El único que cerró fue el de en medio: **3 revisores sobre trabajo YA HECHO**, y fue justo el que encontró el bloqueante. · **Regla**: dimensionar por DURACIÓN, no solo por número de agentes — un workflow que puede tardar horas está expuesto a que la máquina se suspenda y no hay reintento que lo salve. Preferir **varios pequeños sobre trabajo terminado** a uno grande sobre trabajo por hacer: rinden más y lo que se pierde al caer es menos. Antes de uno largo, comprobar que el equipo no se suspenderá. Y ante un techo de gasto, el trabajo determinista se hace directo: quemar 1,3 M tokens sin resultado no es diligencia. Ver `99 §71`. **Reincidió 09-24/25** (`§95.4`, `§96`): cortó a los verificadores. Lo que quede sin revisión independiente se le dice al Ingeniero y va al ADR.

### L-98 · Un round-trip por Python o por el editor puede dejar caracteres de control LITERALES en el fuente
**Disparador**: escribir con `Write`/heredoc un archivo que lleva escapes `\u0000`…`\u001F` en un regex, y luego reescribirlo con un script. · **Cicatriz** (`99 §83.7`): `fichas_borrador.js` quedó con NUL, backspace, VT, FF y DEL **de verdad** dentro del regex de limpieza. Los tests pasaban —un carácter de control literal dentro de una clase de caracteres funciona igual— así que nadie lo vio hasta que un `Read` mostró `[ --]`. · **Regla**: tras un round-trip, barrer lo tocado con `LC_ALL=C grep -c $'[\001-\010\013\014\016-\037\177]'`; y escribir esos escapes como `\u00XX` explícitos, nunca confiar en que el harness los preserve.

### L-111 · Desde un worktree, `../brain-private` no existe: el pull falla y `brain:check` sale SANO sin comparar
**Disparador**: tocar el kernel o la bóveda desde una sesión en `.claude/worktrees/<nombre>/`. · **Cicatriz** (`99 §120`):
`npm run brain:pull` apunta a `../brain-private/kernel/pull.mjs`, que desde ahí no existe; y `brain:check` dijo «kernel
íntegro (canónico no clonado)» y «archiveDir no existe — gate omitido»: verde **sin** comparar el kernel con el canónico ni
revisar la bóveda. · **Receta**: `node ~/Desktop/GitHub-MJ/brain-private/kernel/pull.mjs` con la raíz del worktree como
carpeta actual (el pull escribe en la carpeta desde donde se corre); comprobar a mano con `cmp scripts/X.mjs <canónico>/X.mjs`; y para
repartir al otro repo, un árbol temporal `git worktree add --detach <tmp> origin/main` — allí tampoco corren sus candados
de nombres, así que solo se sube el kernel. [HONOR] · **Y una conversación de más de 48 h** (10-05, `99 §139`): si solo hubo compactaciones y ningún SessionStart, el pre-commit dice «COMMIT BLOQUEADO: presupuesto de boot excedido» aunque el arranque quepa; es el canario de `boot-gate.mjs` (`docs/.boot-marker` > 48 h). Los ganchos sí viven: `node scripts/session-handoff.mjs --boot-echo` y reintentar (no usar `BOOT_CANARY_SKIP`).

## 🌐 Chrome del Ingeniero, extensión y banco → hija `36`

> L-62, L-92, L-94 y L-105 viven en [`36-LECCIONES-CHROME-BANCO.md`](36-LECCIONES-CHROME-BANCO.md) (§G.5, 2026-10-07, `99 §149`).
