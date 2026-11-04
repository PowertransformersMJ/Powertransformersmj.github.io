# 🗂️ 00c — ÍNDICE SINÁPTICO, tramo §141–§197 (hija de `00`)

> **Hija por rango de [`00-INDICE.md`](00-INDICE.md)** (§G.5 sharding, 2026-10-28, `99 §197.9`): la madre
> pasó su tope (17.693/16.000). Aquí viven, **sin tocar una letra**, las filas §141–§197 del
> mapa § → línea de `99-HISTORIAL-ADR.md`. Las filas nuevas NUNCA entran aquí: se agregan al final
> de la madre (`brain:archive` lo hace solo). La columna Línea la reconcilia el mismo
> `npm run brain:index` (lee `00` y sus hijas `00[a-z]-INDICE*.md`), y `brain:check` las audita juntas (gates #3/#5a/#9).
> El ruteo semántico (síntoma → neurona) sigue en la madre: **consulta allí primero**.

> Formato de fila EXACTO (el reconciliador lo parsea): `| §N | descripción con hook | LINEA |`

| § | Qué resuelve (hook para decidir si leerlo) | Línea |
|---|---|---|
| §141 | ADR-141 — **Órdenes E/S**: cantidad corregible y material «Otro» | 6104 |
| §142 | ADR-142 — **Órdenes E/S**: «Órdenes guardadas» (ver, PDF, Excel, editar) | 6146 |
| §143 | ADR-143 — **Órdenes E/S**: filtro por zona y entregas por transformador | 6184 |
| §144 | ADR-144 — **Órdenes E/S**: indicadores por accesorio, zona, motivo y mes | 6230 |
| §145 | ADR-145 — **Contrato 4125000143**: inventario de Libro4 (pactado, `§145.9`; `§145.10` → cerrado en `§161.7`) | 6283 |
| §146 | ADR-146 — **Contrato ↔ Órdenes E/S**: nexo calculado (luego §147/§148 escriben) | 6347 |
| §147 | ADR-147 — **Contrato ↔ Órdenes E/S**: entregas como movimientos enlazados | 6449 |
| §148 | ADR-148 — **Contrato ↔ Órdenes E/S**: registro automático (equipo, reglas) | 6544 |
| §149 | ADR-149 — **Cerebro**: auditoría Nivel-2 (44 hallazgos, M-10, hija 36) | 6637 |
| §150 | ADR-150 — **Cerebro**: freno al PUBLICAR, consejo externo a pedido, memoria liviana | 6703 |
| §151 | ADR-151 — **Cerebro**: documentación total de la sesión 10-06 → 10-07 | 6749 |
| §152 | ADR-152 — **Mapa de Colombia**: fondo arreglado + mapa DANE en Borrador (parque por municipio) | 6783 |
| §153 | ADR-153 — **Mapa**: S/E ubicadas con el KMZ del Ingeniero (147/147) y sus transformadores | 6863 |
| §154 | ADR-154 — **Inventario**: editar guarda solo lo que cambió (ya no borra matrícula ni condición) | 6994 |
| §155 | ADR-155 — **Mapa**: el botón «Mapa» abre el mapa nuevo (opción 2 suya) | 7061 |
| §156 | ADR-156 — **Mapa**: Mapa y Relieve a voluntad (casillas) | 7099 |
| §157 | ADR-157 — **Mapa**: filtros de salud 1–5 y de Cargabilidad SCADA (CRG) | 7121 |
| §158 | ADR-158 — **Cargabilidad SCADA**: los 77 sin medición; motivo con la causa; relevo de Sampués; cargas de octubre (1–7 y **1–22**, `.12`/`.13`) | 7165 |
| §159 | ADR-159 — **Cargabilidad SCADA por periodo** (p99 exacto con `top`) e historia del equipo | 7369 |
| §160 | ADR-160 — **CRG con la escala del MO** (Muy Bueno…Muy Pobre); lo ofrecido → `§160.7` (dentro de §161) | 7486 |
| §161 | ADR-161 — **Contrato conforme a las órdenes**: 4 órdenes corregidas; el tablero relee las órdenes | 7526 |
| §162 | ADR-162 — **Cerebro**: auditoría Nivel-2 + neurogénesis (00b, 23, 37, 38, lóbulo 54) | 7596 |
| §163 | ADR-163 — **Informe de Mantenimiento Brigada**: F60 de Applus (refrigeración) con listado como Fichas, PDF y Word · TODO-81 | 7709 |
| §164 | ADR-164 — **Cerebro**: espejo PRIVADO en GitHub (`cerebro-mj`); matiza ADR-059, no es respaldo · TODO-29 | 8010 |
| §165 | ADR-165 — **Cargabilidad SCADA**: todos los devanados de placa (tensión, ampacidad, potencia calculada, carga) en lista, CSV y detalle · TODO-69 | 8079 |
| §166 | ADR-166 — **Cargabilidad SCADA**: placa característica de cada equipo en su detalle (foto, lectura, diferencias); carga admin, foto atada a sus bytes · TODO-69 | 8135 |
| §167 | ADR-167 — **Lorica T1** contra su placa + cargabilidad del SCADA (67,4 %, 13,8 kV); una muestra nueva ya no borra la CRG · TODO-54 | 8203 |
| §168 | ADR-168 — **Cargabilidad SCADA**: mes a mes y acumulada a la fecha en cada equipo; «A la fecha» = cargabilidad oficial en la revisión · TODO-69 | 8270 |
| §169 | ADR-169 — **Cargabilidad SCADA**: cada devanado mes a mes frente a sus límites de PLACA (ONAN/ONAF); potencias placa ↔ plataforma ↔ Excel de Salud de Activos · TODO-69/54 | 8318 |
| §170 | ADR-170 — **Cargabilidad SCADA**: corriente límite IMPRESA en la placa (o «calculada»); terciario de compensación sin límite; planos y «futuro» marcados; 102 placas completadas · TODO-69/54 | 8404 |
| §171 | ADR-171 — **Bosque T2** con su placa (WEG 40 MVA, 67 kV): ampacidades 344,7/1.673,5 A, CRG oficial 79,1 % (CRG 4); placa reconectable no grave · TODO-54 | 8453 |
| §172 | ADR-172 — **Cargabilidad SCADA**: tabla «Devanados de placa» con valores de PLACA; la cifra oficial con la corriente de placa (32 devanados) · TODO-69/54 | 8497 |
| §173 | ADR-173 — **Placas v4** (Magangué T2A, Montería T2A: corriente de MT impresa) + una corriente de las notas que cuadra mejor con OTRO devanado no se rotula «impresa» (L-155) · TODO-54/69 | 8547 |
| §174 | ADR-174 — **Cargabilidad SCADA**: detalle de los umbrales de placa en las barras (recuadro, leyenda, tabla con la lectura «al borde de la ONAN»/«supera la ONAF») · TODO-69 | 8595 |
| §175 | ADR-175 — **Nueva Cospique T1–T4** con los datos de su placa (primario 110 kV, no 66): homologación automática y cifra firme · TODO-54/69 | 8646 |
| §176 | ADR-176 — **Puerto Libertador**: T1 por su 13,8 kV (el 34,5 kV mide T1 + T2) y T2 con su placa (4000 kVA) y su circuito de salida; cifras firmes · TODO-54/69 | 8688 |
| §177 | ADR-177 — **Lorica T2** con su placa (primario 33 kV) y **San Benito de Abad T1** con su placa y cifra por 13,8 kV (34,5 kV con escalas erradas) · TODO-54/69 | 8726 |
| §178 | ADR-178 — **Cargabilidad SCADA**: nivel medido pero excluido en la homologación → «medida excluida en la homologación» con su motivo (no «no se mide») · TODO-69 | 8770 |
| §179 | ADR-179 — **Santa Rosa T1** por su 13,8 kV (las 3 bahías de 34,5 kV con escalas erradas) y con sus datos de placa; cifra firme 45,5 % · TODO-54/69 | 8803 |
| §180 | ADR-180 — **Zambrano T1A** (tres devanados): el aviso de relación no aplica a sus dos salidas (el terciario inyecta); firme 90,6 % por el secundario; placas de T1A y T2 · TODO-54/69 | 8847 |
| §181 | ADR-181 — **Boston T1A**: sobrecarga REAL 110 % CRG 5 con su terciario (alias de elemento en el empaquetador); la prueba de relación no aplica a un tres devanados; placa · TODO-54/69 | 8903 |
| §182 | ADR-182 — **Berrugas T1** por la SUMA de los circuitos de su barra (fase S ×2 y 34,5 kV ×½ en el SCADA); nueva capacidad «suma de circuitos»; placa (Dyn11, ONAN/ONAF) · TODO-54/69 | 8975 |
| §183 | ADR-183 — **Informe Brigada**: la ACTIVIDAD de un informe nuevo se escribe a mano (lista como sugerencias; modelo F60); reglas `ibrActividad` · TODO-81 | 9046 |
| §184 | ADR-184 — **Ovejas**: T1 por su 13,8 kV (el 34,5 kV mide T1 + T2) y T2 por su circuito de salida (94,5 % CRG 5); placas de los dos · TODO-54/69 | 9095 |
| §185 | ADR-185 — **Sobrecarga por DEVANADO**: el indicador y el filtro catalogan firmes, posibles, periodo sin cifra y circuitos (39 → 52); la etiqueta nombra el devanado; placa de **San Luis T1** (8,37/20,92 A) · L-157/L-158 · TODO-54/69 | 9137 |
| §186 | ADR-186 — **Cambio de MEDIDA desde un mes** («medidas anteriores» en la homologación; regla que no deja perderlas); caso **Becerril** (una barra → barras separadas en may-2026) · TODO-54/69 | 9202 |
| §187 | ADR-187 — **Filtro «Devanado sobrecargado»** (primario · secundario · terciario, con conteos) · TODO-69 | 9266 |
| §188 | ADR-188 — **Homologación de los 8 «por confirmar»** (entrada común, paralelo, puntos cruzados, banco monofásico) · TODO-69 | 9309 |
| §189 | ADR-189 — **Sin cifra medidos por circuito** (19 decisiones, placa Bosque T4, entradas comunes de San Martín de Loba y Montelíbano) · TODO-69 | 9374 |
| §190 | ADR-190 — **Firmeza por el devanado que da la cifra** (mes, periodo y detalle; resguardos: días sin cargar, meses fuera de servicio, tridevanado, sobrecarga de un devanado mal medido) · TODO-69 | 9428 |
| §191 | ADR-191 — **Los 26 provisionales**: «No usar» en Puerto Escondido, Gambote, Las Delicias y Loma del Bálsamo; marca **fase sin carga por diseño** (bancos de dos monofásicas: Mata de Caña, El Paraíso) · TODO-69 | 9492 |
| §192 | ADR-192 — **Las 4 propuestas**: San Andrés T2 (medida anterior), El Brillante y Ánimas Bajas (fase S sin carga), Nueva Cospique T3 con la marca **unidad de reserva** · TODO-69 | 9551 |
| §193 | ADR-193 — **San Luis T1** (unidad cambiada en mayo: medida anterior excluida) y la marca **bandera «Invalid» no confiable** (La Europa T1, Ovejas T2; reproceso desde lo guardado) · TODO-69 | 9610 |
| §194 | ADR-194 — **Maracayo T1** (bandera «Invalid» no confiable; sigue provisional por medida muerta desde jun), Ferrocarril aplazado y **pedido consolidado** al área SCADA y la brigada · TODO-69 | 9665 |
| §195 | ADR-195 — **banda muerta** (Tres Palmas) · **mes casi sin medida** (Maracayo) · TODO-69 | 9704 |
| §196 | ADR-196 — **Oriente → ENERGUA** desde sep-2026 (periodo hasta ago) · TODO-69 | 9774 |
| §197 | ADR-197 — panel de gases: «Urgente» · «PD por confirmar» · aviso ENERGUA · TODO-69 | 9833 |
