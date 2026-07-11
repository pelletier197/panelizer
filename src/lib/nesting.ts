import type { Panel } from '../types/panel'
import type { Material } from './materials'
import type { Stock } from './stock'
import { findMaterial } from './materials'

/** One part placed on a sheet. Coordinates are mm from the sheet's top-left
 *  corner (margin already included); `w`/`h` are the footprint on the sheet. */
export interface Placement {
  panelId: string
  name: string
  x: number
  y: number
  w: number
  h: number
  /** True if the part is turned 90° from its as-drawn orientation. */
  rotated: boolean
}

/** One physical sheet with the parts packed onto it. Sheets in a group may be
 *  different sizes (a full sheet, an offcut, …), so each carries its own size. */
export interface SheetLayout {
  index: number // 1-based within its group
  length: number
  width: number
  placements: Placement[]
  /** Sum of placed part areas (mm²) — used vs the sheet area for waste. */
  usedArea: number
}

/** All sheets cut for one material + thickness (possibly from several stock
 *  sizes). */
export interface StockGroup {
  key: string
  materialName: string
  color: string
  thickness: number
  sheets: SheetLayout[]
}

export interface UnplacedPart {
  panelId: string
  name: string
  /** `no-stock`: no sheet of this material + thickness exists at all.
   *  `too-big`: larger than every sheet of this material + thickness.
   *  `no-space`: would fit, but the available sheet quantity ran out. */
  reason: 'no-stock' | 'too-big' | 'no-space'
  /** The material + thickness the part needs — so the UI can offer to add
   *  matching stock in one click. */
  materialId: string
  materialName: string
  thickness: number
}

export interface CutlistResult {
  groups: StockGroup[]
  unplaced: UnplacedPart[]
}

interface Footprint {
  w: number
  h: number
  rotated: boolean
}

/** The footprint orientations a part may take on the sheet. Sheet grain runs
 *  along the sheet length (X). A grained part must keep its grain edge along X,
 *  so it has one orientation; a grain-free part can also turn 90°. */
function footprints(panel: Panel): Footprint[] {
  const { length: l, width: w, grain } = panel
  if (grain === 'length') return [{ w: l, h: w, rotated: false }]
  if (grain === 'width') return [{ w: w, h: l, rotated: true }]
  return [
    { w: l, h: w, rotated: false },
    { w: w, h: l, rotated: true },
  ]
}

/** Whether a part fits an empty usable area in at least one allowed orientation. */
function fitsUsable(panel: Panel, uL: number, uW: number): boolean {
  return footprints(panel).some((f) => f.w <= uL && f.h <= uW)
}

// ---- MaxRects bin packer -------------------------------------------------
//
// Each sheet is a bin whose empty space is tracked as a set of maximal free
// rectangles. A part is placed in the free rect with the tightest fit (best
// short-side leftover), then every free rect it overlaps is split into the
// sub-rectangles that remain, and rectangles fully contained in another are
// pruned. This reclaims the space a shelf packer wastes below short parts.
//
// Kerf (saw width) is handled by reserving `part + kerf` on the right/bottom of
// each placement, and giving the bin an extra `kerf` of usable space, so parts
// keep a blade gap between them while still sitting flush to the margins.

interface FreeRect {
  x: number
  y: number
  w: number
  h: number
}

interface Bin {
  length: number
  width: number
  free: FreeRect[]
  placements: Placement[]
  usedArea: number
}

const area = (l: number, w: number) => l * w

/** `a` fully contains `b`. */
function contains(a: FreeRect, b: FreeRect): boolean {
  return a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h
}

/** The parts of `free` left uncovered after `used` is placed over it (up to 4
 *  rectangles). If they don't overlap, `free` is returned unchanged. */
function splitFree(free: FreeRect, used: FreeRect): FreeRect[] {
  const noOverlap =
    used.x >= free.x + free.w ||
    used.x + used.w <= free.x ||
    used.y >= free.y + free.h ||
    used.y + used.h <= free.y
  if (noOverlap) return [free]

  const pieces: FreeRect[] = []
  if (used.y > free.y) pieces.push({ x: free.x, y: free.y, w: free.w, h: used.y - free.y })
  if (used.y + used.h < free.y + free.h)
    pieces.push({ x: free.x, y: used.y + used.h, w: free.w, h: free.y + free.h - (used.y + used.h) })
  if (used.x > free.x) pieces.push({ x: free.x, y: free.y, w: used.x - free.x, h: free.h })
  if (used.x + used.w < free.x + free.w)
    pieces.push({ x: used.x + used.w, y: free.y, w: free.x + free.w - (used.x + used.w), h: free.h })
  return pieces
}

/** Place a part in a bin using best-short-side-fit. Returns true if it fit. */
function placeInBin(bin: Bin, panel: Panel, kerf: number, margin: number): boolean {
  let best:
    | { score1: number; score2: number; x: number; y: number; rw: number; rh: number; w: number; h: number; rotated: boolean }
    | null = null

  for (const f of footprints(panel)) {
    const rw = f.w + kerf // reserved footprint (leaves a saw gap on right/bottom)
    const rh = f.h + kerf
    for (const fr of bin.free) {
      if (rw > fr.w || rh > fr.h) continue
      const leftoverW = fr.w - rw
      const leftoverH = fr.h - rh
      const score1 = Math.min(leftoverW, leftoverH) // best short-side fit
      const score2 = Math.max(leftoverW, leftoverH)
      if (!best || score1 < best.score1 || (score1 === best.score1 && score2 < best.score2)) {
        best = { score1, score2, x: fr.x, y: fr.y, rw, rh, w: f.w, h: f.h, rotated: f.rotated }
      }
    }
  }

  if (!best) return false

  const used: FreeRect = { x: best.x, y: best.y, w: best.rw, h: best.rh }
  bin.free = bin.free.flatMap((fr) => splitFree(fr, used))
  bin.free = bin.free.filter((r, i) => !bin.free.some((o, j) => j !== i && contains(o, r)))
  bin.placements.push({
    panelId: panel.id,
    name: panel.name,
    x: margin + best.x,
    y: margin + best.y,
    w: best.w,
    h: best.h,
    rotated: best.rotated,
  })
  bin.usedArea += panel.length * panel.width
  return true
}

/** Stock inventory entry: one stock size and how many sheets remain to open. */
interface Slot {
  stock: Stock
  uL: number
  uW: number
  remaining: number // Infinity when the stock quantity is unlimited (null)
}

/** Stock matches a group's thickness within this tolerance (mm). Exact float
 *  equality is too brittle across unit rounding: an "11/16" sheet (17.4625) and
 *  an 18 mm panel look identical to the user and should nest together, so the
 *  tolerance spans that ~0.54 mm gap — but stays under the ~1.05 mm gap to the
 *  next real thickness (3/4" = 19.05 mm) so distinct stock isn't merged. */
const THICKNESS_TOL = 0.8

/**
 * Nest the design's panels onto the available stock. Panels are grouped by
 * material + thickness and packed onto stock of the same material + thickness,
 * honouring kerf (gap between parts) and margin (clear border).
 *
 * All matching stock sizes are used, not just the first: parts fill already-open
 * sheets when they can, and when a new sheet is needed the **smallest** stock
 * that fits is opened (using up offcuts first and trimming waste). Stock
 * quantities are respected — the packer never invents sheets beyond what's
 * available; parts that then can't be placed are reported as unplaced:
 *  - `no-stock`  — no matching sheet exists,
 *  - `too-big`   — larger than every matching sheet,
 *  - `no-space`  — would fit, but the sheet quantity ran out.
 *
 * Per sheet the packer is MaxRects (best-short-side-fit) with first-fit-
 * decreasing input order — a good waste/scrap trade-off without a full solver.
 */
export function generateCutlist(
  panels: Panel[],
  materials: Material[],
  stocks: Stock[],
  kerf: number,
  margin: number,
): CutlistResult {
  const groups: StockGroup[] = []
  const unplaced: UnplacedPart[] = []

  // Group panels by material + thickness (the identity of a stock).
  const byKey = new Map<string, Panel[]>()
  for (const panel of panels) {
    const key = `${panel.materialId}@${panel.thickness}`
    const list = byKey.get(key)
    if (list) list.push(panel)
    else byKey.set(key, [panel])
  }

  for (const [key, groupPanels] of byKey) {
    const [materialId, thicknessStr] = key.split('@')
    const thickness = Number(thicknessStr)
    const material = findMaterial(materials, materialId)
    const matching = stocks.filter(
      (s) => s.materialId === materialId && Math.abs(s.thickness - thickness) < THICKNESS_TOL,
    )

    const unfit = (panel: Panel, reason: UnplacedPart['reason']) =>
      unplaced.push({ panelId: panel.id, name: panel.name, reason, materialId, materialName: material.name, thickness })

    if (matching.length === 0) {
      for (const p of groupPanels) unfit(p, 'no-stock')
      continue
    }

    // Inventory, smallest sheet first — so offcuts / small sheets are opened
    // before full sheets, and a new sheet is always the smallest that fits.
    const inventory: Slot[] = matching
      .map((stock) => ({
        stock,
        uL: stock.length - 2 * margin,
        uW: stock.width - 2 * margin,
        remaining: stock.quantity == null ? Infinity : stock.quantity,
      }))
      .sort((a, b) => area(a.stock.length, a.stock.width) - area(b.stock.length, b.stock.width))

    const fitsAnyStock = (panel: Panel) => inventory.some((s) => fitsUsable(panel, s.uL, s.uW))

    // First-fit-decreasing: tackle the biggest parts first.
    const sorted = [...groupPanels].sort(
      (a, b) => Math.max(b.length, b.width) - Math.max(a.length, a.width),
    )

    const bins: Bin[] = []
    for (const panel of sorted) {
      if (!fitsAnyStock(panel)) {
        unfit(panel, 'too-big')
        continue
      }

      // Try existing open sheets, smallest first (fill offcuts before big ones).
      const openSmallestFirst = [...bins].sort((a, b) => area(a.length, a.width) - area(b.length, b.width))
      let placed = false
      for (const bin of openSmallestFirst) {
        if (placeInBin(bin, panel, kerf, margin)) {
          placed = true
          break
        }
      }
      if (placed) continue

      // Open a new sheet: the smallest available stock that fits this part.
      const slot = inventory.find((s) => s.remaining > 0 && fitsUsable(panel, s.uL, s.uW))
      if (!slot) {
        unfit(panel, 'no-space') // fits a stock size, but the quantity ran out
        continue
      }
      slot.remaining -= 1
      const bin: Bin = {
        length: slot.stock.length,
        width: slot.stock.width,
        // Bin gets one extra kerf so a part reserved as (size + kerf) still sits
        // flush to the far margin.
        free: [{ x: 0, y: 0, w: slot.uL + kerf, h: slot.uW + kerf }],
        placements: [],
        usedArea: 0,
      }
      placeInBin(bin, panel, kerf, margin)
      bins.push(bin)
    }

    groups.push({
      key,
      materialName: material.name,
      color: material.color,
      thickness,
      sheets: bins.map((b, i) => ({
        index: i + 1,
        length: b.length,
        width: b.width,
        placements: b.placements,
        usedArea: b.usedArea,
      })),
    })
  }

  return { groups, unplaced }
}
