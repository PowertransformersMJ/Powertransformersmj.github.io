# 02 · Cálculos — método correcto, entradas, corrección

> Esta prueba tiene poca "matemática" pero un **método estricto**: el valor solo es válido
> si se midió a **500 Vdc** con la **tierra del núcleo desconectada**. El error más común no
> es de cálculo, es de procedimiento (medir con la tierra puesta → lectura ~0 sin significado).

## Entradas requeridas

| Entrada | Símbolo | Obligatoria | Nota |
|---|---|---|---|
| IR núcleo–tierra medida | R_med | Sí | en MΩ/GΩ, a **500 Vdc** |
| Tensión de prueba | V_prueba | Sí | **500 Vdc** (NO 5 kV — dañaría el aislamiento del núcleo) |
| Pletina de tierra del núcleo levantada | — | Sí ⭐ | sin desconectarla la medida no informa |
| Temperatura | T | recomendable | para tendencia y comparación vs fábrica |
| Dato de fábrica / commissioning | — | preferente | máxima precedencia |
| DGA reciente (correlación) | — | recomendable | C₂H₄/C₂H₆/CH₄ confirman corriente circulante |
| Corriente de tierra del núcleo (si se midió) | I_tierra | opcional | ⚠️ límite práctico ~0.1 A (verificar) |

---

## 1) Validación del método (hacer SIEMPRE primero)

```
SI V_prueba ≠ 500 Vdc            → medida NO comparable con el criterio (repetir a 500 Vdc)
SI tierra del núcleo NO levantada → lectura ≈ 0 por la tierra intencional → INVÁLIDA
```

Solo con 500 Vdc y la pletina desconectada la lectura representa el **aislamiento real**
núcleo↔tierra. Documentar ambos hechos en el reporte.

---

## 2) Evaluación directa (sin corrección, criterio de campo)

```
R_med  vs  500 MΩ (NETA §7.2.2.D.11)  y  vs  dato de fábrica
```

- **R_med ≥ 500 MΩ** y comparable a fábrica → **APRUEBA** (aislamiento sano, una sola tierra).
- **R_med < 500 MΩ** → **INVESTIGAR / RECHAZA** según cuán baja: pocos MΩ o kΩ ⇒ casi seguro
  un **segundo punto de tierra** → ir a `04-diagnostico.md`.

**Ejemplo**: R_med = 2.3 GΩ @ 500 Vdc, tierra levantada → 2300 MΩ ≥ 500 MΩ ⇒ **APRUEBA**
(coherente con fábrica si baseline ~ GΩ).

**Ejemplo de falla**: R_med = 0.8 MΩ @ 500 Vdc → ≪ 500 MΩ ⇒ **RECHAZA** → segundo aterrizaje
probable → confirmar con DGA (C₂H₄/C₂H₆) y termografía.

---

## 3) Corrección de temperatura (opcional, para tendencia)

La IR del núcleo es **menos sensible a T** que la del devanado (no es aislamiento celulósico-
aceite masivo), pero si se compara contra un baseline a otra temperatura se puede aplicar el
factor de la **Tabla 100.14** (columna que corresponda) como aproximación. ⚠️ El criterio de
campo (≥500 MΩ) se aplica al valor medido; la corrección sirve sobre todo para comparar
tendencia limpia. Anotar siempre T y si se corrigió.

---

## 4) Correlación con corriente circulante (si hay medida de I de tierra)

```
Núcleo sano:  I por la pletina de tierra ≈ unos mA (capacitiva)
2 puntos de tierra:  I circulante puede superar ~0.1 A (⚠️ verificar límite) → calentamiento
```

Una corriente de tierra del núcleo alta es evidencia **convergente** con la IR baja: ambas
apuntan al segundo aterrizaje.

---

## Pseudocódigo de referencia (para portar al tablero)

```
function evaluarNucleo({R_med, Vprueba, tierraLevantada, datoFabrica, dga}) {
  if (Vprueba !== 500 || !tierraLevantada) return {valido:false, nota:'método inválido'};
  const min = 500; // MΩ — NETA §7.2.2.D.11
  const pasaNeta = R_med >= min;
  const pasaFabrica = datoFabrica ? R_med >= 0.5 * datoFabrica : null; // caída fuerte = alerta
  const sospechaMultiTierra = !pasaNeta || (dga?.C2H4_C2H6_alto);
  // veredicto + convergencia DGA → ver 03 y 04
}
```
