# Wood3D

A browser-based 3D designer for plywood cabinets. Sketch rectangular carcasses
from panels, resize them freely (thickness stays locked), and generate a cutlist
— all client-side, no backend. Designs export to a `.json` file and re-import,
so the whole thing can be hosted as a static site.

## Getting started

```bash
npm install
npm run dev      # dev server on http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

Deploy by publishing the `dist/` folder to any static host (GitHub Pages,
Netlify, S3, …).

## How it works

The design is a plain list of **panels** held in one store. Everything else —
the 3D scene and the cutlist — is a *derived view* of that list, never a second
source of truth. Get the data model right and the rest follows.

A `Panel` is a rectangular piece described by a face (`length` × `width`) and a
`thickness` running along its `normal` axis. Thickness is the one dimension you
cannot change by dragging in the viewport; it is edited in the properties panel
and follows the chosen material. All measurements are stored in millimetres; the
scene is rendered in metres (see `MM_TO_M`).

### Units

Storage is always millimetres — units are only about entry and display
(`lib/units.ts`). A design has one default unit (mm / cm / inch, saved in the
file), used for bare numbers and as the starting display unit. Any field accepts
an explicit unit though — `24.5 in`, `3/4"`, `23 3/4`, `2.5cm`, `5 ft` — and
remembers it, so you can have thickness in mm next to a width in inches.
Inches display as shop-friendly fractions to the nearest 1/16".

### Project layout

```
src/
  types/panel.ts          Panel domain type
  lib/
    materials.ts          Sheet-good materials (name, thickness, colour)
    geometry.ts           mm to m scale + panel -> world-box-size mapping
    panel.ts              createPanel() factory with defaults
    cutlist.ts            Derive & group the cutlist; CSV export
    persistence.ts        Serialize / parse / download / autosave
  store/designStore.ts    Zustand store — the single source of truth
  components/
    viewport/             R3F canvas, scene, per-panel mesh + move gizmo
    panels/               Toolbar, properties editor, cutlist table
    ui/                    Reusable form controls
```

## Status

**Phase 1 — core loop (done).** Add / select / move / resize / delete panels,
edit properties, live cutlist, JSON export & import, localStorage autosave.
Customizable materials (name + colour; thickness is per-panel) — panels
reference a material, the cutlist groups by it.

**Phase 2 — assembly-aware (in progress).** Helping panels fit together while
keeping the rule that **the size you set is the size you cut** — panels are
never auto-resized.

1. **Snapping (done).** Dragging a panel magnetically aligns it to its
   neighbours' faces, edges, and centres, and butts panels together
   (`lib/snapping.ts`). Alignment logic is pure and unit-testable.
2. **Overlap highlights (done).** Panels keep their drawn size in 3D; wherever
   two panels share space, a translucent teal marker shows the joint region
   (`lib/overlaps.ts`), tracking panels live as they drag. Purely referential —
   it flags where a joint lives (butt by default; a miter/dovetail is the
   builder's choice). The cutlist always reports the drawn size.
3. **Viewport tools (done).** A tool switch in the toolbar (`Move` / `Snap
   point` / `Measure`). Snap-point picks a corner on one panel then a corner on
   another and translates the first so they coincide. Measure picks two corners
   and shows a line + distance label. Corners come from the pure `lib/corners.ts`.

### Ideas for later

- **Panel rotation**: add a real rotation to `Panel` (beyond the discrete
  thickness-axis) plus a rotate gizmo. Cut dimensions are unaffected. To avoid
  reworking the axis-aligned assumptions, rotated panels opt out of magnetic
  snapping and joint auto-capture (they use their as-drawn size).
- **Drag-to-resize handles**: resize a panel's length/width by dragging faces in
  the 3D view (today resizing is via the numeric fields). Thickness stays locked.
- **Point-to-point resize**: pick an edge/face of a panel then a target point,
  and resize that dimension so the panel fits between the two (e.g. make a shelf
  span an opening). Corner-tool cousin of drag-resize; thickness stays locked.
- **Bundle code-splitting**: the build is a single ~1.16 MB chunk (mostly
  Three.js). Fine for now; lazy-load / split if first-load matters.
