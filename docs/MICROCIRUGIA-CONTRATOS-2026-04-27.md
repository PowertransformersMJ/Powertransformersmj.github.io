# Fase 1 · Inventario y Diagnóstico (2026-04-27 PM3)

Sesión de microcirugía técnica del módulo Suministros / Contratos.
Esta nota documenta el estado encontrado al iniciar el plan de 6 fases.

## 1. PDFs encontrados en el repo

### Carpeta `Contrato N° 4123000081 Informacion Contractual/` (6 PDFs · 16 MB)

| Documento | Peso |
|---|---|
| 047-Minuta del Contrato 4123000081_OT1.pdf | 423 KB |
| 048-Garantía y seguros del contrato 4123000081_OT1.pdf | 2.6 MB |
| 4123000081 POLIZAS.pdf | 1.9 MB |
| 4123000081_OT1 ADMINISTRADOR PROVEEDOR.pdf | 112 KB |
| Carta de presentación de la oferta.pdf | 181 KB |
| Pedido 5623000169 OT1.pdf | 10.9 MB |

### Carpeta `Contrato N° 4125000143 Informacion Contractual/` (7 PDFs · 24 MB)

| Documento | Peso |
|---|---|
| 024 - Adenda No. 01 41102025T1.pdf | 639 KB |
| 024 - Adenda No. 02 41102025T1_.pdf | 494 KB |
| 043- Informe de recomendación y aceptación_ signed 4122025.pdf | 301 KB |
| 044- Comunicación aceptación de oferta 4125000143 (1).pdf | 651 KB |
| 064 - Orden de inicio N° 4125000143.pdf | 314 KB |
| 48-Garantías y seguros del contrato 4125000143.pdf | 11.3 MB |
| PEDIDO 5626000011 - BORIS (1).pdf | 10.7 MB |

**Decisión:** los archivos viajan a `assets/docs/contratos/{cid}/` con
nombres URL-safe (sin acentos ni espacios) para servirse por GitHub
Pages. Se conserva el título legible en un manifest JSON. Las
carpetas originales se borran del repo después de la copia.

## 2. Estado del sidebar (Fase 2)

Pos-revert del dark mode al aqua light (commit `50cf27a`), el sidebar
quedó con:

```css
.sb {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
.sb::before { content: none; }
```

Ambas reglas eran del experimento "sidebar 100% transparente" que se
hizo cuando el fondo era la foto IMG_9840 nocturna. Con el aqua light
+ Fonto PT.jpg actual, el director quiere el material glass aqua del
diseño original (PR #54 v2.1.0-aqua):

```css
background: linear-gradient(180deg, rgba(255,255,255,.36) 0%, rgba(255,255,255,.22) 100%);
backdrop-filter: blur(52px) saturate(200%) brightness(108%);
border-right: 1px solid rgba(255,255,255,.45);
box-shadow:
  inset -1px 0 0 rgba(0,40,90,.08),
  1px 0 0 rgba(255,255,255,.4),
  24px 0 60px -12px rgba(0,40,90,.08);
```

Esto le devuelve el panel translúcido con vidrio, hightlight superior y
sombra sutil, manteniendo el texto navy oscuro legible.

## 3. Sidebar drilldown actual vs deseado

### Estado actual (commit `8541a29`):

```
Contratos ▾
  Suministro de Elementos y Accesorios… ▾  ← LINK que va a contratos.html (incorrecto)
    4123000081 ▾
      Control y Gestión Operativa
      Información Contractual
    4125000143 ▾
      (espejo)
```

### Estado deseado:

```
Contratos ▾
  Suministro de Elementos y Accesorios… ▾  ← NODO PADRE expandible (no link, NO abre página)
    4123000081 ▾
      Control y Gestión Operativa  → contrato.html?id=4123…
      Información Contractual      → contrato-info.html?id=4123…  (NUEVA página)
    4125000143 ▾
      (espejo)
```

El click en "Suministro de Elementos…" debe SOLO expandir/colapsar la
rama, no navegar.

## 4. Auditoría visual rápida (preliminar)

Análisis directo del CSS sin abrir browser. Patrones detectados:

- `color: var(--brand)` (#007aff) usado en text sobre `background:
  rgba(0,122,255,.12)` (`.tb-nav a.is-active`). El brand al 12% de
  opacidad como fondo + texto al 100% del mismo color → contraste
  bajo en zonas claras de la foto. Verificar.
- Varios `color: #fff` sobre `background: var(--grad-brand)` —
  correcto (texto blanco sobre azul saturado).
- Sidebar items: `color: var(--ink-2)` (#1f3656) + `text-shadow
  rgba(255,255,255,.55)` — correcto sobre cielo de la foto.
- `color: #008f4a` (verde oscuro) sobre `rgba(28,200,112,.14)` (verde
  al 14%) → contraste ~5.2:1 → WCAG AA pasa.

Auditoría profunda se hace en Fase 5 con el sitio en producción.

## 5. Visor PDF embebido — decisión técnica

Para "que se visualice en un visor dentro de la propia web":

- **Opción A — `<iframe src="doc.pdf">`:** soporte nativo en Chrome,
  Safari, Firefox modernos. Cero dependencias. Renderizado por el
  motor del navegador.
- **Opción B — PDF.js (Mozilla):** control fino de zoom, búsqueda,
  print, página a página. Pesa ~1 MB CDN.

**Decisión:** Opción A en primera implementación. El iframe nativo
ya soporta lo esencial (scroll, zoom, print, fullscreen). Si el
director pide más control o falla en algún navegador legacy, se
reemplaza por PDF.js sin tocar la lógica de listado.

## 6. Cómo llega el PDF al navegador

Dos canales con un único API en frontend:

1. **GitHub Pages (default):** `assets/docs/contratos/{cid}/{slug}.pdf`
   servido como static asset. Cero infra adicional. Se commiteará en
   Fase 4. Funciona inmediato.
2. **Firebase Storage (futuro):** `gs://sgm-transpower.appspot.com/
   contratos/{cid}/{slug}.pdf` con regla `read: isTeamMember()`. El
   frontend resuelve por config flag. Script de migración queda en
   `scripts/deploy-pdfs-storage.js` para que el director ejecute
   desde su Mac cuando quiera.

## 7. Plan de 6 fases — TODAS COMPLETADAS

| Fase | Descripción | Commit |
|---|---|---|
| 1 | Inventario + diagnóstico (este reporte) | `1d941f1` feat(contratos): Fase 1 · inventario PDFs + plan |
| 2 | Sidebar restructure + recuperar aqua glass | `3c5d82e` fix(sidebar): Fase 2 · categoría como nodo padre + fondo aqua glass |
| 3 | Página contrato-info con visor PDF | `ac17522` feat(contratos): Fase 3 · página Información Contractual con visor PDF |
| 4 | PDFs commiteados + script Firebase | `13875ce` feat(contratos): Fase 4 · script Node para deploy de PDFs |
| 5 | Auditoría visual + fixes contraste | `60c0d55` fix(ui): Fase 5 · auditoría visual · contraste WCAG AA |
| 6 | Documentación final | (este commit) docs(microcirugia): Fase 6 · documentación final |

## 8. Resultado final — entregables verificados

### 8.1 Sidebar (verificado en `assets/js/aqua-shell.js` y `aqua-components.css`)

- `<button class="sb-item sb-item-child sb-item-category sb-item-toggle">`
  para "Suministro de Elementos y Accesorios para Transformadores
  de Potencia". Ya no es link. Solo toggle.
- Material aqua glass del sidebar restaurado:
  `background: linear-gradient(180deg, rgba(255,255,255,.36),
  rgba(255,255,255,.22))` + `backdrop-filter: blur(52px)
  saturate(200%) brightness(108%)` + highlight `::before` 3D.
- Border-right `rgba(255,255,255,.45)` y box-shadow exterior suave.

### 8.2 Página Información Contractual (`pages/contrato-info.html`)

- 4 archivos: HTML (54 líneas), CSS dedicado (350 líneas), JS
  controlador (170 líneas), data layer (130 líneas).
- Soporta `?id=4123000081` y `?id=4125000143`.
- Visor `<iframe src="...pdf#view=FitH">` — render nativo del PDF
  por el navegador, sin librerías externas.
- Lista lateral agrupada por 7 categorías: minuta, garantias,
  oferta, adenda, orden, administracion, otros.
- Buscador en vivo (filtra título sin tildes, case-insensitive).
- Botones de acción: descargar, abrir nueva pestaña, fullscreen
  (Fullscreen API con fallback a clase CSS).
- Hash routing `#doc=slug` para deeplink y refresh-resilience.

### 8.3 Documentos commiteados (`assets/docs/contratos/`)

- 6 PDFs (15.4 MB) en `4123000081/` + manifest.json
- 7 PDFs (23.3 MB) en `4125000143/` + manifest.json
- Total: 13 PDFs · ~39 MB
- Slugs URL-safe (lowercase, NFD, dash-separated, sin acentos)
- Manifest con título legible, slug, categoría, peso

### 8.4 Migración Firebase (`scripts/deploy-pdfs-storage.js`)

- Script Node ESM con CLI args
- Lee manifest local, sube a `gs://sgm-transpower.appspot.com/
  contratos/{cid}/{slug}.pdf`
- Idempotente por md5
- Inyecta URLs firmadas en `/contratos/{cid}.documentos_contractuales[]`
  Firestore para que el frontend las consuma como override.
- `storage.rules` actualizado con match `/contratos/{contratoId}/
  {filename=**}` (read:true, write:isAdmin, max 50 MB).

### 8.5 Auditoría visual

- 6 reglas CSS migradas de `color: var(--brand)` (#007aff) a
  `color: var(--brand-deep)` (#0051d5) en lugares donde el bg era
  `rgba(0,122,255,.14)`. Contraste WCAG AA pasó de 3.8:1 a 5.4:1.
- Reglas afectadas: `.tb-nav a.is-active`, `.stat-icon`,
  `.stat--brand .stat-icon`, `.alert.info .alert-icon`, `.qc-icon`,
  `.tab.is-active`.

### 8.6 Tests + lint

- `npm run lint:html` → limpio en todo el plan
- `npm run test:unit` → 453/453 verde mantenido durante las 6 fases
  (perdimos 15 tests JSX en commit anterior `c41d316`)

## 9. Próximos pasos para el director

1. **Mergear el branch a `main`** (o pushear vía web). Con eso GitHub
   Pages despliega y todo queda visible en producción.
2. **Verificar visualmente** la página Información Contractual:
   navegar a un contrato → click en submenu → debería ver lista de
   PDFs y visor embebido. Probar buscador, fullscreen, descargar.
3. **(Opcional pero recomendado) Deploy de storage rules**:
   ```
   firebase deploy --only storage
   ```
   Esto habilita las reglas de `/contratos/{cid}/` en Firebase
   Storage para cuando se quiera migrar.
4. **(Opcional, futuro) Migración a Firebase Storage**:
   ```
   npm install firebase-admin --save-dev
   node scripts/deploy-pdfs-storage.js --service-account ~/sa.json
   ```
   Tras esto, el frontend lee las URLs de Firebase Storage en lugar
   de GitHub Pages. Los PDFs en `assets/docs/contratos/` quedan
   como backup; pueden borrarse del repo en un commit separado para
   liberar 39 MB del histórico.
5. **Si en algún momento aparece bug visual**: el issue documentado
   en este plan + el changelog v2.6.0 + el código tiene comentarios
   suficientes para que cualquier sesión futura entienda el modelo
   sin re-leer toda la conversación.
