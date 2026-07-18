# 🔬 TRIAJE — Rescate del cerebro viejo (migración brain-kit v1.0 · 2026-07-18 · ADR-051)

> Gate F7 del runbook `brain-kit/INSTALACION-FABLE.md`: censo del 100% de `_legacy/` con veredicto
> por archivo. Veredictos: **RESCATADO** (migrado al nodo destino) · **STALE** (el repo actual lo
> contradice — no migrar, la contradicción anotada) · **ARCHIVO** (queda aquí como referencia, sin
> valor operativo vigente). NADA se borró. Verificación: 7 agentes de lectura (workflow
> `rescate-cerebro-f7`) + decisiones de triaje del instalador.

## Censo y veredictos — `_legacy/cerebro-anterior/`

| Archivo/sección | Qué contiene | Veredicto | Destino |
|---|---|---|---|
| `CLAUDE-viejo.md` | Router del cerebro v1.0.0 (identidad, doctrinas §3, gobernanza §G, mapa de nodos) | **RESCATADO** (reescrito) | Nuevo `CLAUDE.md` v1.1.0: §1 identidad re-verificada + entrevista F3a; §2 política git NUEVA (Claude push/merge/deploy — reemplaza "el push lo hace el director"); doctrinas §3.1-3.5 conservadas + §3.6/3.7 del kit |
| `docs/99-HISTORIAL-ADR.md` (50 ADRs, 199KB) | Historial completo de decisiones ADR-001→050, formato canónico 7 puntos | **RESCATADO ÍNTEGRO** | `docs/99-HISTORIAL-ADR.md` §1–§50 sin reescribir (ya estaban en formato destino; renumerar habría roto todas las refs cruzadas §NN/L-NN) + §51 nuevo (esta migración) |
| `docs/00-INDICE.md` | Ruteo semántico curado + 50 filas §→línea + doctrinas | **RESCATADO** (condensado 18.1k→~15k chars) | `docs/00-INDICE.md` formato v1.1.0; filas §41-§50 recortadas a hooks; fila §51 añadida; reconciliado con `npm run brain:index` (51/51) |
| `docs/30-LECCIONES.md` (59 lecciones, 77.5k chars) | Experiencia: L-01..L-58 + M-01 con cicatrices completas | **RESCATADO** (condensado a ~40k chars) | `docs/30-LECCIONES.md`: TODAS las 59 conservadas (formato Disparador·Cicatriz·Regla + puntero "(Full: `_legacy §…`)" al texto completo aquí). **L-01 REESCRITA** (política git nueva F3a). + L-59/60/61 rescatadas del monolito previo |
| `docs/20-MEMORIA-ESPACIAL.md` | Mapa espacial: árbol, flujos, schema, módulos del tablero | **RESCATADO** (verificado contra el repo) | `docs/20-MEMORIA-ESPACIAL.md` con **10 correcciones STALE** (ver sección abajo) + catálogo nuevo de las 16 hojas del dueño + `docs/pruebas/` |
| `docs/05-ESTADO-GLOBAL.md` (10k chars) | Signos vitales inflados (celda Build de ~9k chars duplicando ADRs) | **RESCATADO** (reescrito desde cero) | `docs/05` nuevo ≤4k chars con señales VERIFICADAS hoy (`npm test` 1185/1185 · `git fetch`: PRs #181–#187 mergeadas). El detalle histórico ya vivía en `99` — no se perdió nada |
| `docs/10-MEMORIA-CORTO-PLAZO.md` | Foco FP/tan δ + TODO-01/02/08/10 + callejones + bitácora | **RESCATADO** (depurado) | `docs/10` nuevo: TODO-01(Fase 9 kit) · viejos TODO-01→02, TODO-02→03, TODO-08→04, TODO-10→05 (verificados vigentes: script migrate existe; skills transformadores YA commiteadas) · validación APP→06 · bóveda→07 · PAT→08. Callejones FP/tan δ conservados. **STALE detectado**: "PR pendiente de abrir" — ya estaba mergeado (PRs #185-#187) |
| `docs/15-CONSEJO-EXTERNO.md` | Protocolo 2ª opinión adversarial (provider ChatGPT/GPT-5, flujo manual vía el Ingeniero, matriz de tiers, anti-anclaje) | **RESCATADO ÍNTEGRO** | `docs/15-CONSEJO-EXTERNO.md` (copiado tal cual — vigente; el flujo es manual y no depende de nada local) |
| `docs/40-LOBULOS-DOMINIO.md` | Registry de lóbulos 41-50 + workflow Trigger 🔵 + skills creadas | **RESCATADO** (1 fix) | `docs/40` copiado + corregida la línea stale "replicar a las 12 restantes" (las 13 ya existen, verificado) |
| `docs/49-PRUEBAS-ELECTRICAS.md` | Lóbulo de ensayos: 13 skills + valores `⚠️ verificar` + hallazgos de auditorías | **RESCATADO ÍNTEGRO** | `docs/49` (13 carpetas de skills verificadas presentes; valores ⚠️ siguen esperando al Ingeniero — TODO-04) |
| `docs/50-TRANSFORMADORES-POTENCIA.md` | Lóbulo del EQUIPO: 11 skills, frontera con 49 | **RESCATADO ÍNTEGRO** | `docs/50` (11 carpetas verificadas presentes; validación de arquitectura — TODO-05) |
| `docs/INSTALACION-CEREBRO.md` | Protocolo de instalación del template v1.0.0 VIEJO | **STALE / SUPERSEDED** | No migra: describe el paquete viejo ("CEREBRO NUEVO/", 74 skills). Lo reemplaza `brain-kit/INSTALACION-FABLE.md` + este TRIAJE |
| `docs/skills-inventory.md` | Catálogo viejo de skills del repo + "verdad del wiring" | **RESCATADO** (regenerado) | `docs/skills-inventory.md` nuevo generado desde frontmatter reales: 38 kit + 5 agents + 76 carpetas del repo; conserva la advertencia "el repo NO es la fuente de las skills cargadas" (L-19) |
| `scripts/brain-check-viejo.mjs` + `githooks/pre-commit-viejo` + `claude-settings/settings-viejo.json` | Kernel viejo (linter 6 secciones, hook, hook de sesión) | **SUPERSEDED** | Reemplazados por kernel v1.2 (16 checks) + pre-commit del kit + settings con handoff. Quedan aquí como referencia |

## Censo y veredictos — `_legacy/` raíz (migración anterior, 2026-06-04)

| Archivo | Qué contiene | Veredicto | Destino |
|---|---|---|---|
| `CLAUDE-previo.md` (200KB, monolito pre-cerebro) | 14 reglas §0.1.2.* + historia de sesiones + gotchas UI | **RE-MINADO 2026-07-18** | Ya minado en 2026-06-04 (14 reglas → L-03..L-15). Spot-check de hoy encontró 6 piezas NO rescatadas → **L-59** (HEIC + padding en fotos), **L-60** (triage deploy con `curl`), **L-61** (glosario "tal cual" + invariante `.aqua-power-scene`), **TODO-08** (PAT viejo pendiente de REVOCAR — cabo de seguridad reportado al Ingeniero) |
| `README.md` | Aviso de cuarentena de la migración 2026-06-04 | **ARCHIVO** | Se conserva; este TRIAJE lo complementa |

## STALE del 20 viejo (contradicciones repo vs cerebro — conocimiento en sí mismas)

1. "Push solo con PAT inline" → flujo ADR-005 y ahora política F3a (Claude pushea). 2. "Rules/índices los corre el director a mano" → los deploya Claude (ADR-005). 3. "Tendencia en Fase 1" → F1-F3 consolidadas (`narrativaTendenciaIA` desplegada). 4. "15 documentos del dueño" → son 16 + `docs/pruebas/` (10 JSON). 5. "INSTALACION-CEREBRO vive en docs/" → vive en `_legacy/cerebro-anterior/`. 6. "`bloquesDeExtra` export del dominio" → es función LOCAL del shell. 7. "CF solo email/cron + extracción" → 4 exports en `functions/index.js`. 8. Schema omitía colecciones que `firestore.rules` define (`pruebas_electricas` + subcolecciones, `contramuestras`, `monitoreo…`). 9. "Render del tablero = 3 archivos" → creció (shell + 4 paneles + modal). 10. "scripts/ = migrate + brain-check" → también `audit-bloques-pruebas.mjs`. → Todas corregidas en el `docs/20` nuevo con marca `⚠️ corregido 2026-07-18`.

## Lo que NO se rescató y POR QUÉ (transparencia total)

- Prosa narrativa larga de las lecciones (ejemplos extensos, código inline): condensada; el texto completo sigue AQUÍ (punteros "(Full: `_legacy §…`)"). Cero lecciones eliminadas.
- Filas de bitácora del `10` viejo ya consolidadas en ADRs (§46-§50): eran duplicado del `99`.
- Celda "Build" de 9k chars del `05` viejo: duplicaba lo que `99 §28-§45` ya documenta (regla SSoT).
- `INSTALACION-CEREBRO.md`: protocolo del template viejo, reemplazado por el kit v1.0.

> 30 nuevo quedó en ~40.8k chars (cap 40k, zona ↗ "destilar"): aceptado conscientemente para no
> perder cicatrices; la poda fina queda para el GC de la Fase 9.
