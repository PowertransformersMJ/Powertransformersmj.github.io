# Cuarentena — override local stale de `comite-expertos` (2026-07-28, ADR-058)

`.claude/skills/comite-expertos/` era una copia LOCAL del 12-jun-2026 que hardcodeaba:
- `:96` "Provider externo activo: **ChatGPT — familia GPT-5**"
- `:100-101` "el modelo externo **NO ve** nuestro código ni el cerebro"  ← FALSO con Antigravity
- `:105` tiers `GPT-5.5 / 5.4 / 5.3 / 5.2 / mini`

Al oficializarse **Gemini vía Antigravity** en `docs/15-CONSEJO-EXTERNO.md`, este archivo
quedaba diciendo lo contrario que el nodo. La versión GLOBAL (`~/.claude/skills/comite-expertos/`)
es agnóstica de provider (delega en `docs/15`) y es la que debe ganar.

No se borró (§G.4, límite de guardián: cuarentenar, no borrar). Está fuera de la ruta de
carga de skills, así que ya no puede pisar a la global.

⚠️ `.claude/` está gitignorado: este movimiento NO viaja por git. Si se restaura el repo
en otra máquina desde GitHub, este override no existirá — que es justo lo deseado.
