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
| **TODO-57** | **Versionar los assets contra la caché**: cada despliegue sirve una MEZCLA de HTML nuevo con módulos viejos. No se arregla con `?v=` en el HTML (son ~997 referencias, 487 dentro de los propios módulos): va un paso de sellado en el despliegue. `99 §74.24`, **L-85**. | 🟡 (frío desde 09-30) |
| **TODO-47** | 🟡 **Dos huecos de `99 §73.9`, decisión suya**: el «solo PNG» mira la etiqueta que declara el cliente, no los bytes; y cualquier miembro obtiene el inventario del almacén con `listAll`. Detalle y propuesta → CF-26 y la cola. | 🟡 (frío desde 10-01) |
| **TODO-14** | Ola 5: separar 5 dominios + partir los monolitos (`99 §52`) = **decisión de arquitectura**. | 🟡 decisión |
| **TODO-33** | Decisión: ¿reescribir el historial de git para borrar los datos reales de commits antiguos? Irreversible. | 🟡 decisión |
| **TODO-09** | Falta el **template xlsm sanitizado** para el flujo "Actualizar desde Excel" (insumo/decisión del Ingeniero: qué estructura publicar). El dashboard ya quedó conectado al parque real en `99 §56`. | 🟢 casi |
| **TODO-17** | Hygiene: `calificarResistencia` (schema) da OK ≤5% mientras semáforo/scorecard usan 2% — unificar o documentar. | 🟢 menor |
| **TODO-05** | Valida arquitectura de las 11 skills `transformadores-potencia` antes de replicar. | 🔄 |
| **TODO-06** | Validar ADR-046→050 en la APP real. Regla vigente: la reorg POR PRUEBA va paso a paso a pedido suyo, NO generalizar (`99 §48/50`). | 🔲 |
| **TODO-02/03** | Tipificar S03-S06 del contrato 4125000143 (`scripts/migrate/…-fan-db.js`, dryRun) · flujo FN-063 vs FN-050. | 🔮 |
| **CONECTAR D** | D decidido: **NO activar** (`99 §52.14`). Esperar necesidad multi-rol real del negocio. | 🔵 decidido |
| **TODO-48** | **Vercel Hobby veta el uso comercial** y hoy no lo consume nadie: retirarlo o dejarlo a sabiendas. Heredado de la bitácora de julio de `10` (`99 §60`: GitHub Pages, en cambio, no nos prohíbe nada → no se migra). NO re-analizar por calendario: solo por los disparadores de `60 §60.7`. | 🟡 decisión |
| **TODO-45** | `robots.txt` está al revés para este caso: `Disallow: /pages/` + `Allow: /assets/` ⇒ la página (sin datos) está bloqueada y el `.js` (con los 9 nombres (JORGE RHENALS, `§76`)) es rastreable; el `<meta robots>` no cubre a un `.js`. Valorar `Disallow: /assets/js/` o mover la lista de responsables a Firestore. `99 §70`. | 🟡 |
| **TODO-39** | Sitio · cola de ADR-067: badge «TENDENCIA CRÍTICA» **cableado** en Indicadores de Calidad (viola L-69) · KPIs que solo muestran guiones sin decir por qué · `transformador_2048px-2.png` (334 KB, cero usos). | 🟡 |
| **TODO-40** | Gates del cerebro (`99 §68`): `verificado-vivo` valida la fecha, no la verificación · gate #6 por substring · **ningún hook escanea secretos** (claves/tokens); cédulas, firmas y SCADA sí se revisan en todo commit · la salida temprana del `pre-commit` y el 5c → TODO-67. | 🟡 |
| **TODO-36** | Decisiones de ADR-067 (`99 §67.7`): 9 fixtures con datos REALES del TX 450108 en el repo PÚBLICO · SAIDI/SAIFI públicos · sembrarlos en Firestore · 2 páginas de desarrollo desplegadas · indicadores congelados en mayo. | 🟡 decisión |
| **TODO-42** | 🟡 **Tres decisiones del import, esperando al Ingeniero** (detalle → `99 §69.7`): **(a)** acotar el import a `TX_Potencia` y rotular las hojas excluidas — *propuesto, falta su visto bueno*; **(b)** los **57 equipos reales** de `TPT_Servicio` y `TX_Respaldo` que caen por la cabecera en fila 2 (**L-72**): incorporarlos o excluirlos por escrito; **(c)** las discrepancias `CONDICION` vs Índice de Salud (46% de acuerdo), empezando por **ASTREA** (250%, dato sospechoso — **L-73**) y las tres jóvenes sobrecargadas. | 🟡 |
| **TODO-72** | **Firefox y Safari reales sin probar** (Fichas, `99 §113.8`): solo Chrome se recorrió. | 🟢 |
| **TODO-29** | 🔴 **Bóveda sin remoto** (decisión suya, ADR-059): UN disco con material real de cliente. Los 127 MB de fotos ya quedaron versionados (08-21): dentro del disco no falta nada; falta una copia FUERA → `lastOffsiteBackup`. | 🟡 decidido |
| **TODO-74** | **Skills del dominio por actualizar** (`99 §137`), cada una con la fuente web verificada en la misma sesión: `pruebas-electricas/dga` (FIST L1, gas suficiente, fronteras de Duval 2002; su ejemplo «T2/T3» es T3) · `gestion-vida-activo` (IEC 60076-7:2018 y los 6 °C) · `analisis-aceite` (IEC 60422) · `regulacion-tomas` + `cambiador-tomas-ltc` (IEC 60214-1, C57.139). Catalogar las de `anthropic-skills:` de Fichas y del reporte semanal tras leerlas. Gestión de activos (CIGRE TB 761/445, ISO 55000, RCM): investigar antes de crear nada. | 🟢 |
| **TODO-12** | Ola 3: falta CSP en 95 HTML · **G111**: SheetJS 0.18.5 (CVE-2023-30533) en **9** cargas, incluida «Datos SCADA» (`homologacion.js`, `§122`, solo admin). Decisión: vendorizar ≥0.20.2 o aceptarlo. `99 §52.9`, `§122`. | 🟡 |
