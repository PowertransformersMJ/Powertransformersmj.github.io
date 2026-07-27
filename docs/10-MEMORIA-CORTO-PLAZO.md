# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Todo lo EJECUTADO (Fase 9 + fase CONECTAR) → `99 §52.8-52.14`. Crudos → bóveda
> `~/Desktop/brain-private/sgm-transpower/research-archive/` (`2026-07-21-fase9/` + `2026-07-22-decision-rbac-f28/`).

---

## 🎯 Foco (2026-07-24) — Parque real limpio (206, 0 demos) · SIGUE: importar Excel real de Salud

> Fase 9 (ADR-052) Olas 0-5 + CONECTAR A/B/C/E desplegadas; D decidido NO activar (§52.14). **ADR-053 (hoy)**:
> **G010 cableado** (umbrales F18 → Health Index, aditivo, revisión adversarial 0 defectos) + **TODO-04 validado
> parcial** (re-atribución tan δ + per-clase aplicadas; ver `49 §Validación`) + **fixes FASE E** (tarjeta causa
> real + XSS tabla RCA). Billing RESUELTO en vivo (CF vivas) · extracción IA validada con informe real.

### ▶️ TAREA VIVA: importar Excel "Salud de Activos" — DRY-RUN ✅ HECHO (2026-07-24) · espera 3 DECISIONES + OK
> Archivo: `~/Downloads/Salud_de_Activos_2026_UUCC_corregida-2.xlsx` (16-jul; existe una `corregida` anterior).
> **Hecho** (`49e21fb`): importador entiende cabeceras reales (alias aditivos + colapso de espacios) + guard
> `omitidos` (sin él, 5 filas vacías crearían docs basura UNK-*). Dry-run Node (script en scratchpad,
> `dryrun-v2.mjs`): TX_Potencia 213 filas → **208 completas** · factores TDGC/CO/CO₂/C₂H₂/IC/FUR/EDAD
> coinciden ≥93-100% con el Excel · persistencia idempotente por `codigo`=MATRICULA (actualiza, no duplica).
> **DECISIONES:** (1) **DGA** ⏳: Excel = promedio(TDGC,CO,CO₂,C₂H₂) redondeado [201/206] vs motor =
> max(TDGC,C₂H₂) — la resuelve el MO.00418 Ed.02 que el Ingeniero entregará; (2) **CRG** ✅ (2026-07-27,
> `af5a31d`): columna CARGABILIDAD = dato OFICIAL de Planificación Alta Tensión → `crg_pct` directo con
> prioridad en `calcularCalifCRG` (cociente de respaldo); coincidencia subió 148→192/206, las 14 restantes
> son fronteras de umbral → van con la ratificación MO.00418; (3) **HER** ⏳: el Ingeniero indica que el
> MO.00418 también define hermeticidad — se resuelve al recibir el documento.
> **BLOQUEA persistir:** solo el MO.00418 Ed.02 (resuelve DGA + HER + ratifica umbrales) + OK del Ingeniero.
> **Con su OK** → persistir vía `admin/importar.html` en su Chrome (drag&drop L-62; primero botón Simulación =
> dryRun con su sesión → creados/actualizados exactos vs los 206) → verificar dashboard vivo → template
> sanitizado (headers sin datos) cierra TODO-09 → hojas TPT_Servicio (31) y TX_Respaldo (26) tienen filas de
> título encima (cabeceras __EMPTY): necesitan detección de fila-cabecera ANTES de importarse (pendiente).
> Después: TODO-17 · ratificación umbrales+MO.00418 · TODO-05/08 · GitHub Support · G017/G111/STRUCT/D.

### 🔴 Acciones que SOLO el Ingeniero puede hacer
> **(A) GitHub Support** "remove sensitive data" (purga `refs/pull/*`). **(B) Revocar PATs viejos** (TODO-08).
> **(C) Ratificar TODO-04** (`49 §Validación`) y entregar MO.00418 Ed.02 (tabla per-clase no confirmable en
> fuentes públicas). (✅ Alerta de presupuesto GCP $5/mes hecha — detalle en `05`.)

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
| **TODO-04** | **✅ PARCIAL (ADR-053)**: clusters IR/PI/DAR + FP/tan δ/bujes + TTR validados con fuente y refutación; 2 re-atribuciones aplicadas (`c7683d7`). RESTA: ratificación del director + MO.00418 (per-clase) + clusters 3b/4 (→ TODO-15). | 🟢 parcial |
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

> **2026-07-22/23** — Fase 9 + CONECTAR A-E → `99 §52.8-52.14` · ADR-053 (escaneo+G010) · ADR-054 (2 bugs shell,
> falta clasificar RESPALDO) · ADR-055 (ΔC1 al veredicto + clusters 3b/4; nuevo TODO-17) · billing resuelto +
> extracción IA validada (LEL27007, L-62, TODO-10 ✅) — detalle en sus ADRs/`05`/`30-31`.
>
> **2026-07-24 (Fable 5) — TODO-09 ADR-056**: dashboard conectado al parque REAL, verificado vivo; TX-DEMO
> eliminados con aprobación del Ingeniero → **206 reales · 0 demos**. Detalle → ADR-056.
>
> **2026-07-24 (Fable 5) — DRY-RUN Excel Salud de Activos (`49e21fb`)**: Excel hallado en Downloads (no
> adjuntado); importador NO entendía las cabeceras reales (POTENCIA (KVA), AÑO DE FABRICACION, dobles
> espacios…) → HI se calculaba solo con DGA+FUR (EDAD pesa 30%!) e inflaba discrepancias. Alias aditivos +
> test cabeceras reales → 1206 pass. Sondas: DGA-Excel=promedio-de-4 (201/206) · CRG-Excel auto-inconsistente
> (61 filas) · ADFQ ambos usan promedio(RD,IC) · motor validado factor a factor (≥93-100% coincidencia).
> Guard `omitidos` en persistir (5 filas vacías → antes docs UNK-* basura). NO persistido — esperan 3
> decisiones normativas del Ingeniero (ver TAREA VIVA). Nota: plan decía "header:1" pero el código real usa
> sheet_to_json con cabeceras-objeto (§3.3: el código manda).
>
> **2026-07-27 (Fable 5) — DECISIÓN CRG (`af5a31d`)**: el Ingeniero confirma que CARGABILIDAD viene de
> Planificación Alta Tensión (fuente de verdad) y que HER lo define el MO.00418 que entregará. `crg_pct`
> directo cableado (aditivo) → 1208 pass. Pendiente único para persistir: MO.00418 + su OK. El Ingeniero pidió
> **resumen de pendientes actualizado en cada turno** a medida que respondemos decisiones.
