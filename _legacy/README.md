# 🗄️ _legacy/ — Cuarentena de archivos descartados

> Carpeta de cuarentena. Los archivos que se mueven aquí **no se sirven ni se enlazan**
> desde ninguna parte del proyecto. Se conservan en vez de borrarse para poder
> revertir si hiciera falta (Reflejo del límite de guardián, `CLAUDE.md §G.4`:
> "apendar, no sobrescribir; cuarentenar, no borrar").
>
> Verificación previa al mover (doctrina `CLAUDE.md §3.3`): cero referencias internas
> (`grep` en HTML/JS/MJS/JSON/TS) y ninguno aparece en sitemap/manifest/router.

| Archivo | Qué era | Por qué se cuarentenó | Fecha |
|---|---|---|---|
| `CLAUDE-previo.md` | CLAUDE.md monolítico previo (3081 líneas / ~200 KB): plan maestro F0–F37, 14 reglas permanentes §0.1.2.*, handoff de diseño visual §9, protocolo de push/token §0.1. | Reemplazado por el cerebro neuronal (router corto + neuronas on-demand). Cosechado lo esencial a §1 / 05 / 20 / 30; el resto queda como respaldo consultable on-demand. | 2026-06-04 |

## Cómo revertir un archivo

```bash
git mv _legacy/<archivo> <ruta-original>
```

Si tras un tiempo confirmamos que ninguno hace falta, se borran definitivamente
en una fase posterior (con ADR que lo justifique).
