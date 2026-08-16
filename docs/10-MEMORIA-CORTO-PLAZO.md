# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Todo lo EJECUTADO (Fase 9 + fase CONECTAR) → `99 §52.8-52.14`. Crudos → bóveda
> `~/Desktop/GitHub-MJ/brain-private/sgm-transpower/research-archive/` (`2026-07-21-fase9/` + `2026-07-22-decision-rbac-f28/`).

---

## 🎯 Foco (2026-08-16) — AUDITORÍA HOLÍSTICA REMEDIADA (ADR-062)

> 11 auditores + verificación adversarial sobre todo el sistema. 4 CRÍTICOS y 22 ALTOS
> sobrevivieron. Remediado y desplegado en 3 commits (`7444564` · `5830d9c` · `dd9b5f6`).
> **1.334 pruebas verdes y CI en VERDE por primera vez desde el 22 de julio.**
> Informe completo → bóveda `sgm-transpower/auditorias/` (cita datos reales, no va al repo público).

### 🔴 PENDIENTES que NO pude cerrar
> **(A) Desplegar funciones**: `maxInstances` está en el código, el despliegue lo bloqueó el
> clasificador. Comando: `npx firebase deploy --only functions`.
> **(B) Proteger la rama `main`**: configuración de GitHub, solo el Ingeniero.
> **(C) Historial de git**: los datos reales siguen en commits antiguos. Irreversible y la doctrina
> prohíbe force-push a `main` → DECISIÓN DEL INGENIERO, no se hizo.
> **(D)** Índices Firestore faltantes · escapado HTML duplicado en 34 archivos · foto de fondo de
> 1,1 MB · 5 pruebas que pasan sin comprobar nada. Detalle en el informe de la bóveda.

### ▶️ TAREA VIVA: encender el parque real — falta el PASO DEL INGENIERO (detalle → `99 §57`)
> Importador en PRODUCCIÓN y MO.00418 Ed.02 ratificado. **PASO ÚNICO**: abrir `admin/importar.html`
> en su Chrome → drag&drop (L-62) → **Simulación** → **Importar**. Excel:
> `~/Downloads/Salud_de_Activos_2026_UUCC_corregida-2.xlsx`. TRAS el import: template headers-only
> (cierra TODO-09) y detección de fila-cabecera para TPT_Servicio/TX_Respaldo.
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
| **TODO-32** | Desplegar funciones con `maxInstances` (`npx firebase deploy --only functions`) — ADR-062 §62.8. | 🔴 |
| **TODO-33** | Decisión: ¿reescribir el historial de git para borrar los datos reales de commits antiguos? Irreversible. | 🟡 decisión |
| **TODO-30** | Validar `pages/fichas-tecnicas.html` con sesión real: datos de Firestore, ficha completa y exportación PE.02081 con un equipo de verdad (ADR-061). | 🔴 |
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
>
> **2026-07-29 (Opus 5) — ToS del hosting: CERRADO → `99 §61`**: Pages NO nos prohíbe nada (ni
> e-commerce ni SaaS) → **no se migra**; runbook a Cloudflare listo por si acaso. ⚠️ Decisión viva
> del Ingeniero: **Vercel Hobby SÍ veta el uso comercial** y no lo consume nadie → retirarlo o
> dejarlo a sabiendas. NO re-analizar por calendario: solo por los disparadores de §60.7.
