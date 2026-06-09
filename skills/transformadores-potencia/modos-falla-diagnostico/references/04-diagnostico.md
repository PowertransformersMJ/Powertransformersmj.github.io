# 04 · Diagnóstico — mapa síntoma → ensayo → lóbulo

> Lóbulo INTEGRADOR: cierra el arco `01→02→03→04` y conecta todas las skills hermanas. Este lóbulo
> **enruta**, no interpreta el aceite/DGA (eso es el lóbulo 49, `../../pruebas-electricas/`).

## A) Mapa síntoma → ensayo → responsable

| Síntoma observado | Esfuerzo | Ensayo que confirma | Responsable |
|---|---|---|---|
| `%Z` desviada de fábrica | mecánico | `%Z` + FRA | `../impedancia-cortocircuito`, `../construccion-nucleo-devanados` |
| Banda FRA desviada vs referencia | mecánico | SFRA | lóbulo 49 SFRA + `../construccion-nucleo-devanados` |
| Gases combustibles en aceite | térmico/eléctrico | DGA + Duval | lóbulo 49 (`dga`) |
| Punto caliente externo | térmico | termografía | `../sistema-refrigeracion` + lóbulo 49 |
| Papel envejecido (DP bajo) | térmico/químico | DP / 2-FAL furánicos | `../gestion-vida-activo` + lóbulo 49 |
| FP/tan δ de buje creciente | dieléctrico | FP de buje | `../bujes-y-accesorios` + lóbulo 49 |
| Humedad alta | químico | DFR / contenido de agua | lóbulo 49 (`analisis-aceite`) |
| Gas selectivo del OLTC | OLTC | DGA del OLTC + DRM | `../regulacion-tomas` + lóbulo 49 |
| Relación fuera de tolerancia | eléctrico | relación de transformación (TTR) | `../calculos-nominales`, `../grupo-vectorial-conexiones` |
| Excitación anómala / `Z0` rara | eléctrico/diseño | corriente de excitación + cruce de grupo | `../identificacion-tipo-transformador 03 §E` |
| Buchholz con gas | eléctrico/térmico | inspección + DGA del gas atrapado | `../bujes-y-accesorios` + lóbulo 49 |

## B) Reglas de enrutamiento (frontera de dominios)

```
PARÁMETRO del equipo (relación, %Z, grupo, etapa, C1/C2, DP)  →  skill hermana de equipo (lóbulo 50)
ENSAYO / aceite / DGA / interpretación de medida              →  lóbulo 49 (../../pruebas-electricas/)
```

- **No fabricar datos cruzando dominios** (doctrina del cerebro): este lóbulo NO inventa valores de
  aceite/DGA; los **enruta** al 49. Tampoco el 49 redefine la `%Z` de placa: la toma del 50.

## C) Errores típicos de diagnóstico cruzado

1. **Concluir con un solo indicador** → falso positivo. **Fix:** exigir coherencia entre ensayos
   (`02 §B`) y descartar alternativas (`03 §A` paso 5).
2. **Confundir el último eslabón con la causa raíz** (ej. "falló el aislamiento" cuando la raíz fue
   sobrecarga térmica que envejeció el papel). **Fix:** seguir la cadena completa (`01 §B`).
3. **Cruzar dominios fabricando datos** (inventar un DGA para "cerrar" el caso). **Fix:** enrutar al
   lóbulo 49; marcar `⚠️ verificar` lo no medido (`§B`).
4. **Ignorar la referencia histórica** → juzgar por valor absoluto. **Fix:** tendencia vs firma de
   referencia (`02 §C`).
5. **Saltar el protocolo ante bug recurrente** → adivinar el fix. **Fix:** telemetría → diagnóstico →
   reporte → STOP → autorización → fix (§3.3 del cerebro).

## D) Señales de alarma (multi-familia)

- Varios indicadores desviados a la vez (FRA + `%Z` + DGA) → falla mecánica con arco — prioridad alta.
- DP en zona EOL + historia de cortocircuitos → fragilidad mecánica — restringir carga.
- Buchholz/sobrepresión disparados → falla violenta — sacar de servicio, no esperar DGA.
- FP de buje + DGA de buje crecientes → falla dieléctrica de buje incipiente.

## E) Cierre — del síntoma a la acción

```
SÍNTOMA reportado
   ├─ esfuerzo dominante ......... §A + 01 §A
   ├─ familia de falla .......... 01 §C
   ├─ ensayo(s) que confirman ... §A (mapa) + lóbulo 49
   ├─ alternativas descartadas .. 03 §A paso 5 (anti-falso-positivo)
   └─ CAUSA RAÍZ → acción ....... telemetría→diagnóstico→reporte→STOP→autorización→fix (§3.3)
```

> Los umbrales de acción, las tablas DGA (C57.104-2019) y los criterios de MO.00418 quedan
> `⚠️ verificar` hasta confirmar contra la norma directa y el lóbulo 49. Este lóbulo ordena la
> causalidad; la **interpretación de la medida** vive en `../../pruebas-electricas/`.
