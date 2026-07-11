import type { Panel } from '../types/panel'
import { defaultGrain } from '../types/panel'
import { DEFAULT_MATERIAL } from './materials'
import { isImperial, toMm, type Unit } from './units'

/** Default thickness for a new panel (mm). Freely editable per panel. */
export const DEFAULT_THICKNESS = 18

/** Standard panel thickness for the document unit: a clean 3/4" in imperial,
 *  18 mm in metric — so a fresh panel reads as a real stock thickness, not an
 *  odd rounding like 11/16". */
export function defaultThickness(unit: Unit): number {
  return isImperial(unit) ? toMm(0.75, 'inch') : DEFAULT_THICKNESS
}

/** Standard thin-stock thickness (backs, drawer bottoms): 1/4" or 6 mm. */
export function defaultThinThickness(unit: Unit): number {
  return isImperial(unit) ? toMm(0.25, 'inch') : 6
}

/** Build a panel with sensible defaults, applying any overrides. The generated
 *  `id` is always fresh and cannot be overridden, so this is also safe to use
 *  when cloning from an existing panel's fields. Grain defaults to the longer
 *  edge unless the overrides set it explicitly. */
export function createPanel(overrides: Partial<Panel> = {}): Panel {
  const base: Panel = {
    id: crypto.randomUUID(),
    name: 'Panel',
    normal: 'z',
    length: 600,
    width: 400,
    thickness: DEFAULT_THICKNESS,
    position: [0, 0, 0],
    materialId: DEFAULT_MATERIAL.id,
    grain: 'length',
  }
  const merged = { ...base, ...overrides, id: base.id }
  if (overrides.grain === undefined) merged.grain = defaultGrain(merged.length, merged.width)
  return merged
}
