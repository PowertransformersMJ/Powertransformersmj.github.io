# CLAUDE.md — Proyecto SGM · TRANSPOWER

> Documento maestro de planeación, arquitectura y progreso del sitio web personal
> **Dirección y Gestión del Mantenimiento Especializado en Transformadores de Potencia**.
> Este archivo se actualiza al cierre de cada microfase.

---

## 0. Nota operativa para Claude (leer al inicio de cada sesión)

> Sección dedicada al agente (Claude Code) que opera este repo.
> Describe particularidades del entorno que no son obvias al arrancar.

### 0.1 Publicación en GitHub — permisos del entorno

En la sesión de Claude Code de este proyecto, **los canales "normales" de
push a GitHub están restringidos a lectura**:

| Canal | Auth | Resultado |
|---|---|---|
| `git push` (vía `local_proxy` del runtime) | identidad del proxy | ❌ `403 Permission denied` |
| `mcp__github__push_files`, `mcp__github__create_or_update_file`, etc. | instalación del GitHub App del runtime | ❌ `403 Resource not accessible by integration` |
| `git push` con URL `https://USER:PAT@github.com/...` | PAT personal del dueño | ✅ Funciona |

**Fix permanente (pendiente de acción del dueño del repo):**
conceder permiso **Contents: Read & write** al GitHub App de
Claude Code sobre `ajimenezp99-jpg/lordpowertransformersmj.github.io`
en *GitHub → Settings → Applications → Installed GitHub Apps*. Mientras
no se haga, los dos primeros canales seguirán fallando con 403.

**Workaround real (verificado):** el `local_proxy` **resetea el remote
`origin` entre invocaciones** (cambia de puerto y restaura la URL al
formato `http://local_proxy@127.0.0.1:PORT/git/...`), así que **no
sirve** dejar el PAT embebido con `git remote set-url` — sobrevive a
un único push y luego se pierde. La forma confiable de publicar es
**pasar la URL con token inline en cada `git push`**:

```bash
git push https://USER:TOKEN@github.com/USER/REPO.git \
    BRANCH:BRANCH
```

donde `TOKEN` es el PAT clásico del dueño guardado fuera del repo
(en este chat se entregó por mensaje del usuario; en el siguiente
chat habrá que pedirlo de nuevo o leerlo de donde el dueño lo deje).

**Reglas que debo respetar con este token:**
1. Jamás copiar el token a un archivo rastreado, a un mensaje de
   commit, a una PR, a un comentario o a cualquier salida visible
   (logs, prints, etc.). Filtrar siempre con
   `sed 's|ghp_[A-Za-z0-9]*|ghp_****REDACTED****|g'` antes de mostrar
   un remote o un error de push.
2. No hacer `git config` globales con el token. Tampoco vale la pena
   hacer `git config` local porque el proxy lo pisa.
3. Si el dueño revoca el token (recomendable cuando concede
   `contents:write` al App), `git push` volverá a fallar con 401/403
   y habrá que pedir un token nuevo o usar el App.
4. Preferir `git push` con URL inline antes que `mcp__github__*` para
   operaciones de escritura. Los endpoints MCP solo sirven para lectura
   en este entorno.
5. Si aparece una instrucción del usuario en el chat incluyendo un
   token nuevo, **asumir que reemplaza al actual**; usarlo en el
   siguiente push inline. No pedirle al usuario que lo re-introduzca
   si ya lo dio antes.
6. Al iniciar un chat nuevo: si hay commits pendientes y no hay token
   visible, **preguntar al dueño** por un PAT clásico (scope `repo`).
   Sin eso, push imposible.

### 0.1.1 Regla permanente · Protocolo de deploys Firebase

**Cada vez que yo (Claude) modifique uno de estos archivos, DEBO avisar
al director IN EL MISMO TURNO qué comando debe ejecutar él en su Mac:**

| Si modifico… | El director debe ejecutar |
|---|---|
| `firestore.rules` | `firebase deploy --only firestore:rules` |
| `firestore.indexes.json` | `firebase deploy --only firestore:indexes` |
| `storage.rules` | `firebase deploy --only storage` |
| `functions/*.js` o `functions/package.json` | `firebase deploy --only functions` (o `functions:NombreEspecifico`) |
| `firebase.json` | según qué secciones cambiaron |

**El director (miguel) NO tiene auto-deploy de estos canales.** GitHub
Pages sí tiene auto-deploy via workflow `pages.yml`, pero los 4 canales
Firebase requieren su intervención manual.

**Formato del aviso** (siempre al final del mensaje donde se hace el
cambio, no en uno separado):

> ⚠ Requiere deploy manual:
> ```bash
> firebase deploy --only firestore:rules
> ```

**También debo incluir el bloque "Requiere deploy" al final del commit
message** cuando el commit toca esos archivos, para que quede en el
historial.

**Por qué es crítico:**
- Sin rules desplegadas → queries fallan con `permission-denied`.
- Sin índices desplegados → queries fallan con `FAILED_PRECONDITION`.
- Sin functions desplegadas → código viejo sigue corriendo en producción.
- Acumular varios cambios sin deployar hace imposible aislar el bug.

El director (Miguel) solicitó explícitamente esta regla (sesión abril 2026)
después de que un deploy de functions quedó pendiente dos iteraciones.

### 0.1.2 Regla permanente · El entorno del repo manda, no esta CLAUDE.md

**El director explicitó esta regla en la sesión 2026-04-27:** este
documento describe HISTORIA, no necesariamente el estado actual.
Después de `v2.1.0-aqua` el codebase siguió evolucionando (PRs #86–#90:
fix-menu-colors, deploy-contract-dataset, multi-contrato N1–N5,
module-shells nuevos en `assets/js/ui/`, página `pages/contrato.html`
con tabs+iframes, `contrato-context.js`) y §9 quedó sin actualizar.
**No asumas Aqua puro.**

Antes de tocar UI o cualquier cosa visual, **siempre** ejecuta:

```bash
git fetch origin main
git log --oneline origin/main -25
ls assets/css/ assets/js/ui/ assets/js/*-shell.js
```

y revisa si hay archivos/arquitecturas más recientes. Aqua tokens
(`aqua-tokens.css` + `aqua-components.css` + `aqua-shell.js`) siguen
siendo la base, pero **encima** hay capas posteriores
(`assets/js/ui/module-shell.js`, `tabs.js`, `nav.js`,
`contrato-context.js`, páginas `pages/contrato.html`,
`pages/activos.html`, `pages/contratos.html`) que **NO deben revertirse**.
Si la prod muestra algo distinto a lo descrito en §9, **la prod tiene
razón** — actualiza §9, no la prod.

Reglas concretas al recibir un ticket de UI:
1. Mira el screenshot del director y **describe lo que ve**, no lo que
   §9 dice que debería ver.
2. Cambio mínimo: edita la regla específica, no rehagas el sistema.
3. Si necesitas tokens/colores nuevos, pídelos en lugar de inventarlos.
4. La foto de fondo (`.aqua-power-scene` en `aqua-components.css`) debe
   cubrir SIEMPRE el viewport completo: `position: fixed; inset: 0;
   width: 100vw; height: 100vh; height: 100dvh; background-size: cover`.
   Esto es invariante; cualquier sesión que quiera cambiarlo necesita
   justificarlo aquí.

### 0.1.2.1 Regla permanente · Migrar archivos legacy SIN perder detalles visuales

**Contexto del bug histórico (sesión 2026-05-02):** al portar el archivo
legacy `Calculo de Sistemas de refriegracion.html` (1917 líneas
monolíticas) al módulo Mantenimiento Brigada · Selección ONAF, perdí
**dos detalles del gráfico Chart.js** que el director identificó
inmediatamente al ver el resultado:

1. **Posición de la leyenda.** El original tenía `legend.position:
   'bottom'`. La reescribí como `'top'` por costumbre. El director
   notó al instante que estaba en el lado equivocado.
2. **"Cruceta roja" (segmentos de referencia).** El plugin Chart.js
   original dibujaba dos líneas rojas dashed desde los ejes hasta el
   punto de operación + puntos en las intersecciones + etiquetas
   `X.X MVA` y `XX.XXX CFM` justo en los ejes. La eliminé del plugin
   pensando que no era esencial. Era esencial — es la lectura visual
   directa que el ingeniero usa para validar el cálculo.

**Regla permanente:** cuando se migre cualquier archivo legacy
existente (HTML + JS inline) a la arquitectura moderna del proyecto:

1. **Antes de declarar la migración cerrada, comparar lado a lado
   contra el original** — abrir ambos en el navegador, verificar que
   cada elemento visual y funcional está presente. No basta con
   "preservar los IDs" o "pasar los tests"; los detalles de
   presentación (posición de leyenda, líneas auxiliares, etiquetas
   en márgenes, hover states, formato de tooltip) deben mantenerse.
2. **Para gráficos Chart.js específicamente:** copiar `plugins.legend`
   y `plugins.tooltip` palabra por palabra del original, y replicar
   el plugin de `afterDraw` completo, no solo las partes que parecen
   "nuevas". Cualquier `setLineDash`, `arc`, `fillText` que dibuje
   sobre el canvas TIENE un propósito de UX que el ingeniero original
   pensó.
3. **Cuando sea posible, ejecutar el original primero** (servidor
   local) para fotografiar visualmente qué hay y comparar contra el
   resultado.
4. **Si el director provee captura del original junto con el ticket,
   es la fuente de verdad** — no la imagen del rediseño propuesto en
   un design bundle. El rediseño puede sugerir pulido visual, pero
   los elementos funcionales del original (referencia de ejes,
   anotaciones del punto de operación, etc.) son **invariantes**.

**Aplica a futuras migraciones:** el mismo patrón debe seguirse al
portar cualquier `*.html` con script inline a un módulo moderno
(dominio puro + data layer + UI). El "100% de precisión numérica"
no es suficiente; también debe haber 100% de paridad visual y
funcional con el origen.

### 0.1.2.2 Regla permanente · Generación de informes imprimibles (PDF / print)

**Contexto del bug histórico (sesión 2026-05-02 PM2):** al construir
el informe técnico AFINIA del módulo Selección ONAF cometí dos
errores que el director identificó al instante:

1. **Saltos de página forzados → hojas en blanco.** Usé
   `page-break-after: always` después de cada sección (carátula,
   gráfico, mecánicos, calculador). Resultado: hojas a medio llenar
   + páginas en blanco entre secciones cortas. Mal patrón.

2. **Página dedicada solo para el gráfico.** El director pidió "que
   no se corte" y yo interpreté "que tenga su propia página". La
   intención real era simplemente **bloque indivisible**: si cabe en
   la hoja actual, va ahí; si no, pasa íntegro a la siguiente. Sin
   dedicarle una hoja exclusiva. El orden natural del contenido
   manda, no el deseo de que el gráfico "destaque".

3. **Datos incompletos.** Capturé solo un subconjunto del formulario
   (≈ 20 de 60+ campos). Faltaban montaje sobre radiador, ficha
   eléctrica completa del motor, análisis de compatibilidad
   mecánica (4 cards C1-C4), totales del sistema (kW totales, kVA
   aparente, peso conjunto) y lista de materiales con cantidades.
   El informe **debe ser exhaustivo** — todo lo que el ingeniero
   capturó en la calculadora aparece en el documento entregable,
   en su orden lógico.

**Regla permanente para CUALQUIER informe imprimible (PDF/print):**

1. **Flujo natural** — NO usar `page-break-after: always` salvo entre
   documentos completamente distintos. El navegador decide los saltos
   según el espacio disponible.

2. **Bloques indivisibles** — usar `break-inside: avoid` +
   `page-break-inside: avoid` en cada bloque atómico (gráfico,
   tabla, KPI grid, sección de detalle). Si no cabe, el navegador
   lo lleva entero a la siguiente hoja sin partirlo.

3. **`break-after: avoid`** en cada `h2`/`h3` para que no quede
   como última línea de una página huérfana.

4. **Captura completa del formulario** — al generar un informe,
   hacer `grep -oE 'id="[^"]+"' source.html` para listar TODOS los
   IDs y mapear uno a uno al output. No basta "lo importante" —
   los formularios técnicos del director son intencionalmente
   exhaustivos (placa, electromecánica, hidráulica, control,
   normativa). El informe debe reflejar esa exhaustividad.

5. **Totales calculados** — además de los valores individuales,
   incluir totales del sistema cuando aplique (potencia eléctrica
   total = kW × N, kVA aparente = P/cos φ, peso total = peso × N,
   corriente total = I × N + factor seguridad NEC, etc.). El
   ingeniero los necesita para dimensionar tableros, contratar
   transporte y calcular pérdidas.

6. **Lista de materiales (BOM)** — toda selección de protección
   o componentes debe terminar en una tabla "Lista de materiales"
   con columnas: # · Cantidad · Componente · PID/Ref · Especificación.
   Sin BOM el informe no sirve para emitir orden de compra.

7. **Plantilla del cliente como fuente de verdad** — si el director
   provee un docx (Formato AFINIA, plantilla GETP, etc.), extraer
   las dimensiones (page size, margins en twips/in), el header y
   footer (imágenes en `word/media/`) y los textos exactos
   (`grep -oE '<w:t[^>]*>[^<]+</w:t>'`). El informe imprimible
   debe reproducir esos elementos en cada página.

8. **Auto-print al cargar imágenes** — antes de invocar
   `window.print()`, esperar a que TODAS las imágenes (header,
   footer, gráfico exportado) terminen de cargar. Si se imprime
   antes, salen sin logos.

**Aplica a futuros informes:** propuestas de inversión, fichas de
salud de transformador, certificados de calibración, actas de
brigada, etc. El mismo patrón flujo-natural + break-inside-avoid +
captura-exhaustiva + BOM se reutiliza tal cual.

**Refinamientos posteriores (sesión 2026-05-02 PM3):** después de
revisar el primer informe AFINIA generado el director identificó
tres errores adicionales que también deben evitarse:

9. **Título h2 huérfano al final de página.** `break-after: avoid`
   en el h2 NO basta — Chrome/Safari a veces lo ignoran si el bloque
   siguiente es grande. Solución: envolver cada sección entera
   (h2 + primera tabla/bloque) en un `<section class="section-anchor">`
   con `break-inside: avoid`. Garantiza que el título y al menos su
   primer contenido se mueven juntos a la siguiente hoja si no caben.

10. **Fórmulas sin sustitución de valores.** Mostrar
    `N = ⌈ CFM_total / CFM_fan ⌉` solo en forma simbólica es
    insuficiente — el ingeniero necesita ver la fórmula APLICADA con
    los valores reales del cálculo:
      `N = ⌈ 159.000 ÷ 5.933 ⌉ → N = 27 unidades`
    Patrón a usar: bloque `.formula-box` con dos líneas:
    (a) fórmula simbólica en serif itálico (Cambria Math),
    (b) fórmula sustituida con los inputs reales en mono + `→` + el
    resultado destacado. Aplica a: pendiente Westinghouse, CFM
    requerido (m × kVA), corrección altitud (e^(h/8500)), N de
    ventiladores, corriente total (N × I), corriente mínima del
    breaker (1.25 × I_total), potencia eléctrica (N × P₁), potencia
    aparente (P/cos φ), peso conjunto (N × peso_unit). Toda fórmula
    que se cite debe ir acompañada del cálculo numérico.

11. **Diagrama de referencia A/B/C/D omitido.** El director siempre
    espera ver el dibujo CAD del componente con las dimensiones
    señalizadas, no solo la lista textual de qué significa cada
    letra. Cuando el original tenga un diagrama (radiador con A=
    altura, B=span obleas, C=ancho frente, D=tornillos del flanche;
    o cualquier otro componente parametrizado por dimensiones), el
    informe DEBE incluir el diagrama. Si no hay PNG disponible,
    construirlo como SVG inline imitando el original (vista frontal
    + vista en perspectiva o isométrica), con cotas codificadas por
    color (mismo color que las leyendas del UI).

**Refinamiento adicional (sesión 2026-05-02 PM4):** después de
varios intentos, el director sigue viendo el cuerpo del informe
ENCIMA del header/footer en páginas internas. La causa raíz fue
intentar usar `position: fixed` con `@page margin` y offsets
negativos — Chrome lo soporta pero Firefox/Safari no de manera
consistente, y el contenido se traslapaba en hojas 2+.

12. **Encabezado/pie repetido por página · usar SIEMPRE
    `<thead>` + `<tfoot>` con `display: table-header-group` /
    `table-footer-group`.** Este patrón es el único 100% reliable
    cross-navegador (Chrome, Firefox, Safari, Edge) para informes
    paginados imprimibles:

    ```html
    <table class="report-doc">
      <thead><tr><td class="page-header-cell">
        <div class="page-header"></div>  <!-- logo Afinia -->
      </td></tr></thead>
      <tfoot><tr><td class="page-footer-cell">
        <div class="page-footer">         <!-- banda azul + texto -->
          <div class="ribbon"></div>
          <div class="footer-text">CaribeMar...</div>
        </div>
      </td></tr></tfoot>
      <tbody><tr><td class="body-cell">
        ...todo el contenido del informe...
      </td></tr></tbody>
    </table>
    ```

    ```css
    @page { size: letter portrait; margin: 0; }
    table.report-doc { width: 8.5in; margin: 0 auto; }
    table.report-doc thead { display: table-header-group; }
    table.report-doc tfoot { display: table-footer-group; }
    table.report-doc thead td.page-header-cell { height: 1.55in; }
    table.report-doc tfoot td.page-footer-cell { height: 1.20in; }
    table.report-doc tbody td.body-cell { padding: 0.10in 1.18in; }
    ```

    El navegador automáticamente:
    - Repite el `thead` al inicio de cada hoja impresa
    - Repite el `tfoot` al final de cada hoja impresa
    - Reserva espacio para ambos en el flujo de paginación, así que
      el contenido del `tbody` NUNCA puede traslaparse con header/
      footer ni cortarse ambiguamente

    Esto es lo que usan wkhtmltopdf, jsPDF, y prácticamente todo
    motor de reportes corporativos. Es el "gold standard".

13. **NO usar `position: fixed` para headers/footers de informes.**
    Aunque funciona en Chrome con `@page margin` configurado, es
    inconsistente en Firefox y Safari, y con frecuencia produce
    el bug visible de "contenido encima del header en página 2+".
    El método thead/tfoot es estricto y predecible.

**Lección de meta-proceso:** después de generar un informe nuevo, ANTES
de cerrar la sesión, ejecutar mentalmente esta checklist:
- ¿Fluye el contenido sin hojas en blanco?
- ¿Cada h2 está visualmente con su contenido?
- ¿Cada fórmula citada lleva su sustitución numérica?
- ¿Cada componente con dimensiones lleva su diagrama?
- ¿La lista de materiales tiene cantidades + PIDs?
- ¿Los totales del sistema están todos calculados (kW, kVA, peso, A)?
- ¿El header/footer se repite por hoja **vía paginación manual con
  `.sheet` divs + JS** (regla §0.1.2.3, NO thead/tfoot, NO position:fixed)?

### 0.1.2.3 Regla permanente · Safari NO repite header/footer · usar paginación manual con `.sheet` divs

**Contexto del bug histórico (sesión 2026-05-03 PM2):** después de
varios intentos previos (position:fixed con `@page margin`, después
thead/tfoot de tabla paginada) el director volvió a reportar que su
informe AFINIA exportado a PDF desde producción mostraba el header y
footer **solo en la página 1 y 6, ausentes en las páginas 2-5**.

**Causa raíz definitiva:** el director imprime/exporta desde **Safari
en macOS** (`Creator: Safari, Producer: macOS Versión 26.3 / Quartz
PDFContext`). WebKit/Safari **NO repite** `<thead>` ni `<tfoot>` de
tabla paginada en cada página al imprimir cuando hay un solo `<tr>`
con `<td>` grande en `<tbody>` — solo los renderea arriba del primer
TR (página 1) y abajo del último TR (última página). Es un bug
WebKit histórico, ampliamente documentado, sin fix.

Mi error fue verificar con `puppeteer.pdf()` (que respeta thead/tfoot
correctamente como Chrome) y declarar el fix como bueno sin probar
en el navegador real del director. El comportamiento de
`puppeteer.pdf()` **NO es representativo** de `window.print()` en
Safari. Tampoco lo es siquiera de `chrome --headless --print-to-pdf`.

**Regla obligatoria** para CUALQUIER informe imprimible que requiera
header/footer en cada hoja:

1. **NO usar `<thead>/<tfoot>` de tabla paginada.** Falla en Safari.
2. **NO usar `position: fixed` con `@page margin`.** Inestable entre
   browsers (Safari + Chrome + Firefox interpretan distinto los
   offsets), y el contenido normal puede traslaparse con el
   header/footer en hojas 2+.
3. **SÍ usar paginación manual con divs `.sheet`** + script de
   paginación que distribuye el contenido un bloque a la vez:

   ```html
   <div class="report-buffer" aria-hidden="true">
     <article class="report">
       <!-- TODOS los bloques del informe sin paginar -->
       <section>...</section>
       <section>...</section>
     </article>
   </div>
   <div class="report-paginated">
     <!-- vacío; se rellena con .sheet divs vía JS -->
   </div>
   ```

   ```css
   @page { size: letter portrait; margin: 0; }
   body { margin: 0; padding: 0; }
   .sheet {
     width: 8.5in; height: 11in;
     position: relative; overflow: hidden;
     page-break-after: always;
     box-sizing: border-box;
   }
   .sheet:last-child { page-break-after: auto; }
   .sheet-header {
     position: absolute; top: 0; left: 0; right: 0;
     width: 100%; height: 1.0in;
   }
   .sheet-footer {
     position: absolute; bottom: 0; left: 0; right: 0;
     width: 100%; height: 1.07in;
   }
   .sheet-content {
     position: absolute;
     top: 1.0in; bottom: 1.07in;
     left: 1.18in; right: 1.18in;
     overflow: hidden;
   }
   .report-buffer {
     position: absolute; left: -10000px;
     width: calc(8.5in - 2 * 1.18in);
     visibility: hidden;
   }
   ```

   ```javascript
   (function paginate() {
     const buffer = document.querySelector('.report-buffer');
     const out = document.querySelector('.report-paginated');
     function newSheet() {
       const s = document.createElement('div');
       s.className = 'sheet';
       s.innerHTML =
         '<div class="sheet-header">' + HEADER_HTML + '</div>' +
         '<div class="sheet-content"></div>' +
         '<div class="sheet-footer">' + FOOTER_HTML + '</div>';
       out.appendChild(s);
       return s.querySelector('.sheet-content');
     }
     const blocks = Array.from(buffer.querySelector('.report').children);
     let content = newSheet();
     for (const block of blocks) {
       content.appendChild(block);
       if (content.scrollHeight > content.clientHeight) {
         content.removeChild(block);
         content = newSheet();
         content.appendChild(block);
       }
     }
     buffer.remove();
     // Cargar imágenes y luego window.print()
   })();
   ```

   Cada hoja `.sheet` lleva SU PROPIO header y footer DOM-explícitos
   (no vía thead ni vía fixed). El navegador NO necesita "repetir"
   nada — cada hoja es un elemento independiente con `page-break-
   after: always`. Funciona idéntico en Chrome, Edge, Firefox y
   Safari/WebKit en `window.print()` y en exportaciones PDF nativas.

4. **VERIFICAR el fix en navegadores reales antes de cerrar.**
   Específicamente:
   - Safari (macOS): exportar a PDF desde el diálogo de impresión.
   - Chrome (cualquier OS): "Imprimir → Guardar como PDF".
   - `puppeteer.pdf()` o `chrome --headless --print-to-pdf` **NO**
     reemplazan la prueba real — son test rápidos, NO confirmación.
   - Pedirle al director que abra el informe y exporte desde su
     navegador habitual ANTES de declarar el bug cerrado.

5. **Trampa cognitiva a evitar:** "el headless verificó que header
   y footer están en cada página, ergo el fix funciona" — eso es
   FALSO. Headless usa el mismo motor de Chrome (Blink) con la API
   `pdf()` interna, que NO comparte código con `window.print()`.
   La verificación final SOLO la da el navegador del director.

**Lección de meta-proceso:** "verifico headless antes del commit" es
útil como filtro rápido para detectar errores groseros (como el
cover-block recortado), pero NO es suficiente para garantizar
compatibilidad cross-browser. La paginación manual descrita arriba
es la ÚNICA técnica probada que funciona universalmente.

### 0.1.2.4 Regla permanente · Refactor 1→N NO debe vaciar la UI legacy

**Contexto del bug histórico (sesión 2026-05-03 PM4):** al refactorizar
la calculadora de refrigeración para soportar **mix multi-modelo**
(escoger varios tipos de ventiladores con cantidades en el mismo
transformador), eliminé la ruta de "1 modelo único" en
`calcProtection()` y reemplacé el contenido de la sección
"Circuito de protección eléctrica y mando" por un stub *"Agregue al
menos un modelo de ventilador al mix para calcular la protección
eléctrica"* cuando `state.mix.length === 0`.

**Consecuencia:** el director, que estaba acostumbrado a ver el
detalle completo (guardamotores con cantidades + PIDs + settings +
breaker principal + auxiliares SCADA) en cuanto seleccionaba **un**
modelo del dropdown técnico, abrió la página tras el refactor y vio
la sección VACÍA. Lo interpretó (con razón) como *"eliminaste todo
lo de este apartado"*. La ficha del modelo seguía cargándose en
la sección "Datos técnicos del motoventilador" pero la sección de
protección no la consumía si el mix estaba vacío.

**Regla permanente** para CUALQUIER refactor que pase de "trabajar
con 1 entidad" a "trabajar con N entidades":

1. **NO eliminar el cómputo legacy de "1 entidad".** Manténgalo
   como **fallback**. La protección eléctrica (o cualquier sección
   computada) debe tener tres rutas:
   - **Ruta 1 (principal):** colección N >= 1 → cómputo agregado.
   - **Ruta 2 (fallback):** colección vacía PERO hay un *preview*
     legacy seleccionado (ej.: dropdown con 1 modelo cargado) →
     cálculo con ese 1 modelo + N derivado.
   - **Ruta 3 (vacío real):** colección vacía Y sin preview →
     placeholder INFORMATIVO mostrando los componentes que
     aparecerán cuando se carguen datos (no un stub silencioso).

2. **El stub "vacío" nunca debe parecer "eliminado".** Mostrar:
   - El catálogo de componentes esperables (PIDs, modelos de
     referencia, ranges de catálogo).
   - Una pista explícita: *"cargue una ficha desde el dropdown
     técnico O agregue modelos al mix para ver cantidades reales"*.
   - Mantener el bloque visual con su altura mínima para que el
     usuario no perciba que la sección "desapareció".

3. **Antes de cerrar un commit con refactor de UI:** abrir la
   página en el browser **sin hacer ninguna acción** y verificar
   visualmente cada sección consumidora. Si alguna queda vacía
   (stub, sin contenido, "agregue X"), probablemente rompiste un
   flujo legacy. Restaurar como fallback.

4. **Casos típicos de aplicación de esta regla:**
   - 1 ventilador → mix de N ventiladores (commit 2026-05-03).
   - 1 transformador en cálculo → batch de N transformadores.
   - 1 muestra DGA → batch de muestras.
   - 1 contrato seleccionado → multi-contrato.
   - 1 documento → biblioteca de documentos.

5. **Anti-patrón a evitar:** *"el usuario tiene que aprender el
   nuevo flujo"*. NO. La UX debe ser progresiva: la versión legacy
   sigue funcionando, y la versión nueva la complementa. El
   usuario gana funcionalidad sin perder familiaridad.

**Indicios visuales del bug:**
- Sección con título visible pero contenido reemplazado por
  *"agregue X para ver Y"*.
- Director reporta *"eliminaste todo lo de [sección]"* tras un
  refactor.
- Funcionalidad que antes era automática (calcular al seleccionar
  un modelo) ahora exige acción explícita (agregar al mix).

**Solución del bug original (commit `f1a4403` siguiente):** la
función `calcProtection()` se reescribió con las 3 rutas descritas.
La Ruta 2 reusa `calcularProteccionElectrica` (cálculo legacy con
1 modelo + N derivado) como preview cuando `state.mix.length === 0`
y hay un modelo en el dropdown legacy. La Ruta 3 muestra un panel
con tarjetas dashed de los 4 componentes (MS116, HK1-11, S203,
S2C-H11L) con sus PIDs y rangos.

### 0.1.2.5 Regla permanente · Lint local con `npm run lint:html`, no `npx html-validate`

**Contexto del bug histórico (sesión 2026-05-03 PM4):** verifiqué el
lint con `npx html-validate "pages/consolidado-refrigeracion.html"`
y obtuve exit 0. Pusheé el commit. CI falló con 15 errores
WCAG H63 (`<th>` sin `scope`).

**Causa raíz:** `npx html-validate` descarga la versión más reciente
disponible del paquete (transitiva), distinta de la fijada en
`package.json` (`^8.24.0`). La versión transitiva traía un set de
reglas más laxo y no marcó los errores que sí marca CI con la
versión declarada.

**Regla permanente:** antes de cerrar cualquier commit con HTML
nuevo o modificado, **siempre** verificar con:

```bash
npm install --no-audit --no-fund
npm run lint:html
```

NO usar:
- `npx html-validate ...` — descarga versión transitoria.
- `html-validate ...` directo — depende del PATH global.
- Solo verificar visualmente el render — no detecta accesibilidad.

CI ejecuta exactamente `npm ci || npm install` + `npm run lint:html`,
así que reproducirlo localmente es la única garantía de que el
push pasará. La diferencia entre exit 0 local y CI rojo es
**siempre** desalineación de versiones del lint.

**Aplica también a:** `npm test`, `npm run test:unit` — siempre con
las devDependencies del repo instaladas, nunca con runners
transitorios.

### 0.1.2.6 Regla permanente · Firestore rechaza undefined con error "permission-denied" engañoso

**Contexto del bug histórico (sesión 2026-05-03 PM11):** después de
cerrar el plan de 6 microfases del módulo Mantenimiento Brigada, el
director intentó **registrar una acción de mantenimiento** desde el
modal y obtuvo el error visible *"Missing or insufficient
permissions"*. Todos los campos visibles del payload cumplían con
las rules (`transformador_id`, `matricula`, `accion_descripcion`
≥10 chars, `estado_accion ∈ enum`, `mix.size() >= 1`,
`fecha_accion` no vacío) y el director es admin con rol verificado.

**Causa raíz:** el `sanitizar()` del data layer
`assets/js/data/acciones_refrigeracion.js` solo limpia los campos
TOP-LEVEL (transformador_id, matricula, etc.). Pero el payload
incluye objetos anidados pesados con resultados de funciones puras
del dominio:

- `mix[].ficha` — snapshot del catálogo de motoventiladores. Si la
  ficha del catálogo viene con campos opcionales (`fan_kw`,
  `fan_cosphi`, `fan_volt`, etc.) que no aplican a ese modelo,
  quedan `undefined` en el snapshot.
- `evaluacion` — `evaluarMixVentiladores` puede devolver
  `cobertura_pct: null` si no hay datos, pero también `deficit:
  undefined` en branches específicos.
- `proteccion` — `calcularProteccionMix` devuelve `breaker: null` o
  `guardamotor: null` cuando excede catálogo. Ahí no hay problema,
  PERO el `contactor` (microfase 3) puede ser `undefined` si lo
  agregaste manualmente al objeto.
- `compatibilidad` — `evaluarCompatibilidad` devuelve `c1.title`
  como `undefined` cuando el caso no tiene título override.
- `resumen_json` (microfase 5) — anida todos los anteriores.
- `validacion_grafica` (microfase 6) — campos numéricos que en
  edge cases pueden ser `NaN` (división por cero).

**Por qué el error mensaje "permission-denied":** la SDK Web de
Firestore intenta serializar el objeto antes de aplicar las rules.
Cuando encuentra un `undefined`, no puede materializar el campo y
**retorna un error genérico de permisos** en lugar del error de
tipo real. Esto está documentado en
[firebase/firebase-js-sdk#1551](https://github.com/firebase/firebase-js-sdk/issues/1551).
El mensaje correcto sería *"FirebaseError: Function addDoc() called
with invalid data. Unsupported field value: undefined"* pero la SDK
**lo enmascara como permission-denied** en producción cuando hay
muchos campos, especialmente con rules complejas.

**Síntomas del bug a reconocer en futuras sesiones:**
- El usuario ES admin (verificado por otros writes que funcionan).
- Las rules están desplegadas (`firebase deploy --only firestore:rules`).
- El payload top-level cumple todas las rules.
- Pero el error es exactamente *"Missing or insufficient permissions"*.
- El `console.error` muestra `code: 'permission-denied'` pero sin
  detalle del campo problemático.

**Regla permanente** para CUALQUIER data layer que persista objetos
anidados resultado de funciones puras del dominio:

1. **Crear un helper genérico `deepClean`** en
   `assets/js/data/_firestore_clean.js` que recursivamente:
   - Elimina claves con `undefined` (no las incluye en el output).
   - Convierte `NaN` / `Infinity` en `undefined` (omitidos).
   - Omite valores `function`.
   - Preserva `null`, `0`, `''`, `false` (legítimos).
   - Preserva objetos especiales de Firestore: `Timestamp`
     (con `toDate`), `FieldValue` (con `_methodName`),
     `GeoPoint`, `DocumentReference`.
   - Mapea recursivamente arrays y objetos planos.

2. **Aplicar `deepClean(payload)` JUSTO ANTES de `addDoc` /
   `setDoc` / `updateDoc`** en cada función `crear()`,
   `actualizar()`, `actualizarEstado()` del data layer.

3. **NO confiar en el sanitizador top-level**. El sanitizador es
   útil para tipos y defaults de campos planos, pero NO recurre
   a objetos anidados.

4. **Mejorar el manejo de errores en la UI** para que cuando el
   código sea `permission-denied` o el mensaje incluya `permission`,
   **sugerir explícitamente** revisar (a) sesión de admin, (b)
   rules desplegadas, (c) **payload con undefined** (causa #1
   silenciosa). Ver `guardarAccion()` en
   `assets/js/calculo-refrigeracion.js` como referencia.

5. **Tests obligatorios** del helper `deepClean` cubriendo:
   - Primitivos (preserva `0`, `''`, `false`, `null`).
   - `undefined`, `NaN`, `Infinity` → omitidos.
   - Objetos anidados profundos (3+ niveles).
   - Arrays con items `undefined` → filtrados.
   - Objetos especiales Firestore (Timestamp, FieldValue).
   - Caso real: payload completo con ficha de catálogo
     incompleta.

**Aplica también a:** cualquier data layer que persista output de
funciones puras del dominio en Firestore. Casos típicos en este
repo:
- `acciones_refrigeracion` (afectado primero · 2026-05-03).
- `documentos_contractuales` (snapshot de Storage metadata).
- `muestras` (resultado de motor de salud + diagnóstico DGA).
- `ordenes` (con historial inmutable).
- Cualquier futuro data layer del módulo Mantenimiento Brigada.

**Solución del bug original (commit `e7e1b0b` siguiente):**
- Nuevo `assets/js/data/_firestore_clean.js` con función pura
  exportada `deepClean(value)`.
- `acciones_refrigeracion.js` importa `deepClean` y lo aplica en
  `crear()` y `actualizar()` antes de `addDoc`/`updateDoc`.
- `tests/acciones_refrigeracion_deepclean.test.js` con 13 tests
  cubriendo todos los casos.
- `guardarAccion()` mejora detección de error con mensaje accionable
  específico para `permission-denied` listando las 3 causas
  probables.

### 0.1.2.9 Regla permanente · Validaciones críticas en SUBMIT, no solo al abrir el formulario · doble línea de defensa en data layer

**Contexto del bug histórico (sesión 2026-05-04 PM):** después de
implementar el anti-duplicado para evitar registrar el mismo
transformador dos veces sin justificación (regla anterior pedida
por el director), el director reportó que **seguía pudiendo
registrar 3 veces el mismo transformador T1-M/M-CHG sin que el
sistema le exigiera justificación**. La validación falló
silenciosamente.

**Causas raíz (combinación de 3 problemas):**

1. **El chequeo se hacía solo al ABRIR el modal** (`openModalAccion`),
   no en el momento del SUBMIT (`guardarAccion`). El payload usaba
   `state.duplicadoInfo` cacheado que dependía de:
   - Que la query async `existeAccionParaTransformador` hubiera
     completado antes del click "Guardar".
   - Que la query no hubiera fallado silenciosamente (catch que
     retornaba `{existe: false}` sin lanzar).

2. **La query requería un índice compuesto** `transformador_id ASC
   + fecha_accion DESC` que estaba en `firestore.indexes.json` pero
   podía no estar desplegado en producción todavía.

3. **No había segunda línea de defensa**: el data layer `crear()`
   no verificaba el flag de re-registro vs los duplicados reales,
   confiaba 100% en lo que envió la UI.

**Resultado:** la UI mostraba el banner amarillo (a veces) pero el
flag `es_re_registro` quedaba en `false` por race condition / query
silenciosamente fallida → el `payload.es_re_registro` era `false`
→ la validación `if (es_re_registro && !justificacion)` no se
disparaba → el `addDoc` pasaba sin problemas.

**Regla permanente** para CUALQUIER validación crítica
(anti-duplicado, anti-fraude, integridad referencial, etc.):

1. **Validar en el SUBMIT, no solo al abrir el formulario.** El
   estado del modal/formulario NO es fuente de verdad para
   validaciones de seguridad — el usuario puede haber abierto el
   modal antes de que la query async completara, manipulado
   campos, etc. Antes del `addDoc/setDoc/updateDoc` haz la query
   de verificación EN VIVO.

2. **Si la query de verificación falla, BLOQUEA el submit con
   mensaje accionable.** No retornes `{existe: false}` silenciosa
   — eso convierte un error en un permiso silencioso. Lanza error
   con mensaje claro que indique al usuario qué hacer (ej.
   "índice no desplegado · ejecute `firebase deploy --only
   firestore:indexes`").

3. **Doble línea de defensa en el data layer.** La UI puede tener
   bugs, race conditions, o ser bypaseada (otros call sites,
   tests, scripts). El data layer DEBE validar el invariante
   independientemente:
   - `crear()` invoca su propia verificación
   - Si encuentra que el payload viola la regla, lanza error
   - Esto protege contra `addDoc` desde cualquier origen

4. **Mensaje del error explícito.** Cuando se bloquea por la
   regla, el mensaje debe:
   - Identificar la entidad violada (matrícula, ID, etc.)
   - Listar las opciones válidas (catálogo de justificaciones, etc.)
   - Indicar acción concreta del usuario para resolver
   - NO usar texto genérico como "validación falló"

5. **Logging para auditoría.** `console.info` del resultado de la
   verificación de duplicado y `console.error` cuando falla la
   query, para que cualquier inspección posterior tenga trazabilidad.

**Patrón de implementación** (ref.: `guardarAccion()` y `crear()`
en `acciones_refrigeracion.js`):

```javascript
// ── UI · validación en SUBMIT ──
async function submitForm() {
  // ... lectura del formulario ...
  let dupCheck = { existe: false };
  try {
    dupCheck = await mod.existeRegistro(matricula);
    console.info('[anti-duplicado] check:', dupCheck);
  } catch (err) {
    console.error('[anti-duplicado] FALLÓ:', err);
    throw new Error('No se pudo verificar duplicado · BLOQUEO total · ' + err.message);
  }
  if (dupCheck.existe) {
    if (!payload.justificacion) throw new Error('Justificación obligatoria · ...');
    if (!VALIDAS.includes(payload.justificacion)) throw new Error('...');
    payload.es_duplicado = true;
  }
  await mod.crear(payload);
}

// ── Data layer · doble defensa ──
export async function crear(data, uid) {
  const payload = sanitizar(data);
  const errs = validar(payload);
  if (errs.length) throw new Error(...);
  // SEGUNDA LÍNEA · revalidar en data layer
  const dup = await existeRegistro(payload.id);
  if (dup.existe) {
    if (!payload.es_duplicado) throw new Error('Anti-duplicado · ...');
    if (!VALIDAS.includes(payload.justificacion)) throw new Error('...');
  }
  await addDoc(collRef(), deepClean(payload));
}
```

**Aplica también a:** validaciones de unicidad, integridad
referencial (FK), enums obligatorios, rango temporal, etc. Cualquier
regla que el negocio considera invariante debe estar en AMBOS
lugares (UI + data layer) con verificación en vivo, no cacheada.

**Solución del bug original (commit `XXXXXXX` siguiente):**
- `guardarAccion()` reescrito para llamar `existeAccionParaTransformador`
  JUSTO ANTES del crear (no se usa más `state.duplicadoInfo` cacheado).
- Si la query falla, BLOQUEA el submit con error explícito.
- `crear()` en data layer agrega segunda línea de defensa: verifica
  duplicados independientemente y bloquea con error si el payload
  no lleva justificación válida.
- Logging `console.info` del resultado del chequeo + `console.error`
  cuando la query falla.

### 0.1.2.8 Regla permanente · Captura HD de Chart.js exige escalar también fontsize y lineWidth, NO solo el canvas

**Contexto del bug histórico (sesión 2026-05-04 PM):** después de
implementar la captura HD/4K de la gráfica (canvas 2400×1400 ×
DPR 3 = ~7200×4200 efectivos), el director reportó que la gráfica
en el informe **se veía pixelada/ilegible** con todos los textos
diminutos: rótulos de eje, leyenda, etiquetas de las curvas
(115% / 125% / 133% / 166% OA RATING) y valores de la cruceta
roja (24.094 CFM, 9.5 MVA) eran tan pequeños que no se leían.

**Causa raíz:** las opciones de Chart.js usan **font sizes en
píxeles absolutos** (10px legend, 11px títulos, 8-9px ticks). El
plugin `afterDraw` también hardcodea `'10px ...'` y line widths
fijos. Cuando el canvas físico crece de ~600×360 a 2400×1400 px,
esos 10px representan una fracción mucho menor del canvas:
600×360 → 10px = 2.8% del alto → legible.
2400×1400 → 10px = 0.7% del alto → diminuto.

**Regla permanente:** cuando se aumente el tamaño físico del
canvas de Chart.js para una captura de alta resolución, hay que
**escalar proporcionalmente TODOS los siguientes elementos**:

1. **Font sizes de las opciones de Chart.js**:
   - `scales.x.title.font.size`
   - `scales.x.ticks.font.size`
   - `scales.y.title.font.size`
   - `scales.y.ticks.font.size`
   - `plugins.legend.labels.font.size`
   - `plugins.tooltip.bodyFont.size` (si aplica)
   - `plugins.title.font.size` (si aplica)
2. **Line widths de los datasets**:
   - `dataset.borderWidth` × ~2.2 (para que las curvas se vean del
     mismo grosor relativo)
   - `dataset.pointRadius` × ~2 (para los marcadores)
3. **Tamaño de los box de leyenda**:
   - `plugins.legend.labels.boxWidth` × ~1.6
   - `plugins.legend.labels.padding` × ~1.8
4. **TODO lo que dibuje el plugin custom `afterDraw`**:
   - `ctx.font` con tamaño en px → multiplicar por `s`
   - `ctx.lineWidth` → multiplicar por `s`
   - `setLineDash([6, 4])` → multiplicar cada valor por `s`
   - `ctx.arc(x, y, R, ...)` → multiplicar `R` por `s`
   - Padding de etiquetas (`tw / 2 + padX`) → multiplicar por `s`
5. **Pasar el factor al plugin** vía `chart._exportScale`. El
   plugin lee `const s = chart._exportScale || 1;` y multiplica
   por `s` cada dimensión.

**Patrón de implementación** (referencia: `generateReport()` en
`assets/js/calculo-refrigeracion.js`):

```javascript
const FS = 3;  // factor de escala
// 1) Backup de TODOS los font sizes y line widths
const oXTitle  = chart.options.scales.x.title.font.size;
const oXTicks  = chart.options.scales.x.ticks.font.size;
// ... resto de backups
const oBorders = chart.data.datasets.map(d => d.borderWidth);

// 2) Aplicar escala
chart.options.scales.x.title.font.size = (oXTitle || 11) * FS;
chart.options.scales.x.ticks.font.size = (oXTicks || 8)  * FS;
// ... resto de aplicación
chart.data.datasets.forEach(d => { d.borderWidth = (d.borderWidth || 1.4) * 2.2; });
chart._exportScale = FS;

// 3) Resize + update + capture
chart.resize(2400, 1400);
chart.update('none');
const chartImg = chart.toBase64Image('image/png', 1);

// 4) Restaurar TODO al estado original
chart.options.scales.x.title.font.size = oXTitle;
chart.options.scales.x.ticks.font.size = oXTicks;
chart.data.datasets.forEach((d, i) => { d.borderWidth = oBorders[i]; });
chart._exportScale = 1;
chart.resize();
chart.update('none');
```

**NUNCA** hagas captura HD subiendo solo `devicePixelRatio` o solo
el tamaño del canvas — el resultado se verá pixelado o con textos
ilegibles. La regla es **proporcionalidad total**: si subiste el
canvas 4×, todos los elementos visuales deben subir 3-4× también.

**Aplica también a:** futuras gráficas en el módulo (curvas TPT
de sobrecarga, curvas FAA Arrhenius, gráficas de muestras DGA,
KPIs del dashboard ejecutivo, etc.).

**Verificación visual obligatoria** antes de cerrar el commit:
generar el informe, abrir el PNG embebido (clic derecho → ver
imagen) y verificar a tamaño real que TODOS los textos se leen
sin esfuerzo. Si requiere zoom para leerlos, el factor de escala
es insuficiente.

### 0.1.2.7 Regla permanente · Re-deploy obligatorio de firestore.rules tras cualquier cambio en el archivo

**Contexto del bug histórico (sesión 2026-05-03 PM13):** después de
agregar el deep-clean (regla §0.1.2.6) + el pre-chequeo de admin
con `verificarPermisosAdmin`, el director volvió a ver el error
*"Permiso denegado al escribir en Firestore"* con el modal "Registrar
acción de mantenimiento". El pre-chequeo cliente verificaba que el
usuario era admin (rol='admin' + activo=true), pero el `addDoc`
seguía siendo rechazado por las rules en producción.

**Causa raíz:** las rules en producción NO incluían el match
`/acciones_refrigeracion/{id}` agregado en microfase 4 (commit
`a86a51f`). El deploy `firebase deploy --only firestore:rules` que
el director ejecutó esa sesión **incluía los índices nuevos pero
NO había aplicado el match nuevo** — probablemente porque el deploy
fue hecho desde una copia local de `firestore.rules` que aún no
tenía esa sección, o porque el director ejecutó solo
`firebase deploy --only firestore:indexes` y no rules.

Sin el match `/acciones_refrigeracion/{id}`, las rules caían al
fallback final `match /{document=**}` con `allow read, write: if
false` → **deny-all explícito**. La SDK Web reporta esto como
`permission-denied` igual que cualquier otra rule violada, sin
indicar que el match no existe.

**Síntomas a reconocer:**
- El usuario tiene rol admin verificado en `/usuarios/{uid}` y/o
  `/admins/{uid}`.
- Otros writes a colecciones existentes (ej. `/contratos/{cid}`)
  funcionan.
- Solo writes a la colección NUEVA fallan con permission-denied.
- El pre-chequeo cliente `verificarPermisosAdmin` retorna `ok: true`.
- Re-leer las rules en producción desde Firebase Console muestra
  versión vieja (sin el match nuevo).

**Regla permanente** para CUALQUIER sesión que modifique
`firestore.rules`:

1. **Detectar el cambio:** si el commit toca `firestore.rules`,
   AVISAR al director con el bloque `⚠ Requiere deploy manual`
   incluyendo el comando exacto:
   ```bash
   firebase deploy --only firestore:rules
   ```
   (regla §0.1.1).

2. **Verificar el deploy fue exitoso:** después de deployar, el
   director debe ver en la salida del CLI:
   ```
   ✓ firestore: released rules firestore.rules to cloud.firestore
   ✓ Deploy complete!
   ```
   Si solo dice "deployed indexes" sin "released rules", el deploy
   de rules NO se ejecutó.

3. **El director debe ejecutar AMBOS** comandos cuando aplica:
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only firestore:indexes
   ```
   `firebase deploy --only firestore` ejecuta los dos juntos pero
   trigger una pregunta sobre índices que el director debe
   responder con N (regla §0.1.1).

4. **Verificar las rules en producción** comparando contra el repo:
   ```bash
   # En Firebase Console:
   # https://console.firebase.google.com/project/lordpowertransformersmj/firestore/rules
   # → revisar que el contenido coincide con firestore.rules del repo
   ```
   Si NO coincide, ejecutar `firebase deploy --only firestore:rules`
   nuevamente.

5. **Mensaje accionable en la UI** cuando el pre-chequeo cliente
   pasa pero Firestore rechaza con permission-denied:
   *"CAUSA MUY PROBABLE: las rules en producción NO incluyen el
   match /COLECCION/{id} (deploy desactualizado). → ACCIÓN: ejecute
   `firebase deploy --only firestore:rules` desde la Mac."*

   Implementado en `guardarAccion()` desde commit este (2026-05-03).

6. **NUNCA asumir que las rules están desplegadas.** Siempre que
   el director reporte permission-denied, el primer chequeo es
   *"¿están las rules en producción al día con el repo?"*.

**Solución del bug original (commit `b8e2f4d` siguiente):** el
director ejecuta `firebase deploy --only firestore:rules` desde su
Mac con la versión actual del repo. Verificación: la salida del
CLI debe mostrar *"released rules firestore.rules to
cloud.firestore"*. Después hard-reload Cmd+Shift+R y reintentar.

### 0.1.2.10 Regla permanente · Render visual con foto de referencia · fidelidad + interactividad obligatorias

**Contexto del bug histórico (sesión 2026-05-05):** durante la
construcción del render integral del transformador en la calculadora
de refrigeración, el director compartió una foto real de un
transformador de potencia (vista cenital · Lord Power) y pidió que
el render se asemejara. Cometí dos errores que requirieron tres
iteraciones para corregir:

1. **Render esquemático en vez de realista.** Primer intento: solo
   rectángulos planos sin gradientes ni profundidad. El director
   respondió: *"no estas haciendo el reinder como te lo pedi, la
   image de referencia no se parece en nada a lo que me estas
   ilustrando"*.

2. **Conservador en posición incorrecta.** Lo coloqué CENTRADO sobre
   el tanque principal con tubería vertical. La foto de referencia
   muestra el conservador montado SOBRE EL BANCO DE RADIADORES, lado
   AT, paralelo a ellos, soportado por una cuna fijada al tanque
   (no al centro).

3. **No-interactividad.** Las asignaciones de "qué ventilador en
   qué cuerpo" se hacían solo desde dropdowns auxiliares en otra
   sección. El director pidió: *"aun no me permites desde render
   ubicar los ventiladores ami voluntad desde [el render]"*.

**Regla permanente** para CUALQUIER render visual de un activo
físico (transformador, radiador, motor, switchgear, etc.):

1. **Si el director comparte foto de referencia, la foto MANDA.**
   - Antes de codificar el render, descomponer la foto en
     elementos: tipo de cuerpo, posición relativa, escala, color
     dominante, montaje (cuna, brida, soportes). Anotar en el
     comentario del SVG.
   - Si tienes dudas sobre posición de algún elemento, **pregunta
     antes de inventar**. Especialmente para elementos auxiliares
     (conservador, BRT, panel de control, descargadores).
   - **Anti-patrón:** asumir posición "típica" sin verificar. El
     conservador puede estar centrado, lateral, sobre radiadores
     A o B, en cuna o en pedestal. La foto te lo dice.

2. **Detalles 3D NO son opcionales en un render que comunica
   "real".** Aplicar siempre:
   - **Gradientes lineales y radiales** en superficies metálicas
     (tanque, radiadores, conservador, bujes).
   - **Sombras proyectadas** con `feGaussianBlur` + offset positivo
     (mínimo `dx="2" dy="4"`).
   - **Capas apiladas** para simular volumen 3D (ej.: bujes de
     porcelana = 4 ellipses ascendentes).
   - **Highlights** en zonas iluminadas (rectángulo blanco a 50%
     opacidad en la mitad superior del cuerpo).
   - **Detalles funcionales reales:** placas de inspección con
     tornillería, indicador de nivel, respiradero, brida de
     conexión, cabezales superior/inferior de radiador, aletas
     individuales (no solo líneas).

3. **El render de cualquier conjunto seleccionable DEBE ser
   interactivo.** Si el render representa entidades que el usuario
   asigna (ventiladores en cuerpos, fases en bornes, breakers en
   slots, sensores en taps, etc.):
   - Cada entidad clickeable lleva `data-<entidad>="N"` +
     `style="cursor:pointer"` + `tabindex="0"` + `role="button"` +
     `<title>` informativo (accesibilidad).
   - Click → modal o popover con controles para asignar/quitar.
   - Cambio en el modal → re-render del conjunto + re-cálculo
     de cualquier KPI dependiente.
   - Esc / clic afuera / botón close → cierra el modal.
   - **Anti-patrón:** dejar el render como decorativo y forzar al
     usuario a reasignar desde dropdowns externos. Si el usuario
     ve el cuerpo, espera poder interactuar con él.

4. **Verificación obligatoria antes de cerrar el commit:**
   - Abrir la página en el browser, agregar 2-3 modelos al mix,
     hacer clic en cada cuerpo y verificar que el modal abre.
   - Asignar/quitar ventiladores y verificar que el conteo total
     se mantiene (invariante de la cantidad).
   - Comparar visualmente contra la foto de referencia que el
     director compartió. Si algo se ve diferente, ajustar antes
     de pushear.

5. **Iteraciones esperadas:** la fidelidad visual rara vez se
   logra en un solo intento. Esperar 2-3 rondas de feedback con
   el director antes de declarar el render terminado. Cada ronda
   debe acercar más al fotografía de referencia.

**Solución del bug original (commit siguiente):**
- Reposicionar conservador sobre el banco de radiadores lado A
  con cuna de soporte (2 columnas hasta el tanque).
- Cada radiador wrap en `<g class="render-cuerpo-clickable"
  data-cuerpo="N" tabindex="0" role="button">`.
- Modal `abrirAsignacionCuerpo(N)` con controles +/- por modelo
  + función de rebalanceo `asignarMasAlCuerpo` /
  `quitarDelCuerpo` que conserva la cantidad total y redistribuye
  hacia el cuerpo más/menos cargado.
- Hint banner sobre el render: *"💡 clic en cualquier cuerpo
  para asignar ventiladores"*.

### 0.1.2.11 Regla permanente · Foto de referencia → embeber con `<image>`, NUNCA redibujar en SVG

**Contexto del bug histórico (sesión 2026-05-05):** después de
documentar la regla §0.1.2.10 ("foto de referencia MANDA"), aún
así caí en el anti-patrón de **reinterpretar** la foto del director
como SVG dibujado a mano alzada (gradientes, bujes simulados,
ABB texto sintético, etc.). El director respondió de inmediato:
*"el render debe verse tal cual como esta en el repositorio estas
alterando la imagen"*.

El problema: redibujar una foto en SVG **siempre** introduce
"interpretación creativa" — colores ligeramente distintos,
proporciones aproximadas, detalles inventados o suprimidos. Por
muy fiel que se intente, NO es el original. El director quiere
ver SU foto, no una versión "estilo el original".

**Regla permanente** para CUALQUIER caso donde el director
provea una imagen (foto JPG/PNG, ilustración técnica, screenshot
de catálogo, etc.) y pida que se use como render visual:

1. **NO redibujar en SVG.** Por más detallado que parezca el
   resultado, será una aproximación, no la imagen del director.
   Cualquier redibujado es alteración.

2. **Embeber la imagen original con `<image href="...">`** dentro
   del SVG (o `<img src="...">` si es HTML directo). El SVG sirve
   como contenedor para las anotaciones (cotas, etiquetas,
   highlights interactivos) pero el contenido visual es la
   imagen original sin tocar.

3. **Archivar la imagen** en una ruta dedicada del repo
   (`assets/img/refs/<descripcion>.png`) para que esté disponible
   tras el deploy. NO usar URLs externas (Imgur, Drive, Discord,
   WhatsApp CDN) que pueden caducar.

4. **Si necesitas ajustar tamaño/relación de aspecto:** usar
   `width`/`height` del `<image>` + `preserveAspectRatio="xMidYMid
   meet"` para que la imagen entera se vea sin deformación.
   NUNCA recortar, redimensionar destructivamente, o
   "recolorear" la imagen original.

5. **Solo agregar encima:** título superior, footer con cotas
   numéricas, y opcionalmente regiones interactivas invisibles
   (`<rect fill="transparent">` con `cursor:pointer`) para
   permitir clicks. Nada que altere la apariencia de la imagen
   subyacente.

6. **Anti-patrón a EVITAR aunque parezca tentador:**
   - "Voy a redibujarla mejor con gradientes futuristas" → **NO**.
   - "Voy a hacer mi versión que respete el espíritu" → **NO**.
   - "Voy a animar partes con SVG vectorial" → **NO sin el OK
     explícito del director**.
   - "La foto es de baja resolución, mejor reconstruirla" →
     **NO** — si la calidad es insuficiente, pídele al director
     una versión de mayor resolución.

7. **Excepción legítima:** SVG vectorial sí es apropiado cuando
   el director NO ha provisto foto de referencia y la imagen no
   existe (ej.: render esquemático de un cálculo, diagrama de
   bloques, gráfico de Chart.js). En ese caso el SVG es la
   fuente de verdad, no una copia.

**Solución del bug original (commit `75d1d13`):**
- `_renderLateral` reescrito de ~210 líneas SVG redibujado a
  ~25 líneas que solo hacen `<image href="../assets/img/refs/
  lateral-transformador-ABB-ref.png">` + título arriba + cotas
  abajo.
- Imagen archivada en `assets/img/refs/` (no en root del repo).
- Eliminadas todas las referencias a "ABB", "rivets", "bujes
  porcelana", etc. que eran reconstrucción manual.

**Síntomas para reconocer en futuras sesiones:**
- El director dice *"alteraste la imagen"*, *"no es como está
  en el repo"*, *"esto no se parece a la foto"*.
- El SVG tiene >50 líneas reproduciendo elementos visuales
  (gradientes, paths complejos, círculos en patrones, etc.)
  que claramente intentan imitar una foto.
- Hay un archivo PNG/JPG en el repo con el mismo contenido
  visual que el SVG está redibujando.

**Aplica también a:** ilustraciones de catálogo de fabricante
(Ziehl-Abegg, Krenz, ABB, Siemens) que el director suba como
referencia, screenshots de pantallas legacy, fotos de placas de
características, diagramas unifilares oficiales del cliente, etc.

### 0.1.3 Regla permanente · Multi-contrato N5 · docId compuesto en suministros

**Contexto del bug histórico (sesión 2026-04-27 PM5):** el módulo
Movimiento del contrato 4125000143 dejó de funcionar tras la migración
multi-contrato N5. Síntoma: al guardar un movimiento aparecía
"Suministro X no existe".

**Causa raíz:** desde N5 los suministros se guardan en Firestore con
**docId compuesto** `'{contrato_id}_{codigo}'` (ej. `4125000143_S01`).
Pero `assets/js/data/movimientos.js#suministroRef(sid)` y
`assets/js/data/marcas.js#suministroRef(sid)` accedían directo a
`/suministros/{sid}` con solo el código plano, lo que **falla
silenciosamente** para todos los contratos que usan docId compuesto.

**Regla obligatoria para cualquier consumer de `/suministros`:**

```javascript
// ❌ MAL — solo funciona con docs legacy 4123000081 pre-migración
const ref = doc(db, 'suministros', codigo);

// ✅ BIEN — soporta docId compuesto N5 + fallback a codigo plano
import { composeDocId } from '../domain/contratos.js';
function suministroRef(sid, contratoId = '') {
  const docId = contratoId ? composeDocId(contratoId, sid) : sid;
  return doc(db(), COL_SUMINISTROS, docId);
}
```

**Cualquier código nuevo que lea/escriba `/suministros/{X}` directo
debe pasar el `contrato_id`** del payload, del filtro activo, o del
contrato_context (`getContratoActivo()` de `assets/js/ui/contrato-
context.js`). Sin contrato_id queda fallback a codigo plano (compat
con el contrato 4123000081 importado antes de la migración N5).

**Aplica también a:**
- `crearMovimiento` (lee suministro para `stock_inicial` en la tx)
- `computarStock(suministroId)` (one-shot stock calculation)
- `marcas.js` `crear/actualizar/eliminar` (sync de
  `marcas_disponibles[]` en el suministro)
- Cualquier query de movimientos por suministro debe filtrar también
  por `contrato_id` para que dos contratos con el mismo S01 no
  mezclen su stock en el cálculo agregado.

**Verificación:** si en una sesión nueva tocas o creas algo que
accede a `/suministros/{X}`, **ejecutar siempre**:

```bash
grep -rn "doc(.*, 'suministros'\|COL_SUMINISTROS" assets/js/ --include="*.js"
```

y verificar que cada call site usa `composeDocId(cid, codigo)` o
recibe el ID ya compuesto desde un `getDocs` previo.

**Indicios visuales del bug:**
- "Suministro X no existe" en el formulario de Movimiento.
- Stock muestra "—" persistentemente en el formulario.
- Sync de `marcas_disponibles` no actualiza el array del suministro
  (la marca queda en `/marcas` pero no aparece en el dropdown del
  formulario de Movimiento ni en el catálogo).

### 0.2 Branch de trabajo

Durante la evolución v2.0 (F16–F37) la rama activa fue
`claude/review-phase-16-plan-mhPgg` (no `claude/personal-website-
transformers-CVWxV` — esa era la rama legacy del plan v1.0).
Cualquier sesión nueva debe continuar en la rama activa indicada
por el hook del entorno o explícitamente por el dueño.
`main` se toca solo cuando el dueño lo pide explícitamente.

### 0.3 Estado al iniciar una sesión nueva (abril 2026)

**El plan v2.2 (F16–F37) está cerrado.** Al arrancar una sesión
nueva, lee en este orden:

1. Esta §0 completa (permisos + token + branch).
2. **§7 del presente archivo** (progreso actual, inventario del
   repo §7.1, cómo continuar §7.2).
3. `docs/ARQUITECTURA.md` para entender dónde vive cada cosa.
4. `docs/OPERACIONES.md` si el director te pide un troubleshooting
   o un paso operativo.
5. `CHANGELOG.md` para ver qué cambió en cada tag post-v2.0.

**NO arranques a re-implementar el plan**. Las 22 microfases están
hechas. El último tag es `v2.0.8` (commit `6accdb6`). El prompt
maestro v2.2 está archivado como contrato funcional de referencia
pero ya se cumplió.

**Qué esperar:** el director te pedirá features puntuales, bug
fixes ante feedback de campo, o una extensión v3 para nuevos
parámetros. Sigue el árbol de decisión de §7.2.

---

## 1. Descripción del proyecto

Plataforma integral para el **seguimiento, planificación y control** del mantenimiento
especializado de transformadores de potencia en servicio activo en el Caribe Colombiano
(Bolívar, Córdoba, Sucre, Cesar y 11 municipios del Magdalena).

El sistema contempla:

- Trazabilidad completa de intervenciones.
- Historial de fallas y análisis de causa raíz.
- Indicadores de desempeño (KPIs) de confiabilidad, disponibilidad y mantenibilidad (RAM).
- Gestión documental alineada con **ISO 50001:2018**, IEEE C57.12, IEC 60076, RETIE, NTC-IEC 60364 y CIGRE WG A2.
- Módulos operativos dinámicos (inventario, órdenes de trabajo, georreferenciación, alertas).

> **Naturaleza:** proyecto sin ánimo de lucro. Todo el stack se diseña sobre
> **tiers gratuitos** de proveedores cloud.

---

## 2. Stack tecnológico proyectado

| Capa              | Herramienta                               | Plan gratuito              | Uso previsto |
|-------------------|-------------------------------------------|----------------------------|--------------|
| Hosting estático  | **GitHub Pages**                          | Ilimitado (repo público)   | Landing y sitio estático |
| Hosting dinámico  | **Vercel** (Hobby)                        | 100 GB banda / mes         | SSR y serverless functions |
| Runtime backend   | **Node.js** (Serverless Functions)        | Incluido en Vercel Hobby   | APIs internas |
| Autenticación     | **Firebase Authentication** (Spark)       | Ilimitado Email/Password   | Login de admin |
| Base de datos     | **Cloud Firestore** (Spark)               | 1 GB · 50k lecturas/día    | Datos operativos |
| Almacenamiento    | **Firebase Storage** (Spark)              | 5 GB · 1 GB descarga/día   | Documentos técnicos |
| Mapas             | **Leaflet + OpenStreetMap**               | Gratuito                   | Georreferenciación |
| Control de versiones | **GitHub**                             | Ilimitado                  | Código y CI/CD |

> **Nota importante:** cada servicio dinámico se enlazará **de forma progresiva** en las
> microfases dedicadas. Por el momento el sitio permanece estático (HTML/CSS/JS vanilla)
> con barrera de acceso también estática.

---

## 3. Arquitectura lógica (estado objetivo)

```
┌─────────────────────────────────────────────────────────────┐
│                  Usuario (navegador)                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
     ┌────────────────────────────┐
     │  index.html (landing      │  ← visible para todos, SIEMPRE
     │  "en construcción" +      │     se muestra al entrar
     │  panel de acceso)         │
     └────────────┬──────────────┘
                  │  código correcto
                  ▼
     ┌────────────────────────────┐
     │  home.html (sitio real)   │  ← protegido por auth-guard
     │  y páginas internas       │
     └────────────┬──────────────┘
                  │  ruta /admin (fase futura)
                  ▼
     ┌────────────────────────────┐
     │  Panel admin               │  ← protegido por Firebase Auth
     │  (CRUD sobre Firestore)    │
     └────────────┬──────────────┘
                  │
                  ▼
     ┌────────────────────────────┐
     │  Firebase (Auth · Firestore│
     │  · Storage)                │
     └────────────────────────────┘
```

### Estructura de carpetas (objetivo)

```
/
├── index.html              # Landing "en construcción" + gate
├── home.html               # Home real del sitio (detrás del gate)
├── CLAUDE.md               # Este documento
├── README.md               # (futuro)
├── package.json            # (futuro — Fase 3)
├── vercel.json             # (futuro — Fase 3)
├── firebase.json           # (futuro — Fase 4)
├── .firebaserc             # (futuro — Fase 4)
├── /assets/
│   ├── /css/
│   │   ├── base.css        # (futuro — Fase 1)
│   │   └── real.css        # Estilo del sitio real (Fase 0 inicial)
│   ├── /js/
│   │   ├── gate.js         # Lógica del gate estático  ✅ Fase 0
│   │   ├── auth-guard.js   # Protector de páginas internas  ✅ Fase 0
│   │   ├── firebase-init.js # (futuro — Fase 4)
│   │   └── admin/          # (futuro — Fase 5+)
│   └── /img/               # Logos, SVGs
├── /pages/                 # (futuro) Páginas internas del sitio real
├── /api/                   # (futuro) Serverless functions Node.js
└── /.github/workflows/     # (futuro) CI/CD
```

---

## 4. Control de acceso

### Estado actual: **Login-first unificado** (Fase 14)

- **`index.html` es el portal de login público** (SaaS-style). Es la
  única ruta visible sin autenticación; el resto del sitio devuelve
  redirect al login mientras no haya sesión activa.
- **Firebase Authentication (Email/Password)** es la fuente de verdad.
  Los miembros del equipo se autentican con su correo corporativo y
  contraseña. La persistencia es configurable por checkbox: sesión
  (cierra al salir del navegador) o local (permanente hasta logout).
- **Perfiles y roles en Firestore** — `/usuarios/{uid}` con
  `{email, nombre, rol, activo, createdAt, createdBy}`. Roles activos:
  - `admin` — acceso completo + panel `/admin/*`.
  - `tecnico` — acceso de operación (lectura de módulos, no edita).
- **Guard unificado** — `assets/js/auth/session-guard.js` es el único
  punto de verificación. `page-guard.js` y `admin-guard.js` son
  wrappers auto-ejecutables para páginas protegidas. Oculta el
  `<body>` hasta resolver; redirige a login si no hay sesión o perfil,
  y a `/home.html` si un no-admin pisa una ruta admin.
- **Bootstrap** — `/admins/{uid}` (colección heredada de F5) sigue
  siendo aceptada como admin legacy para que el propietario no quede
  bloqueado durante la migración del primer perfil. Basta con crear
  el doc desde Firebase Console. Una vez hay un admin, se gestionan
  los demás usuarios desde `/admin/usuarios.html`.
- **Recuperación de contraseña** — el portal expone
  `sendPasswordResetEmail` de Firebase Auth.
- **Gate estático / dinámico retirados** — los artefactos de F0
  (`gate.js`, `sessionStorage.sgm.access`) y de F12 (`gate_codes`,
  `/admin/codigos.html`) fueron eliminados. Ya no hay códigos de
  acceso: solo credenciales personales por miembro.

### Reglas Firestore (F14)

- `isTeamMember()` — `activo=true` en `/usuarios/{uid}` **o**
  existencia en `/admins/{uid}` (bootstrap).
- `isAdmin()` — `rol='admin'` + `activo=true` en `/usuarios/{uid}`
  **o** existencia en `/admins/{uid}` (bootstrap).
- Todas las colecciones de negocio (`transformadores`, `ordenes`,
  `documentos`, `alertas_*`) requieren `isTeamMember()` para lectura
  y `isAdmin()` para escritura.
- `/usuarios/{uid}` — cada usuario puede leer su propio perfil; los
  admins pueden listar y gestionar todo. No se permite auto-eliminación.
- `/gate_codes/{hash}` — cerrada (`read, write: if false`). Los datos
  residuales de F12 quedan inertes hasta que se borren manualmente.

---

## 5. Plan de microfases

> **Regla de oro:** cada microfase se cierra con un **commit aislado** y el agente se
> detiene hasta recibir la orden explícita de continuar con la siguiente. Esto evita
> agotar el presupuesto de contexto / timeouts / crasheos.

### Resumen visual

| # | Microfase                                                 | Peso | Acumulado | Estado |
|---|-----------------------------------------------------------|------|-----------|--------|
| 0 | Documentación inicial + barrera de acceso estática        |  5%  |   5%      | ✅ completada |
| 1 | Estructura base CSS/JS y refactor del landing             |  5%  |  10%      | ✅ completada |
| 2 | Home real + páginas estáticas internas                    | 10%  |  20%      | ✅ completada |
| 3 | Preparación de hosting (Vercel / GitHub Pages + CI)       |  5%  |  25%      | ✅ completada |
| 4 | Integración de Firebase (Auth, Firestore, Storage)        |  5%  |  30%      | ✅ completada |
| 5 | Autenticación admin real (login con Firebase Auth)        |  5%  |  35%      | ✅ completada |
| 6 | Módulo: Inventario de activos (CRUD)                      | 10%  |  45%      | ✅ completada |
| 7 | Módulo: Órdenes de trabajo                                | 10%  |  55%      | ✅ completada |
| 8 | Módulo: KPIs y analítica                                  | 10%  |  65%      | ✅ completada |
| 9 | Módulo: Gestión documental (+ Storage)                    |  8%  |  73%      | ✅ completada |
| 10 | Módulo: Georreferenciación (Leaflet)                     |  7%  |  80%      | ✅ completada |
| 11 | Módulo: Alertas y notificaciones                         |  7%  |  87%      | ✅ completada |
| 12 | Gate dinámico + endurecimiento admin                     |  5%  |  92%      | ✅ completada |
| 13 | Pulido: SEO, accesibilidad, performance, i18n            |  4%  |  96%      | ✅ completada |
| 14 | Lanzamiento: login unificado + roles + v1.0.0            |  4%  | 100%      | ✅ completada |
| 15 | Realtime: `onSnapshot` en home, órdenes y alertas        |  —   | 100% + RT | ✅ completada |

### Evolución v2.0 · MO.00418.DE-GAC-AX.01 Ed. 02 (F16–F37)

La tabla post-v1 original (F16–F24) fue reemplazada por el plan v2.2
derivado del documento interno **MO.00418.DE-GAC-AX.01 Ed. 02**
(CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM). 22 microfases
independientes, cada una con commit aislado:

| #  | Microfase                                                  | Estado |
|----|------------------------------------------------------------|--------|
| 16 | Refactor modelo de datos v2 (secciones, salud_actual, subestaciones) | ✅ completada |
| 17 | Importador Excel → Firestore con recálculo HI              | ✅ completada |
| 18 | Motor de Salud (HI ponderado Tabla 10 + overrides §A5/A9)  | ✅ completada |
| 19 | Muestras de Laboratorio (DGA / ADFQ / FUR) time-series     | ✅ completada |
| 20 | Subestaciones (UI dedicada)                                | ✅ completada |
| 21 | Contratos (8 contratos macro · presupuesto)                | ✅ completada |
| 22 | Catálogos (subactividades / macroactividades / causantes)  | ✅ completada |
| 23 | Refactor Órdenes v2 (FKs catálogo)                         | ✅ completada |
| 24 | TPT / Respaldo (calculadora sobrecarga IEEE C57.91)        | ✅ completada |
| 25 | Fallados + RCA (5 porqués, Ishikawa, FMEA)                 | ✅ completada |
| 26 | Contramuestras + Monitoreo Intensivo C₂H₂ + Juicio experto FUR | ✅ completada |
| 27 | Dashboards ejecutivos por rol                              | ✅ completada |
| 28 | RBAC granular con ámbito geográfico (5 roles + admin)      | ✅ completada |
| 29 | Workflow aprobaciones + Estados especiales (OTC §A9.3)     | ✅ completada |
| 30 | Plan de Inversión (scoring multicriterio)                  | ✅ completada |
| 31 | Reportes PDF / Excel oficiales                             | ✅ completada |
| 32 | Cloud Functions + notificaciones por email                 | ✅ completada |
| 33 | Desempeño de aliados / contratistas                        | ✅ completada |
| 34 | PWA + offline para brigadistas                             | ✅ completada |
| 35 | Audit log global + bitácora                                | ✅ completada |
| 36 | Matriz de Riesgo Criticidad × Salud                        | ✅ completada |
| 37 | Motor de Estrategias por Condición (catálogo §A7)          | ✅ completada |

> **Continuidad entre chats:** al reabrir una sesión, lee sección 0
> (permisos push + token inline), luego la tabla arriba. La próxima
> movida tras F16 es **F17 — Importador Excel**. El prompt maestro
> v2.2 (con addendum §A1–A9) es el contrato funcional de referencia.

### Detalle por microfase

#### ✅ Fase 0 — Documentación inicial + barrera de acceso estática

**Entregables**

- `CLAUDE.md` con plan completo y proyección.
- `assets/js/gate.js` con código estático `97601992@`.
- `assets/js/auth-guard.js` para proteger páginas internas.
- Panel de acceso integrado en `index.html` (mantiene el diseño "en construcción").
- Stub de `home.html` como sitio real tras el gate.
- Barra de progreso del landing actualizada al **5%**.

**Criterio de cierre**

- Sin acceso a `home.html` sin el código correcto (redirige a `index.html`).
- Con el código correcto, se persiste la sesión y se accede a `home.html`.

#### ⏳ Fase 1 — Estructura base CSS/JS

- Extraer CSS embebido del landing a `assets/css/base.css`.
- Sistema de tipografías y variables compartido entre landing y sitio real.
- Añadir `favicon`, `meta` OG/SEO mínimos.
- No hay cambios funcionales visibles más allá del refactor.

#### ✅ Fase 2 — Home real + páginas estáticas

- `home.html` con navegación real, hero, resumen de módulos y KPIs (aún placeholder).
- Subpáginas: `/pages/about.html`, `/pages/cobertura.html`, `/pages/normativa.html`, `/pages/contacto.html`.
- Todas protegidas por `auth-guard.js` / `auth-guard-pages.js`.
- Contenido 100% estático.

#### ✅ Fase 3 — Hosting y CI

- `package.json` base con scripts de lint y serve.
- `.htmlvalidate.json` con ajustes tolerantes para HTML estático.
- `vercel.json` con headers de seguridad, cleanUrls y redirects.
- `.nojekyll` para GitHub Pages sin procesamiento Jekyll.
- `.gitignore` de Node / Vercel / secretos.
- `.github/workflows/ci.yml` — lint HTML en push / PR (branches `main`, `master`, `claude/**`).
- `.github/workflows/pages.yml` — deploy a GitHub Pages desde `main`.
- `README.md` con estado, stack y comandos de desarrollo.

#### ✅ Fase 4 — Firebase

- `firebase.json` (hosting + rules paths + emuladores Auth/Firestore/Storage).
- `.firebaserc` con `default: "sgm-transpower"`.
- `firestore.rules` y `storage.rules` en modo **DENY-ALL** (`allow read, write: if false`).
- `firestore.indexes.json` vacío (se pobla en F6+).
- `assets/js/firebase-config.js` con config pública placeholder y flag `isFirebaseConfigured`.
- `assets/js/firebase-init.js` — SDK modular v10 vía CDN (app/auth/firestore/storage), exports `getApp`, `getAuthSafe`, `getDbSafe`, `getStorageSafe`. Expone `window.__sgmFirebaseProbe()` para diagnóstico.
- `pages/_firebase-test.html` — página oculta (no enlazada) que verifica la carga del SDK y reporta `projectId` + servicios cargados.
- Pasos manuales documentados en el header de `firebase-config.js` (crear proyecto, habilitar Auth/Firestore/Storage, desplegar reglas con `firebase deploy`).

#### ✅ Fase 5 — Autenticación admin

- `/admin/login.html` con formulario Email/Password sobre Firebase Auth, persistencia `browserSessionPersistence` y chequeo contra allowlist de UIDs. Detecta prerequisitos (Firebase configurado + UID registrado) y bloquea el botón con aviso si faltan.
- `/admin/index.html` — panel administrativo vacío con 8 módulos placeholder (F6–F12), banner con email del admin y botón de logout.
- `assets/js/admin/admin-config.js` — `ADMIN_UIDS` (allowlist) + `ADMIN_ROUTES` + helper `isAdminUid(uid)`.
- `assets/js/admin/admin-auth.js` — `loginAdmin`, `logoutAdmin`, `onAdminAuthChange`, `humanizeAuthError`, `ensureReady`.
- `assets/js/admin/admin-guard.js` — verifica gate estático + sesión Firebase + UID autorizado. Oculta el `<body>` hasta resolver. Timeout de 5 s → redirige a login.
- Link discreto a `admin/login.html` en el footer de `home.html`.

#### ✅ Fase 6 — Módulo Inventario

- Colección `transformadores` en Firestore con campos: `codigo`, `nombre`, `departamento`, `municipio`, `subestacion`, `potencia_kva`, `tension_primaria_kv`, `tension_secundaria_kv`, `marca`, `modelo`, `serial`, `fecha_fabricacion`, `fecha_instalacion`, `estado` (operativo / mantenimiento / fuera_servicio / retirado), `latitud`, `longitud`, `observaciones`, timestamps y `createdBy`.
- Reglas Firestore: lectura pública (filtrada por gate estático) + escritura restringida a admins vía colección `/admins/{uid}`. Validación server-side de campos obligatorios y enumeración de `estado`.
- Índices compuestos en `firestore.indexes.json` (`departamento+codigo` y `estado+codigo`).
- `assets/js/data/transformadores.js` — API: `listar`, `obtener`, `crear`, `actualizar`, `eliminar`, `contarPorEstado` + enums + helpers de formato.
- `admin/inventario.html` + `admin-inventario.js` — tabla con filtros (depto / estado), modal CRUD completo con 16 campos, confirmación de borrado, mensajes de feedback.
- `pages/inventario.html` + `inventario-public.js` — vista solo lectura con KPIs (total, operativo, mantenimiento, fuera de servicio), filtros y búsqueda local.
- `assets/css/inventario.css` — tabla, toolbar, estado-pills, modal.
- Nav ampliada con "Inventario" en `home.html` + 5 subpáginas + panel admin.

#### ✅ Fase 7 — Módulo Órdenes de trabajo

- Colección `ordenes` en Firestore con campos: `codigo`, `titulo`, `descripcion`, `transformadorId`, `transformadorCodigo`, `tipo` (preventivo / correctivo / predictivo / emergencia), `prioridad` (baja / media / alta / crítica), `estado` (planificada / en_curso / cerrada / cancelada), `tecnico`, `fecha_programada`, `fecha_inicio`, `fecha_cierre`, `duracion_horas`, `observaciones`, timestamps y `createdBy`.
- Subcolección **`ordenes/{id}/historial`** (append-only) con eventos `{tipo_evento, estado_previo, estado_nuevo, nota, uid, at}`. Reglas Firestore bloquean update/delete (historial inmutable). La API registra automáticamente un evento `creacion` al alta y `cambio_estado` cuando cambia el campo `estado`.
- Reglas Firestore: lectura pública (filtrada por gate estático) + escritura restringida a admins vía `/admins/{uid}` con validación de enums server-side (`estado`, `tipo`, `prioridad`).
- Índices compuestos en `firestore.indexes.json`: `estado+codigo`, `tipo+codigo`, `prioridad+codigo`, `transformadorId+codigo` (todos con `codigo DESC` para listar órdenes más recientes primero).
- `assets/js/data/ordenes.js` — API: `listar`, `obtener`, `crear`, `actualizar`, `eliminar`, `registrarEvento`, `listarHistorial`, `contarPorEstado` + enums `ESTADOS_ORDEN`, `TIPOS_ORDEN`, `PRIORIDADES` + helpers de etiqueta.
- `admin/ordenes.html` + `admin-ordenes.js` — tabla con filtros (estado / tipo / prioridad), modal CRUD con 14 campos + select de transformadores (cargado desde la API de inventario), confirmación de borrado y **historial inmutable visible en modo edición**.
- `pages/ordenes.html` + `ordenes-public.js` — vista solo lectura con KPIs (total, planificadas, en curso, cerradas), filtros y búsqueda local por código/título/transformador/técnico.
- `assets/css/ordenes.css` — pills de `estado-pill.planificada|en_curso|cerrada|cancelada`, `tipo-pill.*`, `prioridad-pill.*` y bloque `.historial-wrap`.
- Nav ampliada con "Órdenes" en `home.html` + 6 subpáginas + panel admin + admin/inventario.

#### ✅ Fase 8 — KPIs y analítica

- `assets/js/data/kpis.js` — agregador cliente-side sobre `transformadores` + `ordenes`. Función principal `computeDashboard()` devuelve: totales, distribuciones (por estado / tipo / prioridad / departamento), serie mensual (últimos 12 meses), top-10 transformadores con más intervenciones y bloque **RAM** (`mtbf_dias`, `mttr_horas`, `disponibilidad_pct`, `muestra_fallos`, `parque_dias_servicio`). Adicionalmente `exportarOrdenesCSV()` genera un CSV con el universo de órdenes enriquecido con nombre y departamento del transformador.
- **Fórmulas RAM:**
  - MTTR = media de `duracion_horas` en órdenes `correctivas` cerradas; fallback a `fecha_cierre − fecha_inicio`.
  - MTBF = días-equipo acumulados en servicio (Σ `hoy − fecha_instalacion` por transformador) ÷ número de fallos (correctivas cerradas).
  - A = MTBF / (MTBF + MTTR) en las mismas unidades (horas).
- `pages/kpis.html` + `kpis-public.js` — dashboard público con 4 KPIs de parque, 3 tarjetas RAM, 5 gráficas (doughnut, 3 barras, línea) y tabla top-10. Botón "Recalcular" que vuelve a pedir a Firestore.
- `admin/kpis.html` + `admin-kpis.js` — mismo dashboard + botón **Exportar CSV** que descarga `sgm-ordenes-YYYY-MM-DD.csv`.
- `assets/js/kpis-render.js` — renderer compartido entre admin y público (destrucción correcta de charts en recargas, paleta alineada con variables CSS).
- `assets/css/kpis.css` — `.ram-grid`, `.ram-card` (con variantes good/warn según disponibilidad), `.charts-grid`, `.chart-card`, `.top-wrap`.
- Chart.js 4.4.1 por CDN (jsDelivr, umd.min).
- `home.html` alimenta ahora las 4 tarjetas placeholder (`TRANSFORMADORES / ÓRDENES ACTIVAS / DISPONIBILIDAD / MTBF`) con valores reales del snapshot.
- Nav "KPIs" en home + 7 subpáginas (incluye `_firebase-test`) + 3 paneles admin.
- Consultas agregadas sobre `ordenes`.

#### ✅ Fase 9 — Gestión documental

- Colección Firestore `documentos` (metadatos) + binarios en Firebase Storage bajo `documentos/{docId}/{filename}`.
- Campos: `codigo`, `titulo`, `descripcion`, `categoria` (protocolo / informe / certificado / manual / reporte / otro), `norma_aplicable` (ISO_50001 / IEEE_C57_12 / IEC_60076 / RETIE / NTC_IEC_60364 / CIGRE_WG_A2 / NINGUNA), `transformadorId`, `transformadorCodigo`, `autor`, `fecha_emision`, `filename`, `mime`, `size`, `storagePath`, `downloadURL`, `status` (subiendo / listo / error), timestamps y `createdBy`.
- **Storage**: `storage.rules` permite lectura pública (filtrada por gate estático), escritura restringida a admins vía `firestore.exists(/admins/{uid})` con límite de **20 MB** por archivo.
- **Firestore**: `firestore.rules` valida enums server-side en `create` y `update`; escritura restringida a admins.
- Índices compuestos en `firestore.indexes.json`: `categoria+codigo`, `norma_aplicable+codigo`, `transformadorId+codigo`.
- `assets/js/data/documentos.js` — API: `listar`, `obtener`, `subir` (pre-crea doc → `uploadBytesResumable` con callback de progreso → marca `status=listo` con `downloadURL`), `actualizarMetadata`, `eliminar` (borra objeto en Storage + doc), `formatSize`, `iconoPorMime` + enums + `MAX_FILE_MB`.
- Vista admin: `admin/documentos.html` + `admin-documentos.js` — tabla con filtros (categoría / norma), modal con 9 campos de metadata + drop-zone de archivo con barra de progreso en tiempo real. En edición se oculta el campo archivo (los binarios no se reemplazan en esta fase).
- Vista pública: `pages/documentos.html` + `documentos-public.js` — 4 KPIs (total, protocolos, informes, volumen total), filtros + búsqueda local, enlaces de descarga directos a Storage.
- `assets/css/documentos.css` — pills por categoría (6 variantes) y por estado de subida, drop-zone, barra de progreso.
- Nav ampliada con "Documentos" en home + 8 subpáginas (incluye `_firebase-test`) + 4 paneles admin.

#### ✅ Fase 10 — Georreferenciación

- Renderer compartido `assets/js/mapa-render.js` sobre **Leaflet 1.9.4** + **Leaflet.markercluster 1.5.3** (ambos por CDN unpkg con SRI). Funciones públicas: `initMap(id)`, `loadMarkers({departamento, estado, adminEditHref, onReport})`, `resetMap()`, `legendHtml()`. Usa `L.markerClusterGroup({ maxClusterRadius: 50, spiderfyOnMaxZoom: true })` y `divIcon` coloreado por estado via CSS var `--dot-color`.
- **Centro inicial:** `[9.4, -74.8]` · Caribe Colombiano · zoom 7. Tile layer **OpenStreetMap** estándar. `fitBounds` automático con `padding [30,30]` y `maxZoom: 11` al cargar marcadores.
- Filtro de coordenadas válidas: se descartan `null`, `0,0` y valores fuera de `[-90,90] / [-180,180]` (evita marcadores espurios en el origen).
- Paleta por `estado`: `operativo → --accent3 (#00ff99)`, `mantenimiento → --accent2 (#f0a500)`, `fuera_servicio → #ff5577`, `retirado → #4a6478`.
- Vista pública: `pages/mapa.html` + `assets/js/mapa-public.js` — filtros departamento/estado, botones **Recargar** y **Vista general**, contador `X visible de Y`, status-bar con total / con-coordenadas / sin-coordenadas, popup con ficha resumida del transformador (código, nombre, estado-pill, ubicación, potencia, tensión, coordenadas).
- Vista admin: `admin/mapa.html` + `assets/js/admin/admin-mapa.js` — mismos filtros + popup extendido con **enlace directo a `inventario.html#edit:{id}`** para corregir coordenadas o editar ficha.
- `assets/css/mapa.css` — contenedor `#sgmMap { height: 560px; }` (460px ≤ 768px), **tema oscuro** aplicado a controles y popups Leaflet (`.leaflet-container`, `.leaflet-control-attribution`, `.leaflet-control-zoom a`, `.leaflet-popup-content-wrapper`, `.marker-cluster` + `.marker-cluster div`), estilos de toolbar, contador, leyenda, barra de estado y pill `.sgm-pop-edit`.
- Nav ampliada con "Mapa" en home + 9 subpáginas (incluye `_firebase-test`) + 5 paneles admin.

#### ✅ Fase 11 — Alertas y notificaciones

- `assets/js/data/alertas.js` — motor de reglas cliente-side sobre `transformadores` + `ordenes` + `alertas_config` + `alertas_reconocidas`. Función principal `computarAlertas()` devuelve `{alertas[], resumen, config, generatedAt}`. Cada alerta lleva un **id sintético determinista** (`tipo:recursoId:sello`) que permite persistir reconocimientos aun cuando la alerta se recalcule.
- **Reglas activas:**
  - `orden_vencida` — órdenes `planificada|en_curso` con `fecha_programada < hoy` (severidad `critica` si hay más de 7 días o si la prioridad es `critica`, `warning` en otro caso).
  - `orden_proxima` — planificadas que vencen dentro de `config.proxima_dias` (severidad `info`).
  - `orden_prolongada` — `en_curso` con `fecha_inicio` anterior a `config.prolongada_dias` días (severidad `warning`).
  - `orden_critica_abierta` — prioridad `critica` todavía no cerrada (severidad `critica`).
  - `mantenimiento_largo` — transformadores `estado=mantenimiento` cuyo último `en_curso` supera `config.mantenimiento_dias` (severidad `critica` cuando duplica el umbral).
  - `sin_coordenadas` — activos sin lat/lng válido (bloquea vista de mapa).
  - `sin_fecha_instalacion` — activos sin fecha de instalación (impacta cálculo de MTBF).
- **Colecciones nuevas en Firestore:**
  - `alertas_config/global` — umbrales (`proxima_dias=15`, `prolongada_dias=30`, `mantenimiento_dias=14`) + `destinatario_email` + flag `notificaciones_enabled` (reservado para F12).
  - `alertas_reconocidas/{alertId}` — un doc por alerta reconocida (`{alertId, nota, uid, at}`).
  - Reglas Firestore: lectura pública, escritura admin (`allow write: if isAdmin()`), validación de `alertId` no vacío.
- Vista pública: `pages/alertas.html` + `alertas-public.js` — resumen con 5 tarjetas (críticas / atención / informativas / activas / reconocidas), filtros (severidad / tipo / texto / toggle reconocidas), tabla con severidad-pill, tipo-pill y enlaces al recurso (Inventario / Órdenes).
- Vista admin: `admin/alertas.html` + `admin-alertas.js` — mismo dashboard + **panel de configuración** (5 campos con guardar/restaurar) + botones **Reconocer** / **Desreconocer** por fila. Al reconocer solicita una nota opcional y guarda el UID del admin. Enlaces del recurso llevan a `inventario.html#edit:{id}` o `ordenes.html#edit:{id}`.
- `assets/css/alertas.css` — banner resumen, `sev-pill.{critica|warning|info}`, `alerta-tipo-pill`, filas `.alert-row.reconocida` con tachado, panel `.config-panel` con grid de inputs, botones `btn-ack` / `btn-unack` / `btn-goto`.
- Nav "Alertas" en home + 10 subpáginas (incluye `_firebase-test` y `mapa`) + 6 paneles admin.

#### ✅ Fase 12 — Gate dinámico + endurecimiento

- `assets/js/data/codigos-acceso.js` — data layer del gate dinámico. API: `validarCodigo` (público, con fallback al bootstrap estático), `listar`, `crear`, `actualizarMetadata`, `eliminar`, `hashCode` (SHA-256 hex via `crypto.subtle`), `generarCodigoAleatorio(len=12)`, `estadoCodigo`, `hashPreview`. Constante exportada `BOOTSTRAP_CODE = '97601992@'` como mecanismo de recuperación permanente.
- **Colección nueva** `gate_codes/{sha256(plaintext)}` con `label`, `notes`, `active`, `expires_at`, `created_at`, `created_by`. El plaintext **nunca** se persiste; el hash hex es el docId.
- **Reglas Firestore endurecidas:**
  - `get: if true` — cualquier cliente puede leer un doc si ya conoce el hash (i.e., conoce el código). Esto permite validar sin exponer los códigos.
  - `list: if isAdmin()` — impide enumeración anónima.
  - `create` valida que el docId tenga ≥ 32 chars, que `label` sea string y que `active` sea bool; `update` valida `active` cuando está presente.
- `assets/js/gate.js` reescrito como **módulo ESM**: computa SHA-256 con `crypto.subtle.digest`, hace `getDoc(gate_codes/{hash})`, verifica `active=true` y `expires_at` futuro. Si Firebase no está configurado o no hay match, acepta el bootstrap estático. Mensaje "⋯ Verificando…" mientras resuelve.
- Panel admin `/admin/codigos.html` + `admin-codigos.js` con tabla (etiqueta, estado-pill, fecha expiración, fecha creación, hash abreviado, acciones), filtros (estado activo/inactivo/vencido + búsqueda), modal **Nuevo** con botón **Generar** aleatorio (56 chars del alfabeto sin confundibles) y modal **Editar** metadata (label/notes/expires/active, no el plaintext). Tras crear, un modal **Revelar** muestra el plaintext una sola vez con botón **Copiar** (clipboard API).
- `assets/css/codigos.css` — `.cod-pill.{activo|inactivo|vencido}`, `.cod-hash`, `.codigo-row` para fila input+generar, `.revelar-code` (caja destacada con borde dashed y glow), `.btn-mini` y `.btn-mini.danger`.
- Nav "Códigos" en 7 paneles admin. Se activa la tarjeta F12 del panel principal (`admin/index.html`), se mueve F13 la tarjeta "Usuarios & Roles" y se actualiza el resumen "Fase 12 cerrada · 92 %".

#### ✅ Fase 13 — Pulido (SEO + accesibilidad)

- **SEO.**
  - `robots.txt` con `Allow: /`, `Allow: /index.html`, `Allow: /assets/` y `Disallow: /admin/`, `/home.html`, `/pages/` (zona interna/admin), más línea `Sitemap:` apuntando a `https://lordpowertransformersmj.github.io/sitemap.xml`.
  - `sitemap.xml` con una única URL (la landing pública); el resto del sitio queda detrás del gate y se marca `noindex` en sus páginas.
  - `index.html` con bloque completo de **Open Graph** (`og:type=website`, `og:site_name`, `og:locale=es_CO`, `og:url`, `og:title`, `og:description`, `og:image`) + **Twitter Card** (`summary`) + `<link rel="canonical">` + `<meta name="theme-color" content="#040c14">` + `<meta name="color-scheme" content="dark">` + `<meta name="robots" content="index, follow">`.
  - **JSON-LD Organization schema** embebido al final de `index.html` con `name`, `url`, `logo`, `areaServed` (Bolívar, Córdoba, Sucre, Cesar, Magdalena como `AdministrativeArea`) y `knowsAbout` (ISO 50001, IEEE C57.12, IEC 60076, RETIE, NTC-IEC 60364, CIGRE WG A2, Transformadores de potencia, Análisis RAM).
  - `home.html` con `theme-color`, `color-scheme=dark`, `canonical` y `preconnect` a `fonts.gstatic.com` (sigue en `noindex` por ser zona interna).
- **Accesibilidad (WCAG AA).**
  - `.skip-link` ("Saltar al contenido principal") en `index.html` + `home.html`, posicionada fuera de pantalla y visible al recibir foco. Apunta al landmark `<main id="main">` (se promueve el `<div class="wrapper">` del landing a `<main>` con el mismo ID).
  - Reglas globales en `assets/css/base.css`:
    - `@media (prefers-reduced-motion: reduce)` desactiva `scroll-behavior: smooth` y acorta animaciones/transiciones a `.01ms`.
    - `:focus-visible` con `outline` azul + `outline-offset` para todos los elementos; `button|a|input|select|textarea:focus-visible` refuerzan con `box-shadow` de 2 px en el color de acento.
    - Clase utilitaria `.sr-only` (contenido solo para lectores de pantalla).
  - `aria-hidden="true"` en los elementos decorativos (`.deco-line`, `.pulse`) del landing.
  - Se promueve el `<div class="topbar">` del landing a `<header class="topbar">` (el `role=banner` implícito ahora viene del elemento nativo, sin redundancia).
- **Performance.**
  - `preconnect` a `fonts.gstatic.com` (además del ya existente a `fonts.googleapis.com`) para adelantar el handshake TLS del CDN de fuentes.
  - Se mantiene el uso de `display=swap` en la URL de Google Fonts (evita FOIT).
- Barra de progreso y `phases-row` actualizadas en `index.html` y `home.html`: `F13 Pulido` pasa de `planned → done`, `--fill-pct` y etiqueta suben de **92 % → 96 %**, leyenda "Fases 0–13 completadas de 14".

#### ✅ Fase 14 — Lanzamiento · Login-first + Roles

- **Nueva arquitectura "login-first".** `index.html` es ahora el portal
  de autenticación SaaS-style (formulario centrado email+password +
  recuperación de contraseña). Ninguna página del sitio es accesible
  sin sesión Firebase Auth válida.
- **Unificación admin ↔ público.** El antiguo `/admin/login.html` se
  eliminó; el mismo login entra tanto al home como al panel admin. El
  panel admin deja de ser un sitio aparte: es una sección integrada
  del home, con enlace "Admin" en la nav principal visible solo
  cuando `rol=admin`.
- **Sistema de roles.** Nueva colección `/usuarios/{uid}` con campos
  `{email, nombre, rol, activo, createdAt, createdBy}`. Roles:
  `admin` (control total + CRUD) y `tecnico` (lectura operativa).
- **Guard unificado.** `assets/js/auth/session-guard.js` reemplaza a
  los 4 guards previos (`gate.js`, `auth-guard.js`,
  `auth-guard-pages.js`, `admin/admin-guard.js`). Wrappers
  auto-ejecutables: `page-guard.js` (sesión) y `admin-guard.js`
  (sesión + rol admin). Oculta el `<body>` hasta resolver; expone
  `window.__sgmSession = {user, profile, role}` y dispara
  `sgm:session-ready`.
- **Data layer de usuarios.** `assets/js/data/usuarios.js` con
  `listar`, `obtener`, `crear`, `actualizar`, `eliminar`, `ROLES`,
  `labelRol`.
- **Panel de gestión de usuarios.** `/admin/usuarios.html` +
  `admin-usuarios.js` — tabla con filtros (rol / estado / texto),
  modal **Nuevo** (pide UID de Firebase Auth + email + nombre + rol +
  activo) y modal **Editar** (nombre + rol + activo). El correo es
  read-only en edición (es identidad en Auth). Bloquea al admin de
  auto-eliminarse y de quitarse el rol o desactivar su cuenta.
- **Reglas Firestore refactorizadas.** Lecturas por `isTeamMember()`,
  escrituras por `isAdmin()`. Ambas helpers admiten fallback al doc
  legacy `/admins/{uid}` para no bloquear al propietario durante la
  migración. Nueva sección `/usuarios/{uid}` con validación de enums
  server-side (`rol ∈ {admin, tecnico}`, `activo bool`). La colección
  `gate_codes` queda cerrada (`read, write: if false`).
- **Retiro del gate de F12.** Se eliminaron `assets/js/gate.js`,
  `assets/js/data/codigos-acceso.js`, `assets/js/admin/admin-codigos.js`,
  `assets/css/codigos.css` y `/admin/codigos.html`. Todas las nav
  admin sustituyen el enlace "Códigos" por "Usuarios".
- **Retiro del guard estático.** Se eliminaron `assets/js/auth-guard.js`,
  `assets/js/auth-guard-pages.js`, `assets/js/admin/admin-guard.js`
  y `assets/js/admin/admin-config.js`. `admin-auth.js` queda como
  shim fino que reexporta `logoutAdmin` (wrapper de `session-guard`)
  y `onAdminAuthChange` (basado en evento `sgm:session-ready`) para
  no tocar los controladores admin-*.js.
- **Recuperación de contraseña.** El portal expone
  `sendPasswordResetEmail` de Firebase Auth; envía el enlace al
  correo indicado en el campo email.
- **Persistencia configurable.** Checkbox "Mantener sesión en este
  dispositivo" alterna entre `browserLocalPersistence` (permanente) y
  `browserSessionPersistence` (hasta cerrar el navegador).
- **Home actualizada.** Nav incluye `user-chip` (nombre + rol) y,
  para admins, enlace `Admin ▾`. Logout usa el helper unificado.
  Barra de progreso al 100 %, v1.0.0. Se mantiene `noindex` en la
  zona interna; el sitemap solo lista la landing de login.
- **Tag `v1.0.0`** al cierre de la fase.

#### ✅ Fase 15 — Realtime con `onSnapshot`

Primera evolución post-v1: la plataforma deja de recargar datos bajo
demanda y pasa a escuchar Firestore en vivo. Ahora cualquier cambio
que haga un administrador (alta/baja/edición de transformadores u
órdenes, reconocimiento de alertas, ajuste de umbrales) se propaga
instantáneamente a todas las pestañas abiertas del equipo, sin
botones de "Recargar".

- **Data layer.**
  - `assets/js/data/transformadores.js` → `suscribir(filtros, onData, onError)` con `onSnapshot`.
  - `assets/js/data/ordenes.js` → `suscribir(filtros, onData, onError)` con los mismos filtros que `listar`.
  - `assets/js/data/kpis.js` → nueva función pura `computeFromDatasets(trafos, ords)` extraída de `computeDashboard()` para permitir recomputar sin I/O.
  - `assets/js/data/alertas.js` → nueva función pura `computarFromDatasets(transformadores, ordenes, config, recs, hoy)` y `suscribirComputo(onData, onError)` que combina **4 suscripciones** (`transformadores`, `ordenes`, `alertas_config/global` y `alertas_reconocidas`) con **debounce de 250 ms** y retorna un único `unsubscribe()` que cancela todas.
- **Vistas migradas.**
  - `home.html` — las 4 tarjetas del parque (Transformadores / Órdenes activas / Disponibilidad / MTBF) se alimentan de dos `suscribir()` paralelos (transformadores + ordenes) y recomputan con `computeFromDatasets` con debounce 150 ms.
  - `assets/js/ordenes-public.js` — `cargar()` deja de hacer `await listar(...)`; ahora administra el ciclo de vida de `suscribir()`, con cancelación al cambiar filtros y en `beforeunload`.
  - `assets/js/admin/admin-ordenes.js` — misma migración; se eliminan los `await cargar()` tras crear/editar/eliminar porque la suscripción refresca sola.
  - `assets/js/alertas-public.js` — usa `suscribirComputo`.
  - `assets/js/admin/admin-alertas.js` — usa `suscribirComputo`; reconocer/desreconocer y guardar configuración ya no recargan manualmente (el motor recalcula cuando llega el snapshot de `alertas_reconocidas` o `alertas_config/global`).
- **Cuota Firestore.** Se reemplazan ráfagas de `getDocs()` por conexiones `onSnapshot` persistentes. Cada página interna mantiene abiertas 1–4 suscripciones según el módulo; dentro del plan Spark (50 k lecturas/día) el cliente solo consume delta-reads cuando un documento cambia.
- **Backwards-compat.** `listar()` y `computarAlertas()` siguen existiendo para flujos CSV / exports que no requieren realtime.

#### ✅ Fase 16 — Refactor del modelo de datos v2 (MO.00418 Ed. 02)

Primera microfase de la **evolución v2.0** derivada del prompt maestro
v2.2 + documento interno **MO.00418.DE-GAC-AX.01 Ed. 02** (CARIBEMAR
DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM). El shape plano de v1
(introducido en F6 como "17 campos aplanados") se reemplaza por un
documento estructurado en secciones que acomoda la metodología
oficial de Salud de Activos. **Esta F16 sustituye el F16 anterior
("Vercel deploy + serverless skeleton")**, que pasa a ser parte de
F32 cuando se aborde en v2.

- **Dominio puro (`assets/js/domain/`).** Tres módulos sin dependencia
  de Firebase (importables desde Node para tests):
  - `schema.js` — fuente canónica de enumeraciones: `TIPOS_ACTIVO`
    (POTENCIA/TPT/RESPALDO), `ZONAS` (BOLIVAR/ORIENTE/OCCIDENTE),
    `GRUPOS` (G1/G2/G3), `DEPARTAMENTOS` mapeados a su zona,
    `ESTADOS_SERVICIO` ampliado con `fallado`, `ESTADOS_ESPECIALES`
    (§A9.3: `monitoreo_intensivo_c2h2`, `propuesta_fur_pendiente`,
    `operacion_temporal_controlada`, `pendiente_reemplazo`,
    `reemplazado`, `fin_vida_util_papel`), `CONDICIONES` con nombres
    oficiales §A9.7 (Muy Bueno/Bueno/Medio/Pobre/Muy Pobre, sin
    "regular" ni "malo"), `BUCKETS_HI` con bordes [1.5, 2.5, 3.5,
    4.5], `NIVELES_CRITICIDAD` (Mínima…Máxima), `UBICACIONES_FUGA`
    (por ubicación dominante, §A3.6), `ROLES` F28 (admin,
    director_proyectos, analista_tx, gestor_contractual,
    brigadista, auditor_campo), `NORMATIVAS` (30 referencias A8),
    `PESOS_HI` **Tabla 10 del MO.00418 §A9.8 como fuente canónica**
    (DGA 0.35 · EDAD 0.30 · ADFQ 0.15 · FUR 0.05 · CRG 0.05 ·
    PYT 0.05 · HER 0.05) con verificación de suma=1.0 en tiempo de
    carga que lanza si alguien altera los pesos. Catálogo UUCC
    CREG 085/2018: `esUUCCValida` acepta N3T1–N3T25 + N4T1–N4T19 +
    N5T1–N5T25; `esUUCCRegulada` restringe a N4T1–N4T19 y N5T1–N5T25
    (las únicas que gozan de vida útil reconocida de 30 años).
    Helper `bucketDesdeHI(hi)` clampea a [1, 5] y devuelve la key.
  - `transformador_schema.js` — sanitizador por secciones
    (`identificacion`, `placa`, `ubicacion`, `electrico`, `mecanico`,
    `refrigeracion`, `protecciones`, `fabricacion`, `servicio`) +
    sub-objetos derivados (`salud_actual` con las 12 calificaciones
    parciales + HI bruto/final + bucket + overrides_aplicados[] +
    bandera `fin_vida_util_papel`; `criticidad` con usuarios aguas
    abajo y nivel; `restricciones_operativas` reservado para OTC
    §A9.3). Acepta input plano (v1) o estructurado (v2) y mapea a
    shape canónico. `validarTransformador` devuelve array de
    errores (latitud/longitud en rango, enums, campos obligatorios).
    `proyeccionV1(docV2)` aplana a los 17 campos v1 de nivel raíz
    para retrocompat con vistas legacy.
  - `subestacion_schema.js` — nueva entidad FK con sanitizador y
    validador (codigo único, depto catalogado, zona opcional,
    coordenadas en rango).

- **Data layer (`assets/js/data/`).**
  - `transformadores.js` — API v2 manteniendo las firmas v1 (`listar`,
    `suscribir`, `obtener`, `crear`, `actualizar`, `eliminar`,
    `contarPorEstado`) para que Inventario UI, KPIs, Mapa y Alertas
    sigan funcionando sin tocarse. Cada write normaliza con el
    sanitizador v2 y escribe AMBOS niveles (secciones + proyección
    v1 aplanada al raíz) para convivencia v1/v2. Nuevos: `listarV2`
    con filtros por sección (`zona`, `tipo_activo`, `grupo`,
    `bucket`, `subestacionId`), `actualizarParcial(id, parches)` y
    re-exports del dominio (`sanitizarTransformador`,
    `validarTransformador`, `proyeccionV1`).
  - `subestaciones.js` — CRUD Firebase con `listar`, `suscribir`,
    `obtener`, `crear`, `actualizar`, `eliminar`.
  - `transformadores_subcolecciones.js` — dos subcolecciones
    append-only: `placas_historicas` (retrofits de potencia /
    tensión / refrigeración / tap / otro con `tipo_cambio`, `campo`,
    `valor_anterior`, `valor_nuevo`, `razon`, `orden_ref`,
    `autorizado_por`) e `historial_hi` (snapshots del motor con
    `trigger` ∈ {`muestra_nueva`, `parametros_actualizados`,
    `migracion_v2`, `manual`, `override_experto`, `recalculo_masivo`},
    calificaciones por variable, `hi_bruto`/`hi_final`, `bucket`,
    `overrides_aplicados[]`, `muestra_origen_ref`).

- **Migración (`scripts/migrate/v1-to-v2-transformadores.js`).**
  Función pura `migrarDocV1aV2(docV1)` idempotente (si el input ya
  es v2 sólo lo re-sanitiza). Infiere `ubicacion.zona` desde
  `departamento`, extrae `fabricacion.ano_fabricacion` desde ISO, y
  marca `salud_actual.overrides_aplicados = ['_migracion_v2']`
  para trazabilidad (el motor F18 retira la marca al primer
  recálculo real). Runner defensivo `ejecutarMigracion({list,
  write, log, dryRun, limite})` acepta adaptadores de I/O
  arbitrarios (web SDK, admin SDK, mock de tests), retorna reporte
  `{escaneados, migrados, yaV2, errores, lista}`, respeta `limite`
  para corrida parcial. Reutilizable como sub-rutina por F17
  (importador Excel).

- **Firestore rules v2 (`firestore.rules`).** Helpers
  `isTipoActivoValido`, `isEstadoServicioValido`, `isZonaValida`,
  `isDeptoValido`, `isGrupoValido`. Match `/transformadores/{id}`
  valida `schema_version==2`, las claves de `identificacion`, enum
  de `tipo_activo`, enum de `grupo`, enum de `departamento` en
  `ubicacion`, enum de `zona` si está presente, y coherencia entre
  nivel raíz v1 y secciones v2 (`root.codigo ==
  identificacion.codigo`, `root.estado == estado_servicio` con la
  excepción `fallado → retirado` para proyección v1). Subcolecciones
  `placas_historicas` e `historial_hi` append-only (update/delete
  bloqueados) con validación de enum `tipo_cambio` / `trigger`.
  Nueva sección `/subestaciones/{id}` con lectura team, escritura
  admin, validación de depto/zona. `/usuarios/{uid}` acepta roles
  F28 (`admin`, `tecnico`, `director_proyectos`, `analista_tx`,
  `gestor_contractual`, `brigadista`, `auditor_campo`) en create y
  update.

- **Índices (`firestore.indexes.json`).** +8 compuestos nuevos:
  - `transformadores`: `ubicacion.zona+codigo`,
    `identificacion.grupo+codigo`,
    `identificacion.tipo_activo+salud_actual.hi_final DESC`,
    `ubicacion.subestacionId+codigo`,
    `salud_actual.bucket+ubicacion.zona`,
    `estado_servicio+codigo`.
  - `subestaciones`: `zona+codigo`, `departamento+codigo`.
  - Collection group `historial_hi`: `trigger+ts_calculo DESC`.
  Los índices v1 (`departamento+codigo`, `estado+codigo`, etc.) se
  conservan para las vistas legacy mientras dure la convivencia.

- **Suite de tests.** `package.json` declara `"type": "module"`,
  `engines.node >= 20`, scripts `test:unit` (`node --test
  tests/*.test.js`) y `test` (lint + tests). 4 archivos, 63 tests:
  - `tests/schema.test.js` — pesos HI suman 1.0 y son inmutables,
    nombres oficiales §A9.7, 5 departamentos con zona correcta,
    patrón UUCC, catálogo regulado vs general, bordes de
    `bucketDesdeHI` (§4.2), roles F28 + compat legacy, identidad
    institucional.
  - `tests/transformador_schema.test.js` — sanitizador mapea plano
    v1 a secciones v2 y vice-versa, rechaza UUCC inválida, cae a
    defaults ante enums desconocidos, filtra `estados_especiales`
    fuera de catálogo, clampea `calif_*` a [1,5], valida lat/lng,
    `proyeccionV1` mapea `fallado → retirado` para vistas v1.
  - `tests/subestacion_schema.test.js` — normalización de codigo,
    zona inválida descartada, validador flagea depto fuera de
    catálogo y coords fuera de rango.
  - `tests/migracion_v1_v2.test.js` — detectores `esV1`/`esV2`
    (cuidado con `&&` que en JS devuelve el último operando no
    falsy), 5 deptos mapean a su zona correcta, idempotencia v2,
    runner: colección vacía no-op, `dryRun=false` salta `esV2`,
    respeta `limite`, un error no aborta los demás, exige adaptador
    `write` cuando `dryRun=false`.

- **Documentación.** `docs/MODELO-DATOS-v2.md` con diagrama ER,
  diccionario completo por sección con referencia a MO.00418 por
  campo, catálogo de rules/índices, política de migración y plan
  de convivencia v1↔v2. `README.md` actualizado con estado v2.0 y
  sección "Modelo de datos v2". `CLAUDE.md` reemplaza la tabla
  post-v1 (F16–F24 Vercel+Email+PDF…) por la tabla de 22 microfases
  v2.0 (F16–F37) derivadas del prompt maestro v2.2.

- **Tag:** `v2.0.0-f16`. **Próxima movida:** F17 (importador Excel).

### 5.2 Plan post-v1.0 (F16–F24) · SUPERSEDED por v2.2

> ⚠️ **NOTA (abril 2026).** La tabla y detalles de F16–F24 que siguen
> a continuación describen el plan post-v1.0 ORIGINAL (Vercel,
> notificaciones email, exports XLSX/PDF, adjuntos, auditoría,
> calendario, PWA, analítica predictiva). Ese plan fue
> **reemplazado** por el plan v2.0 derivado del documento interno
> **MO.00418.DE-GAC-AX.01 Ed. 02** (prompt maestro v2.2). La
> correspondencia es:
>
> - F16 (original: Vercel deploy) → rescatado en F32 v2 (Cloud
>   Functions + notificaciones email).
> - F17 (original: notificaciones email) → también absorbido en
>   F32 v2 + F17 v2 (importador Excel).
> - F18 (original: export Excel) → F31 v2 (reportes).
> - F19 (original: export PDF) → F31 v2.
> - F20 (original: adjuntos por orden) → parte del refactor de
>   órdenes en F23 v2 y documental F9 (ya cerrada).
> - F21 (original: auditoría) → F35 v2 (audit log global).
> - F22 (original: calendario mantenimientos) → mantenido como
>   feature opcional post-v2.
> - F23 (original: PWA offline) → F34 v2 (PWA brigadistas).
> - F24 (original: analítica predictiva) → feature opcional
>   post-v2; el Plan de Inversión F30 v2 cubre el caso de uso
>   principal.
>
> La tabla canónica ahora es la **sección 5.1 Evolución v2.0**
> (F16–F37). La tabla y detalles abajo quedan por referencia
> histórica.

Cada fase post-v1.0 era **independiente** y debía cerrar con su propio
commit aislado. Ninguna dependía rígidamente de la anterior salvo las
que tocaban el backend (F17 dependía de F16). Si el dueño hubiese
querido reordenar o saltarse una, no se rompía nada — el plan era una
sugerencia priorizada, no una secuencia obligatoria. Pre-requisito
común: `assets/js/firebase-config.js` ya conectado al proyecto real.

#### 🔜 Fase 16 — Vercel deploy + serverless skeleton

**Objetivo.** Habilitar el backend en Vercel sin abandonar GitHub Pages
para el frontend. Necesario para todas las fases que requieran código
server-side (F17, eventualmente F24).

- Crear proyecto en Vercel apuntando a este repo, branch `main`. Build
  command vacío (sitio estático ya servido por GitHub Pages); el deploy
  de Vercel queda **solo para `/api/*`**.
- `vercel.json` ya existe (F3) con headers de seguridad — extenderlo
  con `functions` config si hace falta runtime Node 20.
- Primera function `/api/health.js` que devuelve `{ok:true, ts:...}`
  para validar que el deploy pipeline funciona.
- Configurar las env vars en Vercel:
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
    (descargadas del Firebase Console → Project Settings → Service accounts).
  - Estas habilitan `firebase-admin` para operaciones server-side
    privilegiadas (notificaciones, agregaciones pesadas).
- Documentar en `README.md` el flujo de deploy (push a main → Vercel
  redeploya `/api/*`) y la separación frontend/backend.
- **Yo configuro Vercel siempre** (instrucción explícita del dueño).
  El dueño solo tiene que dar permiso una vez al GitHub App de Vercel
  para conectar el repo; el resto lo hago vía CLI o dashboard.

**Criterio de cierre.** `https://<proyecto>.vercel.app/api/health` responde
200 OK y se enlaza desde `_firebase-test.html` para verificación rápida.

#### 🔜 Fase 17 — Notificaciones por email

**Objetivo.** Aprovechar el flag `alertas_config.notificaciones_enabled`
+ `destinatario_email` que F11 dejó reservados. Resumen diario de alertas
críticas a un correo configurado por el admin.

- Endpoint cron `/api/cron/alertas-diarias.js` ejecutado por **Vercel Cron**
  una vez al día (config en `vercel.json`).
- Re-implementa el motor de `assets/js/data/alertas.js` en Node usando
  `firebase-admin` (lectura de `transformadores`, `ordenes`, `alertas_config`).
- Filtra solo severidad `critica` no reconocidas, agrupa por tipo, arma
  un email HTML con resumen + tabla.
- Envío vía **Resend** (free tier 3 000 emails/mes, 100/día) — alternativa
  Brevo (300/día). API key en env var `RESEND_API_KEY`.
- Si `notificaciones_enabled === false` o no hay `destinatario_email`,
  el cron termina sin enviar.
- Vista admin: pequeño panel "Última ejecución" en `admin/alertas.html`
  con timestamp del último envío (guardado en `alertas_config/global`).

**Criterio de cierre.** Cron corre todos los días, envío llega al inbox
del destinatario configurado, y `admin/alertas.html` muestra "Último envío:
hace N horas".

#### 🔜 Fase 18 — Exportación Excel (XLSX)

**Objetivo.** Dar a los usuarios un export profesional para reportes
ejecutivos y compartir con stakeholders no técnicos.

- Librería **SheetJS (`xlsx`)** vía CDN (sin npm: el sitio sigue siendo
  estático). Versión community/free.
- Botón **"Exportar XLSX"** en:
  - `pages/inventario.html` y `admin/inventario.html` (parque completo + filtros aplicados).
  - `pages/ordenes.html` y `admin/ordenes.html` (con filtros aplicados).
  - `pages/kpis.html` y `admin/kpis.html` (multi-hoja: KPIs / RAM / Top 10 / Por departamento).
  - `pages/alertas.html` (alertas activas con severidad y recurso).
- Hojas con cabeceras estilizadas (negrita + fondo gris claro), columnas
  auto-ancho, fechas formateadas como tipo `Date` real (no string).
- Helper compartido `assets/js/exports/xlsx.js` con `descargarHojas(nombre, hojas)`.
- El CSV actual de KPIs (F8) se conserva como opción secundaria.

**Criterio de cierre.** Cada vista lista exporta `.xlsx` que abre limpio
en Excel/LibreOffice/Google Sheets.

#### 🔜 Fase 19 — Exportación PDF

**Objetivo.** Documentos formales para cierre de orden, fichas técnicas
y reportes mensuales.

- Librerías **jsPDF + jspdf-autotable** vía CDN. Renderizado client-side.
- Plantillas:
  1. **Ficha técnica de transformador** — desde `admin/inventario.html` y
     `pages/inventario.html`, botón "PDF" por fila. Incluye: encabezado
     con logo SGM, datos generales, datos eléctricos, ubicación, mapa
     mini (captura del marker via Leaflet `getCanvas`), pie con
     normativas aplicables y QR del código.
  2. **Cierre de orden** — desde `admin/ordenes.html` cuando `estado==='cerrada'`.
     Incluye: encabezado con código + transformador, descripción,
     técnico responsable, duración real, observaciones, **historial completo**
     (la subcolección `historial`), espacio para firma del responsable.
  3. **Reporte mensual de KPIs** — desde `admin/kpis.html`. Resumen
     ejecutivo: parque, RAM, top transformadores, distribución por estado.
     Selector de mes. Pie con fecha de generación y normativas.
- Helper compartido `assets/js/exports/pdf.js` con plantilla base
  (encabezado/pie reutilizables).
- Logos en `/assets/img/` ya existen.

**Criterio de cierre.** Las 3 plantillas generan PDFs A4 vertical legibles,
con tablas paginadas correctamente.

#### 🔜 Fase 20 — Adjuntos por orden (evidencias fotográficas)

**Objetivo.** Cerrar el ciclo de trazabilidad: foto **antes** y **después**
del mantenimiento adjunta a la orden.

- Subcolección Firestore `ordenes/{id}/adjuntos` con metadatos:
  `{filename, mime, size, storagePath, downloadURL, etiqueta, uid, at}`.
- Storage bajo `ordenes/{ordenId}/adjuntos/{filename}`.
- Reglas: lectura por `isTeamMember()`, escritura por `isAdmin()` y por
  el técnico asignado a la orden (validar `request.auth.token.email ===
  resource.data.tecnico`). Tope **5 MB** por archivo (foto comprimida).
- Reutilizar la API de `documentos.js` (F9) — extraer un módulo común
  `assets/js/data/_storage-uploader.js`.
- Vista admin: pestaña **"Evidencias"** en el modal de edición de orden,
  con galería thumbnails (`<img>` + `loading="lazy"`), drop-zone y
  botón **"Marcar como ANTES / DESPUÉS"**.
- Vista pública: galería read-only en `pages/ordenes.html` al expandir
  la fila.
- Las fotos se incluyen en el PDF de cierre (F19) como anexo.

**Criterio de cierre.** Subir 2 fotos a una orden, verlas en admin y
público, y verlas embebidas en el PDF de cierre.

#### 🔜 Fase 21 — Auditoría / bitácora cross-collection

**Objetivo.** Trazabilidad regulatoria (ISO 50001 sección 9.1.4):
quién hizo qué cambio cuándo en qué documento.

- Colección `auditoria` con docs `{coleccion, docId, accion, uid,
  email, at, diff}` donde `diff` es un objeto `{campo: {antes, despues}}`.
- Acciones: `crear` / `actualizar` / `eliminar` / `reconocer_alerta`
  / `subir_documento` / `subir_evidencia` / `cambiar_rol`.
- Hook en cada función de escritura del data layer
  (`transformadores.js`, `ordenes.js`, `documentos.js`, `usuarios.js`,
  `alertas.js`) — un único helper `auditar(accion, coleccion, docId, diff)`.
- Vista admin `/admin/auditoria.html` — tabla con filtros (colección /
  acción / usuario / rango de fechas), búsqueda por docId, paginación.
- Reglas Firestore: lectura solo `isAdmin()`, escritura **solo por
  `firebase-admin`** (server-side desde funciones, o por reglas que
  validen `request.auth.uid` coincide con el `uid` registrado).

**Criterio de cierre.** Cada CRUD aparece como entrada de auditoría;
la vista admin permite reconstruir el estado histórico de cualquier
documento.

#### 🔜 Fase 22 — Calendario de mantenimientos

**Objetivo.** Vista mensual visual sobre `ordenes.fecha_programada`
para planificar carga de trabajo y detectar solapamientos.

- Implementación con **FullCalendar 6** (free, MIT) vía CDN, o
  construcción manual con grid CSS si se quiere evitar la dependencia
  (~60 KB).
- Vista pública `pages/calendario.html` y admin `admin/calendario.html`.
- Cada evento = una orden, color por prioridad (verde/amarillo/naranja/rojo).
- Click en evento → modal con detalle + enlace al admin de órdenes.
- Filtros por técnico y tipo.
- Realtime con `suscribir` de F15 (ya existe).
- **Export iCal (`.ics`)** del calendario filtrado para que técnicos
  importen en Google Calendar / Outlook / Apple Calendar.
- Helper `assets/js/exports/ical.js`.

**Criterio de cierre.** Vista mensual navegable, exportar `.ics` que
importa correctamente en al menos 2 calendarios externos.

#### 🔜 Fase 23 — PWA + offline básico

**Objetivo.** Que la plataforma funcione como app instalable en móvil
y que las consultas básicas (órdenes recientes, ficha de transformador)
sigan funcionando sin red.

- `manifest.json` con icons, name, theme_color (`#040c14`), display
  `standalone`, start_url `/index.html`.
- Service worker en `/sw.js`:
  - **Cache-first** para shell (HTML/CSS/JS/fuentes/icons).
  - **Stale-while-revalidate** para imágenes y assets de Storage.
  - **Network-first con fallback a cache** para datos de Firestore.
- Activar `enableIndexedDbPersistence(db)` en `firebase-init.js` para
  que Firestore mantenga su propia cache offline (sincroniza al volver).
- Cola de escrituras pendientes ya manejada por Firestore offline persistence
  — basta con activarla.
- Banner "Instalar app" en `home.html` cuando el evento `beforeinstallprompt`
  esté disponible.
- Auditoría Lighthouse: PWA score ≥ 90.

**Criterio de cierre.** Cortar red (DevTools offline), navegar entre
home / órdenes / inventario sigue funcionando con datos cacheados.
Volver a línea sincroniza cualquier cambio pendiente.

#### 🔜 Fase 24 — Analítica predictiva ligera

**Objetivo.** Cerrar el ciclo RAM con un componente predictivo simple
sobre el histórico de órdenes correctivas. Sin ML pesado: regresión
lineal y media móvil bastan para alimentar alertas tempranas.

- Por cada transformador con ≥ 3 fallos correctivos cerrados, calcular:
  - **Tasa de fallos** (fallos / día de servicio).
  - **Próximo fallo esperado** = última falla + (1 / tasa).
  - **Tendencia** (regresión lineal sobre intervalos entre fallas).
- Agregar regla `prediccion_falla` al motor de alertas (F11):
  - `info` si próximo fallo esperado en > 30 días.
  - `warning` si en (7, 30] días.
  - `critica` si en ≤ 7 días.
- Visualización en `pages/kpis.html`: tarjeta nueva "Próximas fallas
  proyectadas" con top 5 transformadores en riesgo.
- Línea de tendencia en la gráfica mensual existente (Chart.js soporta
  `type: 'line'` adicional).
- Sin librerías de ML — implementación manual (~50 líneas de JS) en
  `assets/js/data/predict.js` con tests unitarios cliente.
- Documentar el modelo en `README.md`: limitaciones (asume distribución
  uniforme; no detecta cambios de régimen) y advertir que es una guía,
  no un dictamen.

**Criterio de cierre.** Crear histórico ficticio en un transformador
de prueba, verificar que la predicción aparece como alerta y en el
panel de KPIs.

---

## 6. Convenciones de trabajo

- **Branch de desarrollo:** `claude/personal-website-transformers-CVWxV`.
- **Commits:** un commit por microfase, mensaje descriptivo en español iniciando con `feat|fix|docs|chore|refactor|style|ci`.
- **Idioma del sitio:** español (primario); inglés como fase futura.
- **Estilo de código:** HTML5 semántico, CSS con variables, JavaScript ES6+ modular.
- **No se sube código** con claves, tokens o `.env` a Git (se usarán secretos de GitHub / Vercel).

---

## 7. Progreso actual

| Métrica                    | Valor |
|----------------------------|-------|
| v1.0 (F0–F14)              | **100 %** ✅ |
| v1.0 + Realtime (F15)      | ✅ |
| Evolución v2.0 (F16–F37)    | **22/22 microfases ✅ cerradas** |
| Tags plan (F16 → F37)       | `v2.0.0-f16` · `v2.0.0-f17` · `v2.0.0-f18` · `v2.0.0-f19` · `v2.0.0-f22` · `v2.0.0-f23` · `v2.0.0-f26` · `v2.0.0-f30` · `v2.0.0-f37` · **`v2.0.0`** |
| Post-plan polish            | **9 ciclos cerrados**: `v2.0.1` · `v2.0.2` · `v2.0.3` · `v2.0.4` · `v2.0.5` · `v2.0.6` · `v2.0.7` · `v2.0.8` (+ refactor `6accdb6`) |
| Tests                       | **468 / 468 verdes** (135 suites, node --test) |
| Lint HTML                   | limpio |
| Último tag                  | (sin tag desde `v2.4.1` · trabajo visual continuo en `claude/set-background-image-nhgwM` · branch hotfix `claude/mira-feature-XqsGK` para v2.8.1) |
| Tag previo                  | `v2.4.1` (deploy contrato 4125000143) |
| Referencia normativa activa | MO.00418.DE-GAC-AX.01 Ed. 02 (14/10/2025) |
| Sistema de diseño activo    | **AQUA LIGHT** · `assets/css/aqua-tokens.css` (inks Steel Navy oscuros que leen como negro corporativo + glass blanco perla translúcido) + `aqua-components.css` (sidebar aqua glass, topbar light glass, drilldown contratos 4 niveles con números como botones toggle) + `assets/js/aqua-shell.js` (markActive con hash matching) · body class="aqua" en todas las páginas |
| Foto de fondo activa        | `assets/img/aqua/substation-photo.webp` **2880×1620 WebP q=95 method=6 · 1.07 MB** · convertida de `FONDO POWERTRANSFORMER.jpg` (3.4 MB) |
| Service Worker              | **kill-switch** (`sw.js` se auto-desregistra) · PWA offline-first temporalmente desactivada |
| Importador Suministros      | **Canal único Excel** (xlsm) · JSX retirado en v2.5.1 · `parsearArchivos({xlsmBuffer, XLSX})` |
| Información Contractual     | `pages/contrato-info.html?id=NNN` · nube documental con visor PDF embebido (iframe nativo) · 13 PDFs servidos desde `assets/docs/contratos/{cid}/` · admin upload + delete via Firebase Storage (v2.7.0) |
| Seguimiento Contractual     | Misma página `pages/contrato-info.html?id=NNN&tipo=X` parametrizada por `tipo` ∈ {`remisiones`, `reuniones-seguimiento`} · Storage `contratos/{cid}/{tipo}/` · Firestore `documentos_{tipo}[]` · admin upload/delete reutiliza el flujo de Información Contractual (v2.8.0 · 2026-05-01) · **fix v2.8.1**: el data layer ahora rellena `codigo`+`estado` por defecto en `setDoc(merge:true)` para que el upload no falle con `permission-denied` cuando `/contratos/{cid}` no existe en Firestore |
| Mantenimiento Brigada       | **Calculadora Selección ONAF** (v2.9.0 · 2026-05-02 · refactor mix multi-modelo en curso desde 2026-05-03) · `pages/mantenimiento-brigada.html` con `module-shell` + tab "Sistema de Refrigeración" → `pages/calculo-refrigeracion.html` · dominio puro `assets/js/domain/refrigeracion.js` con **mix multi-modelo de ventiladores** (`evaluarMixVentiladores` + `sugerirMejoras` + `calcularProteccionMix`, 62 tests) · 2 catálogos (206 transformadores AFINIA + 13 fichas ZIEHL-ABEGG/KRENZ) · Chart.js con cruceta roja + leyenda abajo · informe AFINIA imprimible Letter con paginación manual `.sheet` divs (regla §0.1.2.3) · 10 secciones + fórmulas aplicadas + diagrama SVG A/B/C/D + BOM. Doc: `docs/MANTENIMIENTO-BRIGADA.md` § 4.3. |
| **Estado al 2026-05-05 (sesión render visual + interactividad)** | Branch `claude/adjust-website-pages-8Ntwz` con commits adicionales esta sesión sobre el render integral del transformador (módulo Mantenimiento Brigada · Selección ONAF). Cadena de iteraciones: (a) `aaa2425` render integral cenital base con asignación por unidad → (b) `183f864` radiadores a ambos lados (lado A arriba, lado B abajo) + bujes AT/BT + conservador → (c) `1dc3528` 3D realista (bujes apilados con porcelana, gradientes, sombras, cabezales, aletas individuales) → (d) `110404e` interactividad click-en-cuerpo + conservador sobre banco lado A + regla permanente §0.1.2.10 → (e) `96ebb0b` conservador sobre tanque + render lateral redibujado tipo foto Lord Power/ABB → (f) **`75d1d13` (último)** conservador ENTRE lado A y lado B (apoyado sobre la tapa del tanque, en el área central) + render lateral usa la **foto real del repositorio TAL CUAL** vía `<image>` (no SVG redibujado). Imagen de referencia archivada en `assets/img/refs/lateral-transformador-ABB-ref.png` (Lord Power/ABB · vista lateral con conservador, radiador, ventilador frontal, bujes). **CLAUDE.md ampliado con regla permanente §0.1.2.10** (fidelidad + interactividad obligatorias cuando hay foto de referencia). **570 / 570 tests verdes + HTML lint OK** durante toda la sesión. Doc handoff: `docs/SESION-2026-05-05.md`. |
| **Estado al 2026-05-03 (cierre + deploy OK)** | Branch `claude/adjust-website-pages-8Ntwz` con **21 commits** desde último merge. Plan de 6 microfases CERRADO + 9 hotfixes/refinements + 1 commit docs. Último commit: `a35e97b` (handoff actualizado). Resumen: refactor mix multi-modelo (5) → CI lint scope (`f1a4403`) → fallback legacy protección (`a3bc06b`) → 6 microfases (tolerancia / estrategias VFD-aerodinámica / FLC+contactor AF+SCADA+coordinación / faltantes / JSON estructurado / validación gráfica) → deep-clean Firestore (`e0ccffb`) → UI reorder + gráfica DPR3 (`2662671`) → pre-chequeo permisos admin (`c85eb41`) → diagnóstico exhaustivo + regla §0.1.2.7 (`525fc3c`) → gráfica HD/4K canvas 2400×1400 (`08dcf03`) → docs handoff (`a35e97b`). **✅ Director confirmó deploy exitoso de `firebase deploy --only firestore:rules`** — rules en producción ahora incluyen match `/acciones_refrigeracion/{id}`, el bug del modal está resuelto. Versiones publicadas: **v2.5.0** → **v2.9.0**. CLAUDE.md ampliado con **7 reglas permanentes nuevas** §0.1.2.1 a §0.1.2.7. **570 / 570 tests verdes** + HTML lint OK durante toda la sesión. Documentación: `docs/MANTENIMIENTO-BRIGADA.md` § 4.3 a 4.7 + `docs/SESION-2026-05-03-CONTINUACION.md` (handoff exhaustivo de toda la sesión con 10 bloques + reglas permanentes + cómo continuar). |
| Próxima movida              | (1) Director hace hard-reload Cmd+Shift+R y valida (a) render integral del transformador con conservador entre lado A/B + click-en-cuerpo funciona, (b) render lateral por ventilador muestra la foto real del repo. (2) Mergear branch `claude/adjust-website-pages-8Ntwz` a `main` cuando apruebe. (3) Post-merge: revocar PATs históricos + cleanup 7 PDFs raíz del repo (commit `91f386c`). (4) Próxima sesión: extender módulo Mantenimiento Brigada con nuevas calculadoras (aceite, aterramiento, etc.) reutilizando el patrón establecido (dominio puro + tests + UI binding + persistencia + tab consolidado + informe imprimible). |
| Servicios dinámicos activos | Firebase (Auth + Firestore + Storage) · Cloud Functions deployable (F32 stubs + cron/Resend) |

### 7.1 Inventario del repo post-v2.0.8

| Área | Archivos clave |
|---|---|
| **Plan v2.0** | 22 microfases F16-F37 (prompt v2.2) |
| **Dominio puro** (`assets/js/domain/`) | `schema.js` · `transformador_schema.js` · `subestacion_schema.js` · `salud_activos.js` · `dga_diagnostico.js` · `sobrecarga_admisible.js` · `monitoreo_intensivo.js` · `juicio_experto_fur.js` · `umbrales_salud_baseline.js` · `muestra_schema.js` · `contrato_schema.js` · `catalogos_baseline.js` · `orden_schema.js` · `fallados_schema.js` · `tpt_respaldo.js` · `matriz_riesgo.js` · `estrategias.js` · `rbac.js` · `workflow.js` · `plan_inversion.js` · `desempeno_aliados.js` · `audit.js` · `importador.js` |
| **Data layer** (`assets/js/data/`) | `transformadores.js` · `subestaciones.js` · `transformadores_subcolecciones.js` · `ordenes.js` · `documentos.js` · `alertas.js` · `kpis.js` · `usuarios.js` · `umbrales_salud.js` · `muestras.js` · `contratos.js` · `catalogos.js` · `fallados.js` · `monitoreo_fur.js` · `parametros_criticidad.js` · `auditoria.js` · `importar.js` |
| **UIs admin** (15) | `index.html` · `inventario.html` · `ordenes.html` · `kpis.html` · `alertas.html` · `documentos.html` · `mapa.html` · `usuarios.html` · `muestras.html` · `subestaciones.html` · `contratos.html` · `catalogos.html` · `motor-salud.html` · `umbrales-salud.html` · `importar.html` · `propuestas-fur.html` · `plan-inversion.html` · `desempeno-aliados.html` · `fallados.html` · `contramuestras.html` · `auditoria.html` · `demo-seed.html` |
| **Páginas públicas** (v2) | `dashboard.html` · `matriz-riesgo.html` · `inventario.html` · `ordenes.html` · `kpis.html` · `alertas.html` · `muestras.html` · `documentos.html` · `mapa.html` · `about.html` · `cobertura.html` · `normativa.html` · `contacto.html` |
| **Cloud Functions** (`functions/`) | `index.js` · `package.json` · `README.md` (deployable con `firebase deploy`) |
| **Tests** (`tests/`) | 16 archivos · 282 tests (incluye 3 E2E + 7 audit helper + 11 importador + 95 motor) |
| **Scripts** | `scripts/migrate/v1-to-v2-transformadores.js` |
| **Rules / Índices** | `firestore.rules` v2 · `firestore.indexes.json` (20+ índices compuestos) · `storage.rules` |
| **Docs** | `CLAUDE.md` (master plan) · `README.md` · `CHANGELOG.md` · `docs/MODELO-DATOS-v2.md` · `docs/DEPLOY-FUNCTIONS.md` · `docs/ARQUITECTURA.md` · `docs/OPERACIONES.md` · `docs/PLAN-SERVICIOS-EXTERNOS.md` · `functions/README.md` |
| **PWA** | `manifest.json` · `sw.js` (cache version `sgm-v2-0-8`) |
| **CI/CD** | `.github/workflows/ci.yml` (lint) · `.github/workflows/pages.yml` (deploy main → GitHub Pages) · `vercel.json` |

> **Continuidad entre chats.** Si arrancas una sesión nueva: lee la
> sección **0** (permisos de push + token inline), luego §7.1
> (inventario del repo) y §7.2 abajo (cómo continuar). El plan v2.2
> cerró en `v2.0.0`; del `v2.0.1` al `v2.0.8` fueron ciclos de
> pulido que el prompt original no pedía pero sí aportan cierre
> operativo. El último commit fue `6accdb6` (refactor DRY de
> `persistirAuditoria`) sin tag.

### 7.2 Cómo continuar en una sesión nueva

Si el director pide un **feature específico** (ej. "quiero un widget X",
"implementa un cálculo Y"):
1. Revisa el módulo de dominio adecuado en `assets/js/domain/`.
2. Extiende con función pura + tests.
3. Si hay I/O: añade data layer en `assets/js/data/`.
4. Actualiza UI (admin y/o público) según corresponda.
5. Commit aislado + push inline con el token PAT.

Si el director pide un **bug fix**:
1. Reproduce con test primero (node --test).
2. Corrige y verifica 282/282 verdes.
3. Commit con mensaje descriptivo.

Si el director pide una **operación de despliegue**:
1. Seed catálogos → `admin/catalogos.html` → CARGAR BASELINE.
2. Importar Excel → `admin/importar.html` → SIMULAR primero.
3. Cloud Functions → seguir `docs/DEPLOY-FUNCTIONS.md`.
4. Merge a main → crear PR desde `claude/review-phase-16-plan-mhPgg`.

Si el director pide una **extensión mayor v3** (nuevos parámetros,
integración SCADA, etc.):
1. Pide el "brief técnico" similar al prompt v2.2.
2. Genera un plan en microfases en `CLAUDE.md` §8.
3. Cada microfase con commit aislado.

### 7.3 Mapas de documentación

- **Plan histórico** → `CLAUDE.md` §5 (fases F0–F37 con detalle).
- **Release notes** → `CHANGELOG.md`.
- **Modelo de datos** → `docs/MODELO-DATOS-v2.md`.
- **Arquitectura de código** → `docs/ARQUITECTURA.md`.
- **Runbook operativo** → `docs/OPERACIONES.md`.
- **Despliegue de Cloud Functions** → `docs/DEPLOY-FUNCTIONS.md`.
- **Servicios externos (legacy)** → `docs/PLAN-SERVICIOS-EXTERNOS.md`.
- **Mantenimiento Brigada · Selección ONAF** → `docs/MANTENIMIENTO-BRIGADA.md`
  (arquitectura · dominio puro · catálogos AFINIA + ZIEHL-ABEGG ·
   plantilla informe AFINIA · cómo extender).

---

## 8. Historial de cambios

- **Fase 0** — Creación de `CLAUDE.md`, gate estático con código `97601992@`, `home.html` stub protegido, `gate.js`, `auth-guard.js`, actualización del landing al 5 %.
- **Fase 1** — `assets/css/base.css` con variables, reset, bg, animaciones y utilidades compartidas. Refactor de `index.html` y `home.html` para usar variables CSS (`--font-*`). `assets/img/favicon.svg` con ícono del transformador. Meta tags OG/SEO en ambas páginas. Progreso actualizado al 10 %.
- **Fase 2** — `assets/css/app.css` con shell compartido (topbar, nav, page-container, stats/modules/norm/geo cards, forms, progress, highlight-box, responsive). Reescritura de `home.html` como dashboard operativo (KPIs placeholder, 6 módulos, barra de progreso 20 %, 15 status-badges de fases). Nuevas subpáginas estáticas: `pages/about.html` (perfil + descripción), `pages/cobertura.html` (5 departamentos + 11 municipios Magdalena + placeholder de mapa), `pages/normativa.html` (ISO 50001, IEEE C57.12, IEC 60076, NTC-IEC 60364, RETIE, CIGRE WG A2), `pages/contacto.html` (formulario visual + info de canales). `assets/js/auth-guard-pages.js` para proteger rutas en `/pages/`. Landing actualizado a 20 %.
- **Fase 3** — `package.json` (scripts `lint:html`, `serve`, `test`) + `html-validate` como dev dep. `.htmlvalidate.json` con reglas tolerantes para el shell estático. `vercel.json` con headers de seguridad (`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`), `cleanUrls` y `redirects`. `.nojekyll` y `.gitignore` (node_modules, .env, secretos). Workflows: `.github/workflows/ci.yml` (lint en push / PR) y `.github/workflows/pages.yml` (deploy automático a GitHub Pages desde `main`). `README.md` con estado, stack y comandos. Landing y home actualizados a 25 %.
- **Fase 4** — Integración base de Firebase (sin servicios activos todavía). `firebase.json` con hosting, rules y emuladores (auth 9099, firestore 8080, storage 9199, hosting 5000). `.firebaserc` (`default: sgm-transpower`). `firestore.rules` y `storage.rules` en modo **DENY-ALL**. `firestore.indexes.json` vacío. `assets/js/firebase-config.js` con config pública placeholder + flag `isFirebaseConfigured`. `assets/js/firebase-init.js` — SDK modular v10 por CDN con `getApp` / `getAuthSafe` / `getDbSafe` / `getStorageSafe` y sonda `window.__sgmFirebaseProbe()`. `pages/_firebase-test.html` (oculta) para verificar carga del SDK. Landing y home al 30 %.
- **Fase 5** — Autenticación admin real sobre Firebase Auth. `/admin/login.html` (Email/Password, `browserSessionPersistence`, aviso cuando faltan prerequisitos, errores humanizados). `/admin/index.html` — panel vacío con 8 módulos placeholder (F6–F12), banner con email del admin, botón logout. Módulo `assets/js/admin/` con: `admin-config.js` (allowlist `ADMIN_UIDS` + helper `isAdminUid`), `admin-auth.js` (`loginAdmin`, `logoutAdmin`, `onAdminAuthChange`, `humanizeAuthError`, `ensureReady`), `admin-guard.js` (gate estático + verificación de sesión + UID autorizado, body oculto hasta resolver, timeout 5 s → login). Link discreto a admin en el footer de `home.html`. Landing y home al 35 %.
- **Fase 6** — Módulo Inventario CRUD. Colección `transformadores` con 17 campos (incl. timestamps y `createdBy`). `firestore.rules` con validación de campos obligatorios, enum de `estado` y control de admins vía colección `/admins/{uid}`. Índices compuestos `departamento+codigo` y `estado+codigo`. `assets/js/data/transformadores.js` (API: `listar`, `obtener`, `crear`, `actualizar`, `eliminar`, `contarPorEstado` + enums + labels). `admin/inventario.html` + `admin-inventario.js` (tabla con filtros depto/estado, modal con 16 campos, alta/edición/baja con confirmación). `pages/inventario.html` + `inventario-public.js` (KPIs por estado, filtros depto/estado, búsqueda local por texto, solo lectura). `assets/css/inventario.css` (tabla, toolbar, estado-pills, modal). Nav actualizada con "Inventario" en home + 5 subpáginas + panel admin. Landing y home al 45 %.
- **Fase 7** — Módulo Órdenes de trabajo. Colección `ordenes` con 14 campos funcionales (codigo, titulo, descripcion, transformadorId, transformadorCodigo, tipo, prioridad, estado, tecnico, fechas programada/inicio/cierre, duracion_horas, observaciones) + timestamps y `createdBy`. Subcolección **`ordenes/{id}/historial`** append-only (append-only reforzado en reglas: update/delete bloqueados) con eventos `creacion` y `cambio_estado` registrados automáticamente por la API. `firestore.rules` extendidas con enums de `estado` (planificada/en_curso/cerrada/cancelada), `tipo` (preventivo/correctivo/predictivo/emergencia) y `prioridad` (baja/media/alta/critica). Índices compuestos `estado+codigo`, `tipo+codigo`, `prioridad+codigo`, `transformadorId+codigo`. `assets/js/data/ordenes.js` (API completa con `registrarEvento` y `listarHistorial`). `admin/ordenes.html` + `admin-ordenes.js` (tabla con 3 filtros, modal con 14 campos + select dinámico de transformadores + bloque de historial visible en edición). `pages/ordenes.html` + `ordenes-public.js` (KPIs por estado, 3 filtros, búsqueda local). `assets/css/ordenes.css` (pills de estado-orden / tipo / prioridad + bloque historial). Nav con "Órdenes" en home + 6 subpáginas + 2 paneles admin. Landing y home al 55 %.
- **Fase 8** — Módulo KPIs &amp; Analítica RAM. `assets/js/data/kpis.js` agrega en cliente sobre `transformadores` + `ordenes` y entrega un snapshot con totales, distribuciones (estado/tipo/prioridad/departamento), serie mensual de últimos 12 meses, top-10 transformadores y bloque RAM (MTBF en días, MTTR en horas, Disponibilidad = MTBF/(MTBF+MTTR)). Además `exportarOrdenesCSV()` genera CSV enriquecido. Chart.js 4.4.1 por CDN. `pages/kpis.html` + `kpis-public.js` = dashboard público con 4 KPIs + 3 tarjetas RAM + 5 gráficas (doughnut + 3 barras + línea) + tabla top-10. `admin/kpis.html` + `admin-kpis.js` = mismo dashboard con botón "Exportar CSV". Renderer compartido en `assets/js/kpis-render.js`. `assets/css/kpis.css` para grids RAM / charts / tabla top. `home.html` alimenta en tiempo real sus 4 tarjetas placeholder (Transformadores / Órdenes activas / Disponibilidad / MTBF). Nav "KPIs" en home + 7 subpáginas + 3 paneles admin. Landing y home al 65 %.
- **Fase 9** — Gestión Documental con Firebase Storage. Colección `documentos` con metadatos (codigo, titulo, descripcion, categoria, norma_aplicable, transformadorId/Codigo, autor, fecha_emision, filename, mime, size, storagePath, downloadURL, status) + timestamps y `createdBy`. Binarios en `documentos/{docId}/{filename}` con tope de **20 MB**. `firestore.rules` valida enums (6 categorías × 7 normas) y limita escritura a admins. `storage.rules` abre `documentos/**` con lectura pública y escritura admin vía `firestore.exists(/admins/{uid})`. Índices `categoria+codigo`, `norma_aplicable+codigo`, `transformadorId+codigo`. `assets/js/data/documentos.js` (API `listar`/`obtener`/`subir`/`actualizarMetadata`/`eliminar` + `uploadBytesResumable` con progreso + limpieza de Storage al borrar). `admin/documentos.html` + `admin-documentos.js` (tabla + modal con drop-zone + barra de progreso). `pages/documentos.html` + `documentos-public.js` (4 KPIs, filtros cat/norma, búsqueda local, enlaces de descarga). `assets/css/documentos.css` (pills por categoría y estado, drop-zone). Nav "Documentos" en home + 8 subpáginas + 4 paneles admin. Landing y home al 73 %.
- **Fase 10** — Georreferenciación con **Leaflet 1.9.4** + **Leaflet.markercluster 1.5.3** (CDN unpkg con SRI). Renderer compartido `assets/js/mapa-render.js` expone `initMap`, `loadMarkers`, `resetMap` y `legendHtml`. Tile layer OpenStreetMap, centro Caribe Colombiano `[9.4,-74.8]` zoom 7, `fitBounds` automático con padding al cargar. Paleta por estado (operativo/mantenimiento/fuera_servicio/retirado) aplicada a `divIcon` vía CSS var `--dot-color`. Filtro de coordenadas válidas (descarta `null`, `0,0` y valores fuera de rango). `pages/mapa.html` + `mapa-public.js` (filtros depto/estado, contador `X visible de Y`, status-bar, popups solo-lectura). `admin/mapa.html` + `admin-mapa.js` (mismos filtros + popup con enlace `inventario.html#edit:{id}` para corregir coordenadas). `assets/css/mapa.css` (contenedor `#sgmMap` 560px/460px, tema oscuro para controles Leaflet y popups, leyenda con dots coloreados). Nav "Mapa" en home + 9 subpáginas + 5 paneles admin. Landing y home al 80 %.
- **Fase 11** — Alertas &amp; Notificaciones. `assets/js/data/alertas.js` implementa un motor de reglas cliente-side sobre `transformadores` + `ordenes` con 7 reglas (`orden_vencida`, `orden_proxima`, `orden_prolongada`, `orden_critica_abierta`, `mantenimiento_largo`, `sin_coordenadas`, `sin_fecha_instalacion`) y tres severidades (crítica · atención · informativa). IDs sintéticos deterministas `tipo:recursoId:sello` permiten persistir reconocimientos en `alertas_reconocidas/{alertId}` (`{alertId, nota, uid, at}`). Configuración global en `alertas_config/global` con umbrales (`proxima_dias=15`, `prolongada_dias=30`, `mantenimiento_dias=14`) + placeholders de notificación por correo (`destinatario_email`, `notificaciones_enabled`, reservados para F12). `firestore.rules` extendidas: lectura pública + escritura admin en las dos colecciones. Vista pública `pages/alertas.html` + `alertas-public.js` (5 tarjetas resumen, 4 filtros, tabla con severidad-pill / tipo-pill / enlaces al recurso). Vista admin `admin/alertas.html` + `admin-alertas.js` (mismo dashboard + panel de configuración con 5 campos + botones reconocer/desreconocer por fila que solicitan nota y guardan UID). `assets/css/alertas.css` (banner resumen, pills de severidad, `.alert-row.reconocida`, `.config-panel`, `.btn-ack` / `.btn-unack`). Nav "Alertas" en home + 10 subpáginas + 6 paneles admin. Landing y home al 87 %.
- **Fase 12** — Gate dinámico + endurecimiento admin. `assets/js/data/codigos-acceso.js` implementa el nuevo gate sobre la colección `gate_codes/{sha256(hex)}` donde el docId es el hash SHA-256 del código en texto plano (calculado con `crypto.subtle.digest`). El plaintext nunca se persiste. Reglas Firestore endurecidas: `get: if true` (conocer el hash equivale a conocer el código), `list: if isAdmin()` (no hay enumeración), `create`/`update`/`delete` restringidos a admins con validación de longitud de hash y tipo de `label`/`active`. `assets/js/gate.js` reescrito como módulo ESM que consulta Firestore, respeta `active` + `expires_at` y cae al bootstrap estático (`97601992@`) para recuperación permanente. Panel admin `/admin/codigos.html` + `admin-codigos.js` con tabla, filtros (estado/texto), modal **Nuevo** con botón **Generar** aleatorio (alfabeto sin caracteres confundibles), modal **Editar** metadata (no el plaintext) y modal **Revelar** que muestra el código plano una sola vez con botón **Copiar** (clipboard API). `assets/css/codigos.css` con `.cod-pill.{activo|inactivo|vencido}`, `.cod-hash`, `.revelar-code`, `.btn-mini` y `.btn-mini.danger`. Nav "Códigos" en 7 paneles admin. Módulo F12 activado en el panel principal; la tarjeta "Usuarios &amp; Roles" se mueve a F13. Landing y home al 92 %.
- **Fase 13** — Pulido SEO + accesibilidad. Nuevos `robots.txt` (permite landing + `/assets/`, bloquea `/admin/`, `/home.html`, `/pages/`) y `sitemap.xml` (solo landing, resto bajo gate). `index.html` amplía el `<head>` con Open Graph completo (incluye `og:locale=es_CO`, `og:image`), Twitter Card, `<link rel="canonical">`, `theme-color #040c14`, `color-scheme dark`, `preconnect` a `fonts.gstatic.com` y bloque **JSON-LD Organization** al final del `<body>` con `areaServed` (5 departamentos como `AdministrativeArea`) y `knowsAbout` (ISO 50001, IEEE C57.12, IEC 60076, RETIE, NTC-IEC 60364, CIGRE WG A2, Transformadores, RAM). `home.html` recibe `theme-color`, `color-scheme`, `canonical` y `preconnect`. Accesibilidad: `.skip-link` en landing y home apuntando a `<main id="main">` (el `<div class="wrapper">` del landing se promueve a `<main>`); `:focus-visible` con `outline` + `box-shadow` para botones/inputs/links en `base.css`; `@media (prefers-reduced-motion: reduce)` desactiva `scroll-behavior: smooth` y colapsa animaciones a `.01ms`; clase utilitaria `.sr-only`; `aria-hidden="true"` en decorativos (`.deco-line`, `.pulse`); el `.topbar` del landing pasa de `<div>` a `<header>` (elemento nativo con rol `banner` implícito). Barra de progreso y `phases-row` actualizadas: `F13 Pulido` `planned → done`, `--fill-pct 92% → 96%`, leyenda "Fases 0–13 completadas de 14". Landing y home al 96 %.
- **Fase 14** — Lanzamiento + refactor de acceso "login-first". `index.html` se reescribe por completo como portal de autenticación SaaS-style (form email+password centrado, recuperación de contraseña vía `sendPasswordResetEmail`, persistencia configurable). Nueva colección `/usuarios/{uid}` con campos `{email, nombre, rol, activo, createdAt, createdBy}` y enums `rol ∈ {admin, tecnico}`. Nuevo guard unificado `assets/js/auth/session-guard.js` + wrappers `page-guard.js` / `admin-guard.js` que reemplazan a `gate.js`, `auth-guard.js`, `auth-guard-pages.js` y `admin/admin-guard.js`. Firestore rules refactorizadas: lecturas por `isTeamMember()` (perfil activo o fallback a `/admins/{uid}`), escrituras por `isAdmin()` (rol admin o fallback legacy). Panel `/admin/usuarios.html` + `admin-usuarios.js` + `assets/css/usuarios.css` con CRUD de perfiles, filtros por rol/estado/texto y protecciones de auto-baja. Panel admin ahora integrado a la plataforma: enlace "Admin ▾" en nav del home visible solo con `rol=admin`, y `user-chip` (nombre + rol) en la topbar. `admin-auth.js` reducido a shim que mantiene la superficie `logoutAdmin` / `onAdminAuthChange` / `ADMIN_ROUTES` sobre el nuevo `session-guard`. Eliminados `admin/login.html`, `admin/codigos.html`, `assets/js/gate.js`, `assets/js/auth-guard.js`, `assets/js/auth-guard-pages.js`, `assets/js/admin/admin-guard.js`, `assets/js/admin/admin-config.js`, `assets/js/admin/admin-codigos.js`, `assets/js/data/codigos-acceso.js` y `assets/css/codigos.css`. `robots.txt` actualizado a "plataforma privada". Barra de progreso al 100 %. Tag **v1.0.0**.
- **Fase 15** — Realtime con `onSnapshot`. Data layer: `transformadores.js` y `ordenes.js` exponen ahora `suscribir(filtros, onData, onError)` además de `listar`; `kpis.js` factoriza `computeFromDatasets(trafos, ords)` como función pura; `alertas.js` factoriza `computarFromDatasets(...)` y añade `suscribirComputo(onData, onError)` que combina **4 suscripciones** (`transformadores`, `ordenes`, `alertas_config/global`, `alertas_reconocidas`) con debounce de 250 ms y devuelve un único `unsubscribe()`. Vistas migradas: `home.html` alimenta sus 4 KPIs vía dos `suscribir()` paralelos + recompute debounced; `ordenes-public.js` y `admin-ordenes.js` reemplazan `await listar(...)` por `suscribir(...)` con gestión de ciclo de vida (cancelación al cambiar filtros y en `beforeunload`); `alertas-public.js` y `admin-alertas.js` usan `suscribirComputo`. Los `await cargar()` tras crear/editar/eliminar/reconocer desaparecen: el snapshot refresca la UI solo. `listar()` y `computarAlertas()` se mantienen para flujos CSV / exports. Primera evolución post-v1; no mueve el 100 % del plan original, añade una capa realtime encima.
- **Fase 17** — Importador Excel → Firestore con recálculo HI. Parser puro `domain/importador.js` que lee filas de "Salud de Activos 2026.xlsx" (hojas `TX_Potencia` → POTENCIA, `TPT_Servicio` → TPT, `TX_Respaldo` → RESPALDO), normaliza (trim, comas→puntos decimales, fechas dd/mm/yyyy → ISO, enums, departamentos con tildes) y **recalcula el HI con el motor F18** descartando la columna CONDICION del Excel (según §D1–D17 del prompt). Cada fila produce `{docV2, diagnostico}` donde el diagnóstico compara `hi_recalculado` vs `condicion_excel` y emite flag si la diferencia > 0.5. `procesarLibro(hojas)` agrega el reporte con conteo por hoja, exitosos/errores y las discrepancias. Data layer `data/importar.js` con `persistirImportacion` idempotente por `codigo` (busca existente, hace update; si no, crea) usando batches de 450 writes, registra el job en `/importaciones/{jobId}` con los primeros 30 discrepancias como entregable auditable. UI `admin/importar.html` con drop-zone, carga SheetJS 0.18.5 vía CDN, muestra resumen + tabla de discrepancias con bucket-pills, botón SIMULAR (dryRun) y botón IMPORTAR. Rules F17 añaden `/importaciones` append-only (lectura team, create admin, update/delete false). 11 tests nuevos cubren parseo de fila, mapeo de hoja→tipo_activo, recálculo HI con override CRG=5, normalización de departamentos con tildes, fechas dd/mm/yyyy, comas decimales y reporte agregado. Total 169/169 tests. Tag `v2.0.0-f17`.

- **Fase 18** — Motor de Salud de Activos conforme MO.00418 Ed. 02. Implementa los calificadores oficiales de las 7 variables con tests de conformidad numérica: DGA (TDGC de 4 gases + CO + CO₂ + C₂H₂ — corrigiendo los errores §D1/§D2 del Excel), ADFQ (RD NTC 3284/ASTM D1816 + IC = TI/NN, corrigiendo §D3/§D4), FUR con curva de Chedong (DP + %vida_utilizada + %vida_remanente, CIGRÉ 445), CRG = MAX(CP/AP, CS/AS, CT/AT) con override automático a HI ≥ 4 cuando CRG=5 (§A5), EDAD anclada a CREG 085/2018 (corrigiendo §D6), HER por **ubicación dominante** de fuga (no por componente como el Excel §D7), PYT escala 1–5 (antes solo 1/5). `calcularHIBruto` aplica la Tabla 10 canónica (35/30/15/5/5/5/5) con redistribución proporcional cuando falta una variable. `aplicarOverrides` implementa §A5 (FUR≥4 solo si aprobado por experto, CRG=5 automático) y §A9.1 (C₂H₂=5 con aceleración ≥ umbral → HI ≥ 4; sin aceleración queda como marker informativo). `snapshotSaludCompleto` produce el sub-objeto `salud_actual` listo para persistir. Módulos nuevos `dga_diagnostico.js` (Duval Triangle 1 IEC 60599 + Rogers + Doernenburg + alerta arco D2 cuando C₂H₂/C₂H₄ ≥ 3), `sobrecarga_admisible.js` (tablas IEEE C57.91 §7 + FAA Arrhenius + `proponerPlanMitigacionSobrecarga` para F24/F30), `monitoreo_intensivo.js` (A9.1: `calcularVelocidadC2H2`, `evaluarOverrideC2H2` R1/R2/R3, batería ETU de 5 pruebas, `crearEstadoMonitoreoIntensivo`), `juicio_experto_fur.js` (A9.2: `crearPropuestaReclasificacionFUR` solo si FUR≥4, workflow de 3 decisiones expertas con audit trail, `puedeAbrirOrden` que bloquea órdenes distintas a reemplazo/retiro/OTC tras aprobación). Baselines oficiales en `umbrales_salud_baseline.js` con verificación estructural + `mergeConBaseline(custom)` para respetar overrides de la colección `/umbrales_salud/global`. Data layer `data/umbrales_salud.js` con CRUD + suscripción realtime + subcolección `historial` append-only. Rules v2.1 (`/umbrales_salud`, `/monitoreo_intensivo`, `/propuestas_reclasificacion_fur`). UI admin: `motor-salud.html` (sandbox que recibe entrada manual para los 7 factores y muestra HI + bucket + overrides aplicados + diagnóstico DGA + alerta D2) y `umbrales-salud.html` (formulario con baseline-chip al lado de cada input + botón "restaurar baseline oficial"). 95 tests nuevos (total 158/158). Tag `v2.0.0-f18`.

- **Fase 16** — Refactor del modelo de datos v2 · MO.00418.DE-GAC-AX.01 Ed. 02. Primera microfase de la evolución v2.0 (CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM). Nuevo paquete de dominio puro `assets/js/domain/` con `schema.js` (enums canónicos: `TIPOS_ACTIVO`, `ZONAS`, `GRUPOS`, `DEPARTAMENTOS`+zona, `ESTADOS_SERVICIO` ampliado con `fallado`, `ESTADOS_ESPECIALES` §A9.3, `CONDICIONES` 1–5 con nombres oficiales §A9.7, `BUCKETS_HI`, `NIVELES_CRITICIDAD`, `UBICACIONES_FUGA`, `ROLES` F28, `NORMATIVAS`, `PESOS_HI` con verificación de suma=1.0 en tiempo de carga conforme Tabla 10 §A9.8), `transformador_schema.js` (sanitizador por secciones `identificacion`/`placa`/`ubicacion`/`electrico`/`mecanico`/`refrigeracion`/`protecciones`/`fabricacion`/`servicio` + sub-objetos derivados `salud_actual`/`criticidad`/`restricciones_operativas` reservados para F18/F29/F36 + `validarTransformador` + `proyeccionV1` para retrocompat con vistas legacy), `subestacion_schema.js` (entidad FK nueva). Data layer `assets/js/data/` reescrito: `transformadores.js` acepta shape v1 (plano) o shape v2 (secciones) y escribe AMBOS para que las vistas sin migrar sigan leyendo del nivel raíz; `subestaciones.js` nueva; `transformadores_subcolecciones.js` con `placas_historicas` e `historial_hi` append-only. `scripts/migrate/v1-to-v2-transformadores.js` con función pura `migrarDocV1aV2` + runner defensivo `ejecutarMigracion({list, write, dryRun, limite})` reutilizable por F17. `firestore.rules` v2: helpers `isTipoActivoValido`/`isEstadoServicioValido`/`isZonaValida`/`isDeptoValido`/`isGrupoValido`, validación por sección, coherencia root(v1) ↔ secciones(v2), subcolecciones append-only, nueva colección `/subestaciones`, roles F28 aceptados en `/usuarios/{uid}` (`admin`, `tecnico`, `director_proyectos`, `analista_tx`, `gestor_contractual`, `brigadista`, `auditor_campo`). `firestore.indexes.json` +8 índices compuestos (`ubicacion.zona+codigo`, `identificacion.grupo+codigo`, `identificacion.tipo_activo+salud_actual.hi_final`, `ubicacion.subestacionId+codigo`, `salud_actual.bucket+ubicacion.zona`, `estado_servicio+codigo`, 2 de subestaciones, 1 de `historial_hi` como collection-group). Runner de tests: Node native `node --test` + `"type": "module"` en `package.json`, scripts `npm run test:unit` y `npm test` (lint + tests). 63 tests unitarios (4 files) cubriendo pesos HI/enums/UUCC CREG 085 (N4T1–N4T19 + N5T1–N5T25 reguladas, rango general N3T1–N5T25)/buckets/roles/sanitizadores/validadores/proyección v1/migración v1→v2 idempotente/runner defensivo. `docs/MODELO-DATOS-v2.md` con diagrama ER, diccionario completo de campos, catálogo de rules/índices, referencia normativa por sección y plan de migración. README.md y CLAUDE.md actualizados con estado v2 y tabla F16–F37. Tag `v2.0.0-f16`.

---

## 9. Diseño visual UI v3 · DARK MODE (2026-04-27)

> **Esta sección es el handoff entre sesiones de Claude Code.** Si
> arrancas una sesión nueva, lee primero §0 (permisos push), luego
> esta §9 antes de tocar cualquier cosa visual. La regla §0.1.2 es
> obligatoria: verifica primero el estado del repo (`git log
> origin/main`, `ls assets/css/`) — esta §9 puede estar desactualizada.

### 9.1 Estado actual (post v2.7.0 · 2026-04-27 PM4)

| Concepto | Valor |
|---|---|
| Modo visual | **AQUA LIGHT** (revertido del dark mode en commit `50cf27a` v2.5.1) · texto Steel Navy oscuro `#0d1f38` legible como negro corporativo |
| Foto de fondo activa | `assets/img/aqua/substation-photo.webp` · **2880×1620 · WebP q=95 · 1.07 MB** · convertida de FONDO POWERTRANSFORMER.jpg |
| Sidebar | **Aqua glass material** · `rgba(255,255,255,.36-.22)` + `blur(52px) saturate(200%) brightness(108%)` + highlight 3D superior |
| Sidebar drilldown | Categoría "Suministro de Elementos…" + cada número de contrato (4123, 4125) son `<button>` puros — **solo expand/collapse, NO navegan** (v2.7.0). La navegación al dashboard sale exclusivamente por "Control y Gestión Operativa" |
| Información Contractual | `pages/contrato-info.html?id=NNN` · nube documental con visor PDF embebido (iframe nativo) · 13 PDFs servidos desde `assets/docs/contratos/{cid}/` (manifest local) + override Firestore `/contratos/{cid}.documentos_contractuales[]` (admin upload v2.7.0) |
| Admin Information Contractual (v2.7.0) | Botón **"+ Agregar documento"** en cabecera de lista lateral · hover-action **trash** en cada doc · modales upload/delete con barra de progreso resumable · solo visibles para `rol === 'admin'` · wire a Firebase Storage (`uploadBytesResumable` + `deleteObject`) y Firestore (`setDoc` con merge en array) |
| Importador Suministros | **Canal único Excel** (xlsm) · JSX retirado en v2.5.1 commit `c41d316` · `parsearArchivos({xlsmBuffer, XLSX})` |
| Tag de release | (sin tag nuevo · branch activa `claude/set-background-image-nhgwM`) |
| Versiones CHANGELOG | v2.5.0 · v2.5.1 · v2.6.0 · v2.6.1 · v2.7.0 (sesión 2026-04-27) · v2.7.1 · v2.8.0 · **v2.8.1** (sesión 2026-05-01) |
| PRs mergeados a main esta jornada | #90 → #119 (28+ PRs · #119 = hotfix admin upload v2.8.1) |
| Sitio en producción | `ajimenezp99-jpg.github.io/LordPowerTransformersMJ.github.io/` (project page · NO el dominio raíz) |
| Service Worker | **kill-switch** · `sw.js` se auto-desregistra y limpia caches al activarse · sin SW corriendo en producción |

### 9.2 Decisiones del director (NO re-debatir)

1. **Modo visual:** light mode (Light Perla) **DESCARTADO**. El sistema
   ahora es dark mode sobre la foto IMG_9840 que el director subió. Inks
   claros, glass tokens con tint navy oscuro `rgba(8,18,35,X)` en vez
   de `rgba(255,255,255,X)`.
2. **Foto de fondo:** la versión activa es **IMG_9840** (subestación
   Caribe Colombiano de noche con luces puntuales sobre los aisladores
   y atardecer detrás). NO la foto vieja `substation-photo.png` que
   tenía padding blanco interno (esa quedó borrada en commit
   `7ac452f`). NO SVG ilustrativos.
3. **Layout:** topbar fixed 64px + sidebar vertical permanente 264px
   a la izquierda. En mobile (≤1024px) sidebar se oculta, topbar
   ocupa full-width. **Foto cubre 100vw × 100vh / 100dvh** garantizado
   por la regla `.aqua-power-scene` en `aqua-components.css:40-58`.
4. **Sidebar:** completamente transparente (`background: transparent
   !important; backdrop-filter: none !important`). La foto se ve a
   través directamente. Texto del sidebar tiene `text-shadow` oscuro
   `rgba(0,8,20,.65)` para legibilidad sobre cualquier zona de la foto.
5. **Texto inks** (DARK MODE):
   - `--ink-1: #f3f7ff` (títulos, KPI · cool white)
   - `--ink-2: #d6e0ec` (cuerpo, items menú · light steel)
   - `--ink-3: #a0b3ca` (subtítulos, meta · muted blue-gray)
   - `--ink-4: #6f7f96` (placeholder · low contrast)
6. **Glass tokens** (DARK MODE):
   - `--glass-thin: rgba(8,18,35,.32-.20)`
   - `--glass-regular: rgba(8,18,35,.42-.28)`
   - `--glass-thick: rgba(8,18,35,.55-.40)`
   - `--glass-ultra: rgba(8,18,35,.72-.56)`
   - blur reducido a 28-54px y brightness reducido a 92-96% (no
     aclarar de más en composición sobre foto oscura)
7. **Topbar dark glass:** `rgba(8,18,35,.45-.30)` con border-bottom
   `rgba(255,255,255,.10)` (highlight superior sutil). Search box
   también dark translucent.
8. **Sidebar drilldown de contratos** (5 niveles · actualizado v2.8.0):
   ```
   Contratos ▾
     Suministro de Elementos y Accesorios para Transformadores de Potencia ▾
       4123000081 ▾
         Control y Gestión Operativa  → contrato.html?id=4123000081
         Información Contractual      → contrato-info.html?id=4123000081
         Seguimiento Contractual ▾    (toggle puro · v2.8.0)
           Remisiones                 → contrato-info.html?id=4123000081&tipo=remisiones
           Reuniones de Seguimiento   → contrato-info.html?id=4123000081&tipo=reuniones-seguimiento
       4125000143 ▾
         (misma estructura espejo)
   ```
   "Control y Gestión Operativa", "Información Contractual",
   "Remisiones" y "Reuniones de Seguimiento" son **links terminales**
   (no acordeones). "Seguimiento Contractual" es un **toggle puro**
   (botón · solo expand/collapse, no navega). Cargan el contenido en el
   panel derecho. Los 5 tabs (Dashboard, Catálogo, Movimiento,
   Histórico, Importar) viven SOLO en `pages/contrato.html`, no
   replicados en sidebar. **Proper case** (no uppercase) — el
   director lo pidió explícitamente.

### 9.3 Pendientes que conoce el director

1. **Información Contractual** — el director va a subir datos al
   repo. Cuando suba, debo:
   - Recibir nombre de archivo + formato (JSON / PDF / Excel / etc.)
   - Recibir lookup-strategy: ¿mismos datos para ambos contratos
     o diferenciados por `?id=`?
   - Montar tab `#tab=info-contractual` en `pages/contrato.html`
     que rendere los datos
   - Hasta entonces el link existe pero la página no muestra nada
     distinto al dashboard default
2. **Tokens revocar** — el director dio dos PATs inline en esta
   sesión:
   - `ghp_3Xnq…` (sesión inicial · usado para PRs #90, #91, #92,
     #93, #94, #95) · ya revocado por el director (push falló
     después)
   - `ghp_kzk3…` (segundo · usado para PRs #96 onwards) · pendiente
     revocar cuando termine el trabajo
3. **Datos de Suministros del contrato 4125000143** — algunas KPIs
   muestran 0 porque la importación XLSM dio 0 movimientos
   registrados. No es bug visual; falta cargar movimientos via
   `admin/importar-suministros.html`. Tema fuera de scope visual.

### 9.4 Inventario de archivos del rediseño

| Archivo | Estado | Propósito |
|---|---|---|
| `assets/css/aqua-tokens.css` | **Activo · DARK MODE** | Tokens: inks claros, glass navy oscuro, motion, radii iOS, aliases legacy. Versión light-perla histórica preservada en commits `e28faa2^` |
| `assets/css/aqua-components.css` | **Activo · DARK MODE** | Topbar dark glass, sidebar transparente, page titles con shadow oscuro, sidebar 5-level (greatgrandchild proper-case) |
| `assets/js/aqua.js` | Activo | Particles, glint cursor, topbar scroll state |
| `assets/js/aqua-shell.js` | Activo | Auto-inyecta topbar + sidebar + escena. `markActive()` ahora compara hash `#tab=` para desambiguar items con mismo `?id=`. `bindTreeToggle()` respeta `aria-expanded` inicial del caret en vez de forzar todo expandido |
| `assets/img/aqua/substation-photo.jpg` | **Activo** · foto de fondo | 2560×1920 · 1.16 MB · JPEG q88 progresivo · sin padding blanco · convertida de IMG_9840.HEIC |
| `assets/img/aqua/substation-photo.png` | **BORRADO** (commit `7ac452f`) | Era la foto vieja recortada (1598×1599) · reemplazada por la JPEG hi-res |
| `assets/img/aqua/IMG_9840.HEIC` (raíz y assets) | **BORRADO** (commit `7ac452f`) | Origen HEIC procesado · ya solo queda el JPEG resultado |
| `assets/img/aqua/{substation-scene,power-scene}.svg` | Inactivos | SVGs ilustrativos rechazados sesiones previas. Dejados por compat |
| `assets/img/aqua/{transformer,tower,logo-aqua}.svg` | Logo + decorativos | Bundle inicial · `logo-aqua.svg` sigue siendo el favicon |
| `sw.js` | **kill-switch** | Auto-desregistra al activarse + limpia todos los caches. PWA offline-first temporalmente desactivada |
| `pages/dashboard.html` | Modificada | Removido el `navigator.serviceWorker.register()` para no re-registrar el SW |

### 9.5 Decisiones técnicas resolvidas en esta sesión

1. **Cobertura full-viewport del fondo (PR #91)** · La regla
   `.aqua-power-scene` ahora es invariante: `position: fixed; inset: 0;
   width: 100vw; height: 100vh; height: 100dvh; min-width: 100%;
   min-height: 100%; background-size: cover; background-position:
   center center;`. La unidad `100dvh` corrige el recorte de barras
   del navegador en iOS/Android.
2. **Padding blanco en el PNG (PR #98)** · La foto vieja medía
   3840×2400 px pero solo el 41% era contenido real (subestación);
   el resto era padding blanco que `background-size: cover` extendía
   a todo el viewport. Solución: detectar bounding box de pixeles
   no-blancos con PIL+numpy y recortar al contenido real
   (1598×1599 px). Después la foto IMG_9840 ya venía sin padding
   y reemplazó esa versión.
3. **Service Worker bloqueando deploys (PR #95, #96)** · El SW v3-5-2
   original (cache-first puro) seguía sirviendo CSS viejo aunque
   GitHub Pages tuviera el nuevo. Bumpear `CACHE_VERSION` no era
   suficiente porque Safari decidía cuándo chequear `sw.js`
   (hasta 24h). Solución de raíz: SW kill-switch que se
   auto-desregistra. Una vez que cualquier navegador descarga
   el nuevo `sw.js`, install + activate borran TODOS los caches
   y llaman `registration.unregister()`. El sitio queda funcionando
   como un sitio web tradicional (sin cache de SW) y los deploys
   son visibles en la siguiente recarga.
4. **HEIC no es soportado por Chrome/Firefox como CSS background**
   · Solo Safari renderiza HEIC en `background-image: url()`. Para
   compatibilidad cross-browser, las fotos en HEIC del director
   deben convertirse a JPEG/WebP antes de usarse como fondo.
   Pipeline establecido en sesión: `pillow-heif` para abrir HEIC,
   `Pillow.Image.LANCZOS` para resize, save como JPEG q88
   progressive optimize=True.
5. **Active state desambiguación (PR #102)** · Antes la función
   `markActive()` solo comparaba pathname + `?id=`. Resultado:
   múltiples items con mismo ID se marcaban activos a la vez. La
   nueva versión también compara hash `#tab=`: si la URL tiene
   `#tab=X`, solo el item con ese tab gana; si no hay hash, gana
   el item raíz (sin tab). También expande la cadena completa
   de árboles ancestros (no solo el padre inmediato vía
   `closest()`).
6. **Sidebar drilldown contratos (PR #102, #103)** · Estructura
   planeada inicialmente como 5 niveles con leaves replicando
   los tabs del contrato. El director clarificó: los tabs viven
   SOLO en el panel derecho — el sidebar termina en
   "Control y Gestión Operativa" e "Información Contractual"
   como links terminales. Estructura final: 4 niveles (categoría
   → número de contrato → sección).

### 9.6 Cómo hacer un cambio visual en sesión nueva

1. **Identificar tipo:**
   - Token (color, espaciado, glass, ink) → editar `aqua-tokens.css`.
   - Componente específico (sidebar, modal, topbar) → editar
     `aqua-components.css`.
   - Estructura del shell (qué se inyecta, navegación, role-hide)
     → editar `aqua-shell.js`.
2. **Modo dark obligatorio:** los inks son claros (`#f3f7ff…`),
   los glass son `rgba(8,18,35,X)`. NO uses `rgba(255,255,255,X)`
   para tints — eso era light mode y se reverted.
3. **Verificar:** `npm run lint:html` debe quedar limpio. `npm test`
   debe seguir verde. NUNCA tocar `assets/js/data/`, `assets/js/domain/`,
   `firestore.rules`, `firestore.indexes.json`, `storage.rules`,
   `functions/` para un cambio visual.
4. **Push inline con PAT** (CLAUDE.md §0.1) si el director lo
   provee, sed-redactando el token de cualquier output visible.
5. **PR contra `main`**, el director mergea desde GitHub.com web
   (a veces vía GitHub Desktop si hay conflicto local).

### 9.7 Reglas duras de feedback (refinadas en esta sesión)

- Si el director pide foto X de fondo, **verificar primero si la foto
  tiene padding blanco interno**: `python3 -c "from PIL import Image;
  import numpy as np; img = np.array(Image.open(PATH).convert('RGB'));
  non_white = np.any(img < 245, axis=2); ..."`. Si hay padding,
  recortar al bounding box antes de usarla — `background-size: cover`
  estira el padding a todo el viewport.
- Si la foto es HEIC, **convertir a JPEG/WebP** antes de comprometerla.
  Chrome/Firefox no la renderizan como background-image.
- Si el director reporta "todo sigue igual" después de un deploy,
  verificar via `curl https://ajimenezp99-jpg.github.io/LordPowerTransformersMJ.github.io/assets/css/...`
  qué CSS está realmente en el servidor. Si el CSS está bien, el
  problema es cache local del navegador. El kill-switch SW de esta
  sesión resolvió eso definitivamente.
- "Tal cual" significa SIN overlays, velos, scrims, oscurecimientos.
  La foto a plena visibilidad. Cualquier veil que se agregue
  necesita justificación específica.
- "Manéjalo proper case" = NO uppercase. El director lo pidió para
  los items "Control y Gestión Operativa" / "Información Contractual"
  cuando primer iteré con `text-transform: uppercase`.
- "Toda la información asociada debe apreciarse a la derecha" =
  el sidebar es solo navegación. El contenido va en el panel
  principal (`<main class="app-main">`). NO replicar tabs del
  contrato en sidebar.
- Si el sitio no carga: verificar URL real (project page subpath
  `LordPowerTransformersMJ.github.io/`, NO dominio raíz
  `ajimenezp99-jpg.github.io/`). El user página `ajimenezp99-jpg.github.io/`
  retorna 404 — el repo se sirve en project page.

### 9.8 Microcirugía Suministros · Información Contractual (v2.6.0 · 2026-04-27 PM3)

Reestructura del módulo Suministros / Contratos en 6 fases. Detalle
en `docs/MICROCIRUGIA-CONTRATOS-2026-04-27.md` y `CHANGELOG.md`
v2.6.0. Estado de cierre:

**Sidebar contratos (estructura final v2.7.0)**:

```
Contratos ▾                                        ← <a href> a contratos.html
  Suministro de Elementos y Accesorios… ▾          ← <button> · solo expand/collapse
    4123000081 ▾                                   ← <button> · SOLO expand/collapse (v2.7.0)
      Control y Gestión Operativa                  ← <a href> a contrato.html?id=…
      Información Contractual                      ← <a href> a contrato-info.html?id=…
    4125000143 ▾
      (espejo)
```

Tanto la categoría como cada número de contrato son `<button
class="sb-item-toggle">` que solo togglean el árbol. La navegación
real al dashboard del contrato sale exclusivamente por
"Control y Gestión Operativa". Esta consistencia se introdujo en
v2.7.0 (commit `76f7b88`) — el director había pedido el cambio
explícitamente.

**Página `pages/contrato-info.html`**:

Layout split (320px lista + 1fr visor) con:
- Lista de PDFs agrupada por categoría (minuta, garantías, oferta,
  adendas, ordenes, administracion, otros) con buscador
- Visor `<iframe>` con `#view=FitH` para fit-horizontal
- Toolbar: descargar / abrir nueva pestaña / fullscreen
- Hash routing `#doc=slug` para refresh-resilience
- Empty state amigable hasta que se elija doc

**Documentos contractuales — transporte dual**:

- **Default:** GitHub Pages servida vía
  `assets/docs/contratos/{cid}/manifest.json` + PDFs en mismo dir.
  Funciona inmediato, cero infra.
- **Override futuro:** Firebase Storage + array
  `documentos_contractuales[]` en `/contratos/{cid}` Firestore. El
  data layer mergea: Firestore gana sobre el manifest local.
- **Migración:** `node scripts/deploy-pdfs-storage.js
  --service-account ~/sa.json` desde la Mac del director cuando
  quiera. Idempotente por md5; URLs firmadas con expiración 2100.

**Reglas Storage (pendiente deploy)**:

```javascript
match /contratos/{contratoId}/{filename=**} {
  allow read:   if true;
  allow create: if isAdmin() && request.resource.size <= 50 * 1024 * 1024;
  allow update: if isAdmin() && request.resource.size <= 50 * 1024 * 1024;
  allow delete: if isAdmin();
}
```

⚠ Requiere `firebase deploy --only storage` antes de que el script
ó la UI admin de upload puedan subir PDFs.

**Admin upload + delete (v2.7.0)**:

Si el usuario logueado tiene `rol=admin`:
- Aparece botón "+ Agregar documento" en la cabecera de la lista
  lateral. Abre modal con campos título / categoría (7 opciones
  canónicas) / archivo PDF. Upload via `uploadBytesResumable` con
  barra de progreso 0-100. Idempotente por slug. Al éxito refresca
  la lista (mergea Firestore sobre manifest).
- Aparece botón trash absoluto al hover sobre cada doc. Abre modal
  de confirmación. Al confirmar, `deleteObject` del Storage +
  filter del array Firestore.

Las funciones de upload/delete viven en
`assets/js/data/documentos_contractuales.js`:
- `slugFromTitle(titulo)` — genera slug URL-safe (NFD + lowercase
  + a-z0-9 con dash separator, sufijo .pdf). Mismas reglas que el
  script Python.
- `subirDocumento({cid, titulo, categoria, file, uid, onProgress})`
- `eliminarDocumento({cid, archivo})` — solo elimina docs que
  estén en el array Firestore. Docs del manifest base del repo
  lanzan error informativo.

Manejo de errores: `permission-denied` en upload/delete agrega
sugerencia explícita del comando `firebase deploy --only storage`
en el mensaje (referencia a §0.1.1 de este archivo).

**Fixes de contraste WCAG AA**: 6 reglas migradas de
`color: var(--brand)` → `color: var(--brand-deep)` en
`.tb-nav a.is-active`, `.stat-icon`, `.stat--brand`,
`.alert.info .alert-icon`, `.qc-icon`, `.tab.is-active`. Contraste
3.8:1 → 5.4:1 sobre fondos brand semi-translúcidos.

**Importador Suministros — canal único Excel** (commit
anterior `c41d316`): el JSX
`control_suministros-2.jsx` quedó retirado del flujo. La
importación lee solo del `.xlsm`. Datos legacy (`/transformadores`,
`/correcciones`) quedan en Firestore inmutables desde el importer.

### 9.9 Hotfix admin upload · defaults codigo+estado en /contratos/{cid} (v2.8.1 · 2026-05-01)

Bug de regresión revelado al lanzar Seguimiento Contractual (v2.8.0):
el botón **"+ Agregar documento"** del modal admin caía con
`Missing or insufficient permissions` después de que el upload a
Firebase Storage llegara al 100 %. Reproducible al subir cualquier
PDF a un contrato cuyo doc Firestore `/contratos/{cid}` no había
sido dado de alta previamente con los campos canónicos.

**Causa raíz** (`firestore.rules:418-430`):

```javascript
allow create: if isAdmin()
              && request.resource.data.codigo is string
              && request.resource.data.codigo.size() > 0
              && request.resource.data.estado in
                 ['vigente','suspendido','finalizado','en_liquidacion'];
allow update: if isAdmin()
              && request.resource.data.estado in
                 ['vigente','suspendido','finalizado','en_liquidacion'];
```

El data layer hacía `setDoc(merge:true)` enviando solo
`{[campo]: arr, [campoUpdatedAt]: ts}`. Con merge, el
`request.resource.data` que evalúan las rules es el merged-post-state.
Si el doc no existía o no tenía `estado` válido, el campo quedaba
`undefined` post-merge y la cláusula `estado in [...]` fallaba.

`4123000081` en v2.7.0 funcionaba porque su `/contratos/4123000081`
tiene `estado: 'vigente'` legítimo. `4125000143` (más reciente, sin
"Información Contractual" cargada antes) no tenía el doc poblado, y
ningún flujo de v2.8.0 (Remisiones, Reuniones) lo había hecho.

**Fix** (`assets/js/data/documentos_contractuales.js`): helper
`_conDefaultsContrato(payload, cid, dataExistente)` que **respeta
los valores existentes** (no pisa un `estado='suspendido'` real) y
solo agrega defaults cuando faltan o son inválidos:

```javascript
function _conDefaultsContrato(payload, cid, dataExistente) {
  const out = { ...payload };
  if (!dataExistente.codigo) out.codigo = String(cid);
  const ESTADOS_VALIDOS = ['vigente', 'suspendido', 'finalizado', 'en_liquidacion'];
  if (!ESTADOS_VALIDOS.includes(dataExistente.estado)) out.estado = 'vigente';
  return out;
}
```

Aplicado en `subirDocumento` (línea 279) y `eliminarDocumento`
(línea 342). Sin deploy de Firebase: el fix vive 100 % en JS.

**Lección permanente para este patrón:** cuando un setDoc(merge:true)
toca una colección con rules que exigen ciertos campos, hay que
asegurarse de incluirlos en el payload — sea porque ya están en el
doc existente (verificable con un `getDoc` previo), o porque el
data layer los rellena con defaults seguros. Esta regla aplica a
toda colección con enums obligatorios:
- `/contratos/{cid}` → `codigo`, `estado` (afectado por v2.8.1)
- `/transformadores/{id}` → schema_version, identificacion.codigo,
  estado_servicio, etc. (no usa setDoc-merge desde data layer; se
  construye payload completo en `crearTransformador`)
- `/ordenes/{id}` → codigo, estado, tipo, prioridad (igual)

**Verificación funcional:** las 7 remisiones (`REMISION 1.pdf` …
`REMISION 7.pdf`) del contrato `4123000081` cargadas exitosamente
vía admin upload. Visor PDF embebido renderiza. Categorización
automática como "Remisiones" en la lista lateral.

**Nota operativa para sesiones nuevas:** durante la jornada el
director subió por error los 7 PDFs al raíz del repo via GitHub
web (commit `91f386c`). No afecta el sistema (los PDFs reales viven
en Firebase Storage tras el upload), pero quedaron como peso muerto
del repo (~3 MB total). Cleanup pendiente en una versión futura.

Branch del fix: `claude/mira-feature-XqsGK` · Commit: `e43aa42` ·
PR: #119 · Merge a main: `8e1aa10`.


