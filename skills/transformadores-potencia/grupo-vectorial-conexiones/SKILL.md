---
name: grupo-vectorial-conexiones
description: Lee, interpreta y verifica el GRUPO VECTORIAL (grupo de conexión) de un transformador de potencia — conexiones Y/Δ/zigzag, índice horario (desfase angular en múltiplos de 30°), polaridad, y el mapeo ANSI ↔ IEC. Deriva de ahí el factor √3 de la relación de línea, las condiciones para operar en PARALELO y la compensación de desfase para protección diferencial. Úsala SIEMPRE que el usuario mencione grupo de conexión, grupo vectorial, Dyn/YNd/YNyn/Dd/Zigzag, índice horario, reloj/clock, desfase angular, polaridad aditiva/sustractiva, conexión estrella/delta/zigzag, operación en paralelo de transformadores, o pregunte qué desfase tiene un equipo — incluso si no usa la palabra "grupo".
---

# Grupo vectorial / grupo de conexión

El grupo de conexión codifica TRES cosas en una etiqueta corta (p.ej. `YNd1`): la **conexión**
de cada devanado (Y/Δ/Z), si el **neutro** sale a borne (`n`/`N`), y el **desfase angular**
entre AT y BT (índice horario × 30°). De él dependen el **factor √3** de la relación de línea,
si dos transformadores pueden ir en **paralelo**, y cómo se **compensa el desfase** en la
protección diferencial. Leerlo mal propaga error a la relación, al paralelo y a la protección.

## Cuándo se dispara

El usuario menciona un grupo (Dyn11, YNyn0d, Dd0, zigzag…), pregunta el desfase/índice horario
de un equipo, quiere poner dos transformadores en paralelo, o necesita el factor √3 correcto
para validar una relación de placa. También al cargar una placa nueva al tablero.

## Workflow (6 pasos)

1. **Lee la etiqueta de grupo** de la placa: letra(s) mayúscula(s) = AT, minúscula(s) = BT/MT,
   `N`/`n` = neutro accesible, número final = índice horario. → `references/03-criterios-evaluacion.md`.
2. **Traduce el índice horario** a grados: `desfase = h × 30°` (BT respecto a AT). → `02-calculos.md`.
3. **Deriva el factor √3** de la relación de línea según las conexiones del par (Yy/Dd→a; Dy→a/√3;
   Yd→a·√3). Cruza con `../_conocimiento/convenciones-calculo.md §B`.
4. **Si es para paralelo**: verifica las 4 condiciones (mismo grupo/desfase, misma relación,
   mismo %Z dentro de tolerancia, misma polaridad/secuencia). → `04-diagnostico.md §A`.
5. **Si es para protección diferencial**: determina la compensación de desfase (hoy numérica en
   el relé; antes por conexión de TC). → `04-diagnostico.md §B`.
6. **Emite la ficha de grupo** (formato abajo), marcando lo no confirmable `⚠️ verificar`.

## Árbol de lectura (resumen ejecutable)

```
Etiqueta = [CONEXIÓN AT][n? ][conexión BT][n? ][índice horario]
   ej. Y N d 1   →  AT en estrella, neutro AT accesible, BT en delta, BT atrasa 30°
   ej. D yn 11   →  AT en delta, BT en estrella con neutro, BT adelanta 30°
Índice 0  →  0°    (AT y BT en fase: Yy0, Dd0)
Índice 1  →  −30°  (BT atrasa; típico Dy1 / Yd1)
Índice 11 →  +30°  (BT adelanta; típico Dy11 / Yd11 — preferido IEC)
Índice 6  →  180°  (oposición)
```

## Neuronas (lee según necesites)

- `references/01-teoria.md` — conexiones Y/Δ/zigzag, qué codifica el grupo, por qué hay desfase, índice horario.
- `references/02-calculos.md` — índice→grados, factor √3 por par, polaridad, cómo se determina el desfase.
- `references/03-criterios-evaluacion.md` — leer la etiqueta de placa, mapeo ANSI↔IEC, grupos comunes (multi-norma).
- `references/04-diagnostico.md` — paralelo (condiciones + corrientes circulantes), protección diferencial, errores típicos.

Marcos compartidos: `../_conocimiento/00-fundamentos-transformador.md`,
`../_conocimiento/marco-normativo-tx.md`, `../_conocimiento/convenciones-calculo.md`.

## Formato de salida (ficha de grupo)

```
GRUPO DE CONEXIÓN: <p.ej. YNd1>
  AT: <Y/Δ/Z> · neutro accesible: <sí/no>
  BT: <y/d/z> · neutro accesible: <sí/no>
  ÍNDICE HORARIO: <0..11>  → DESFASE BT vs AT: <h×30°>°  (<atrasa/adelanta/en fase>)
FACTOR √3 EN RELACIÓN DE LÍNEA: <a | a/√3 | a·√3>  (según conexiones del par)
POLARIDAD: <aditiva/sustractiva — ANSI>   SECUENCIA: <ABC/…>
APTO PARA PARALELO CON: <mismo grupo/desfase + misma relación + %Z ±tol + misma polaridad>
COMPENSACIÓN DIFERENCIAL: <ángulo a compensar en el relé = índice×30°>
⚠️ VERIFICAR: <desfase estándar de la flota AFINIA / norma del director; valores no confirmados>
```

→ El grupo determina cómo se calcula la relación (`calculos-nominales`) y se cruza con la
tipificación (`identificacion-tipo-transformador`): un 3.er símbolo `…d` en el grupo delata un
terciario en delta. Para evaluar la relación medida vs tolerancia → `../../pruebas-electricas/`.
