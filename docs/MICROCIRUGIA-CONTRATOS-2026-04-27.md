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

## 7. Plan de 6 fases (este documento es Fase 1)

| Fase | Descripción | Commit |
|---|---|---|
| 1 | Inventario + diagnóstico (este reporte) | feat(contratos): inventario PDFs + plan de microcirugía |
| 2 | Sidebar restructure + recuperar aqua glass | fix(sidebar): nodo padre expandible + fondo aqua glass |
| 3 | Página contrato-info con visor PDF | feat(contratos): página Información Contractual con visor PDF |
| 4 | PDFs commiteados + script Firebase | feat(contratos): cargar PDFs + script de deploy a Firebase Storage |
| 5 | Auditoría visual + fixes contraste | fix(ui): auditoría visual completa · contrastes y visibilidad |
| 6 | Documentación | docs: documentar microcirugía sesión 2026-04-27 PM3 |
