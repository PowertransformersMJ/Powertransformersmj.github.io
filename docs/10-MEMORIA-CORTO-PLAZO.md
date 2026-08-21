# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Todo lo EJECUTADO (Fase 9 + fase CONECTAR) → `99 §52.8-52.14`. Crudos → bóveda
> `~/Desktop/GitHub-MJ/brain-private/sgm-transpower/research-archive/` (`2026-07-21-fase9/` + `2026-07-22-decision-rbac-f28/`).

---

## 🎯 Foco (2026-08-20) — FICHAS TÉCNICAS: PORT COMPLETO + AUDITADO (ADR-064/065/066)

> Fichas Técnicas: port completado (ADR-064/065), validado en vivo (TODO-30) y auditado por 6
> auditores con su remediación (ADR-066). **ADR-067**: barrido de las 32 páginas — el sitio mostraba
> datos inventados sin rotularlos y escondía los reales del Ingeniero.
> **1.387 pruebas.** ⚠️ TODO-34 (falta el índice de salud) · TODO-35 · TODO-36.

### 🔴 SIN PODER CERRARSE (de ADR-063; detalle → `99 §63`)
> **(A)** Proteger `main` (config de GitHub) · **(B)** ¿reescribir el historial de git? irreversible ·
> **(C)** tres decisiones suyas: tope en `/alertas_reconocidas`, `defer` en Chart.js, barras de progreso.

### ▶️ TAREA VIVA: el import de Salud de Activos — PASO DEL INGENIERO
> Simulación ya corrida con SU archivo (`~/Documents/2026/PSM 2026/Salud de Activos 2026 Actualizado
> 01 de junio.xlsx`): 270 filas · 0 errores · **9 nuevos, 199 actualizados, 62 omitidos** (las hojas
> de servicio y respaldo no traen campos obligatorios). Falta pulsar **IMPORTAR EN FIRESTORE**: el
> clasificador me bloquea esa escritura. Repetirlo es seguro (busca por matrícula y fusiona).
> Cierra TODO-34 y llena salud, matriz de riesgo y priorización.
> 📌 El Ingeniero pidió **resumen de pendientes actualizado en CADA turno**.

### 🔴 Acciones que SOLO el Ingeniero puede hacer
> **(A) GitHub Support** "remove sensitive data" (purga `refs/pull/*`). **(B) Revocar PATs viejos** (TODO-08).
> **(C) Entregar capítulo PRUEBAS ELÉCTRICAS del MO** (tablas per-clase — el anexo Salud de Activos ya
> entregado NO las trae) y ratificar TODO-04 (`49 §Validación`). **(D) Drag&drop del import** (arriba).

### 🚫 Callejones (NO reintentar)
> Workflow `args` grande como string → serializado · git-filter-repo: `--branch` reescribe SOLO esa rama
> (rm+gc antes) · ref local `main` stale post-filter → usar `origin/main` · "FUSIÓN muerta"=FALSA ·
> G024 "XSS dashboards" casi todo FALSO · tand-panel→L-57 · chip por norma→L-58 · "Reprocesar"→ADR-020.

---

## 📋 Pendientes (TODO-NN) — lo ejecutado → `99 §52.8-52.14`

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **CONECTAR D** | D decidido: **NO activar** (§52.14 — prerrequisitos del día D allá: UI no-admin, custom claims, constraints por CAMPO). Esperar necesidad multi-rol real del negocio. | 🔵 decidido |
| **TODO-04** | **✅ PARCIAL (ADR-053/057)**: clusters validados + paquete SALUD ratificado con MO.00418 Ed.02 en mano. RESTA: capítulo PRUEBAS ELÉCTRICAS del MO (tablas per-clase — el anexo Salud NO las trae) + ratificación del director. | 🟢 parcial |
| **TODO-17** | Hygiene (hallazgo ADR-055): `calificarResistencia` (schema) da OK ≤5% mientras semáforo/scorecard usan 2% — unificar o documentar; ligado al `.calif` write-only (G012). | 🟢 menor |
| **TODO-12** | Ola 3: **✅ G025** (suite de reglas vía emulador + CI, §52.12 — desbloquea CONECTAR D). Pendiente: CSP en 95 HTML (vía `<meta>`, trade-offs CDN/inline) · G111 xlsx = **decisión** (sin fix npm → migrar a cdn.sheetjs.com vs aceptar). | 🟡 G025 ✅ |
| **TODO-13** | Ola 4: G017 movimientos no atómicos = **decisión** (contadores agregados vs Cloud Function vs aceptar; fix "obvio" INVIABLE en SDK Web). | 🟡 decisión |
| **TODO-14** | Ola 5: separar 5 dominios (app/cerebro/skills/OLTC) + monolitos (shell 2398L, `calculo-refrigeracion.js` 4913L) = **decisión de arquitectura**. | 🟡 decisión |
| **TODO-09** | ✅ Dashboard conectado a Firestore real + fixture (ADR-056, verificado vivo 212 activos). RESTA solo: **template xlsm sanitizado** para el flujo "Actualizar desde Excel" (insumo/decisión del Ingeniero: qué estructura publicar). | 🟢 casi |
| **TODO-33** | Decisión: ¿reescribir el historial de git para borrar los datos reales de commits antiguos? Irreversible. | 🟡 decisión |
| **TODO-36** | Decisiones de ADR-067 (detalle → `99 §67.7`): 9 informes REALES del TX 450108 commiteados en el repo PÚBLICO (no servidos en web) · SAIDI/SAIFI reales públicos · sembrarlos en Firestore · retirar 2 páginas de desarrollo desplegadas · indicadores congelados en mayo. | 🟡 |
| **TODO-35** | Cola de ADR-066 (detalle → `99 §66.7`): vendorizar SheetJS ≥0.20.2 (CVE, cierra G111) · partir `panel.js` + `normalizarEquipo` al dominio · identidad de 2 TX en la misma subestación vía Excel · aviso de trabajo sin guardar. | 🟡 |
| **TODO-34** | 🔴 **El parque real NO tiene Health Index**: los 206 traen `salud_actual` con TODOS sus campos en `null`/`""` (sin `hi_final`, `bucket`, `edad_anos`) y sin `usuarios` de criticidad. Por eso la banda de salud sale «Sin dato 206», la matriz de riesgo vacía y 0 equipos en riesgo — el módulo degrada limpio, no inventa. Se llena al correr el import de Salud de Activos (paso del Ingeniero, arriba) o al disparar el recálculo. | 🔴 |
| **TODO-05** | Valida arquitectura de las 11 skills `transformadores-potencia` antes de replicar. | 🔄 |
| **TODO-06** | Validar ADR-046→050 en la APP real (tras Firebase Auth). | 🔲 |
| **TODO-08** | 🔐 Ingeniero revoca PAT clásicos viejos de GitHub (uno de mayo 2026). | 🔲 |
| **TODO-02/03** | Tipificar S03-S06 contrato 4125000143 (`scripts/migrate/tipificar-suministros-fan-db.js`, dryRun) · flujo runtime FN-063 vs FN-050 (contrato 4123000081). | 🔮 |

---

## 📝 Bitácora (efímera)

> **Julio — TODO CONSOLIDADO, no re-leer aquí**: Fase 9 + CONECTAR A-E (`99 §52`) · ADR-053/054/055 ·
> ADR-056 (dashboard al parque REAL) · ADR-057 (importador + MO.00418 Ed.02 ratificado) · **ADR-058**
> (ecosistema paraguas + kernel canónico + `60-WORKFLOWS`). Detalle en sus ADRs vía `00`.
>
> **2026-07-29 (Opus 5) — ToS del hosting: CERRADO → `99 §61`**: Pages NO nos prohíbe nada (ni
> e-commerce ni SaaS) → **no se migra**; runbook a Cloudflare listo por si acaso. ⚠️ Decisión viva
> del Ingeniero: **Vercel Hobby SÍ veta el uso comercial** y no lo consume nadie → retirarlo o
> dejarlo a sabiendas. NO re-analizar por calendario: solo por los disparadores de §60.7.
