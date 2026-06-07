# 01 · Teoría — Resistencia óhmica de devanados

## Qué mide

La prueba inyecta una **corriente continua (DC)** conocida a través de un devanado y mide la
caída de tensión para obtener su **resistencia óhmica** por la ley de Ohm `R = V/I`. Los valores
son muy pequeños (rango de **mΩ**), así que se mide con un **ohmímetro de baja resistencia** por
el método **Kelvin de 4 hilos** (ver abajo). Es una verificación directa de la **integridad del
cobre y de todas las conexiones** del circuito: empalmes, soldaduras, terminales y los contactos
del cambiador de tomas (LTC/DETC).

## Por qué el método de 4 hilos (Kelvin) ⭐

Medir mΩ con 2 hilos es imposible: la resistencia de los propios cables de prueba y de los
contactos (decenas de mΩ) dominaría la lectura. El método **Kelvin de 4 hilos** separa:

- **2 hilos de corriente** (force) — inyectan la corriente DC.
- **2 hilos de tensión** (sense) — miden la caída SOLO sobre el devanado, sin incluir la
  resistencia de los cables de corriente ni de los contactos.

Así la lectura refleja la resistencia real del devanado, no la del montaje. La corriente debe ser
suficiente para una lectura estable pero **≤ 10% de la corriente nominal** del devanado (IEEE
C57.152) para no calentar el cobre y falsear la medida.

## Por qué la resistencia depende fuertemente de la temperatura ⭐

La resistividad del cobre (y del aluminio) **aumenta de forma casi lineal con la temperatura**:
en cobre, R sube ~**0.39%/°C**. Una misma bobina medida a 25 °C y a 75 °C da valores muy distintos.
**Sin corregir a una temperatura de referencia común, comparar resistencias no tiene sentido** —
ni contra fábrica, ni vs previos, ni entre fases si no están a la misma T. La corrección usa la
constante de temperatura del material `Tk` (234.5 °C cobre, 225 °C aluminio); ver `02-calculos.md`.

Además, tras energizar o tras inyectar DC, el devanado necesita **estabilización térmica**: la
lectura "fluye" mientras la corriente magnetiza/calienta. Se espera a que la lectura se asiente
y se registra la T del devanado (no la ambiente) en ese momento.

## Qué fallas revela

| Síntoma en R de devanados | Qué significa físicamente |
|---|---|
| Una fase con R **notablemente mayor** | **Mala conexión / empalme** flojo o **contacto degradado** en el camino de esa fase |
| R **alta solo en ciertos TAPs** | **Contacto del cambiador de tomas (LTC/DETC)** erosionado/picado en esa posición |
| R **infinita / no se estabiliza** | **Devanado abierto** o conexión interrumpida |
| R **menor** de lo esperado en una fase + TTR/excitación anómalas | Posibles **espiras en cortocircuito** (menos cobre efectivo) |
| R que **crece vs histórico** en una fase | Conexión que se está degradando (oxidación, aflojamiento) |

> A diferencia de la TTR (cociente, sin corrección de T), la R de devanados **siempre** se corrige
> a la temperatura de referencia. Continúa en `02-calculos.md` (fórmulas) y `03-criterios-evaluacion.md`.
