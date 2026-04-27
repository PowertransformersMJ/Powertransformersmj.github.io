# UI v3 — Dark Mode sobre foto de subestación

Fecha de cierre: **2026-04-27** · Tag CHANGELOG: **v2.5.0**

> Documento de decisiones de diseño del refactor visual UI v3.
> Complementa `CLAUDE.md` §9 (handoff entre sesiones) y la entrada
> v2.5.0 del CHANGELOG.

## 1. Contexto

La sesión 2026-04-25 cerró con `v2.1.0-aqua` — sistema Aqua light
perla con foto de fondo `substation-photo.png` 755×752 px y luego
3840×2400 (con padding blanco interno). El director reportó:

1. La foto no cubría toda la pantalla en producción.
2. El sidebar opaco tapaba la foto en el lado izquierdo.
3. Después del fix de transparencia, los espacios blancos a los
   lados de la subestación seguían visibles ("la imagen útil debe
   ocupar todo el fondo, no los espacios en blanco").
4. La foto vieja era un thumbnail con padding embebido.

Esta sesión 2026-04-27 PM resuelve los 4 puntos y cambia el modo
visual a **dark mode** sobre una foto nueva (`IMG_9840.HEIC` →
`substation-photo.jpg`) que el director subió expresamente.

## 2. Foto de fondo

### 2.1 Pipeline HEIC → JPEG

```python
import pillow_heif; pillow_heif.register_heif_opener()
from PIL import Image
img = Image.open('IMG_9840.HEIC').convert('RGB')
# Resize: max 2560 wide manteniendo aspect ratio (4:3 original)
if img.width > 2560:
    ratio = 2560 / img.width
    img = img.resize((2560, int(img.height * ratio)), Image.LANCZOS)
img.save('substation-photo.jpg', 'JPEG',
         quality=88, optimize=True, progressive=True)
```

| | HEIC original | JPEG procesado |
|---|---|---|
| Dimensiones | 5712×4284 (4:3) | 2560×1920 (4:3) |
| Peso | 3.9 MB | 1.16 MB |
| Compatibilidad | solo Safari como CSS bg | universal |
| Padding interno | ninguno | ninguno |

### 2.2 Por qué JPEG y no PNG

PNG sin pérdida sobre una foto fotográfica de 5+ MP genera archivos
de 8-15 MB. JPEG q88 progressive da calidad visual indistinguible
para fondos a 1.16 MB. El director prioriza performance del sitio
en producción.

### 2.3 Por qué 2560 px de ancho y no más

- Retina 4K (3840 px) es el tope teórico de pantalla actual
- Pero como background-cover, se escala a viewport
- 2560 cubre todos los viewports actuales sin pixelado perceptible
- 5712 px (HEIC original) era overkill — 2.5× más peso sin
  diferencia visual

### 2.4 Detección de padding blanco

Reglas para validar fotos antes de comprometerlas:

```python
import numpy as np
arr = np.array(img.convert('RGB'))
non_white = np.any(arr < 245, axis=2)
rows = np.any(non_white, axis=1)
cols = np.any(non_white, axis=0)
rmin, rmax = np.where(rows)[0][[0, -1]]
cmin, cmax = np.where(cols)[0][[0, -1]]
# Si rmin > 0, hay padding superior; si cmin > 0, izquierdo; etc.
```

Si la foto tiene padding, recortar al bounding box antes de usar
`background-size: cover`. La foto del thumbnail viejo tenía 60%
de área como padding (commit `b69ec35` lo recortó).

## 3. Tokens del sistema

### 3.1 Inks (texto)

```css
--ink-1: #f3f7ff;   /* títulos, números KPI · cool white */
--ink-2: #d6e0ec;   /* cuerpo, items menú · light steel */
--ink-3: #a0b3ca;   /* subtítulos, meta · muted blue-gray */
--ink-4: #6f7f96;   /* placeholder · low contrast */
```

Familia cromática **steel-navy invertida** del light mode previo
(`#0d1f38 → #f3f7ff`, mismo H pero L invertida). Mantiene
identidad corporativa GE/Siemens/ISA pero legible sobre foto
nocturna.

### 3.2 Glass tokens

```css
--glass-thin:    linear-gradient(140deg, rgba(8,18,35,.32) 0%, rgba(12,24,42,.20) 100%);
--glass-regular: linear-gradient(140deg, rgba(8,18,35,.42) 0%, rgba(12,24,42,.28) 100%);
--glass-thick:   linear-gradient(140deg, rgba(8,18,35,.55) 0%, rgba(12,24,42,.40) 100%);
--glass-ultra:   linear-gradient(140deg, rgba(8,18,35,.72) 0%, rgba(12,24,42,.56) 100%);

--glass-blur-thin:    blur(28px) saturate(170%) brightness(96%);
--glass-blur-regular: blur(40px) saturate(180%) brightness(94%);
--glass-blur-thick:   blur(54px) saturate(190%) brightness(92%);
```

**Cambio crítico vs light mode**: tints son `rgba(8,18,35,X)` (navy
oscuro) en vez de `rgba(255,255,255,X)`. `brightness` reducido a
92-96% (era 108-110% en light) para no aclarar de más en
composición sobre foto oscura.

### 3.3 Specular y borders

```css
--glass-border-top:    rgba(255,255,255,.42);  /* highlight superior, era .98 en light */
--glass-border-bottom: rgba(0,0,0,.30);        /* sombra inferior, era rgba(0,40,90,.10) en light */
--glass-ring:
  inset 0 1.5px 0 rgba(255,255,255,.42),
  inset 0 -1px 0 rgba(0,0,0,.30),
  ...;

--glass-specular:
  radial-gradient(ellipse 80% 50% at 22% -12%, rgba(255,255,255,.32) 0%, ...);
```

Highlight superior reducido (.42 vs .98 light) para no parecer
plástico sobre dark mode. El borde inferior usa negro real
(`rgba(0,0,0,.30)`) para sombra perceptible.

## 4. Layout y elementos

### 4.1 Foto de fondo · `.aqua-power-scene`

```css
.aqua-power-scene {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;          /* fallback para iOS Safari sin recortes */
  min-width: 100%;
  min-height: 100%;
  z-index: -1;
  background-image: url("../img/aqua/substation-photo.jpg");
  background-position: center center;
  background-size: cover;
  background-color: var(--bg-1, #f4f6fb);  /* fallback durante carga */
}
```

**Invariante**: cualquier sesión que toque esta regla tiene que
preservar el full-viewport. Si la foto cambia, mantener `cover` y
verificar que no tenga padding interno (§2.4).

### 4.2 Sidebar · `.sb`

```css
.sb {
  position: fixed; top: 0; left: 0; bottom: 0; width: 264px;
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border-right: 1px solid rgba(255,255,255,.18);
  box-shadow: 1px 0 0 rgba(255,255,255,.12),
              24px 0 60px -16px rgba(0,40,90,.04);
  z-index: 100;
}
```

Sidebar **completamente transparente** sin blur. La foto se ve a
través directamente. Borde derecho sutil (`rgba .18`) para
delimitar visualmente.

Texto del sidebar tiene `text-shadow` oscuro para legibilidad:

```css
body.aqua .sb-item,
body.aqua .sb-brand-head,
.sb-group-title {
  text-shadow: 0 1px 2px rgba(0,8,20,.65), 0 0 4px rgba(0,8,20,.45);
}
```

El halo oscuro pop el texto claro contra zonas brillantes de la foto
(luces sobre aisladores, reflejos del cielo).

### 4.3 Topbar · `.tb`

```css
.tb {
  position: fixed; top: 0; left: 264px; right: 0;
  background: linear-gradient(180deg, rgba(8,18,35,.45) 0%, rgba(8,18,35,.30) 100%);
  backdrop-filter: blur(36px) saturate(180%) brightness(96%);
  border-bottom: 1px solid rgba(255,255,255,.10);
  height: 64px;
}
.tb.is-scrolled {
  background: linear-gradient(180deg, rgba(8,18,35,.62) 0%, rgba(8,18,35,.50) 100%);
  backdrop-filter: blur(52px) saturate(200%) brightness(94%);
}
```

Glass dark con blur fuerte. Search box dentro: `rgba(255,255,255,.06)`
(translucent dark) con border `rgba(255,255,255,.16)`.

### 4.4 Page titles flotantes (sobre foto, sin card)

```css
.page-title {
  color: var(--ink-1);
  text-shadow: 0 1px 2px rgba(0,8,20,.70), 0 2px 12px rgba(0,8,20,.50);
}
.page-title em {
  color: var(--brand-hi);   /* era var(--brand) en light · ajustado para visibilidad */
}
.page-sub {
  color: var(--ink-3);
  text-shadow: 0 1px 2px rgba(0,8,20,.60);
}
.section-title {
  text-shadow: 0 1px 2px rgba(0,8,20,.65), 0 2px 8px rgba(0,8,20,.45);
}
```

## 5. Sidebar drilldown de contratos

Estructura final (4 niveles):

```
Contratos ▾
  Suministro de Elementos y Accesorios para Transformadores de Potencia ▾
    4123000081 ▾
      ─ Control y Gestión Operativa
      ─ Información Contractual
    4125000143 ▾
      ─ Control y Gestión Operativa
      ─ Información Contractual
```

### 5.1 Markup

`assets/js/aqua-shell.js` líneas 184-228 (aprox).

```html
<div class="sb-tree sb-tree-nested" data-tree-key="contrato-4123000081">
  <a href="pages/contrato.html?id=4123000081" class="sb-item sb-item-grandchild">
    <code class="sb-contrato-num">4123000081</code>
    <button class="sb-caret sb-caret-sm" aria-expanded="false" ...>
      <i data-lucide="chevron-down"></i>
    </button>
  </a>
  <div class="sb-children" data-tree-children="contrato-4123000081">
    <a href="pages/contrato.html?id=4123000081" class="sb-item sb-item-greatgrandchild">
      <span class="sb-child-bullet"></span>
      <span class="sb-section-text">Control y Gestión Operativa</span>
    </a>
    <a href="pages/contrato.html?id=4123000081#tab=info-contractual"
       class="sb-item sb-item-greatgrandchild" data-tab="info-contractual">
      <span class="sb-child-bullet"></span>
      <span class="sb-section-text">Información Contractual</span>
    </a>
  </div>
</div>
```

### 5.2 CSS de los niveles

| Selector | Nivel | Padding-left | Font | Weight | Color |
|---|---|---|---|---|---|
| `.sb-item` | 1 | 14px | 13.5px | 500 | `--ink-2` |
| `.sb-item-child` | 2 | 24px | 13px | 500 | `--ink-2` |
| `.sb-item-grandchild` | 3 | 50px | 12px | 500 | `--ink-2` |
| `.sb-item-greatgrandchild` | 4 | 64px | 11.5px | 500 | `--ink-2` |

Niveles 4 (greatgrandchild) son **proper case** (no uppercase). El
director lo pidió expresamente — antes de la sesión los había
estilado uppercase como section labels.

### 5.3 Active state

`assets/js/aqua-shell.js` función `markActive()`:

1. Compara pathname + folder.
2. Compara `?id=` query.
3. Compara `#tab=` hash:
   - Si la URL actual tiene `#tab=X`, solo el item con `tabLink ===
     X` gana.
   - Si la URL no tiene hash, gana el item raíz (sin tabLink).
4. Walk-up de árboles ancestros: marca `.is-expanded` en todo el
   chain (no solo el padre inmediato).

```javascript
let node = winner.a.parentElement;
while (node) {
  if (node.classList && node.classList.contains('sb-tree')) {
    node.classList.add('is-expanded');
    const btn = node.querySelector(':scope > .sb-item .sb-caret, ...');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
  node = node.parentElement;
}
```

### 5.4 Default-state de árboles

`bindTreeToggle()` ahora respeta el `aria-expanded` inicial del botón
caret:

```javascript
const btn = tree.querySelector(':scope > .sb-item .sb-caret, ...');
const defaultExpanded = btn ? btn.getAttribute('aria-expanded') !== 'false' : true;
if (defaultExpanded) tree.classList.add('is-expanded');
```

Defaults actuales:
- Contratos: expanded (top-level)
- Suministro de…: expanded (categoría)
- 4123000081 / 4125000143: collapsed (clic para abrir)

## 6. Service Worker · kill-switch

`sw.js` actual:

```javascript
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) c.navigate(c.url);
  })());
});
```

Cuando un navegador descarga este `sw.js` y activa el nuevo SW,
borra TODOS los caches locales del sitio + se desregistra a sí
mismo + navega las pestañas controladas. El sitio queda funcionando
sin SW intermediando.

`pages/dashboard.html` ya NO llama `navigator.serviceWorker.register()`
(removido en commit `5faf14b`). Si nadie registra, nadie re-instala.

### 6.1 Por qué se mató el SW

El SW cache-first F34 original (`CACHE_VERSION = 'sgm-v3-5-2'`)
seguía sirviendo CSS viejo aunque GitHub Pages tuviera el nuevo.
Bumpear `CACHE_VERSION` no era suficiente porque Safari decide
cuándo chequear `sw.js` (hasta 24h). Network-first tampoco resolvía
el bootstrap (necesitabas el nuevo SW corriendo, pero el SW viejo
seguía interceptando).

Solución de raíz: kill-switch. Se sacrifica la PWA offline-first
temporalmente. Se reintroducirá después con strategy network-first
probada.

## 7. Cómo iterar visualmente desde aquí

1. **Cambio de color/spacing/radius** → `aqua-tokens.css`.
2. **Cambio de un componente específico** (sidebar, modal, topbar,
   page-title, KPI card) → `aqua-components.css`.
3. **Cambio en estructura del shell** (qué se inyecta, navegación)
   → `aqua-shell.js`.
4. **Cambio de la foto de fondo** → reemplazar
   `assets/img/aqua/substation-photo.jpg` (verificar §2.4 padding).
5. **Push** vía PR contra `main`. CI corre lint + tests
   automáticamente.

Reglas duras:
- **Modo dark obligatorio**. Inks claros (`#f3f7ff…`), glass
  `rgba(8,18,35,X)`. NO usar `rgba(255,255,255,X)` para tints.
- **Foto cubre 100vw × 100vh × 100dvh** (invariante).
- **No revertir a Aqua light perla** sin discutirlo con el director.
- **Proper case** en items navegacionales (no uppercase).
- **No tocar** `assets/js/data/`, `domain/`, `firestore.rules`,
  `firestore.indexes.json`, `storage.rules`, `functions/` para
  cambios visuales.

## 8. Pendientes con compromiso

1. **Tab "Información Contractual"** en `pages/contrato.html` con
   contenido real cuando el director suba los datos. URL destino
   ya cableada: `pages/contrato.html?id=NNN#tab=info-contractual`.
2. **Reactivar PWA offline-first** después de validar que los
   deploys quedan estables. Reemplazar kill-switch por SW
   network-first probado.
3. **Revocar `ghp_kzk3…` PAT** cuando el director termine la
   iteración visual.
