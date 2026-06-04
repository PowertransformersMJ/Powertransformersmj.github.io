---
name: canvas-design-creative
description: >
  Use this skill when the user wants to create visually expressive design
  artifacts — posters, art prints, concept canvases, PDFs, or PNGs — rooted
  in a design philosophy or aesthetic movement. Trigger when the user mentions
  "canvas," "design philosophy," "art piece," "poster," "visual identity,"
  "aesthetic movement," "generative art," "abstract composition," "museum
  quality," or asks to "express visually" any idea or concept. Output is
  always .md (philosophy) + .pdf or .png (visual artifact). Never use for
  slide decks or documents — use pptx-presentations for those.
license: Proprietary. LICENSE.txt has complete terms
source: https://www.aitmpl.com/component/skill/creative-design/canvas-design
install: npx claude-code-templates@latest --skill creative-design/canvas-design
---

# Canvas Design Skill

These are instructions for creating design philosophies — aesthetic movements
that are then EXPRESSED VISUALLY. Output only `.md` files, `.pdf` files, and
`.png` files.

Complete this in two steps:

1. **Design Philosophy Creation** (`.md` file)
2. **Express by creating it on a canvas** (`.pdf` file or `.png` file)

---

## STEP 1 — DESIGN PHILOSOPHY CREATION

To begin, create a VISUAL PHILOSOPHY (not layouts or templates) that will be
interpreted through:

- Form, space, color, composition
- Images, graphics, shapes, patterns
- Minimal text as visual accent

### The Critical Understanding

- **What is received**: Some subtle input or instructions by the user that
  should be taken into account, but used as a foundation; it should not
  constrain creative freedom.
- **What is created**: A design philosophy / aesthetic movement.
- **What happens next**: The same context receives the philosophy and EXPRESSES
  IT VISUALLY — creating artifacts that are 90% visual design, 10% essential
  text.

Think of it this way:

- Write a manifesto for an art movement
- The next phase involves making the artwork

The philosophy must emphasize: Visual expression. Spatial communication.
Artistic interpretation. Minimal words.

### How to Generate a Visual Philosophy

**Name the movement** (1-2 words): e.g. "Brutalist Joy" / "Chromatic Silence" /
"Metabolist Dreams"

**Articulate the philosophy** (4-6 paragraphs — concise but complete):

Express how the philosophy manifests through:

- Space and form
- Color and material
- Scale and rhythm
- Composition and balance
- Visual hierarchy

### Critical Guidelines

- **Avoid redundancy**: Each design aspect should be mentioned once. Avoid
  repeating points about color theory, spatial relationships, or typographic
  principles unless adding new depth.
- **Emphasize craftsmanship REPEATEDLY**: The philosophy MUST stress multiple
  times that the final work should appear as though it took countless hours to
  create, was labored over with care, and comes from someone at the absolute
  top of their field. Repeat phrases like "meticulously crafted,"
  "painstaking attention," "master-level execution."
- **Leave creative space**: Remain specific about the aesthetic direction, but
  concise enough that there is room to make interpretive choices at an
  extremely high level of craftsmanship.

The philosophy must guide visual expression of ideas — not text. Information
lives in design, not paragraphs.

### Philosophy Examples

**"Concrete Poetry"**
Philosophy: Communication through monumental form and bold geometry.
Visual expression: Massive color blocks, sculptural typography (huge single
words, tiny labels), Brutalist spatial divisions, Polish poster energy meets
Le Corbusier. Ideas expressed through visual weight and spatial tension, not
explanation. Text as rare, powerful gesture — never paragraphs, only essential
words integrated into the visual architecture. Every element placed with the
precision of a master craftsman.

**"Chromatic Language"**
Philosophy: Color as the primary information system.
Visual expression: Geometric precision where color zones create meaning.
Typography minimal — small sans-serif labels letting chromatic fields
communicate. Think Josef Albers' interaction meets data visualization.
Information encoded spatially and chromatically. Words only to anchor what
color already shows. The result of painstaking chromatic calibration.

**"Analog Meditation"**
Philosophy: Quiet visual contemplation through texture and breathing room.
Visual expression: Paper grain, ink bleeds, vast negative space. Photography
and illustration dominate. Typography whispered (small, restrained, serving
the visual). Japanese photobook aesthetic. Text appears sparingly — short
phrases, never explanatory blocks.

**"Organic Systems"**
Philosophy: Natural clustering and modular growth patterns.
Visual expression: Rounded forms, organic arrangements, color from nature
through architecture. Information shown through visual diagrams, spatial
relationships, iconography. Text only for key labels floating in space.

**"Geometric Silence"**
Philosophy: Pure order and restraint.
Visual expression: Grid-based precision, bold photography or stark graphics,
dramatic negative space. Typography precise but minimal. Swiss formalism meets
Brutalist material honesty. Structure communicates, not words.

*These are condensed examples. The actual design philosophy should be 4-6
substantial paragraphs.*

### Essential Principles

- **VISUAL PHILOSOPHY**: Create an aesthetic worldview to be expressed through design
- **MINIMAL TEXT**: Text is sparse, essential-only, integrated as visual element — never lengthy
- **SPATIAL EXPRESSION**: Ideas communicate through space, form, color, composition — not paragraphs
- **ARTISTIC FREEDOM**: Interpret the philosophy visually — provide creative room
- **PURE DESIGN**: This is about making ART OBJECTS, not documents with decoration
- **EXPERT CRAFTSMANSHIP**: The final work must look meticulously crafted, labored over with care, the product of countless hours by someone at the top of their field

Output the design philosophy as a `.md` file.

---

## STEP 2 — DEDUCING THE SUBTLE REFERENCE

**CRITICAL STEP**: Before creating the canvas, identify the subtle conceptual
thread from the original request.

The topic is a **subtle, niche reference embedded within the art itself** — not
always literal, always sophisticated. Someone familiar with the subject should
feel it intuitively, while others simply experience a masterful abstract
composition. The design philosophy provides the aesthetic language. The deduced
topic provides the soul — the quiet conceptual DNA woven invisibly into form,
color, and composition.

Think like a jazz musician quoting another song — only those who know will
catch it, but everyone appreciates the music.

---

## STEP 3 — CANVAS CREATION

With both the philosophy and the conceptual framework established, express it
on a canvas.

**IMPORTANT**: For any type of content, even if the user requests something for
a movie/game/book, the approach should still be sophisticated. Never lose sight
of the idea that this should be art, not something cartoony or amateur.

To create museum or magazine quality work:

- Use the design philosophy as the foundation
- Create one single page, highly visual, design-forward PDF or PNG output
  (unless asked for more pages)
- Use repeating patterns and perfect shapes
- Treat the abstract philosophical design as if it were a scientific bible —
  dense accumulation of marks, repeated elements, layered patterns that build
  meaning through patient repetition and reward sustained viewing
- Add sparse, clinical typography and systematic reference markers that suggest
  a diagram from an imaginary discipline
- Anchor the piece with simple phrase(s) or details positioned subtly, using a
  limited color palette that feels intentional and cohesive

**Text as a contextual element**: Text is always minimal and visual-first, but
let context guide whether that means whisper-quiet labels or bold typographic
gestures. Most of the time, font should be thin. All use of fonts must be
design-forward and prioritize visual communication. Nothing falls off the page
and nothing overlaps. Every element must be contained within the canvas
boundaries with proper margins.

**IMPORTANT**: Use different fonts if writing text. Search the `./canvas-fonts`
directory. Regardless of approach, sophistication is non-negotiable.

Download and use whatever fonts are needed. Get creative by making the
typography actually part of the art itself — if the art is abstract, bring
the font onto the canvas, not typeset digitally.

**CRITICAL**: To achieve human-crafted quality, create work that looks like it
took countless hours. Make it appear as though someone at the absolute top of
their field labored over every detail with painstaking care. Ensure composition,
spacing, color choices, typography — everything screams expert-level
craftsmanship. Double-check that nothing overlaps, formatting is flawless,
every detail perfect.

Output the final result as a single, downloadable `.pdf` or `.png` file,
alongside the design philosophy used as a `.md` file.

---

## STEP 4 — FINAL REFINEMENT PASS

**IMPORTANT**: The user ALREADY said: *"It isn't perfect enough. It must be
pristine, a masterpiece of craftsmanship, as if it were about to be displayed
in a museum."*

**CRITICAL**: To refine the work, avoid adding more graphics; instead refine
what has been created and make it extremely crisp, respecting the design
philosophy and the principles of minimalism entirely. Rather than adding a new
filter or refactoring a font, ask:

> *"How can I make what's already here more of a piece of art?"*

Take a second pass. Go back to the code and refine/polish further to make this
a philosophically designed masterpiece.

---

## MULTI-PAGE OPTION

To create additional pages when requested:

- Create more creative pages along the same lines as the design philosophy but
  distinctly different as well
- Bundle those pages in the same `.pdf` or many `.png` files
- Treat the first page as just a single page in a whole coffee table book
  waiting to be filled
- Make the next pages unique twists and echoes of the original
- Have them almost tell a story in a very tasteful way
- Exercise full creative freedom
