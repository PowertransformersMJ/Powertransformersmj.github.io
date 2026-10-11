# 📦 54 — SUMINISTROS, CONTRATO Y ÓRDENES DE ENTRADA Y SALIDA (lóbulo de dominio)

> Lóbulo registrado en `40-LOBULOS-DOMINIO` y nombrado en `CLAUDE.md §0`. Nacido 2026-10-11 (`99 §162`).
> **Dueño del CRITERIO** del suministro de accesorios del parque: órdenes de Materiales de entrada y salida (OE/OS,
> formato IT.05801), el contrato 4125000143 y su nexo con ellas, los movimientos del inventario y sus indicadores.
> Solo reglas y punteros: cada decisión vive en su ADR (`99 §70`, `§76`, `§77`, `§141`–`§148`, `§161`).
> **Dónde vive el código** → `22` (fila Contratos de suministro · nexo con Órdenes E/S). **Los valores vigentes** los
> manda el archivo:constante citado.
>
> Fronteras: órdenes de TRABAJO (`pages/ordenes.html`) y estrategias por condición → `51 §7` · el accesorio como
> subsistema del equipo → `50` (aquí solo su suministro) · cédulas, firmas y permisos → `35` · archivos → `22`.

---

## 1. Vocabulario de la operación
- Solo hay dos tipos de orden: **ENTRADA** y **SALIDA** (`99 §143.8`).
- En su operación la ENTRADA es la entrega bodega Bosque → subestación: «entrada» NO es «a bodega». El sentido de un
  tipo se pregunta, no se presume (`§143.9`).
- La SALIDA no descuenta del contrato: se informa aparte (`§146.2`, decisión 1; él rechazó que devolviera unidades).
- El transformador sale SOLO del campo de la orden, nunca del destino, que puede ser una bodega (`§143.2`, `§144.5`).
- Órdenes de Materiales (`pages/ordenes-materiales.html`) ≠ órdenes de TRABAJO (`pages/ordenes.html`), desde `§70.2`.

## 2. La orden manda (`§161`)
- El contrato SE DERIVA de las órdenes guardadas. Si no cuadra, se reconcilia orden por orden en solo lectura y se
  corrige **LA ORDEN** con el hecho que él confirme (los hechos no se deducen). Nunca se «ajusta» el contrato ni se
  borran movimientos a mano: el registro automático los rehace desde la orden (`§148`).
- Causas típicas (`§161.1`): ítem del contrato escrito como «Otro», transformador distinto del destino, fecha del día
  de digitación, entrega hecha como SALIDA.
- No son defecto: los Krenz (URE) y la lista Bodega Membrillal no cuentan, por su decisión (`§146.2`).
- Cambiar SALIDA → ENTRADA = «Convertir en orden nueva» con el mismo contenido y luego eliminar la vieja (queda lápida, `§77`).
- Antes de tocar una orden, mirar su versión: otra persona del equipo puede estar editándola (`§161.5`).
- Receta y cicatriz → L-138 (`37`).

## 3. Qué descuenta del 4125000143 (`domain/ordenes_contrato_nexo.js`, `§146.2`)
- Órdenes de ENTRADA dentro de la vigencia del pedido (`NEXO_CONTRATOS`; arranca con la Orden de inicio, `§145.10`).
- Solo los 25 nombres EXACTOS de la lista «Accesorios» → S01–S25 (`TABLA_ACCESORIOS`). `EXCLUIDOS` y «Otro» no se
  emparejan por parecido; una prueba de amarre falla si la lista cambia sin la tabla.
- Un egreso manual del mismo ítem al mismo transformador solo se AVISA como posible doble registro.
- No se reabre sin su pedido: la ENTRADA de Bocagrande de dic-2025 se cobra a este contrato (nota de `§146.2`).
- El 4123000081 no tiene nexo: su valor sale de cantidades × precio.

## 4. Valor y cantidades (`§145.9`, L-128 en `38`)
- La «Cantidad» de su Libro4 es la PACTADA (con la adición), no la existencia de hoy.
- Valor del contrato = `contratos/{id}.monto_total` (pedido + adición, sin IVA) si existe; si no, cantidades × precio
  (`valoresContrato`, `domain/stock_calculo.js`). Disponible = contrato − consumido.
- Defecto conocido: las tarjetas de unidades suman kg, m y unidades (TODO-76).

## 5. Movimientos
- Solo INGRESO y EGRESO (`TIPOS_MOVIMIENTO`). No hay «ajustes»: un egreso sin transformador fabrica consumo por zona (`§145.5`).
- Cada entrega es un EGRESO enlazado (`orden_es`, id fijo `oes_<cid>_<orden>_<Sxx>`) con consecutivo MOV único por año;
  transformador, subestación, zona y departamento salen del PARQUE (`§147`). Se registra solo al guardar o eliminar la
  orden y al abrir el contrato (`data/contrato_ordenes_sync.js`, `§148`).
- El equipo activo crea el EGRESO enlazado (`movEsDeOrden`, `isContratoConNexo` en `firestore.rules`): lo decidió él
  contra lo recomendado («solo el administrador»), con riesgos aceptados (`§148.9`). **Esto supera la decisión 6 de
  `PLAN-SUMINISTROS.md §3`** (solo admin). Editar movimientos y todo lo manual sigue siendo del admin.
- El tablero y la pestaña Movimiento leen las órdenes una vez por visita y las releen si cambia una entrega enlazada, al
  volver tras > 1 min o con «Actualizar» (`domain/contrato_relectura.js`, `§161.2`; L-137 en `37`).

## 6. Firmas y datos personales (solo punteros)
- «AUTORIZADO POR» / «ENTREGADO POR» → `§114` · quién exporta con firmas → `§117` · cédulas fuera del repo → `§78`, `35`.

## 7. Indicadores
- Del contrato: zona y departamento de cada entrega salen del PARQUE, no del destino (`§147.2`). De Órdenes E/S
  (`domain/ordenes_indicadores.js`, `§144`): la zona escrita en la orden, unificada sin tildes ni mayúsculas.
- No se suman unidades distintas (`§143.5`, `§144.5`).
- Familias de accesorio y % por falla esperan una tabla suya: no se fabrican (`§144.8`).

## 8. Fuentes
- Documentos del cliente (Libro4, pedido, aceptación, Orden de inicio): memoria `reference_contrato_4125000143_fuentes`
  (rutas locales: jamás al repo). Hojas históricas → `21`: `CONTRATO_4125000143_ANALISIS.md`,
  `MICROCIRUGIA-CONTRATOS-2026-04-27.md`, `PLAN-SUMINISTROS.md` (es un plan: lo construido difiere).
- Skill del módulo: `anthropic-skills:ordenes-materiales-ssee` (`skills-inventory.md`).

## 9. Pendientes (solo el número)
TODO-76 · TODO-62 · TODO-02/03 (`11`).
