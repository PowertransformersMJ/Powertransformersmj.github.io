# Core — UX/UI Patterns & Design System

How to build a CRM interface that feels world-class: the screens, the
interaction patterns, the component library, design tokens, themes and
accessibility. Patterns distilled from Salesforce Lightning, HubSpot, Pipedrive,
Attio, monday. [source: https://www.lightningdesignsystem.com/2e1ef8501/p/355656-patterns]

## Table of contents
1. Layout & navigation
2. Screen anatomy (the big 10)
3. Interaction patterns
4. Component inventory
5. Design tokens
6. Themes (light/dark/high-contrast)
7. States: loading / empty / error
8. Accessibility (WCAG AA)
9. Performance UX
10. CRM UI checklist

---

## 1. Layout & navigation
- **App shell**: top bar (logo, global search, quick-create `+`, notifications
  bell, user menu, org switcher) + left **sidebar** (modules) that collapses to
  icons. Optional **command palette** (Cmd/Ctrl+K) for jump-to + actions.
- **Workspaces** per module with a consistent header (breadcrumb, title,
  primary actions, view tabs/filters).
- **Split view**: keep a list pane beside the open record so reps don't lose
  context. [source: https://www.spekit.com/templates/salesforce-lighting-list-views]
- Responsive: sidebar → drawer on mobile; bottom-sheet modals on phones.

## 2. Screen anatomy (the big 10)

1. **Dashboard/home** — KPI cards row, pipeline summary, today's tasks/agenda,
   activity feed, leaderboard, trend charts. Role-aware.
2. **Pipeline / Kanban** — stage columns, draggable deal cards (title, amount,
   owner avatar, age/rotting, next step), per-column weighted total + count,
   WIP; filter/sort; switch to list. The most-used sales screen.
   [source: https://www.marksgroup.net/blog/salesforce-visual-summaries-with-kanban-view/]
3. **List / table view** — configurable columns, **inline edit**, multi-select +
   **bulk actions**, filters, **saved views**, sort, density toggle, pinned/
   frozen columns, pagination or virtualization, row click → detail.
4. **Record detail** — **highlights header** (key fields + primary actions +
   stage **path**), tabs (Overview / Activity / Related / Files / Notes),
   **activity timeline**, related lists & side panels, edit-in-place.
   [source: https://trailhead.salesforce.com/content/learn/modules/lex_implementation_basics/lex_implementation_basics_explore]
5. **Lead/Contact detail** — profile + consent state + engagement + timeline +
   related deals; convert action.
6. **Inbox / conversations** — channel list (filters) | thread list | message
   pane (bubbles, composer, templates, AI suggest) | context panel (the contact/
   deal). Omnichannel unified.
7. **Calendar & scheduler** — month/week/day, drag to reschedule, booking links.
8. **Reports / dashboard builder** — pick entity/columns/filters/group/chart;
   saved & shared.
9. **Forms & wizards** — create/edit; multi-step wizard for long flows;
   validation; optimistic save; conflict (`_version`) handling.
10. **Settings/admin** — collapsible sections (users & roles, pipelines, custom
    fields, automations, integrations, branding, billing). macOS-Settings style.

## 3. Interaction patterns
- **Inline editing** + **optimistic UI** (update immediately, reconcile on
  snapshot, roll back on failure) with toasts.
- **Bulk select** + actions (assign, tag, change stage, export, delete).
- **Drag-and-drop** (kanban, reorder, file upload) with clear drop targets.
- **Quick-create** (`+`) for any entity from anywhere; **keyboard shortcuts**
  (Cmd+K, n=new, /=search, g+letter=goto); **undo** on destructive actions.
- **Toasts/notifications** + a notification center (bell) with history.
- **Presence & collaboration** (who's viewing/editing), @mentions, comments.
- **Saved views & filters** persisted per user.

## 4. Component inventory
Build (or adopt) a consistent set; map to `assets/templates/components/`:

| Component | Notes |
|---|---|
| Button | variants: primary/secondary/ghost/danger; sizes; loading; icon-only |
| Input / Textarea / Select / Combobox | states: hover/focus/disabled/error; labels + hints + error text |
| Checkbox / Radio / Toggle | accessible custom styling |
| Date/time picker, Currency, Phone (+57), Tag/multiselect | locale-aware |
| Table / DataGrid | column config, sort, inline edit, selection, sticky header |
| Kanban board + Card | draggable, droppable, weighted totals |
| Card / Stat card | KPI tiles, record cards |
| Modal / Drawer (slide-over) / Bottom-sheet | focus trap, Esc, backdrop |
| Tabs / Accordion / Stepper | record sections, wizards |
| Badge / Pill / Status chip | stage/status color-coded |
| Avatar / Avatar group | owner/presence |
| Tooltip / Popover / Dropdown menu | keyboard accessible |
| Toast / Banner / Inline alert | success/error/warning/info |
| Skeleton / Spinner / Progress | loading states |
| Timeline / Activity item | record history |
| Empty state | icon + message + CTA |
| Command palette | fuzzy search + actions |
| Charts | bar/line/pie/funnel (Chart.js or similar) |

## 5. Design tokens
Centralize everything as CSS variables (see `assets/templates/design-tokens.css`):
- **Color**: brand scale (50–900), neutrals (0–950), semantic (success/warning/
  danger/info), surface/bg/text/border roles. Stage/status palette.
- **Spacing**: 4-pt scale (0,2,4,8,12,16,20,24,32,40,48,64…).
- **Typography**: font families, weights, sizes (xs→3xl), line-heights,
  letter-spacing; tabular-nums for numbers.
- **Radius, shadow/elevation, z-index scale, motion** (durations + easing curves),
  layout (sidebar width, header height, content max-width), breakpoints.
- Tokens enable themes + per-client branding by swapping a few variables.

## 6. Themes
- **Light / Dark / High-contrast** via `data-theme` on `<html>`; persist choice
  (localStorage + user profile). Use semantic tokens so components adapt with no
  per-component code. High-contrast targets WCAG AAA contrast for low-vision use.
- Per-client **branding**: override `--brand-*` + logo from the org settings.

## 7. States: loading / empty / error
- **Loading**: skeletons shaped like the real content (not spinners) for lists,
  cards, detail; instant perceived load.
- **Empty**: friendly illustration/icon + one-line explanation + primary CTA
  ("Crear primer contacto").
- **Error**: inline, specific, recoverable ("No se pudo guardar — reintentar");
  never a dead end. Handle offline gracefully.

## 8. Accessibility (WCAG AA)
- Full **keyboard navigation**; visible focus rings; logical tab order; skip-link.
- **Focus management** in modals/drawers (trap + restore); Esc to close.
- **ARIA**: roles/labels for tables, menus, dialogs, tabs, live regions for
  toasts and async updates. Label every input.
- **Contrast** ≥ 4.5:1 text; don't encode meaning in color alone (add icon/text).
- Respect **`prefers-reduced-motion`**; ≥ 44×44px touch targets.

## 9. Performance UX
- Paginate/virtualize big lists; `content-visibility:auto` for off-screen;
  lazy-load heavy modules/charts; index every query (no client full scans).
- Optimistic UI + skeletons for perceived speed; debounce search; cache reads.
- Detach Firestore listeners on unmount; avoid N+1 reads in lists (use snapshots).

## 10. CRM UI checklist
- [ ] App shell: search, quick-create, notifications, org switcher, Cmd+K.
- [ ] Dashboard, list, kanban, detail, inbox, calendar, reports, settings built.
- [ ] Inline edit + bulk actions + saved views + filters.
- [ ] Component library from tokens; light/dark/high-contrast themes; brandable.
- [ ] Loading skeletons, empty states, error states everywhere.
- [ ] WCAG AA: keyboard, focus, ARIA, contrast, reduced-motion.
- [ ] Big lists paginated/virtualized; queries indexed; listeners cleaned up.
- [ ] Mobile/responsive (PWA) with drawers and bottom-sheets.
