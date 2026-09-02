# 🗂️ 21 — HOJAS DE DETALLE DEL PROYECTO (hija de `20`)

> **Nodo hijo de `20-MEMORIA-ESPACIAL`** (§G.5 sharding, creado 2026-09-01: la madre llegó a 3
> caracteres de su tope). Inventario de las hojas técnicas que escribió el dueño en `docs/`: qué
> contiene cada una y para qué sirve. **No se auto-carga**: se consulta cuando el mapa de la madre
> dice «detalle → hoja X» y hace falta saber cuál es esa hoja. Verificado leyendo la cabecera de
> cada archivo. Si se crea, mueve o retira una hoja de `docs/`, se actualiza AQUÍ en el mismo
> cambio (Reflejo de Frescura, `CLAUDE.md §G.4` · **M-02**).

---


> Inventario verificado leyendo la cabecera de cada archivo.

- `ARQUITECTURA.md` — mapa de navegación del repositorio (v2.0.8): dónde vive cada cosa, para sesiones nuevas sin explorar a ciegas.
- `MODELO-DATOS-v2.md` — documento maestro del schema Firestore v2 (Fase 16): Health Index ponderado por secciones, referencia MO.00418.DE-GAC-AX.01 Ed. 02.
- `DEPLOY-FUNCTIONS.md` — guía de activación por etapas de `onMuestraCreate` y `cronAlertasDiarias` (F32); email opcional vía Firebase Extension "Trigger Email" + Gmail SMTP.
- `OPERACIONES.md` — runbook operativo v2.0.8: bootstrap, uso diario y emergencia (audiencia: Ingeniero Director). **Aquí viven los comandos `firebase deploy --only …`**; para COMPARAR declarado vs desplegado se pregunta al servidor: `firebase firestore:indexes` / `firebase functions:list` (L-66).
- `MANTENIMIENTO-BRIGADA.md` — módulo Selección ONAF: calculadora de refrigeración ONAN→ONAF conforme IEEE C57.12.00 / C57.91-2011 / ANSI C57.12.91 + Westinghouse.
- `MANTENIMIENTO-PREDICTIVO.md` — refactor del tablero estático de Pruebas Eléctricas (TransformerOps) a módulo modular sobre Firestore realtime + sistema Aqua.
- `PLAN-SERVICIOS-EXTERNOS.md` — guía paso a paso (legacy, para no-programadores) de conexión con Firebase, Node.js, GitHub Pages y Vercel.
- `PLAN-SUMINISTROS.md` — plan v2.2 de integración Suministros + Repuestos (F38–F50) a partir de los fuentes `.jsx`/`.xlsm`, con decisiones bloqueantes aprobadas.
- `INDICADORES-CALIDAD.md` — dashboard SAIDI_E/SAIFI_E (refactor F40): impacto de causas controlables + proyección Jun–Dic con OLS y bandas IC95%.
- `REPOSITORIO-PRUEBAS-ELECTRICAS.md` — arquitectura del repositorio digital de pruebas por número de serie (extiende `pages/pruebas-electricas.html`); su §13 documenta la extracción con IA (ADR-003).
- `CONTRATO_4125000143_ANALISIS.md` · `MICROCIRUGIA-CONTRATOS-2026-04-27.md` — diagnóstico del módulo Suministros/Contratos (diff del `.xlsm` vs el template canónico + inventario).
- `SESION-2026-05-03-CONTINUACION.md` · `SESION-2026-05-05.md` — handoffs de sesión (Mantenimiento Brigada · render integral del transformador con foto real).
- `UI-V3-DARKMODE.md` — refactor visual UI v3 dark mode (histórico; el sistema activo es AQUA LIGHT).
- `INSTALACION-CEREBRO.md` — manual del cerebro anterior; hoy en `_legacy/cerebro-anterior/docs/`.
- `workflow-auditoria-secciones-pruebas.md` — hoja hija de ESTE nodo: proceso repetible de auditoría/completitud por sección del tablero de pruebas (columnas que la IA pierde).
- `docs/pruebas/` — 10 fichas JSON de criterios normativos, una por prueba (01 FP aislamiento … 10 DFR): mapa código↔norma con `_fuente` apuntando a dominio/skill; las consume `assets/js/pruebas-electricas-shell.js` vía `fetch('../docs/pruebas/…')`.

---
