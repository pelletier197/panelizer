import type { Panel } from '../types/panel'
import type { Material } from './materials'
import type { Unit } from './units'
import { defaultMaterials, findMaterial } from './materials'

const STORAGE_KEY = 'wood3d.autosave'
const FORMAT = 'wood3d'
const VERSION = 1

/** A full design: panels, the materials they use, and the default unit. */
export interface Design {
  panels: Panel[]
  materials: Material[]
  unit: Unit
}

/** On-disk / on-wire shape. Kept flat and versioned so older files can be
 *  migrated if the schema changes. */
export interface DesignFile extends Design {
  format: typeof FORMAT
  version: number
}

export function serialize({ panels, materials, unit }: Design): DesignFile {
  return { format: FORMAT, version: VERSION, unit, materials, panels }
}

/** Parse and validate a design file, throwing on anything that isn't ours.
 *  Older files without a materials list get the default material, and any
 *  panel pointing at a missing material falls back to a valid one. Panel
 *  thickness is preserved as-is (it's a panel property, not the material's). */
export function parse(json: string): Design {
  const data = JSON.parse(json) as Partial<DesignFile>
  if (data.format !== FORMAT || !Array.isArray(data.panels)) {
    throw new Error('This file is not a valid Wood3D design.')
  }

  const materials =
    Array.isArray(data.materials) && data.materials.length > 0
      ? data.materials
      : defaultMaterials()

  const panels = data.panels.map((p) => ({
    ...p,
    materialId: findMaterial(materials, p.materialId).id,
  }))

  return { panels, materials, unit: data.unit ?? 'mm' }
}

/** Trigger a browser download of the design as a `.wood3d.json` file. */
export function downloadDesign(design: Design, filename = 'cabinet.wood3d.json'): void {
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
  const empty: Design = { panels: [], materials: defaultMaterials(), unit: 'mm' }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parse(raw) : empty
  } catch {
    return empty
  }
}
