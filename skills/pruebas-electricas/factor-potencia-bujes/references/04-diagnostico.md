# 04 · Diagnóstico — interpretación, troubleshooting y riesgo

> El FP/capacitancia de buje se interpreta **vs la placa del propio buje**, junto a DGA,
> FP del devanado e inspección (IEEE C57.152 / C57.19.01). Esta neurona traduce patrones
> en causas — y marca cuándo hay **riesgo de explosión** (acción inmediata).
>
> 🔗 **Convergencia obligatoria**: tras identificar un patrón aquí, ve a
> `../../_conocimiento/diagnostico-integrado-bateria.md` (matriz cross-test) para confirmar la
> causa. **Un solo hallazgo = INVESTIGAR; dos o más = diagnóstico.** Excepción: **ΔC1 alto
> es condena por sí solo** (seguridad) — no se "espera convergencia" para sacar de servicio.

## Patrones típicos → causa probable

| Patrón | Causa probable | Corroborar con | Urgencia |
|---|---|---|---|
| **C1 ↑ > 5–10 % vs placa** | **Capas del condensador en cortocircuito** | repetir; comparar fases; DGA del tx | 🔴 RIESGO EXPLOSIÓN |
| FP de C1 ↑ y creciente | Humedad / envejecimiento del aislamiento principal | DGA; FP del devanado; agua en aceite | Alta |
| **FP de C2 ↑** (tap) | **Humedad ingresando por el tap** | sellar/inspeccionar tap; tendencia C2 | Media-alta |
| Hot-collar > 0.1 W en una sección | Humedad / fisura / **bajo nivel de aceite** localizado | comparar secciones y fases; nivel visual; termografía | Media |
| FP y C1 desviados solo en **un buje** | Defecto localizado en ese buje | comparar fases homólogas; inspección | según ΔC1 |
| FP buje alto + DGA con gases | Calentamiento / descarga en el buje | DGA del tx; termografía de la conexión | Alta |
| Capacitancia que **baja** | Pérdida de aceite / capa abierta (raro) | nivel de aceite; repetir | Media |

## Mecanismo y señal de riesgo de explosión (lo más importante)

Un buje condensado degradado falla en **cascada**: una capa en corto sobrecarga las
vecinas, que también colapsan, hasta la descarga interna que **revienta la porcelana** y
proyecta aceite encendido. La **firma medible** es el **aumento de C1** (capas en serie que
se pierden). Por eso:

- **ΔC1 > 5 %** vs placa → **INVESTIGAR** ya (no esperar).
- **ΔC1 > 10 %** (⚠️ umbral a verificar) o tendencia de C1 claramente ascendente →
  **RECHAZA · sacar de servicio**: el buje puede explotar. No se requiere convergencia.

## Factores que ensucian la medida (descartar antes de condenar)

- **Superficie sucia/húmeda del buje** (lluvia, polvo salino del Caribe) → fuga externa que
  sube el FP sin que el aislamiento interno esté mal. Limpiar y secar; repetir.
- **Temperatura no corregida** → FP sobreestimado. Usar factor del fabricante del buje.
- **Conexión del tap mal hecha / tap no descubierto** → C2 o C1 falseados. Verificar el cableado.
- **Interferencia electrostática** (líneas energizadas cerca) → usar supresión del equipo.

## Acciones por veredicto (→ mantenimiento predictivo)

- **APRUEBA**: registrar FP₂₀, C1, C2 y T como baseline; seguir tendencia de C1 (clave).
- **INVESTIGAR** (ΔC1 5–10 %, ΔFP >50 % placa, HC >0.1 W): repetir limpio; comparar fases;
  DGA; acortar intervalo; planificar reemplazo si la deriva confirma.
- **RECHAZA · RIESGO EXPLOSIÓN** (ΔC1 >10 % / C1 en ascenso / capa en corto): **sacar de
  servicio + reemplazo del buje**. Es el disparador de acción correctiva inmediata.

→ Para la **acción correctiva concreta, la urgencia (criticidad×severidad) y el intervalo
de re-ensayo**, cierra el lazo en `../../_conocimiento/gestion-mantenimiento-predictivo.md`
(fila "Buje degradado → reemplazo del buje, riesgo de explosión").

## Enlace con el tablero / IA

El extractor de IA entrega FP, C1, C2 y placa por buje; el diagnóstico determinista debe:
corregir a 20 °C, calcular **ΔC1 y ΔFP vs placa** (`02-…`), aplicar NETA D.5, y emitir el
veredicto + **flag de riesgo de explosión** si ΔC1 lo amerita. La **tendencia de C1**
(pestaña Tendencia) es el insumo más crítico de toda la batería: anticipa fallas catastróficas.
