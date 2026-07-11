/**
 * A sheet-good stock item — the raw sheets parts are cut from. Stock is keyed
 * by material **and** thickness, the way a shop stocks it: "Plywood 18 mm" is a
 * different stock than "Melamine 18 mm" or "Plywood 12 mm". Grain runs along
 * the sheet's `length`.
 */
export interface Stock {
  id: string
  materialId: string
  thickness: number // mm
  length: number // mm — grain runs along this edge
  width: number // mm
  /** Sheets available. `null` means unlimited (buy as many as needed). */
  quantity: number | null
}

import { isImperial, toMm, type Unit } from './units'
import { defaultThickness } from './panel'

/** A full sheet in the document's unit: a clean 96" × 48" in imperial, or
 *  2440 × 1220 mm in metric (both the common 8' × 4' sheet, just rounded to
 *  whichever system the user is working in). Thickness defaults to standard
 *  stock unless given. */
export function createStock(materialId: string, thickness?: number, unit: Unit = 'mm'): Stock {
  return {
    id: crypto.randomUUID(),
    materialId,
    thickness: thickness ?? defaultThickness(unit),
    length: isImperial(unit) ? toMm(96, 'inch') : 2440,
    width: isImperial(unit) ? toMm(48, 'inch') : 1220,
    quantity: null,
  }
}
