# CLAUDE.md — SGM · TRANSPOWER · 🌉 PUENTE (este repo es el SITIO; el cerebro vive en la bóveda)

Tu cerebro NO está en este repo: está en `../brain-private/sgm-transpower/`, la bóveda privada hermana. Las tres
importaciones de abajo lo cargan al arrancar: el router, el estado (`05`) y la memoria corta (`10`). Si NO los ves en
tu contexto (por ejemplo, porque se rechazó la aprobación de importaciones externas), **léelos por ruta antes de tocar
nada**. Todas las rutas `docs/…`, `skills/…` y `_legacy/…` que cite el router son de esa carpeta, no de aquí.

@../brain-private/sgm-transpower/CLAUDE.md
@../brain-private/sgm-transpower/docs/05-ESTADO-GLOBAL.md
@../brain-private/sgm-transpower/docs/10-MEMORIA-CORTO-PLAZO.md

## Dónde se commitea cada cosa
- El cerebro (router, `docs/`, ADR, lecciones) se commitea **en la bóveda** (`cd ../brain-private`). Su pre-commit corre
  el linter sobre lo preparado.
- El sitio (HTML, CSS, JS, workflows e imágenes) se commitea **aquí**. Nunca los dos en el mismo commit.

## Reglas de oro de ESTE sitio
- El repo es **PÚBLICO**: cero secretos y cero cerebro. Nada de `docs/` del cerebro ni `CLAUDE.md` con contenido aquí.
- Despliegue: rama `DESARROLLO-/-PROYECTO-MJ` → merge a `main`. Pages publica SOLO la lista de permitidos de `pages.yml` (99 §211). El ADR se commitea en la bóveda ANTES del merge: el freno al publicar lo comprueba (99 §150, §212). Nunca push forzado a `main`.
- `git add` de rutas concretas. Nada de reescribir historia ni de saltarse los hooks (guard y deny globales).
