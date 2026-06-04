# 🎯 40 — LÓBULOS DE DOMINIO (registry de áreas especializadas)

> **Nodo neuronal: registry de dominios especializados.** Mapa de los lóbulos
> en los que el cerebro puede crecer cuando el cliente solicita análisis
> especializado (Trigger 🔵 §G.2 en `CLAUDE.md`). Este archivo NO contiene
> los análisis — es el ÍNDICE de los lóbulos hijos (`41-SEGURIDAD`, `42-LEGAL`,
> etc.) que nacen on-demand con contenido real.
>
> **Regla clave (§G.4 Neurogénesis)**: los archivos hijos NO existen hasta que
> hay contenido REAL de una auditoría concreta. No crear vacíos por anticipado.
>
> **Mantenimiento**: cuando nazca un lóbulo hijo, agregar su fila a la tabla
> de abajo + registrarlo en `00-INDICE` + actualizar este registry para
> reflejar `🟢 vacío` → `🟠 activo`.

---

## 🗂️ Categorías esperadas

> Numeración reservada 41–49 para lóbulos de dominio. **No reutilizar** estos números para otras neuronas.

| ID | Lóbulo | Disparador (cliente dice…) | Estado | Cubre |
|---|---|---|---|---|
| **41** | Seguridad | "audita seguridad", "vulnerabilidades", "rules", "rutas sin auth", "secrets" | 🟢 vacío | API auth, validación input, prevención inyecciones (SQL/XSS/CSRF), manejo de secrets, rules check backend (Firebase/Supabase/etc.). |
| **42** | Legal/Compliance | "audita legal", "cookies", "privacidad", "GDPR", "Hábeas Data", "Ley 1581", "CCPA", "HIPAA" | 🟢 vacío | Políticas, consentimientos, regulaciones aplicables por jurisdicción. |
| **43** | UX/Diseño | "audita UX", "interfaz", "componentes", "diseño visual" | 🟢 vacío | Patrones de interfaz, modernización de componentes, jerarquía visual, motion. |
| **44** | SEO | "audita SEO", "rich snippets", "ranking", "indexación", "AEO/GEO" | 🟢 vacío | Metadata, structured data, on-page, indexación, AI search. |
| **45** | Performance | "audita performance", "Core Web Vitals", "LCP/CLS/FID", "lento" | 🟢 vacío | Métricas reales (Lighthouse), bottlenecks, optimizaciones. |
| **46** | Escalabilidad | "audita escalabilidad", "arquitectura", "modernización código", "refactor estructural" | 🟢 vacío | Anti-deuda técnica, patrones, módulos, límites. |
| **47** | Copywriting | "audita copy", "voz", "tono", "headlines", "CTAs", "mensajes" | 🟢 vacío | Tono de marca, microcopy, headlines, CTAs, mensajes de error. |
| **48** | Accesibilidad (a11y) | "audita a11y", "WCAG", "lectores de pantalla", "teclado", "contraste" | 🟢 vacío | ARIA, contraste, navegación teclado, alt texts, foco visible, prefers-reduced-motion. |

**Categorías futuras**: cualquier dominio nuevo que el cliente pida análisis
(ej. analytics/49, marketing/50, devops/51) se agrega aquí + se crea el
archivo hijo cuando hay contenido real.

---

## 🛠️ Recursos Externos Complementarios

`skills/` (carpeta del repo + tool `Skill`) es **expertise general de terceros**.
**NO es una neurona** — es un recurso paralelo, alimentado por el cliente.

> 📖 **Catálogo completo de las skills del repo → `docs/skills-inventory.md`**
> Consúltalo al disparar Trigger 🔵 para saber QUÉ skill tienes para un dominio.
>
> ⚠️ **Verdad del wiring**: `skills/` del repo NO es la fuente de las skills cargadas
> en sesión. Las skills se cargan desde `~/.claude/settings.json` del usuario + bundle
> del entorno (`anthropic-skills:*`, `superpowers:*`). El repo `skills/` es un **catálogo
> paralelo curado** (referencia). Detalle en `skills-inventory.md`.

**Workflow obligatorio al disparar Trigger 🔵 (`CLAUDE.md §G.2`)**:

1. **Primero**: revisar qué skills están disponibles (lista en system reminders
   al arranque). Para el dominio solicitado, identificar skills relevantes.
   Mapa de referencia por dominio:
   - 🔒 **Seguridad** → no hay skill dedicada estándar; usar conocimiento pre-entrenado + leer las rules/auth del proyecto.
   - 📜 **Legal** → idem; aterrizar a la jurisdicción aplicable.
   - 🎨 **UX/Diseño** → `frontend-design`, `impeccable`, `design-taste-frontend`, `emil-design-eng`, `redesign-existing-projects`, `minimalist-ui`, `industrial-brutalist-ui`, `high-end-visual-design`.
   - 🔍 **SEO** → `seo-audit`, `ai-seo`, `schema-markup`, `programmatic-seo`, `competitor-alternatives`, `site-architecture`.
   - ⚡ **Performance** → análisis directo + doctrinas `CLAUDE.md §3.1`.
   - 🏗️ **Escalabilidad** → análisis directo + experiencia acumulada en este lóbulo.
   - ✍️ **Copywriting** → `copywriting`, `copy-editing`, `email-sequence`, `cold-email`, `marketing-psychology`, `ad-creative`.
   - ♿ **Accesibilidad** → skill **`accessibility-audit`** (framework WCAG 2.2 AA — usar PRIMERO). `impeccable` solo si se va a rediseñar la UI.
2. **Segundo**: si hay skill aplicable, invocarla vía tool `Skill` (`skill: "name"`). La skill da el FRAMEWORK analítico — qué revisar, en qué orden, con qué criterios.
3. **Tercero**: aplicar el framework al CÓDIGO real del proyecto. Capturar findings en el lóbulo hijo correspondiente (creándolo si no existe).
4. **Cuarto**: el lóbulo registra QUÉ skill usé y por qué — para sesiones futuras, primero consultar el lóbulo (que apunta a la skill correcta + las excepciones específicas del proyecto).

**Sinergia esperada**: skills externas (framework general) + lóbulos internos (findings proyecto-específicos) → análisis cada vez más profundo y más rápido, sin re-investigar lo aprendido. El cerebro acumula know-how estratégico, no solo bugs históricos.

---

## 🌱 Reflejo de Sugerencia de Skills (neurogénesis de skills, no solo de neuronas)

Distinto de crear un lóbulo: aquí proponemos crear una **skill** nueva.

**Regla de oro (la frontera)**: **Skill** = capacidad/framework GENERAL y PORTABLE (sirve en *cualquier* proyecto). **Neurona/lóbulo** = conocimiento **específico de ESTE proyecto**. Si lo aprendido es portable → candidato a skill; si es del proyecto → al cerebro. (No duplicar uno en el otro.)

**Flujo**:
1. Detecto un hueco de capacidad reusable mientras trabajo.
2. Lo **SUGIERO** al cliente con justificación (qué resolvería, por qué es portable).
3. **El cliente DECIDE**.
4. Si aprueba, leo la skill `skill-creator` y la creo según sus parámetros: `SKILL.md` con frontmatter `name`+`description` "pushy" para el trigger, progressive disclosure, `references/` para el detalle.
   - **⚠️ `description` ≤ 1024 caracteres PARSEADOS** — lo exige el uploader de skills, verificar antes de instalar.
5. La instalo en `skills/<nombre>/`.
6. La **registro** en el lóbulo relevante (sección "Skills consultadas") + en `00-INDICE` (ruta del dominio) + actualizo `skills-inventory.md`.

**Skills creadas así (registro vacío)**: _(añadir entradas a medida que se generen)_

---

## 📐 Estructura de un lóbulo hijo (template)

Cuando nazca el primer lóbulo (ej. `docs/41-SEGURIDAD.md`), debe tener
esta forma — copiar/adaptar:

```markdown
# 🔒 41 — SEGURIDAD (lóbulo de dominio)

> Lóbulo registrado en `40-LOBULOS-DOMINIO`. Disparador: Trigger 🔵 §G.2
> con palabras "seguridad", "vulnerabilidades", "rules", etc.
> Mantenido por Claude bajo demanda del cliente.

## Skills consultadas
- `<nombre-skill>` (si aplica) — qué framework dio + dónde se aplicó al proyecto.

## Hallazgos (por ronda de auditoría)

### YYYY-MM-DD · Ronda inicial
- **Hallazgo 1**: descripción + severidad (low/med/high/critical) +
  ubicación (`file:line`) + recomendación.
- **Hallazgo 2**: …

### YYYY-MM-DD · Ronda N
…

## Excepciones / decisiones específicas del proyecto
- Por qué la regla genérica X NO aplica (con justificación verificable).
- Tradeoffs aceptados conscientemente.

## Pendientes / próxima ronda
- Áreas no cubiertas todavía.
- Hipótesis a verificar.
```

---

## 🛡️ Reglas de mantenimiento del registry

1. **No crear archivos hijos vacíos**. Solo nacen con contenido real.
2. **Cuando un lóbulo hijo nace**: actualizar la fila correspondiente en
   este registry (`🟢 vacío` → `🟠 activo`) + agregar fila en `00-INDICE`
   con su ubicación. El linter `brain:check` valida que los `41-*..49-*`
   estén registrados aquí (no en `CLAUDE.md`).
3. **Tope blando ~280 líneas para este archivo**. Si crece por encima
   (ej. el registry se vuelve un meta-índice de muchos sub-temas), shard
   por meta-categorías.
4. **Reflejo de Cierre (`CLAUDE.md §G.4`)**: tras una auditoría especializada,
   verificar antes de cerrar la tarea: ¿lóbulo hijo creado/actualizado?
   ¿skills consultadas registradas? Si no, vuelve y hazlo.
