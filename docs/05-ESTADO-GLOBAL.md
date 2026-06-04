# 🩺 05 — ESTADO GLOBAL (Heartbeat · Snapshot de salud del sistema)

> **Nodo neuronal: signos vitales.** Se **AUTO-CARGA** (junto a `CLAUDE.md` +
> `10-CORTO-PLAZO`). Responde *"¿en qué estado está el sistema AHORA, antes de
> tocar nada?"*. Lo lee el **Reflejo de Auto-auditoría (`CLAUDE.md §G.4`)** al arrancar.
>
> **Mantenimiento (Reflejo de Frescura §G.4)**: actualizar al cambiar versión,
> branch, build o al detectar/resolver un riesgo. **Tope ~25 líneas (§G.5)** — es un
> tablero, no una bitácora.

| Señal | Valor |
|---|---|
| **Build** | 🟢 tests verdes (`node --test`) + lint HTML limpio al último cierre. |
| **Versión** | `v2.4.1` (último tag) · cerebro neuronal v1.0.0 instalado y commiteado local (`8a6db90`, ADR-001). Docs de cierre (00/05/10/99) en commit aparte pendiente (ver `10`). |
| **Cache / SW** | n/a — `sw.js` es kill-switch (PWA offline desactivada a propósito). |
| **Branch activa** | `main` (verificado 2026-06-04). `main` solo se toca con pedido explícito. |
| **Producción** | `main` → auto-deploy GitHub Pages (`pages.yml`) en `https://powertransformersmj.github.io/`. Último commit `e372c6c` (Merge PR #92). |
| **Deploys backend pendientes** | ⚠️ los 4 canales Firebase (rules / indexes / storage / functions) NO tienen auto-deploy — el director los corre a mano en su Mac (ver `CLAUDE.md §1` + `docs/30-LECCIONES.md`). |

## ⚠️ Flags de riesgo activos
- **Push restringido** (L-01): runtime da 403; único canal es `git push https://USER:TOKEN@github.com/...` con PAT inline. **Deploys Firebase manuales** (L-09): tocar `rules`/`indexes`/`storage`/`functions` exige avisar `firebase deploy` en el mismo turno (`CLAUDE.md §1`).

## 🧩 Sub-sistemas (resumen)
- Frontend estático (HTML/CSS/JS vanilla) ✅ · Firebase (Auth + Firestore + Storage) ✅ · Cloud Functions desplegables (F32) ✅ · Vercel `/api` ✅ · PWA/SW ⛔ desactivada.
