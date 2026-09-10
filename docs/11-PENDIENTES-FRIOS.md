# 🧊 11 — PENDIENTES FRÍOS (hija de `10`)

> **Nodo hijo de `10-MEMORIA-CORTO-PLAZO`** (§G.5 sharding, creado 2026-08-30 al reventar el
> presupuesto de arranque — era lo que anticipaba TODO-43). Aquí viven los pendientes que **no
> cambian de semana en semana**: decisiones de arquitectura, validaciones diferidas y colas viejas.
> No se auto-carga: `10` deja el puntero y esta hija se lee cuando toque decidir algo de esta lista.
> Si uno de estos vuelve a estar VIVO, se sube a `10`; cuando se cierra, va a `99` como cualquier otro.

| ID | Item PENDIENTE | Estado |
|---|---|---|
| **TODO-41** | Cerrar por escrito el ledger de adopción de ADR-058 (adoptar o descartar): nodo `55-CONFIG-INFRA` · lecciones ajenas de verificación de UI · patrón `LD-NN` · índice shardeado · caveat anti-burla del auto-mode. `99 §68`. | 🟢 |
| **TODO-04** | **✅ PARCIAL**: clusters validados + paquete SALUD ratificado con MO.00418 Ed.02. RESTA: capítulo PRUEBAS ELÉCTRICAS del MO + ratificación del director. | 🟢 parcial |
| **TODO-13** | Ola 4: G017 movimientos no atómicos = **decisión** (contadores agregados vs Cloud Function vs aceptar). | 🟡 decisión |
| **TODO-14** | Ola 5: separar 5 dominios + partir los monolitos (`99 §52`) = **decisión de arquitectura**. | 🟡 decisión |
| **TODO-33** | Decisión: ¿reescribir el historial de git para borrar los datos reales de commits antiguos? Irreversible. | 🟡 decisión |
| **TODO-09** | Falta el **template xlsm sanitizado** para el flujo "Actualizar desde Excel" (insumo/decisión del Ingeniero: qué estructura publicar). El dashboard ya quedó conectado al parque real en `99 §56`. | 🟢 casi |
| **TODO-17** | Hygiene: `calificarResistencia` (schema) da OK ≤5% mientras semáforo/scorecard usan 2% — unificar o documentar. | 🟢 menor |
| **TODO-05** | Valida arquitectura de las 11 skills `transformadores-potencia` antes de replicar. | 🔄 |
| **TODO-06** | Validar ADR-046→050 en la APP real (tras Firebase Auth). | 🔲 |
| **TODO-02/03** | Tipificar S03-S06 del contrato 4125000143 (`scripts/migrate/…-fan-db.js`, dryRun) · flujo FN-063 vs FN-050. | 🔮 |
| **CONECTAR D** | D decidido: **NO activar** (`99 §52.14`). Esperar necesidad multi-rol real del negocio. | 🔵 decidido |
| **TODO-48** | **Vercel Hobby veta el uso comercial** y hoy no lo consume nadie: retirarlo o dejarlo a sabiendas. Heredado de la bitácora de julio de `10` (`99 §60`: GitHub Pages, en cambio, no nos prohíbe nada → no se migra). NO re-analizar por calendario: solo por los disparadores de `60 §60.7`. | 🟡 decisión |
| **TODO-45** | `robots.txt` está al revés para este caso: `Disallow: /pages/` + `Allow: /assets/` ⇒ la página (sin datos) está bloqueada y el `.js` (con los 8 nombres) es rastreable; el `<meta robots>` no cubre a un `.js`. Valorar `Disallow: /assets/js/` o mover la lista de responsables a Firestore. `99 §70`. | 🟡 |
| **TODO-39** | Sitio · cola de ADR-067: badge «TENDENCIA CRÍTICA» **cableado** en Indicadores de Calidad (viola L-69) · KPIs que solo muestran guiones sin decir por qué · `transformador_2048px-2.png` (334 KB, cero usos). | 🟡 |
| **TODO-40** | Gates del cerebro (`99 §68`): el `pre-commit` sale en verde si el commit no toca `docs/` ⇒ **cero escaneo de secretos/PII** · `verificado-vivo` valida la fecha, no la verificación · gate #6 por substring · gate 5c sin uso posible. | 🟡 |
| **TODO-36** | Decisiones de ADR-067 (`99 §67.7`): 9 fixtures con datos REALES del TX 450108 en el repo PÚBLICO · SAIDI/SAIFI públicos · sembrarlos en Firestore · 2 páginas de desarrollo desplegadas · indicadores congelados en mayo. | 🟡 decisión |
| **TODO-42** | 🟡 **Tres decisiones del import, esperando al Ingeniero** (detalle → `99 §69.7`): **(a)** acotar el import a `TX_Potencia` y rotular las hojas excluidas — *propuesto, falta su visto bueno*; **(b)** los **57 equipos reales** de `TPT_Servicio` y `TX_Respaldo` que caen por la cabecera en fila 2 (**L-72**): incorporarlos o excluirlos por escrito; **(c)** las discrepancias `CONDICION` vs Índice de Salud (46% de acuerdo), empezando por **ASTREA** (250%, dato sospechoso — **L-73**) y las tres jóvenes sobrecargadas. | 🟡 |
| **TODO-37** | 🟢 **FALSA ALARMA, verificada 2026-09-10 — no hay nada en peligro.** `firebase.json:53-55` declara un predeploy versionado (`functions/prepare-deploy.mjs`, `6c752e5`) que **borra y regenera** `functions/domain/` desde `assets/js/domain/` en cada despliegue; los 4 módulos que la Cloud Function ejecuta tienen **SHA-256 idéntico** entre copia y original. La decisión «espejo vs versionar» ya se tomó y ejecutó en `fa21110` (ADR-052 Ola 5): no es un menú abierto. QUEDA solo limpieza: reescribir **`60-WORKFLOWS.md:27` (W-05)**, que dice «esa carpeta DIVERGE, verificar cuál tocas» e invita al error que se eliminó en julio — debe decir «producto automático del predeploy: NUNCA se edita». La corrección entra como ADR nuevo, sin reescribir `99 §68` (§G.4). | 🟢 |
| **TODO-29** | 🔴 **Bóveda sin remoto** (decisión suya, ADR-059): UN disco con material real de cliente. Los 127 MB de fotos ya quedaron versionados (08-21): dentro del disco no falta nada; falta una copia FUERA → `lastOffsiteBackup`. | 🟡 decidido |
