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
