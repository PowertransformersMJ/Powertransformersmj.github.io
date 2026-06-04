# 📚 99 — HISTORIAL DE DECISIONES (ADRs · Largo Plazo)

> **Nodo neuronal: Largo Plazo (ADRs cerrados).** El "por qué" detrás de cada
> decisión funcional del proyecto, en orden cronológico de cierre.
>
> **Cómo leerlo (regla de oro `CLAUDE.md §0`)**: NUNCA leer entero. Usar siempre
> `Read offset=<línea> limit=~150` con la línea sacada de `docs/00-INDICE.md`.
> Si crece >50k líneas, shardar en `99a/99b` por rango de §.
>
> **Cómo crece (`CLAUDE.md §G.3`)**: cada vez que una tarea se cierra por completo:
> 1. apender un `## NN. ADR-NNN — <título>` al final de este archivo (formato §2 de `CLAUDE.md`),
> 2. agregar la fila `| §NN | <tema> | <línea> |` en `docs/00-INDICE.md`,
> 3. marcar el `TODO-NN` correspondiente como ✅ con link al § en `10-CORTO-PLAZO`.
>
> El linter `brain:check` valida que cada `## NN.` aquí tenga fila en el índice
> y que las refs `L-NN`/`M-NN` usadas estén definidas en `30-LECCIONES`.

---

## 1. ADR-001 — Instalación del cerebro neuronal documental sobre SGM·TRANSPOWER

> Pedido del director (2026-06-04): *"Revisa INSTALACION.md y ejecuta las 7 fases
> para instalarlo, adaptándolo a este proyecto. No declares instalado hasta que
> brain-check salga SANO y el barrido anti-vacíos esté limpio."*

**1.1 Causa raíz / motivación** — El `CLAUDE.md` previo era un monolito de 3081 líneas que se auto-cargaba entero en cada sesión → saturación de contexto y memoria no curada. Se adopta el modelo neuronal (router liviano + neuronas on-demand) para acotar la auto-carga a `CLAUDE.md` + `05` + `10`.

**1.2 Solución estructural** — Trasplante del template (v1.0.0) adaptado con datos REALES del proyecto: router `CLAUDE.md` (230 líneas) + 8 neuronas (`00,05,10,15,20,30,40,99`) + manual `INSTALACION-CEREBRO.md` + catálogo `skills-inventory.md` + tooling (`scripts/brain-check.mjs`, `githooks/pre-commit`, `skills/`). Las 18 lecciones `L-01..L-18` y el `§1` se cosecharon del código y del legacy real. `§4` cache/SW se omitió a propósito (`sw.js` es kill-switch, sin PWA activa).

**1.3 No-regresión** — El monolito previo se CUARENTENÓ intacto en `_legacy/CLAUDE-previo.md` (no se borró, límite de guardián). Ningún archivo de producto del proyecto fue tocado. `package.json` solo SUMÓ el script `brain:check`.

**1.4 Tests / verificación** — `node scripts/brain-check.mjs` → ✅ CEREBRO SANO (EXIT=0): cero huérfanos, capacidades bajo tope, refs `L-/M-` (18/18) resueltas, 11 hojas referenciadas existen. Barrido anti-vacíos (grep de placeholders) limpio. Frescura `05` ↔ git real (`main`, `e372c6c` PR #92) verificada. 15 hojas técnicas pre-existentes confirmadas como referenciadas (sin huérfanas).

**1.5 Anti-patterns evitados** — No se borró conocimiento histórico (cuarentena > delete, `L-18`). No se declaró "instalado" antes de cumplir los dos criterios duros. No se versionó nada como plantilla vacía (anti-fragmentación §G.4).

**1.6 Archivos** — *Nuevos*: `_legacy/`, `docs/{00,05,10,15,20,30,40,99}*.md`, `docs/INSTALACION-CEREBRO.md`, `docs/skills-inventory.md`, `githooks/`, `scripts/brain-check.mjs`, `skills/`. *Modificados*: `CLAUDE.md` (monolito → router), `package.json` (+script). *INTACTOS*: todo `assets/`, `pages/`, `admin/`, `functions/`, `firestore.*`, `storage.rules`.

**1.7 Doctrina aplicada + secuela** — Reflejo de Cierre + Auto-auditoría (§G.4). Secuela: bug `M-01` detectado y corregido en la auditoría post-instalación (`brain-check.mjs` usaba `2>NUL` de Windows → ensuciaba la raíz con archivo `NUL`; corregido a `2>/dev/null`). `TODO-03` detectado stale (PDFs ya borrados por `18a25c6`) → marcado resuelto. Sin cache bump (no aplica §4).
