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

/** One physical sheet with the parts packed onto it. */
export interface SheetLayout {
  index: number // 1-based within its group
  length: number
  width: number
  placements: Placement[]
  /** Sum of placed part areas (mm²) — used vs the full sheet area for waste. */
  usedArea: number
}

/** All sheets for one material + thickness, cut from one stock size. */
export interface StockGroup {
  key: string
  materialName: string
  color: string
  thickness: number
  sheetLength: number
  sheetWidth: number
  sheets: SheetLayout[]
  quantity: number | null
  /** True when more sheets are needed than the stock quantity allows. */
  short: boolean
}

export interface UnplacedPart {
  panelId: string
  name: string
  reason: 'no-stock' | 'too-big'
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

interface Shelf {
  y: number // top of the shelf within the usable area
  height: number
  cursorX: number // next free x within the usable area
}

interface Sheet {
  shelves: Shelf[]
  usedHeight: number // total shelf heights + kerf gaps
  placements: Placement[]
  usedArea: number
}

/** Try to place one part on a sheet using a shelf/strip packer. Returns true if
 *  it fit. `uL`/`uW` are the usable dimensions (sheet minus margins). */
function placeOnSheet(sheet: Sheet, panel: Panel, uL: number, uW: number, kerf: number, margin: number): boolean {
  for (const f of footprints(panel)) {
    if (f.w > uL || f.h > uW) continue // can't fit this orientation at all

    // 1) An existing shelf tall enough with room to its right.
    for (const shelf of sheet.shelves) {
      const gap = shelf.cursorX === 0 ? 0 : kerf
      if (f.h <= shelf.height && shelf.cursorX + gap + f.w <= uL) {
        const x = margin + shelf.cursorX + gap
        sheet.placements.push({ panelId: panel.id, name: panel.name, x, y: margin + shelf.y, w: f.w, h: f.h, rotated: f.rotated })
        shelf.cursorX += gap + f.w
        sheet.usedArea += panel.length * panel.width
        return true
      }
    }

    // 2) A new shelf below the existing ones.
    const gap = sheet.shelves.length === 0 ? 0 : kerf
    const y = sheet.usedHeight + gap
    if (y + f.h <= uW) {
      sheet.shelves.push({ y, height: f.h, cursorX: f.w })
      sheet.usedHeight = y + f.h
      sheet.placements.push({ panelId: panel.id, name: panel.name, x: margin, y: margin + y, w: f.w, h: f.h, rotated: f.rotated })
      sheet.usedArea += panel.length * panel.width
      return true
    }
  }
  return false
}

/** Whether a part fits on an empty sheet in at least one allowed orientation. */
function fitsStock(panel: Panel, uL: number, uW: number): boolean {
  return footprints(panel).some((f) => f.w <= uL && f.h <= uW)
}

/**
 * Nest the design's panels onto the available stock. Panels are grouped by
 * material + thickness and packed onto stock of the same material + thickness,
 * honouring kerf (gap between parts) and margin (clear border). Parts with no
 * matching stock, or too big for it, are reported as unplaced.
 *
 * The packer is a shelf/strip heuristic (first-fit-decreasing by longest edge)
 * — fast and good enough to see the layout; a tighter algorithm can drop in
 * behind this same signature later.
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
    const stock = stocks.find((s) => s.materialId === materialId && s.thickness === thickness)

    if (!stock) {
      for (const p of groupPanels) {
        unplaced.push({ panelId: p.id, name: p.name, reason: 'no-stock', materialId, materialName: material.name, thickness })
      }
      continue
    }

    const uL = stock.length - 2 * margin
    const uW = stock.width - 2 * margin

    // First-fit-decreasing: tackle the biggest parts first.
    const sorted = [...groupPanels].sort(
      (a, b) => Math.max(b.length, b.width) - Math.max(a.length, a.width),
    )

    const sheets: Sheet[] = []
    for (const panel of sorted) {
      if (!fitsStock(panel, uL, uW)) {
        unplaced.push({ panelId: panel.id, name: panel.name, reason: 'too-big', materialId, materialName: material.name, thickness })
        continue
      }
      let placed = false
      for (const sheet of sheets) {
        if (placeOnSheet(sheet, panel, uL, uW, kerf, margin)) {
          placed = true
          break
        }
      }
      if (!placed) {
        const sheet: Sheet = { shelves: [], usedHeight: 0, placements: [], usedArea: 0 }
        placeOnSheet(sheet, panel, uL, uW, kerf, margin)
        sheets.push(sheet)
      }
    }

    groups.push({
      key,
      materialName: material.name,
      color: material.color,
      thickness,
      sheetLength: stock.length,
      sheetWidth: stock.width,
      quantity: stock.quantity,
      short: stock.quantity !== null && sheets.length > stock.quantity,
      sheets: sheets.map((s, i) => ({
        index: i + 1,
        length: stock.length,
        width: stock.width,
        placements: s.placements,
        usedArea: s.usedArea,
      })),
    })
  }

  return { groups, unplaced }
}
