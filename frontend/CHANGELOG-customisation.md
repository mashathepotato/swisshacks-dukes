# Dashboard customisation — brainstorm, plan & changelog

Branch: `feat/customisation` (off `feat/copilot-prototype`).
Goal: **each RM can tailor the dashboard to their liking, and it persists for them.**

---

## Brainstorm

Customisation surfaces an RM would actually want:

1. **Reorder the top navigation** — drag the tab buttons into the order that fits their workflow. *(requested)*
2. **Rearrange the client page** — drag sections to reorder, and resize each (width + height). *(requested)*
3. **Density / spacing** — a comfortable vs compact toggle for the whole UI. *(requested: "spacing of elements")*
4. **Hide sections** — drop panels an RM never uses; re-add from a tray. *(bonus — part of "to their liking")*
5. **Customise mode** — one toggle reveals all the edit handles (drag grips, resize handles, size/hide controls) so day-to-day use stays clean.
6. **Reset** — per-area + global reset to the defaults.

**Persistence:** a `customizeStore` (React context + `localStorage`), mirroring the existing `doneStore` / `learningStore` patterns → settings survive refresh, per browser (≈ per RM in this demo).

**Implementation stance — keep it dependency-light (the prototype has no UI libs):**
- **Drag reorder:** native HTML5 drag-and-drop (`draggable` + `onDragStart/Over/Drop`). No library.
- **Resize:** width via a span toggle (half / full in a 2-track grid); height via native CSS `resize: vertical`, captured on release and persisted.
- **Density:** a class on the app root toggling paddings.

**Deliberately NOT doing (so we don't overdo it):** no free-form pixel canvas, no per-widget theming, no multiple saved dashboard profiles, no drag-to-arbitrary-position. A two-track reorderable+resizable grid covers "rearrangeable & resizable" cleanly.

## Plan (slices)

- **Slice 1:** `customizeStore` + a "⚙ Customise" mode toggle + drag-to-reorder nav tabs + density toggle.
- **Slice 2:** Client page → section registry; drag-reorder + width (span) control + reset.
- **Slice 3:** per-section height resize (persisted) + hide/show (with a hidden-sections tray).
- **Slice 4:** polish, accessibility, finalise this changelog.

Each slice: `tsc` + `lint` clean, then commit.

---

## Changelog (chronological — what changed and why)

_(appended as work proceeds)_

### Slice 1 — store + nav reorder + density + customise mode
- **`src/lib/customize.ts`** *(new)* — shared types (`Density`, `ClientSection`), defaults (`DEFAULT_TAB_ORDER`, `DEFAULT_CLIENT_LAYOUT`), and helpers (`moveBefore`, `reconcileTabs`, `reconcileLayout`). Plain module so the store can keep fast-refresh-clean.
- **`src/lib/customizeStore.tsx`** *(new)* — `CustomizeProvider` + `useCustomize()`. Holds: `customising` (session toggle), `tabOrder`, `density`, `clientLayout`; actions to reorder tabs/sections, set span/height, toggle-hide, and reset. Persists tab order, layout, and density to `localStorage` (`dukes.tabOrder` / `dukes.clientLayout` / `dukes.density`); reconciles stored values against the canonical set on load.
- **`src/main.tsx`** — wrapped the app in `<CustomizeProvider>`.
- **`src/App.tsx`** — topbar now renders tabs from `tabOrder`; in customise mode each tab is `draggable` (native HTML5 DnD) to reorder, with a ⠿ grip. Added a **⚙ Customise** toggle and a **density** (Comfortable/Compact) toggle to the topbar, a customise-mode hint bar, and the `density-*` class on both the main app and the full-client-page wrapper.
- **`src/index.css`** — styles for the topbar actions, draggable/dragging tabs, the hint bar, and a set of `.density-compact …` overrides that tighten padding/margins/gaps across panels, cards, rows and grids.

### Slices 2 & 3 — client page: reorder, resize, hide
- **`src/components/ClientPage.tsx`** — refactored the fixed two-column layout into a **section registry** driven by `clientLayout` from the store:
  - Extracted the page body into named sections — `reasoning`, `value`, `profile`, `signals`, `learning`, `recommendations`, `compliance`, `draft` — via a `sectionContent(id, client)` switch (the existing sub-components are reused untouched). `SECTION_TITLE` (panel labels) and `SECTION_HAS` (per-client content predicates so empty panels never show) added.
  - New local **`Section`** component renders each panel as a card. In customise mode it shows a ⠿ drag-header (native HTML5 DnD reorder), a **width** toggle (↔ half / full — a 1- or 2-column grid span), a **height** handle (native CSS `resize: vertical`, captured on release and **persisted**, with an "↕ Auto" reset), and a **✕ hide** button. Non-customise mode shows the panel clean (no chrome) and respects any saved height.
  - Header bar gained **⚙ Customise**, **density**, and (in customise mode) **↺ Reset layout** controls. A **hidden-panels tray** lets the RM re-add anything they've hidden. A customise-mode hint explains the gestures.
  - Reworked the page into a single `.cp-grid` (2-track grid, `auto-flow: dense`) instead of two `.cp-col` stacks.
- **`src/index.css`** — styles for `.cp-section` cards, the section drag-bar + controls, the resizable body, the hidden-panels tray, the bar actions, reset button, and the rehearse CTA. Responsive: collapses to one column under 980px.

### Slice 4 — polish
- **`src/App.tsx`** — added a **↺ Tabs** reset (resets nav order) shown in the topbar while customising.

---

## How to use (for review)

1. Click **⚙ Customise** (top-right). A hint bar appears and edit handles turn on.
2. **Top nav:** drag any tab (⠿ grip) left/right to reorder. **↺ Tabs** resets it.
3. **Density:** the **▦ Comfortable / ⊟ Compact** button tightens spacing across the whole UI.
4. **Client page:** open any client → each panel now has a ⠿ drag-header. Drag to reorder, **↔** to switch half/full width, drag a panel's **bottom edge** to resize its height, **✕** to hide. Hidden panels collect in a tray to re-add. **↺ Reset layout** restores defaults.
5. Click **⚙ Done** to exit. Everything is saved to `localStorage` and restored on refresh (per browser ≈ per RM).

## Verification
- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run lint` — clean (one pre-existing `exhaustive-deps` warning in the now-unused `BookSimulator.tsx`, unrelated).
- Dev server HMR healthy; app serves.

## Deliberately left (kept scope tight)
- No drag-to-arbitrary-pixel canvas / no external grid library (native DnD + CSS only).
- Keyboard reordering isn't wired (native HTML5 DnD is mouse/touch); tabs remain keyboard-focusable for navigation.
- Per-RM identity is the browser (single demo RM); no server-side profiles.
- `BookSimulator.tsx` is still dead code from an earlier change — left untouched here.
