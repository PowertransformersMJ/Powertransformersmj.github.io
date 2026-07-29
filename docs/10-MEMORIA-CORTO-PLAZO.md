# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Todo lo EJECUTADO (Fase 9 + fase CONECTAR) → `99 §52.8-52.14`. Crudos → bóveda
> `~/Desktop/GitHub-MJ/brain-private/sgm-transpower/research-archive/` (`2026-07-21-fase9/` + `2026-07-22-decision-rbac-f28/`).

---

## 🎯 Foco (2026-07-28, cierre) — Ecosistema montado (ADR-058/059) · el PRODUCTO espera el drag&drop

> **ARRANQUE DE LA PRÓXIMA SESIÓN**: el Ingeniero cerró esta anunciando **instrucciones nuevas**.
> Escúchalas primero; NO bloquees lo nuevo por lo de abajo. Contexto mínimo que necesitas saber:
> el cerebro ahora vive en el ecosistema `~/Desktop/GitHub-MJ` con **kernel canónico repartido**
> (`npm run brain:pull`; se edita SOLO en `../brain-private/kernel/`), catálogo de procesos en
> **`60-WORKFLOWS`** (lee **W-11** antes de cualquier decisión fuerte) y consejo externo =
> **Gemini vía Antigravity** (`15`). Proyecto nuevo → `../brain-private/NUEVO-PROYECTO.md`.
>
> ⚠️ **Deuda de equilibrio**: costo-cerebro 30d en ~54% contra bandera del 30%, dos sesiones
> seguidas de infraestructura. Salvo que lo nuevo pida lo contrario, **esta sesión debería ser
> de PRODUCTO**. Y aplica **L-63**: lo que `§2`/`§G` ya autoriza se ejecuta y se reporta, no se pregunta.

### ▶️ TAREA VIVA: encender el parque real — TODO listo salvo el PASO DEL INGENIERO (detalle → `99 §57`)
> Metodología MO.00418 Ed.02 ratificada + importador en PRODUCCIÓN (`main` `c3c1c9b`, 1209 pass). Excel:
> `~/Downloads/Salud_de_Activos_2026_UUCC_corregida-2.xlsx`. **PASO ÚNICO**: Ingeniero abre
> `admin/importar.html` en su Chrome → drag&drop (L-62) → **Simulación** (dryRun: creados/actualizados
> exactos vs los 206) → **Importar** → Claude verifica el tablero vivo con su sesión. TRAS el import:
> (a) template sanitizado headers-only → cierra TODO-09; (b) TPT_Servicio (31) y TX_Respaldo (26) traen
> títulos encima (cabeceras __EMPTY) → detección de fila-cabecera antes de importarlas (resuelve también
> clasificación RESPALDO); (c) discrepancias del job = esperadas (juicio experto ~38 filas, `99 §57`).
> 📌 El Ingeniero pidió **resumen de pendientes actualizado en CADA turno**.

### 🔴 Acciones que SOLO el Ingeniero puede hacer
> **(A) GitHub Support** "remove sensitive data" (purga `refs/pull/*`). **(B) Revocar PATs viejos** (TODO-08).
> **(C) Entregar capítulo PRUEBAS ELÉCTRICAS del MO** (tablas per-clase — el anexo Salud de Activos ya
> entregado NO las trae) y ratificar TODO-04 (`49 §Validación`). **(D) Drag&drop del import** (arriba).

### 🚫 Callejones (NO reintentar)
> Workflow `args` grande como string → serializado (embeber en script) · git-filter-repo: `--branch` reescribe
> SOLO esa rama, aborta con `tmp_pack_*` (rm+gc antes), `glob:*.pdf` matchea todo dir · ref local `main` stale
> post-filter → usar `origin/main` · "FUSIÓN muerta"=FALSA · G024 "XSS dashboards" casi todo FALSO · tablas
> tand-panel→L-57 · chip por norma→L-58 · "Reprocesar"→ADR-020 · `.calif` de schema write-only (G012).

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
| **TODO-05** | Valida arquitectura de las 11 skills `transformadores-potencia` antes de replicar. | 🔄 |
| **TODO-06** | Validar ADR-046→050 en la APP real (tras Firebase Auth). | 🔲 |
| **TODO-08** | 🔐 Ingeniero revoca PAT clásicos viejos de GitHub (uno de mayo 2026). | 🔲 |
| **TODO-02/03** | Tipificar S03-S06 contrato 4125000143 (`scripts/migrate/tipificar-suministros-fan-db.js`, dryRun) · flujo runtime FN-063 vs FN-050 (contrato 4123000081). | 🔮 |

---

## 📝 Bitácora (efímera)

> **2026-07-22→28 (Fable 5) — YA CONSOLIDADO, no re-leer aquí**: Fase 9 + CONECTAR A-E (`99 §52`) ·
> ADR-053/054/055 (G010, 2 bugs del shell, ΔC1 + clusters) · ADR-056 (dashboard al parque REAL,
> 206 reales · 0 demos) · **ADR-057** (importador del Excel real + MO.00418 Ed.02 ratificado tabla
> por tabla). Detalle en sus ADRs vía `00`.
>
> **2026-07-28 (Opus 5) — LAS NUEVAS INSTRUCCIONES eran el ECOSISTEMA → ADR-058**: paraguas
> `~/Desktop/GitHub-MJ` (repo ⇄ bóveda hermanos + carpetas OLTC + `_archivo`), kernel canónico PROPIO
> con reparto sellado (`brain:pull`, gate #0), `60-WORKFLOWS` (W-01..W-13), Antigravity oficial como
> consejo externo, y `brain-private/NUEVO-PROYECTO.md` para que todo proyecto futuro nazca conectado.
> Bóvedas NO se fusionan con el ecosistema de origen (datos de cliente). Detalle → `99 §58`.
> ⚠️ El heartbeat marca **costo-cerebro 30d = 53% 🔴** (bandera 30%): la próxima sesión debería ser
> de PRODUCTO, no de cerebro.
