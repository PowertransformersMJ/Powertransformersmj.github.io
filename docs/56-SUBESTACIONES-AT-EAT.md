# 🏗️ 56 — SUBESTACIONES DE ALTA Y EXTRA ALTA TENSIÓN (lóbulo de dominio · el entorno del transformador)

> Lóbulo registrado en `40-LOBULOS-DOMINIO`. Disparador: Trigger 🔵 §G.2 con «configuración de la S/E», «barra partida»,
> «entrada común», «acople», «transferencia», «TC/TT», «relación del TC», «87T», «86», «50BF», «disparo», «servicios
> auxiliares», «baterías», «malla de tierra», «distancias de seguridad», «pararrayos», «BIL/Um», «contaminación salina»,
> «foso/muro cortafuego», «puesta en servicio», «FAT/SAT».
>
> **Qué cubre**: lo que RODEA al transformador sin ser el equipo: la configuración y su efecto en la medida y en los
> disparos, la cadena de la medida hasta el SCADA, el esquema de protección de la bahía, servicios auxiliares, malla,
> distancias, aislamiento, obra civil y contraincendio, y la puesta en servicio. **Frontera**: el EQUIPO y sus accesorios
> físicos (Buchholz, alivio, nivel, imagen térmica, OLTC, refrigeración) → `50`; los ENSAYOS del transformador y sus
> umbrales → `49`; la cifra de carga, la ampacidad y la firmeza → `53` (aquí solo la topología que la explica).
> **Un valor de norma vive una sola vez, aquí, con su página.**

---

## 0. Fuente y cómo usarla

- **Libro**: «Subestaciones de Alta y Extra Alta Tensión — Guía práctica de diseño», HMV Ingenieros, 3.ª ed. (1.ª 1991,
  2.ª 2003; autor de la 1.ª: Carlos Felipe Ramírez). Copia del Ingeniero (escaneo con OCR, 823 págs.):
  `~/Desktop/GitHub-MJ/SUBESTACIONES DE ALTA Y EXTRA ALTA TENSIÓN - Guia practica de diseño.pdf`. **No entra al repo**
  (público; derechos de autor): aquí solo hay síntesis propia con la página.
- **«p. N» = página IMPRESA del libro.** En el PDF va +10 al inicio y +8 al final (p. 30 = pdf 40; p. 782 = pdf 790).
- **Ingesta 2026-11-02 (`99 §202`)**: 15 lectores + 15 verificadores que re-leyeron cada página (~25 ítems corregidos o
  retirados por bloque) + contraste con este cerebro. **Notas completas por capítulo** (conceptos, criterios, glosario,
  dudas de OCR) → bóveda `2026-11-02-libro-subestaciones/` (`01.json`…`15.json`, `contraste.json`).
- **Es un libro de DISEÑO**: da criterios de diseño y de puesta en servicio, **no umbrales de condición**. Lo que el libro
  dice sin norma va rotulado «práctica del libro». Lo marcado «inferencia» es nuestro, no del libro.

## 1. Mapa de capítulos → para qué le sirve a SGM

| Cap. (págs.) | Tema | Sirve para | Lóbulo |
|---|---|---|---|
| 1 (1–30) | Definiciones, tensiones IEC 60038, ciclo de vida, etapas de diseño | Um del parque, datos mínimos del activo | 56 · 51 |
| 2 (31–60) | Configuraciones de barras e interruptores; selección | Entrada común, barra partida, consecuencia de una falla | **56** · 53 · 51 |
| 3 (61–94) | Coordinación de aislamiento, sobretensiones | Pararrayos del transformador, causas de disparo | 56 |
| 4–5 (95–146) | Distancias mínimas y de seguridad; apantallamiento | Inspección y maniobra con barras vivas | 56 |
| 6–7 (147–226) | Disposición física AIS; GIS | Ubicación de TC/TT por configuración | 56 |
| 8 (227–328) | Interruptores, seccionadores, TT, TC, pararrayos | Escalas de TC, exactitud de medida, interruptor de la bahía | **56** · 53 |
| 9 (329–352) | Transformación y compensación; contraincendio | Terciario cargable / no cargable, banco de monofásicos | 50 · 56 |
| 10 (353–440) | Conductores, ampacidad, corona, conectores, corrosión | Cuellos de botella de la bahía, conectores en costa | 56 · 53 |
| 11–12 (441–520) | Cables aislados; sistemas de control (SAS, SOE) | Cadena de la medida, alarmas al control | 56 · 53 |
| 13 (521–608) | Protecciones (transformador, barras, 50BF, interruptor) | **Disparos del transformador** | **56** · 50 |
| 14–15 (609–680) | Comunicaciones; malla de puesta a tierra (IEEE 80/81) | Malla, neutro del transformador | 56 |
| 16–18 (681–776) | Servicios auxiliares; obra civil; estructuras | c.c./baterías, refrigeración ↔ SSAA, foso y muros | 56 · 50 |
| 19 (777–812) | Pruebas y puesta en servicio | FAT/SAT como línea base; pruebas de interruptor y TC | **56** · 49 |

## 2. Tensiones y niveles de aislamiento del parque (p. 4–5, 63, 75, 231–234)

- **Um (IEC 60038)**: 13,8 → **14,52** · 34,5 → **36,5** (serie II, práctica americana) · 66 → 72,5 · 110 → 123 ·
  220 → 245 kV. Regla: la tensión asignada del equipo ≥ Um (IEC 62271-1).
- **Niveles IEC 60071-1** (frecuencia industrial / rayo, kV): Um 17,5 → 38 / 75 o 95 · Um 36 → 70 / 145 o 170 ·
  Um 72,5 → 140 / 325 · Um 123 → 230 / 550 · Um 245 → 360 / 850 hasta 460 / 1050. A 38 kV (serie norteamericana) hay
  BIL de 150, 170 y 200: **un BIL de 200 kV a 34,5 kV puede ser de placa ANSI, no un error de captura**; y una placa de
  33 kV (serie I) no es error por sí sola: mirar la toma con que opera (inferencia, p. 4, 231–234).
- ⚠️ Um 36 (equipo IEC) < 36,5 (sistema de 34,5 kV): con Ur ≥ Um harían falta equipos de 38 o 40,5 kV salvo que la
  tensión máxima real no pase de 36 kV. Resolver con placas antes de usarlo como regla.

## 3. Configuraciones y lo que cambian en la medida, los disparos y el mantenimiento (cap. 2, p. 31–41; p. 178–181)

| Configuración | Qué implica para el transformador |
|---|---|
| Barra sencilla | Intervenir el interruptor saca al transformador. Una llegada alimenta a todos los que cuelgan de la barra. |
| Barra seccionada | En operación normal los circuitos no pasan de una sección a otra. |
| H | Dos transformadores sobre barra seccionada; con el seccionamiento cerrado, una llegada los alimenta a los dos. |
| Unitaria | La línea termina en el transformador; a veces **sin interruptor de AT** (ver §5). |
| Principal + transferencia | El circuito sigue por el interruptor de transferencia mientras se mantiene el suyo; el TC va del lado del circuito y el campo de transferencia no lleva TC. |
| Doble barra | El acople lleva TC: mide el paso entre barras, no un transformador. |
| Anillo / interruptor y medio | Cada salida queda entre dos interruptores: su corriente es la suma de los dos TC (se arma en el gabinete). La falla de un vecino puede sacar al transformador. |

**Casos SGM que explica** (el libro da la topología, no habla de SCADA: el vínculo es nuestro):
- **Entrada común** (Puerto Libertador `§176`, Lorica `§177`, Ovejas `§184`, Curumaní `§188`, Montelíbano y San Martín de
  Loba `§189`): el TC de una llegada que alimenta una barra con dos transformadores mide la suma → la cifra de cada uno
  sale de su lado de baja o de los circuitos de su sección, **nunca se reparte por capacidad**.
- **Barra de 13,8 kV partida** (Curumaní, Guatapurí T3, Becerril `§186`): cada transformador carga solo los circuitos de
  su sección, y su suma es su carga; por eso la **fecha de partición es un dato de la medida**. La suma de circuitos es de
  magnitudes y la de barra fasorial: con factores de potencia parecidos la diferencia es pequeña (cubierta por el ±10 % de `§182`).
- **Un punto que no representa la carga**: el TC del acople, un solo interruptor de una salida con dos, o un circuito
  tomado como «toda la carga» (`§189`). **Antes de confirmar un punto, mirar el unifilar.**
- **Ceros sin salida de servicio**: con transferencia, un punto junto al interruptor marca cero con el transformador cargado.
- **Consecuencia de una falla o de un mantenimiento** según la configuración (Tabla 2.1, p. 47–53: nada, un circuito, la
  mitad o todo) → insumo para la criticidad de TODO-55 (`51`). ⚠️ El OCR perdió encabezados de esa tabla: ver la imagen.
- ⚠️ **Las configuraciones reales del parque NO están verificadas** (no hay unifilares en el cerebro).

## 4. La cadena de la medida: TC/TT → SCADA (cap. 8, 11–12, 19)

- **Cadena**: TC (multirrelación, secundario 1 o 5 A) → bornera o caja de agrupamiento → medidor, relé o registrador →
  red de la S/E → RTU/concentrador → canal → centro de control (p. 290–295, 493–495). La relación se programa **por
  separado** en contador, registrador, IED y RTU; la puesta en servicio cruza la medida entre todos (p. 799–800, 812).
- **Escalas ×2 / ×4 / ×½** (Berrugas `§182`, Pueblo Nuevo `§189`): las tomas normalizadas son doble o cuádruple una de
  otra (150-300-600; 250-500-1000 A); confundir 1 A con 5 A daría ×5. Regla práctica (inferencia): **si el relé ve bien y
  el SCADA no, el error está en RTU/SCADA; si el relé también sale ×2/×4, en el IED o en la toma del TC**; un ×2 en una
  sola fase apunta a esa fase. El historial de versiones de configuración de cada IED dice cuándo cambió (p. 513).
- **Exactitud según la carga**: un TC de medida solo garantiza su error entre 5 y 120 % de su corriente primaria
  (clase 0,2: 0,75 % al 5 %; 0,2 % al 100–120 %), salvo gama extendida; su corriente térmica continua es la nominal salvo
  que se pida 120, 150 o 200 % (IEC 61869-2, p. 295–298). **Una sobrecarga severa leída por un TC sin gama extendida es
  menos confiable**; un núcleo de protección (5P/10P) se define por su error en falla. Candidato a nota de firmeza en `53`.
- **Potencias y TT**: P, Q y S usan la tensión del TT: una falla de fusibles o mini-interruptores del TT (alarma
  estándar), un √3 de un TT fase-tierra o 100 frente a 110 V dañan la potencia sin tocar la corriente (p. 280–282,
  493–494) → respalda que la cifra de `53` use solo la corriente. El ×1000 visto en `§158.12` es de unidades del SCADA.
- **Histórico del SAS**: guarda máximos, mínimos y medios → al cargar un mes saber si la hora es promedio o máximo (p. 502–503).
- **TT y CVT**: inductivos bajo 72,5 kV; CVT en líneas de 72,5–145 kV y más. Un CVT en ferrorresonancia infla la tensión
  25–50 % con oscilación de ~1/3 de la frecuencia (p. 280–289).

## 5. Protección de la bahía del transformador (cap. 13, p. 522–600)

- **Funciones** (código ANSI): **87T** diferencial porcentual (fallas internas de corriente media o alta, < 3 ciclos) ·
  **51/51N** sobrecorriente de tiempo inverso (la de fases, sobre todo respaldo de fallas externas) · **86** disparo y
  bloqueo (no deja cerrar hasta reponerlo a propósito) · propias del equipo, cableadas por su tablero: **49** imagen
  térmica, **63B** Buchholz, **63P** alivio de presión, **71** nivel de aceite (el accesorio físico es de `50`).
- **Lo que el 87T NO ve** (p. 535–536): falla entre pocas espiras (**< 10 % de In**), fallas de baja corriente cerca del
  neutro, sobretemperatura y sobrecarga, ruptura del tanque, falla del interruptor; ante sobreexcitación solo si es muy
  alta. Esa franja la cubren 63B, 63P, 49 y la sobrecorriente. ⇒ **Un 63B/63P que actuó sin corrientes anormales en la
  oscilografía NO exonera al transformador.** Y con el tablero del transformador fuera, la diferencial sigue para fallas
  de corriente alta pero esa franja queda descubierta (matiza el hecho fijado de `50` sobre los Beneficios).
- **Ajustes de referencia** (catálogo, no norma; p. 535–540): pendiente del 87T 20–50 %, casi siempre > 30 % por el rango
  del cambiador; bloqueo por 2.º armónico (inrush) y 5.º (sobreexcitación); además del desfase del grupo (skill
  `grupo-vectorial-conexiones` §B) se compensan la relación de los TC y la secuencia cero. **51 de fases arranca entre
  130 y 150 % de In** → **una sobrecarga moderada sostenida no la corta la 51**: la barrera es la 49 y los avisos de
  Cargabilidad (filas R3/R4 de `53 §4/§9`). 51N 20–40 % de In (premisa de carga balanceada, dudosa a 13,8 kV). Muchas
  empresas no habilitan el 50 instantáneo por disparos falsos.
- **Disparo del transformador = definitivo** (aislamiento no regenerativo): sin recierre. Pero **el mismo 86 lo activan
  también fuentes AJENAS**: etapa 2 de la falla de interruptor (50BF) de otra bahía, diferencial de barras, sobretensión,
  protecciones propias del interruptor (baja presión de SF6, discrepancia de polos, mecanismo) (p. 588–592). Ejemplo del
  libro de 50BF: redisparo 150 ms, etapa 2 240 ms, despeje total 340 ms (p. 591). Despeje en AT/EAT ≤ 100 ms.
- **74** supervisa el circuito de disparo (crítica con una sola bobina); cada protección principal a su bobina y su
  circuito de c.c.; n-1 también en protecciones.
- **Sin interruptor de AT** (unitaria): despeja el interruptor remoto por teledisparo (DDT) con bloqueo de su recierre; un
  Buchholz o una falla cerca del neutro dan poca corriente en la línea (p. 33, 539, 566). ⚠️ Existencia en el parque no verificada.
- **Terciario** (p. 331–335, 537–538, 684–685): el NO cargable queda fuera del diferencial (sobrecorriente en la tierra de
  un vértice de la delta); el CARGABLE entra al diferencial como tres devanados. De la barra del terciario pueden colgar
  un zigzag (tierra y, si es cargable, SSAA) y reactores de MT: entonces sí lleva corriente (reactiva o consumo propio,
  no clientes). Barras expuestas del terciario fallan por animales: aislarlas o pasarlas a cable.
- **Causas de falla** (p. 524–525): esperadas, impredecibles, de diseño, fabricación/transporte, montaje, operación y
  mantenimiento; < 15 % de las fallas del sistema son de transformadores y reactores; 72 % monofásicas. En transformadores
  son comunes los **disparos sin falla real** por deterioro de las protecciones mecánicas, cableado, ajustes o error
  humano; en sal y humedad las cajas de intemperie se deterioran rápido (coincide con el hecho fijado de `50`).

## 6. Energización, inrush y remanencia (p. 69–72, 252–273, 592–597)

- La inrush depende del instante de cierre (en el cero de tensión satura; en el pico no) y del flujo remanente. El mando
  sincronizado no actúa en los disparos por protección: **tras un disparo el remanente queda sin controlar** → respalda
  excluir la excitación posterior a un disparo (`34` L-151) y desmagnetizar antes de excitación/SFRA (extensión nuestra).
- Abrir un transformador en vacío = cortar corriente inductiva pequeña (sobretensión, reencendido): un seccionador solo
  si se especificó para eso. Energizarlo con cables o líneas en vacío puede dar ferrorresonancia.

## 7. Servicios auxiliares (cap. 16, p. 682–719)

- Más confiables que la propia S/E. **c.c. de 125 V flotante** con detector de tierra (una sola derivación a tierra no
  dispara); principal y respaldo en barras de c.c. distintas; bobinas de disparo operan entre 85 y 110 % de su tensión.
- **Baterías**: referencia 25 °C; más de 3 °C de diferencia dentro del banco lo desbalancea (IEEE 484); reemplazo cuando
  cae al **80 %** de su capacidad (IEEE 485); flotación 2,15–2,35 V por celda. Grupo electrógeno: arranque semanal con carga.
- **Refrigeración ↔ SSAA** (puente con `53 §3` y CF-27): ventiladores y bombas son carga de c.a.; con barra esencial y no
  esencial el grupo solo respalda la esencial → **al perder la fuente de MT un ONAF puede quedar en ONAN** (inferencia a
  validar en campo). Arrancan con ~10 veces su potencia. La **falla de enfriamiento es alarma estándar** al control:
  candidata a la señal de «refrigeración deficiente» que falta (sin mezclar avisos de ventiladores en Cargabilidad).
- **Alarmas estándar del transformador al control** (p. 493–494): diferencial, sobrecorriente, Buchholz, presión súbita,
  falla de enfriamiento, temperatura de devanado y de aceite, posición de toma, cambio incompleto, sobrepresión del
  cambiador, falla del regulador; en patio, fusibles del TT, falla de c.a./c.c., transformador de SSAA y contraincendio.

## 8. Malla, distancias, aislamiento y contaminación

- **Malla (IEEE 80/81, cap. 15)**: neutro del transformador a la malla con cable aislado; mandan las tensiones de toque y
  paso, no la resistencia sola (1 Ω es referencia). La peor corriente de malla suele venir de una falla del lado AT en
  delta; **cambiar el número de transformadores obliga a recalcular la corriente de malla**. Medición por caída de
  potencial (electrodo a ~5 veces la malla, lectura cerca del 62 %); resistividad en época seca y húmeda.
- **Distancia mínima en aire N** (IEC 61936-1, p. 95–108): Um 17,5 → 120–160 mm · 36 → 270–320 · 72,5 → 630 ·
  123 → 900–1100 · 245 → 1300–2100 según BIL. Zona de proximidad N + 1 m hasta 110 kV y N + 2 m por encima (⚠️ la tabla
  deja duda justo en 110 kV); la distancia de trabajo la fija el RETIE. Vehículos: N + 100 mm (mín. 500) con la carga.
- **Pararrayos y coordinación** (cap. 3, 8): el aislamiento interno del transformador es no autorregenerativo, no se
  corrige por altitud y lleva factor 1,15 (el externo 1,05). **El pararrayos va sobre el transformador o lo más cerca, con
  conexiones cortas** (la tensión en bornes crece con esa longitud); se sigue por corriente de fuga y contador de
  descargas. Las sobretensiones (temporales, de maniobra, de rayo; reencendidos de MT de hasta 6 p.u.) dan el árbol
  para investigar un disparo. Densidad de rayos en Colombia: NTC 4552-2.
- **Costa — contaminación** (IEC 60815, p. 417–420): fuga específica mínima por clase a–e: **22 / 27,8 / 34,7 / 43,3 /
  53,7 mm/kV** (sin corrección bajo 1500 m). Pararrayos poliméricos con niebla salina 1000 h. Conectores bimetálicos en
  toda unión Al–Cu; gabinetes con IP/IK declarados y en inoxidable, aluminio o fibra; galvanizado > 100 µm cerca del mar.
  Seccionadores en sal pueden pedir más mantenimiento que el interruptor. → especificación de Fichas y suministros (`54`).
- **Interruptor** (IEC 62271-100, p. 250–262): el **mecanismo concentra ~90 % de sus fallas**; diferencia entre polos
  1/6 de ciclo al abrir y 1/4 al cerrar (el cap. 19 dice ½ ciclo: usar el cap. 8). Un seccionador de apertura central
  puede dejar partes energizadas aun abierto.

## 9. Obra civil y contraincendio de la bahía (p. 117–119, 349–351, 736–747)

- Foso colector (20 % del aceite con tanque, IEC 61936-1) o autocontenedor (**120 %** del aceite, CIGRÉ TB 537);
  sobreancho 1,5 m (IEEE 980) o 2 m (IEEE 979); grava ≥ 0,3 m.
- **Separación según litros de aceite** (IEC 61936-1, desde 1000 L): < 2000 L → 3 / 7,5 m · < 20 000 → 5 / 10 ·
  < 45 000 → 10 / 20 · ≥ 45 000 → 15 / 30 (G1 / G2: hasta otro transformador o superficie no combustible / hasta una
  superficie combustible de edificio; rótulos según la norma, el OCR perdió los encabezados de la Tabla 4.7). Muros que resistan 3 h. ⇒ **una reposición con más aceite
  puede cruzar un escalón y exigir muro o foso mayor** (Fichas de reposición).
- Protección activa: diluvio o despresurización con N2; si actuó, hubo drenaje parcial e inyección de N2 → registrarlo
  antes de interpretar la DGA posterior (`52`; existencia en el parque no verificada).

## 10. Puesta en servicio frente a mantenimiento (cap. 19, p. 777–812)

- Las pruebas de puesta en servicio (SAT) son no destructivas, tras el montaje: comprueban que nada se dañó y que los
  sistemas secundarios funcionan, contra los reportes de fábrica (FAT); **su protocolo es el punto de partida del
  mantenimiento** → la línea base que el tablero no tiene (`49`). Las de mantenimiento buscan tendencia en las mismas
  condiciones.
- **Las Tablas 19.1–19.3 NO son umbrales** (sin norma ni temperatura): FP 1 % en aceite, 0,5 % nuevos, 0,5–2 % bujes;
  IR mínimo para energizar ≈ 1 MΩ por kV + 1; PI/DAR por bandas. Deciden si se energiza, no la condición; el criterio
  multi-norma de `49` manda (ver §12).
- **Contactos** (interruptor, seccionador, barras): microohmímetro de 100 A a la asignada; no más de 1,2 veces la de
  fábrica. **Esquema completo**: se simulan protecciones eléctricas y mecánicas hasta los interruptores, el 87T en
  estabilidad, característica y armónicos, el 86 en reposición; tras energizar, suma de corrientes del diferencial y
  vigilancia de temperatura, presiones, niveles y ruido entre 12 y 24 h.
- **Registro de eventos**: SOE de 1 ms; oscilografía ≥ 8 muestras/ciclo en COMTRADE; relojes IRIG-B o PTP (mejor que SNTP).
- Ensayos de tensión aplicada o inducida pueden generar gas sin descarga → tras una reparación con ensayo dieléctrico,
  DGA antes y después (`52`; inferencia).

## 11. Insumos para la Guía de respuesta a disparos (propuesta, no adoptada)

La Guía del Ingeniero (`Guia_Respuesta_Disparo_Transformadores_AFINIA`, en su escritorio, 2026-10-28) no está ingerida. El
libro sugiere este orden: **(1) ¿qué activó el 86?** propia (87T, 63B, 63P, 49, 71, 51) o ajena (50BF de otra bahía,
barras, sobretensión, interruptor) · **(2) si fue propia, no se reenergiza sin inspección**: 63B/63P sin corrientes
anormales no exonera (espiras); 87T al energizar → revisar 2.º armónico, TC y compensación del grupo sin descartar falla
real · **(3) evidencia**: SOE, COMTRADE, relojes, estado de la c.c. de 125 V, DDT si no hay interruptor de AT, N2 si
existe; si fue rayo, pruebas eléctricas (`49`) antes · **(4) reponer el 86** y vigilar 12–24 h (extrapolación a validar).

## 12. Divergencias con el cerebro (el criterio vigente NO cambia) y ⚠️ por verificar

| Tema | Cerebro | Libro | Decisión |
|---|---|---|---|
| R de devanados: temperatura de corrección | la del devanado/aceite (`34` L-150; skill) | la AMBIENTE (ec. 19.7) | Mantener: con el aceite 15 °C sobre el ambiente el libro mete ~5–6 % de error |
| PI / DAR | PI ≥ 1,0 / ≥ 1,5; DAR > 1,6 (`49`) | bandas sin norma (PI 1–2 «dudoso»; DAR > 1,4 «excelente») | Mantener multi-norma; el libro, referencia rotulada |
| FP de bujes | mismo umbral que devanados (0,5 / 1,0 %) | 0,5–2 % de referencia | Mantener (más exigente y contra placa) |
| R devanados: Al y corriente | Tk 225, ≤ 10 % In | K0 228, ≤ 15 % | Mantener (diferencia ~0,2 %) |
| «Terciario de compensación» | sin límite de carga (`53`, `§170`) | compensación = reactores en la delta: SÍ lleva corriente | Mantener la regla para lo que la placa llama compensación (= estabilización); un terciario con reactores, zigzag cargable o SSAA sí necesita límite |
| «Si el tablero falla, la diferencial sigue» (`50`) | — | la franja de baja corriente queda sin protección | Matizar si un texto firmado lo usa (§5) |

⚠️ Por verificar en la imagen del PDF (OCR): Tabla 2.1 (encabezados), Tabla 4.7 (filas), zona de proximidad en 110 kV.
⚠️ Um 36 vs 36,5 (§2). ⚠️ Configuraciones, DDT, despresurización con N2 y gama extendida de los TC: no verificados en el parque.

## 13. Pendientes / próxima ronda

- Unifilares del parque → confirmar configuración por S/E antes de usar §3 en una decisión de medida (TODO-69).
- Temperaturas por sitio de las memorias de diseño (p. 14) como fuente para el supuesto de 30 °C del modelo térmico (`53`).
- Cruzar §11 con la Guía real cuando el Ingeniero lo pida. Datos mínimos del activo (BIM LOD 500, p. 26) para `51 §12`.
- Lectura dirigida si hace falta: cap. 10 (ampacidad de bajantes y conectores, IEEE 605/738) y cap. 11 (cable de evacuación, IEC 60287).
