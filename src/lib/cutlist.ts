import type { Panel } from '../types/panel'
import type { Material } from './materials'
import { findMaterial } from './materials'
import { formatMeasurement, UNIT_SUFFIX, type Unit } from './units'

/** One line of the cutlist: a group of identical parts and how many are needed. */
export interface CutlistRow {
  length: number
  width: number
  thickness: number
  material: string
  color: string
  quantity: number
  parts: string[]
  /** Ids of the panels in this group, so a row can select them in the scene. */
  ids: string[]
}

/** Group panels that share the same size and material into countable rows.
 *  Sizes are exactly as drawn — the size you set is the size you cut. Face
 *  dimensions are normalised (longest side first) so a 600x400 and a 400x600
 *  panel are recognised as the same part. */
export function buildCutlist(panels: Panel[], materials: Material[]): CutlistRow[] {
  const rows = new Map<string, CutlistRow>()

  for (const panel of panels) {
    const [length, width] = [panel.length, panel.width].sort((a, b) => b - a)
    const material = findMaterial(materials, panel.materialId)
    const key = `${length}x${width}x${panel.thickness}@${material.id}`

    const row = rows.get(key)
    if (row) {
      row.quantity += 1
      row.parts.push(panel.name)
      row.ids.push(panel.id)
    } else {
      rows.set(key, {
        length,
        width,
        thickness: panel.thickness,
        material: material.name,
        color: material.color,
        quantity: 1,
        parts: [panel.name],
        ids: [panel.id],
      })
    }
  }

  return [...rows.values()].sort(
    (a, b) => b.length - a.length || b.width - a.width || b.thickness - a.thickness,
  )
}

/** Render the cutlist as CSV text (dimensions in `unit`), ready to paste into a
 *  spreadsheet. Inch fractions are quoted so the "/" survives the CSV. */
export function cutlistToCsv(rows: CutlistRow[], unit: Unit): string {
  const u = UNIT_SUFFIX[unit]
  const header = ['Qty', `Length (${u})`, `Width (${u})`, `Thickness (${u})`, 'Material']
  const lines = rows.map((r) =>
    [
      r.quantity,
      `"${formatMeasurement(r.length, unit)}"`,
      `"${formatMeasurement(r.width, unit)}"`,
      `"${formatMeasurement(r.thickness, unit)}"`,
      r.material,
    ].join(','),
  )
  return [header.join(','), ...lines].join('\n')
}
