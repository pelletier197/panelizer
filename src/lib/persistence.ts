import type { Panel } from '../types/panel'
import { defaultGrain } from '../types/panel'
import type { Material } from './materials'
import type { Stock } from './stock'
import type { Unit } from './units'
import { DEFAULT_PRECISION } from './units'
import { defaultMaterials, findMaterial } from './materials'

const STORAGE_KEY = 'panelizer.autosave'
const FORMAT = 'panelizer'
const VERSION = 1

/** Default saw kerf and sheet trim margin (mm), used for cutlist nesting. */
export const DEFAULT_KERF = 3
export const DEFAULT_MARGIN = 10

/** A full design: panels, the materials they use, the sheet-good stock to nest
 *  them onto, cutlist settings, and the default display unit. */
export interface Design {
  panels: Panel[]
  materials: Material[]
  stocks: Stock[]
  unit: Unit
  /** Imperial working precision (fraction denominator, e.g. 16 = 1/16"). */
  precision: number
  /** Saw blade width (mm) left between adjacent parts when nesting. */
  kerf: number
  /** Trim margin (mm) kept clear around the edge of each sheet. */
  margin: number
}

/** On-disk / on-wire shape. Kept flat and versioned so older files can be
 *  migrated if the schema changes. */
export interface DesignFile extends Design {
  format: typeof FORMAT
  version: number
}

export function serialize({ panels, materials, stocks, unit, precision, kerf, margin }: Design): DesignFile {
  return { format: FORMAT, version: VERSION, unit, precision, kerf, margin, materials, stocks, panels }
}

/** Parse a design file by its shape, not a format tag: as long as it has a
 *  panels array we try to load it (so files from any past version / name import
 *  fine). Missing materials fall back to the default; a panel pointing at a
 *  missing material is remapped to a valid one; later-added fields (grain,
 *  stocks, precision, kerf, margin) are back-filled. Panel thickness is
 *  preserved as-is (it's a panel property, not the material's). Throws only when
 *  the JSON is unreadable or has no panels array. */
export function parse(json: string): Design {
  const data = JSON.parse(json) as Partial<DesignFile>
  if (!Array.isArray(data.panels)) {
    throw new Error('This file is not a valid Panelizer design.')
  }

  const materials =
    Array.isArray(data.materials) && data.materials.length > 0
      ? data.materials
      : defaultMaterials()

  const panels = data.panels.map((p) => ({
    ...p,
    materialId: findMaterial(materials, p.materialId).id,
    grain: p.grain ?? defaultGrain(p.length, p.width),
  }))

  return {
    panels,
    materials,
    stocks: Array.isArray(data.stocks) ? data.stocks : [],
    unit: data.unit ?? 'mm',
    precision: data.precision ?? DEFAULT_PRECISION,
    kerf: data.kerf ?? DEFAULT_KERF,
    margin: data.margin ?? DEFAULT_MARGIN,
  }
}

/** Trigger a browser download of the design as a `.panelizer.json` file. */
export function downloadDesign(design: Design, filename = 'cabinet.panelizer.json'): void {
  const json = JSON.stringify(serialize(design), null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function saveToStorage(design: Design): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(design)))
  } catch {
    // Storage full or unavailable — autosave is best-effort, so ignore.
  }
}

export function loadFromStorage(): Design {
  const empty: Design = {
    panels: [],
    materials: defaultMaterials(),
    stocks: [],
    unit: 'mm',
    precision: DEFAULT_PRECISION,
    kerf: DEFAULT_KERF,
    margin: DEFAULT_MARGIN,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parse(raw) : empty
  } catch {
    return empty
  }
}
