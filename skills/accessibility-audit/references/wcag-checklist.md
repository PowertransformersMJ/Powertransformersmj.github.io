# WCAG 2.2 AA — audit checklist, contrast math, and recipes

Detailed companion to `SKILL.md`. Read the section you need.

## Contents
1. Color contrast math (the part you must not eyeball)
2. Severity rubric
3. Per-criterion checklist (verify-in-code → common failure → fix)
4. Grep recipes
5. Common false positives (verify before reporting)

---

## 1. Color contrast math

WCAG contrast is a ratio between two relative luminances. Compute it; don't guess.

**Relative luminance** of a color (sRGB channels R,G,B as 0–255):
1. Normalize each channel to 0–1: `c = channel / 255`.
2. Linearize: `c_lin = c/12.92` if `c ≤ 0.03928`, else `((c + 0.055) / 1.055) ** 2.4`.
3. `L = 0.2126*R_lin + 0.7152*G_lin + 0.0722*B_lin`.

**Contrast ratio** between two colors: `(L_lighter + 0.05) / (L_darker + 0.05)`.
Result ranges 1:1 (identical) to 21:1 (black on white).

**Translucent text (`rgba`, opacity α over a background):** composite first, per channel:
`effective = fg * α + bg * (1 - α)`, then compute luminance on the effective color.
This is the #1 source of hidden contrast failures — faint "muted" text tokens defined as
`rgba(ink, 0.3)` often land around 2–3:1.

**Thresholds (level AA):**
| Content | Minimum |
|---|---|
| Body text (< 18pt, or < 14pt bold) | **4.5:1** |
| Large text (≥ 18pt / ≥ 24px, or ≥ 14pt / ≥ 18.66px bold) | **3:1** |
| UI components & graphical objects & **focus indicators** (1.4.11) | **3:1** |
| AAA body / large | 7:1 / 4.5:1 |

**Worked example** (catches a real failure): ink `#F4EEDE` at 32% opacity over bg `#08070A`.
Composite: R = 244*0.32 + 8*0.68 ≈ 84, G ≈ 81, B ≈ 78 → `#54514E`. Its luminance ≈ 0.083;
bg luminance ≈ 0.0023. Ratio = (0.083+0.05)/(0.0023+0.05) ≈ **2.5:1** → fails AA for text.
The same ink at 62% opacity ≈ 6.8:1 → passes. So the fix is often "raise the opacity," and
you can compute the exact opacity that reaches 4.5:1 instead of guessing.

If you have a runtime/browser available, you can verify with `getComputedStyle` instead of
hand-computing, but the formula above is the ground truth and works from static code alone.

---

## 2. Severity rubric

Rank by **impact on completing a task** × **how many users / how central the element**.

- 🔴 **Critical** — an AT user cannot complete a core task. Keyboard trap; a form that
  can't be submitted without a mouse; content hidden from the accessibility tree entirely;
  contrast so low text is invisible.
- 🟠 **High** — a primary, frequently-used control is unnamed (screen reader announces
  "combobox" with no label), OR body text is clearly under 4.5:1, OR no visible focus on
  primary interactive elements. Degrades the experience badly but a determined user can cope.
- 🟡 **Medium** — present but imperfect: focus indicator exists but is weak; an `<h1>` is
  missing; text is marginally sub-AA (4:1–4.4:1); a landmark/skip-link is absent.
- 🟢 **Low** — AAA-level criteria, or best-practice gaps with little real-world harm:
  `prefers-reduced-motion` not honored, target slightly under 24px, redundant ARIA.

When auditing after a change, also tag **regression** (the change caused it) vs **inherited**
(pre-existing, often design-system-wide). It changes who owns the fix and the urgency.

---

## 3. Per-criterion checklist

For each: what it means → how to verify in code → common failure → fix.

### 1.1.1 Non-text content (A)
- **Verify:** every `<img>`/icon that conveys meaning has a non-empty `alt`; purely
  decorative images have `alt=""` (empty, not missing). Background images conveying info
  need a text equivalent.
- **Common failure:** `alt` missing entirely (screen reader reads the file name), or
  decorative images with verbose alt that adds noise.
- **Fix:** meaningful `alt` for content; `alt=""` for decoration; for icon-only buttons use
  `aria-label` on the button, not alt on a glyph.

### 1.3.1 Info & relationships (A)
- **Verify:** form controls have a programmatic name (a `<label for=>` pointing at the
  control's `id`, a wrapping `<label>`, or `aria-label`/`aria-labelledby`). Headings are real
  `<h#>`, lists are real `<ul>/<ol>`, tables have `<th>`. A visible label sitting next to an
  input with no association does NOT count.
- **Common failure:** `<label>Price</label>` followed by an `<input>` with no `for`/`id` link;
  layout faked with `<div>`s instead of semantic elements.
- **Fix:** add `for`/`id`; or `aria-label` on the control when one label can't serve it (e.g.
  a min/max pair under a single "Price" caption → `aria-label="Price minimum"` / `"…maximum"`).

### 1.4.3 Contrast minimum (AA)
- **Verify:** compute every text/background pair (section 1). Watch translucent tokens.
- **Common failure:** "muted"/"faint" text tokens defined with low opacity; gray-on-gray.
- **Fix:** raise lightness/opacity to hit 4.5:1 (3:1 for large). Compute the target value.

### 1.4.11 Non-text contrast (AA)
- **Verify:** UI component boundaries that are the only way to identify a control, and focus
  indicators, are ≥ 3:1 against adjacent colors.
- **Common failure:** a focus ring or input border too faint to see; a borderless button
  distinguished only by a low-contrast background.
- **Fix:** strengthen the indicator color/width.

### 2.1.1 Keyboard (A)
- **Verify:** all interactive elements are real `<button>`/`<a>`/form controls (or have
  `tabindex="0"` + key handlers). No `<div onclick>` without keyboard support. No focus traps.
- **Common failure:** clickable `<div>`/`<span>` with a mouse-only handler; custom dropdowns
  that don't respond to arrow/Enter/Escape.
- **Fix:** use native elements; if custom, add roving tabindex + key handlers + `role`.

### 2.4.1 Bypass blocks (A)
- **Verify:** a "skip to content" link is the first focusable element and targets the main
  landmark (`#main` / `<main>`).
- **Common failure:** none present, so keyboard users tab through the whole nav on every page.
- **Fix:** add a visually-hidden (`.sr-only`) skip link that becomes visible on focus, plus a
  `<main id="main">` (or `id` on the main content container) to target.

### 2.4.6 Headings & labels (A→AA)
- **Verify:** exactly one `<h1>` per page describing its purpose; heading levels don't skip
  illogically; labels/legends are descriptive.
- **Common failure:** pages (especially SEO landing pages) with zero `<h1>`; multiple h1s;
  h1→h4 jumps.
- **Fix:** add a single descriptive `<h1>` (use `.sr-only` if the design has no visible
  heading slot — this also helps SEO); order headings logically.

### 2.4.7 Focus visible (AA)
- **Verify:** every focusable element shows a clear focus indicator. Check that a global
  `:focus-visible` style actually loads on the page in question (stylesheets are per-page).
- **Common failure:** `outline: none` with no replacement; the focus style living in a
  stylesheet that some pages don't load.
- **Fix:** a scoped `:focus-visible { outline: 2px solid <accent>; outline-offset: 2px }`
  on a stylesheet that all target pages load. Never remove outline without a replacement.

### 2.3.3 Animation from interactions (AAA — report as best practice)
- **Verify:** stylesheets that animate honor `@media (prefers-reduced-motion: reduce)`.
- **Common failure:** per-page/component CSS animates with no reduced-motion guard while the
  global CSS has one — inconsistent.
- **Fix:** a reduced-motion block that neutralizes `animation`/`transition` (e.g.
  `animation-duration: 0.01ms !important; transition-duration: 0.01ms !important`).

### 2.5.8 Target size (AA, 2.2)
- **Verify:** interactive targets are ≥ 24×24 px (with exceptions for inline links / spacing).
- **Common failure:** icon buttons (favorite, compare, close) shrunk below 24px on mobile.
- **Fix:** enforce min size / padding on small controls.

### 3.1.1 Language of page (A)
- **Verify:** `<html lang="…">` is present and correct for the content language.
- **Common failure:** missing `lang`, or `lang="en"` on Spanish content.
- **Fix:** set the right `lang`.

### 4.1.2 Name, role, value (A)
- **Verify:** custom widgets and ARIA controls expose an accessible name, the correct role,
  and current state (`aria-pressed`, `aria-expanded`, `aria-checked`, etc.). Toggle buttons
  reflect state; icon buttons have names.
- **Common failure:** a toggle with no `aria-pressed`; an icon button with no name; misused
  `role`.
- **Fix:** add the missing name/role/state; prefer native elements that provide them for free.

---

## 4. Grep recipes

Run these first to map the territory (adapt globs to the project):
- Focus handling: `:focus`, `:focus-visible`, `outline`, `outline:\s*(none|0)`
- Reduced motion: `prefers-reduced-motion` (count per stylesheet — gaps are findings)
- Skip link / hidden text: `skip-link|skip-to|sr-only|visually-hidden|Saltar`
- Language: `<html lang`
- Headings: `<h1` (per page; zero is a finding)
- Names/roles: `aria-label|aria-labelledby|role=|<label|for=`
- Images: `alt=`
- Color: the project's text/accent custom properties and hex/rgba literals

Interpretation tips:
- A `count` grep counts matching *lines*, not matches — minified files (many tags per line)
  undercount. Confirm suspicious counts by reading the actual lines.
- `outline:none` scoped to inputs is fine **if** there's a visible replacement; check before
  reporting.

---

## 5. Common false positives (verify before reporting)

These look like violations but often aren't — open the file and confirm:
- **`outline: none`** — only a problem if there's no replacement focus style. Many designs
  swap outline for a border/box-shadow on focus.
- **Missing `<label for>`** — the control may have `aria-label`/`aria-labelledby`. Check the
  control, not just the label.
- **Empty `alt=""`** — correct for decorative images. Not a failure.
- **Low-contrast text** — confirm it's actual content text, not a disabled control (exempt)
  or decorative element. And confirm the computed (composited) ratio, not the token's nominal color.
- **No `<h1>` in a component file** — the h1 may live in the page template that includes it.
  Check the rendered page, not just the partial.
- **Color counts from grep** — a token defined once but used via `var()` 40× is one
  definition; assess the definition, then where it's applied.

The discipline: a finding you reported that turns out to be a false positive costs more
credibility than a finding you missed. When in doubt, read the code and say what you verified.
