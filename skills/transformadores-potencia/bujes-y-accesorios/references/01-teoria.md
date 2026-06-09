# 01 · Teoría — bujes y accesorios

> Base: IEEE C57.19 (bujes), IEC 60137, ABB Service Handbook, EG cap.6 (accesorios/protecciones).
> Backbone en `../../_conocimiento/00-fundamentos-transformador.md §A/§E`.

## A) Tipos de buje

| Tipo | Construcción | Tiene C1/C2 / tap | Uso |
|---|---|---|---|
| **No-condensador** | aislamiento macizo (porcelana + aceite/aire), sin capas | NO | MT/BT de baja tensión |
| **Condensador OIP** (oil-impregnated paper) | papel impregnado en aceite + capas de foil | SÍ | AT clásica |
| **Condensador RBP** (resin-bonded paper) | papel encolado con resina + capas | SÍ | AT (tecnología antigua) |
| **Condensador RIP** (resin-impregnated paper) | papel impregnado en resina, seco | SÍ | AT moderna (sin aceite, menos riesgo de incendio) |

- El **buje condensador** tiene **capas conductoras concéntricas** (foils) intercaladas en el
  aislamiento. Reparten el campo eléctrico radial y axialmente → gradiente **uniforme** → soporta
  más tensión en menos diámetro.
- El **último foil** se saca a un **tap capacitivo** (tap de prueba), que normalmente va a tierra.

## B) Capacitancias C1 y C2 (la "huella" del buje)

```
C1 = capacitancia principal:  conductor central ↔ último foil (tap)
C2 = capacitancia del tap:     último foil (tap) ↔ brida de tierra
```

- La prueba de **factor de potencia / `tan δ` de buje** mide `C1` (y `C2` según conexión) y su
  pérdida dieléctrica. Un **aumento de `tan δ`** o un **cambio de capacitancia** vs placa/historial
  delata humedad, contaminación o degradación del aislamiento → riesgo de falla del buje.
- Los valores de `C1`/`C2`/FP de fábrica vienen en la **placa del buje** → `⚠️ verificar`. La
  **interpretación** de la medida (límites, tendencia) es del lóbulo 49 (`../../pruebas-electricas/`).

> El **tap capacitivo** debe estar **aterrizado** en operación. Si queda flotante, aparece tensión
> peligrosa en el tap y puede dañar el buje. Es un punto de chequeo de inspección.

## C) Accesorios del transformador

| Accesorio | Función | Protección asociada |
|---|---|---|
| **Tanque** | contención del aceite y los devanados | sobrepresión súbita |
| **Conservador** (expansión) | absorbe dilatación térmica del aceite; con membrana aísla del aire | nivel de aceite |
| **Relé Buchholz** | detecta gas acumulado (incipiente) y flujo brusco (violenta) | alarma + disparo |
| **Válvula de sobrepresión súbita** | alivia el pico de presión de un arco interno | disparo (EG cap.6) |
| **Imagen térmica** (image coil) | simula el hot-spot del devanado | arranque de ventiladores / alarma / disparo |
| **Indicadores** | nivel, temperatura de aceite (top-oil) y de devanado | alarmas por umbral |
| **Desecante** (silica gel) | seca el aire que respira el conservador sin membrana | preventivo (humedad) |

- El **Buchholz** solo existe en equipos con **conservador** (camino de gas hacia arriba). Su disparo
  por flujo es una señal **mecánica/eléctrica** seria (arco interno) — no esperar a confirmar por DGA.
- La **imagen térmica** liga este lóbulo con `../sistema-refrigeracion` (gobierna el arranque de
  etapas) y con la vida del aislamiento (`../gestion-vida-activo`, hot-spot).

## D) Por qué importa para el diagnóstico

- **Bujes**: una fracción grande de fallas de transformador nace en el buje (FP creciente,
  contaminación, tap flotante). El FP de buje es un ensayo clave del plan → lóbulo 49.
- **Accesorios**: son la **protección de respaldo** ante fallas internas (Buchholz, sobrepresión) y
  el **gobierno térmico** (imagen térmica). Su estado condiciona la seguridad operativa.

→ Cálculos (Δcap, %FP): `02-calculos.md`. Identificar tipo de buje: `03-criterios-evaluacion.md`.
