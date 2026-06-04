# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Nodo neuronal: Memoria a Corto Plazo.** Junto con `CLAUDE.md` + `05-ESTADO-GLOBAL`,
> es de las primeras lecturas de cada sesión (Ignorancia Selectiva, `CLAUDE.md §G`).
> SOLO lo vivo: foco actual, pendientes abiertos, bitácora. Estado técnico → `05`.
>
> **Es la pizarra, no el archivo.** Al cerrar una tarea: consolidar a ADR (`99`) +
> fila en `00-INDICE`, extraer lecciones a `30`, y PODAR esto al foco vivo (GC §G.4).
>
> **Convención de handoff (relevo a ventana nueva)**: el "Foco actual" debe incluir
> **🚫 Callejones sin salida** — qué se probó que FALLÓ y NO reintentar, con el porqué.
> Le ahorra al próximo "tú" repetir errores ya descartados (relevo curado > `/compact`).

---

## 🎯 Foco actual

> 🧠 **Cerebro neuronal recién instalado** sobre SGM·TRANSPOWER (2026-06-04). El
> CLAUDE.md monolítico previo (3081 líneas) quedó cuarentenado en
> `_legacy/CLAUDE-previo.md` — sigue siendo la fuente histórica más rica (plan
> F0–F37, 14 reglas §0.1.2.*, handoff visual §9). El cerebro nuevo cosechó lo
> esencial en §1 + `05` + `20` + `30`; el resto se consulta on-demand desde el legacy.
>
> No hay tarea de producto en curso. Esperar pedido del director (feature, bugfix
> o deploy) y seguir el árbol de decisión `_legacy/CLAUDE-previo.md §7.2`.
>
> **🚫 Callejones sin salida**: (1) NO usar canales MCP/`git push` del runtime para
> escribir — dan 403; solo PAT inline funciona. (2) NO asumir que las reglas/índices
> Firebase están desplegados — el director deploya a mano.

---

## 📋 Pendientes abiertos (TODO-NN)

> Al cerrar uno: ✅ + link al ADR §NN, y retirarlo en la próxima poda.

| ID | Item | Estado | Bloqueo |
|---|---|---|---|
| **TODO-01** | Tipificar S03/S04/S05/S06 del contrato 4125000143 en Firestore (script `scripts/migrate/tipificar-suministros-fan-db.js`, correr `dryRun` primero) | 🔮 abierto | director corre el script en su Mac |
| **TODO-02** | Definir flujo de selección runtime FN-063 vs FN-050 para el contrato 4123000081 (pedido del director) | 🔮 abierto | requiere brief del director |
| **TODO-03** | Cleanup: PDFs `REMISION N.pdf` subidos por error al raíz del repo | ✅ resuelto (commit `18a25c6` "limpieza basura raíz · 25 archivos · ~9.4 MB") — verificado 2026-06-04: cero PDFs en raíz | — |

---

## 🔮 Contexto estratégico

- Plan v2.2 (F16–F37) **cerrado** en tag `v2.0.0`; ciclos de pulido hasta `v2.4.1`. El proyecto está en modo "features puntuales + bugfixes de campo", no en plan maestro.
- `_legacy/CLAUDE-previo.md` es el archivo de referencia histórica: contiene las 14 reglas permanentes §0.1.2.* (informes imprimibles, deep-clean Firestore, anti-datalist, integración cross-módulo, render con foto, etc.) que NO se perdieron — están condensadas en `30-LECCIONES.md`.
- Las skills viven en `skills/` (catálogo paralelo). El framework de auditoría se activa con el **Trigger 🔵** cuando el director pida análisis especializado.

## 📝 Bitácora (efímera)

- **2026-06-04** — Instalado el cerebro neuronal (7 fases). CLAUDE.md previo → cuarentena. Cosechado §1/05/20/30 con datos reales del proyecto.
- **2026-06-04** — Auditoría holística post-instalación: limpieza de `CEREBRO NUEVO/` (3.3 MB fuente redundante) + `NUL` (artefacto 0-byte). brain:check SANO, cero huérfanos, 15 hojas técnicas referenciadas, rutas del proyecto verificadas, frescura `05` ↔ git real OK. TODO-03 detectado stale → marcado ✅ (ya resuelto por commit `18a25c6`).
