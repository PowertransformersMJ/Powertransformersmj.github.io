# 🧪 52 — GASES DISUELTOS, ACEITE Y PAPEL (lóbulo de dominio)

> Lóbulo registrado en `40-LOBULOS-DOMINIO` y nombrado en `CLAUDE.md §0`. Nacido 2026-10-02 (`99 §137`).
> **Dueño del CRITERIO** de lo que dice el aislamiento por dentro: gases disueltos (estado, tipo de falla, gas
> suficiente), físico-química del aceite (ADFQ) y papel (furanos, DP, vida consumida, CO/CO₂ como gases del papel).
> **Dónde vive el código** → `22-ESPACIAL-MODULOS` (fila Cargabilidad SCADA) y `20`. **Los valores vigentes** los
> manda el archivo:constante citado; aquí vive el PORQUÉ, la fuente y el estado de validación.
>
> **Frontera (ADR-027, `CLAUDE.md §3.2`)**: la DGA y el aceite están EXCLUIDOS del **Tablero de Pruebas
> Eléctricas** (guardia `ES_NO_ELECTRICA`), NO del dominio: su casa es esta neurona. El ritmo de los gases con la
> carga y la temperatura → `53`. La calificación del índice de salud que usa estas bandas → `51`.

---

## 1. Bandas DGA del MO.00418 §A3.1 y su agregación
- Cortes TDGC (H₂+CH₄+C₂H₄+C₂H₆), CO, CO₂ y C₂H₂ → `domain/umbrales_salud_baseline.js` (`dga.*`), ratificados
  TABLA POR TABLA con el MO.00418 Ed. 02 (`99 §57.2 d`).
- **`eval_dga` = PROMEDIO REDONDEADO de los 4 grupos disponibles** (`calcularEvalDGA`, `99 §57.2`). ⚠️
  `MODELO-DATOS-v2.md §2.8` todavía dice `MAX(TDGC, C2H2)`: está desactualizada, manda el código.
- En Cargabilidad SCADA la calificación «Pesan: …» se agrupa por familia: papel (CO/CO₂) · combustibles (TDGC) ·
  acetileno (`99 §127.2`).

## 2. Monitoreo intensivo de C₂H₂ (MO.00418 §A9.1)
- `domain/monitoreo_intensivo.js` (`BASELINES_C2H2`): velocidad crítica 0,5 ppm/día; 15 ppm sostenido = bloqueante;
  C₂H₂ = 5 → monitoreo semanal SIEMPRE (`99 §127.2`). ⚠️ **El 15 y el 0,5 NO están en el texto del MO Ed. 02** (nota `99 §57.8`):
  su Nota Técnica habla de «el umbral técnico definido para transiciones críticas» sin cifra; lo único del MO es la Tabla 3
  (calificación 5 = C₂H₂ ≥ 7). «§A9.1» es numeración del plan, no del MO. Origen: preguntarle al Ingeniero.
- ⚠️ En la práctica no actúa: `/muestras` está VACÍA (`99 §127.1`) y la velocidad necesita dos muestras con fecha.

## 3. Triángulo de Duval 1 — tipo de falla, no SI hay falla
- **Regla única**: `domain/dga_duval.js` `zonaDuval1` (fronteras de Duval 2002 Fig. 1 = IEEE C57.104-2019 §6.2.3).
  La regla vieja (`duvalTriangle1` de `dga_diagnostico.js`) clasificaba mal ~51 % del área; hoy delega en
  `zonaDuval1` con su contrato intacto (`ba117cf`, `99 §131`; cambió 6 equipos; lo ya guardado no se toca).
- **Lo que el triángulo NO dice**: si hay falla. Eso lo dicen el nivel y la tendencia (USBR FIST 3-31 §5.3, citado
  en la cabecera de `dga_duval.js`).
- **Copia en `pages/parque-transformadores.html:1082` (`duval1`)**: hoy da la MISMA zona que `zonaDuval1` (0
  diferencias en una malla de 80.601 puntos, bóveda `2026-10-02-duval-proyeccion`; y en 2,5 M puntos al azar,
  `99 §137`). Riesgo: que diverjan si se toca una sola → candado pendiente (TODO-73).

## 4. «Gas suficiente» para leer el triángulo
- USBR FIST 3-31 (2003) Tabla 3, límites L1 (`REFERENCIA_SIGNIFICANCIA` en `dga_duval.js`: H₂ 100 · CH₄ 75 · C₂H₂ 3 · C₂H₄ 75 ·
  C₂H₆ 75 ppm) **+ suma CH₄+C₂H₄+C₂H₂ ≥ 10 ppm**. La suma es **criterio del área** (por debajo, los porcentajes son
  ruido), no norma. Sin gas suficiente el punto se dibuja en gris con su motivo (`99 §131.2`).

## 5. Qué tan firme es la zona (margen en ppm)
- `domain/dga_duval_margen.js` `margenPpm`: cuántas ppm de UN gas mueven el punto a la zona vecina. «No firme» si el
  cambio necesario es ≤ máx(15 % del gas, 1 ppm) (`CAMBIO_PEQUENO`) — **criterio pendiente del Ingeniero** (TODO-69, `§131.10`).

## 6. Zona PD con H₂ muy alto
- En el parque, los equipos que salen PD lo hacen por H₂ ≥ 2.000 ppm; en el Triángulo 1 el gaseo del aceite se parece
  a PD → la pantalla recomienda confirmar con los **Triángulos 4 y 5 (Duval 2008)**, que NO están implementados ni
  verificados. Decisión pendiente (TODO-69, `§131.8`). Candidatos naturales a una medición de descargas parciales.

## 7. Registro de las interpretaciones de la DGA que conviven en el código
| Interpretación | Dónde | Estado |
|---|---|---|
| Duval 1 | `domain/dga_duval.js` | ✅ verificada contra fuente (`§131`) |
| Duval 1 (copia) | `pages/parque-transformadores.html:1082` | ✅ idéntica hoy; sin candado (TODO-73) |
| Rogers / Doernenburg | `domain/dga_diagnostico.js` (`rogersRatios`, cita IEEE C57.104 §4 / Anexo B) | ⚠️ cortes sin cotejar |
| `modoDegradacion` (texto que se FIRMA en Fichas) | `domain/fichas_diagnostico.js:162-164` (C₂H₂ ≥ 15 · H₂ ≥ 1.000 con C₂H₄ < 100 · C₂H₄ ≥ 500) | ⚠️ cortes sin norma (ni IEEE C57.104-1991, ni la 2008 por secundarias, ni IEC 60599, ni el MO). Rama con frases fieles a IEC 60599:2022 §4.1/§4.2, cortes «criterio del área» si él los ratifica y sin «Duval» (no se calcula ahí): `99 §140`, espera su «procede» |

**Regla [HONOR]**: ninguna interpretación NUEVA de la DGA sin pasar por esta tabla (y por `34`): antes de crear un
criterio, buscar los que ya existen.

## 8. Los datos de ppm
- `transformadores/{id}.ultima_dga` (RAÍZ): ppm de la última muestra de 2025, **sin fecha de toma** (207 equipos,
  `99 §131.9`). Dos escritores del mismo mapa: el botón «Simular/Cargar gases» (`ui/importar-gases.js` →
  `data/dga_ppm.js`) y la importación completa (`data/importar.js`) → `22`.
- Carga a producción verificada con huella ordenada y fidelidad SHA-1 Excel ↔ Firestore (L-120).
- ⛔ No crear documentos en `/muestras` para «tener historial»: hoy borra `calif_crg` (TODO-64.b).

## 9. Aceite (ADFQ, MO.00418 §A3.2)
- Cortes de rigidez dieléctrica (RD) e índice de calidad (IC = TI/NN) → `umbrales_salud_baseline.js` (`adfq`);
  `eval_adfq = (CalifRD + CalifIC) / 2`.
- Fuentes DISTINTAS, no mezclar: límites en servicio por clase de IEEE C57.106 / NETA 100.4 (skill
  `pruebas-electricas/analisis-aceite`, ⚠️ verificar; no cita IEC 60422) y las EETT AFINIA del aceite del ruptor
  del OLTC (memoria `project_oltc_metodologia`).
- **Qué hace cada tratamiento** (fronteras de los textos firmados de Beneficios, `99 §105`): termovacío = agua y gases del ACEITE (ppm de agua, rigidez); al papel solo le quita humedad superficial · regeneración = ácidos y lodos de la oxidación (acidez, factor de disipación, tensión interfacial); la tierra adsorbente también le quita el inhibidor, por eso se reinhibe · secado de la parte activa = agua del PAPEL en profundidad; encoge el aislamiento, por eso se reaprietan los devanados · antes del termovacío o del secado se registra la DGA como referencia: el tratamiento borra la huella de gases y el seguimiento arranca de nuevo · la humedad del papel se ESTIMA (por el agua del aceite o la respuesta dieléctrica), no se mide. Sustento y callejones → bóveda `2026-09-26-beneficio-{termovacio,regeneracion,secado-parte-activa}` y `2026-09-27-beneficio-toma-muestras`.

## 10. Papel (furanos, DP y vida)
- Cortes FUR (ppb de 2FAL) y juicio experto desde calificación 4 (§A9.2) → `umbrales_salud_baseline.js` (`fur`).
- `domain/salud_activos.js`: `calcularDP` (DP = [log10(2FAL × 0,88) − 4,51] / −0,0035) y % de vida
  ([log10 DP − 2,903] / −0,006021). ⚠️ **FUENTE NO VERIFICADA** (se atribuye a Chendong / CIGRÉ 445): no sostener una
  ficha ante un auditor con esas cifras hasta cotejarlas.
- CO/CO₂ son gases del papel (IEC 60599 §4.2); su ritmo con la temperatura → `53 §5`.

## 11. Callejones probados (lo más caro de reproducir)
- **Proyectar la POSICIÓN del punto de Duval con la carga**: sin respaldo normativo; solo la DIRECCIÓN (Duval 2002,
  Tabla II) → `53 §8`, `99 §131.5`, `§134`.
- **T ≈ 322·log10(C₂H₄/C₂H₆) + 525** (temperatura de falla): sin fuente localizada en 6 búsquedas y error de 150–280 °C
  contra datos (bóveda `2026-10-02-duval-proyeccion`).
- Tomar la columna CAUSANTE del Excel como modo de falla: viene copiada entre filas → `51 §5`, `34` L-73.

## 12. Pendientes (solo punteros)
- TODO-69 (Triángulos 4/5, criterio «no firme», textos DGA en BORRADOR) · TODO-73 (copia de Duval, `modoDegradacion`).
- Tablas 1–4 numéricas de IEEE C57.104-2019 y «Códigos de Acción» de Transequipos: ilegibles en el escaneo del libro
  EG (`50 §Material extraído`); tomarlas de la norma, nunca fabricarlas.
- Skills por actualizar con fuente web verificada en la misma sesión: `pruebas-electricas/dga` (no menciona FIST,
  «gas suficiente» ni las fronteras de Duval 2002) y `pruebas-electricas/analisis-aceite` (IEC 60422).
