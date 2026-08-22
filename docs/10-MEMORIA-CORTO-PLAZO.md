# ⚡ 10 — MEMORIA A CORTO PLAZO (WIP / Sprint activo)

> **Pizarra, no archivo.** Auto-carga con `CLAUDE.md` + `05` (§G.1). SOLO lo vivo/pendiente.
> Lo EJECUTADO vive en `99` (vía `00`); los crudos de deliberación, en la bóveda `archiveDir`.

---

## 🎯 Foco (2026-08-21) — MANTENIMIENTO INTEGRAL DEL CEREBRO (ADR-068)

> Auditoría Nivel-2 (8 sondas, 3 con subagentes fríos): **18 hallazgos, 12 cerrados en la sesión**.
> Dos gates decían verde sin medir lo que anunciaban; el mapa espacial no conocía 4 módulos vivos.
> Kernel **v1.9.0**, neurona hija `32`. Tabla → bóveda `2026-08-21-auditoria-nivel2/HALLAZGOS.md`.
> ⚠️ Abiertos: **TODO-37** (🔴) · TODO-38 · TODO-39 · TODO-40 · TODO-41.

### ▶️ TAREA VIVA: el import de Salud de Activos — PASO DEL INGENIERO
> Simulación corrida con SU archivo (`~/Documents/2026/PSM 2026/Salud de Activos 2026 Actualizado
> 01 de junio.xlsx`): 270 filas · 0 errores · **9 nuevos, 199 actualizados, 62 omitidos** (las hojas de
> servicio y respaldo no traen campos obligatorios). Falta pulsar **IMPORTAR EN FIRESTORE** en
> `admin/importar.html` — el clasificador me bloquea esa escritura. Repetirlo es seguro (busca por
> matrícula y fusiona). Cierra **TODO-34**. 📌 Pidió **resumen de pendientes en CADA turno**.

### 🔴 Solo puede hacerlo el Ingeniero (nadie más tiene la llave)
> **(A)** Pulsar IMPORTAR (arriba). **(B)** GitHub Support "remove sensitive data" para purgar
> `refs/pull/*` + revocar los PAT viejos (**TODO-08**). **(C)** Entregar el capítulo PRUEBAS ELÉCTRICAS
> del MO —el anexo Salud de Activos ya entregado NO trae las tablas per-clase— y ratificar TODO-04
> (`49 §Validación`). **(D)** Tres decisiones suyas de ADR-063: tope en `/alertas_reconocidas`, `defer`
> en Chart.js, barras de progreso. **(E)** Proteger `main` en la configuración de GitHub.

### 🚫 Callejones probados (NO reintentar — cada uno con su ancla)
> `git-filter-repo --branch` reescribe SOLO esa rama, rm+gc antes (**L-25**) · tras un filter-repo el ref
> local `main` queda stale: comparar contra `origin/main` (`99 §52.9`) · "código muerto FUSIÓN" en
> `excitacion-panel.js` = **FALSO**, `tablaFusion` sí se llama (`99 §52.8`) · G024 "XSS en dashboards"
> casi todo FALSO salvo la fuga de `bump.js`, ya corregida (`99 §52.9`) · el fix "obvio"
> `getDocs→tx.get` para movimientos atómicos es INVIABLE en el SDK Web (`99 §52.9`) · reimplementar un
> panel "parecido a X" en vez de reusar el que produce X (**L-57**) · un estado consolidado para todos
> los chips normativos (**L-58**) · reintroducir "Reprocesar" (`99 §20`) · meter DGA/aceite o fabricar
> el dato que falta (`99 §27`, **L-50/L-69**) · pasar un array a `args` de Workflow como string JSON:
> llega serializado y `.map/.filter` revientan (**L-71**).
> **Ya verificado SANO — no re-auditar sin motivo**: lo que las auditorías DESPEJARON vive en la
> casilla `NN.8` de su ADR (`99 §66.8`, `§68.8`) y en el crudo de la bóveda. Consúltalo ANTES de
> volver a auditar Fichas, el escapado de HTML o la doctrina CSS.

---

## 📋 Pendientes (TODO-NN) — lo ejecutado → `99` vía `00`

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **TODO-34** | 🔴 **El parque real NO tiene Health Index**: los 206 traen `salud_actual` todo en `null` y sin `usuarios` de criticidad → banda «Sin dato 206», matriz de riesgo vacía, 0 en riesgo (degrada limpio, no inventa). Se llena con el import (arriba). | 🔴 |
| **TODO-37** | 🔴 **`functions/domain/` vive SOLO en este disco**: 61 archivos gitignorados, **0 versionados**, **5 divergen** de `assets/js/domain/` → un re-clono pierde el dominio de las Cloud Functions desplegadas. Decidir espejo vs versionar vs veto. Detalle → `99 §68`. | 🔴 |
| **TODO-29** | 🔴 **Bóveda sin remoto** (decisión suya, ADR-059): UN disco con material real de cliente. Los 127 MB de fotos de campo YA quedaron versionados el 08-21, así que dentro del disco no hay trabajo sin registrar; lo que falta es una copia FUERA. Si algún día la hay → `lastOffsiteBackup` del manifest. | 🟡 decidido |
| **TODO-36** | Decisiones de ADR-067 (`99 §67.7`): 9 fixtures con datos REALES del TX 450108 en el repo PÚBLICO (`_dev/fixtures/450108-*.json` — el `.gitignore` protege la carpeta `450108/`, no esos archivos) · SAIDI/SAIFI públicos · sembrarlos en Firestore · 2 páginas de desarrollo desplegadas · indicadores congelados en mayo. | 🟡 decisión |
| **TODO-38** | Fichas · cola de ADR-066 que se había evaporado: huecos literales de la norma absorbidos sin nota · `montoCOP` (signo y centavos) · criterio 5 MVA→N4T1 sin escribir ($629,5 M vs $533,7 M) · **carrera de 12 s** que borra EDITS/DEC · paleta duplicada · código muerto · test con fecha no fijada. Lista → `99 §68.7`. | 🟡 |
| **TODO-39** | Sitio · cola de ADR-067: badge «TENDENCIA CRÍTICA» **cableado** en Indicadores de Calidad (viola L-69) · KPIs que solo muestran guiones sin decir por qué · `transformador_2048px-2.png` (334 KB, cero usos). | 🟡 |
| **TODO-40** | Gates del cerebro (`99 §68`): el `pre-commit` sale en verde si el commit no toca `docs/` ⇒ **cero escaneo de secretos/PII** · `verificado-vivo` valida la fecha, no la verificación · gate #6 por substring · gate 5c sin uso posible. | 🟡 |
| **TODO-41** | Cerrar por escrito el ledger de adopción de ADR-058 (adoptar o descartar): nodo `55-CONFIG-INFRA` · lecciones ajenas de verificación de UI · patrón `LD-NN` · índice shardeado · caveat anti-burla del auto-mode. `99 §68`. | 🟢 |
| **TODO-12** | Ola 3: **✅ G025** (suite de reglas vía emulador + CI, `99 §52.12`). Pendiente: CSP en 95 HTML (vía `<meta>`, trade-offs CDN/inline) · G111 xlsx = **decisión** (sin fix npm → migrar a cdn.sheetjs.com vs aceptar). | 🟡 |
| **TODO-35** | Cola de ADR-066 ya priorizada (`99 §66.7`): vendorizar SheetJS ≥0.20.2 (CVE, cierra G111) · partir `panel.js` + `normalizarEquipo` al dominio · identidad de 2 TX en la misma subestación vía Excel · aviso de trabajo sin guardar. | 🟡 |
| **TODO-04** | **✅ PARCIAL**: clusters validados + paquete SALUD ratificado con MO.00418 Ed.02. RESTA: capítulo PRUEBAS ELÉCTRICAS del MO + ratificación del director. | 🟢 parcial |
| **TODO-13** | Ola 4: G017 movimientos no atómicos = **decisión** (contadores agregados vs Cloud Function vs aceptar). | 🟡 decisión |
| **TODO-14** | Ola 5: separar 5 dominios (app/cerebro/skills/OLTC) + monolitos (shell 2398L, `calculo-refrigeracion.js` 4913L) = **decisión de arquitectura**. | 🟡 decisión |
| **TODO-33** | Decisión: ¿reescribir el historial de git para borrar los datos reales de commits antiguos? Irreversible. | 🟡 decisión |
| **TODO-09** | Falta el **template xlsm sanitizado** para el flujo "Actualizar desde Excel" (insumo/decisión del Ingeniero: qué estructura publicar). El dashboard ya quedó conectado al parque real en `99 §56`. | 🟢 casi |
| **TODO-17** | Hygiene: `calificarResistencia` (schema) da OK ≤5% mientras semáforo/scorecard usan 2% — unificar o documentar. | 🟢 menor |
| **TODO-05** | Valida arquitectura de las 11 skills `transformadores-potencia` antes de replicar. | 🔄 |
| **TODO-06** | Validar ADR-046→050 en la APP real (tras Firebase Auth). | 🔲 |
| **TODO-08** | 🔐 Ingeniero revoca PAT clásicos viejos de GitHub (uno de mayo 2026). | 🔲 |
| **TODO-02/03** | Tipificar S03-S06 contrato 4125000143 (`scripts/migrate/tipificar-suministros-fan-db.js`, dryRun) · flujo runtime FN-063 vs FN-050 (contrato 4123000081). | 🔮 |
| **CONECTAR D** | D decidido: **NO activar** (`99 §52.14`). Esperar necesidad multi-rol real del negocio. | 🔵 decidido |

---

## 📝 Bitácora (efímera)

> **Julio consolidado — no re-leer aquí**: Fase 9 + CONECTAR A-E, ADR-053→058 y el cierre del ToS del
> hosting (ADR-060: Pages **no** nos prohíbe nada → no se migra; runbook a Cloudflare listo por si acaso).
> Todo en `99` vía `00`. ⚠️ Decisión viva heredada de ahí: **Vercel Hobby SÍ veta el uso comercial** y hoy
> no lo consume nadie → retirarlo o dejarlo a sabiendas. NO re-analizar por calendario: solo por los
> disparadores de `60 §60.7`.
