import type { Panel } from '../types/panel'
import { axisField, panelBoxSize } from './geometry'

type Vec3 = [number, number, number]

const MIN_SIZE_MM = 1

export interface ResizeResult {
  field: 'length' | 'width'
  value: number
  position: Vec3
}

/**
 * Resize a panel along one world axis by moving one of its faces.
 *
 * `faceSign` says which face moved (+axis side or -axis side); `delta` is how
 * far that face's coordinate moved, in mm. Holding the opposite face fixed,
 * the centre always shifts by `delta / 2` and the size changes by
 * `delta * faceSign`, regardless of which side moved — solving
 * `newCentre + faceSign*newHalf = centre + faceSign*half + delta` (dragged
 * face) together with `newCentre - faceSign*newHalf = centre - faceSign*half`
 * (fixed opposite face) gives both results directly.
 *
 * `symmetric` mirrors the movement onto the opposite face too, so the centre
 * doesn't move and the size changes by `2 * delta * faceSign`.
 *
 * Returns `null` when `axis` is the panel's thickness axis — thickness is
 * locked everywhere in the viewport.
 */
export function resizeAlongAxis(
  panel: Panel,
  axis: 0 | 1 | 2,
  faceSign: 1 | -1,
  delta: number,
  symmetric = false,
): ResizeResult | null {
  const field = axisField(panel.normal, axis)
  if (field === 'thickness') return null

  const size = panelBoxSize(panel)[axis]
  const value = Math.max(MIN_SIZE_MM, size + delta * faceSign * (symmetric ? 2 : 1))

  const position: Vec3 = [...panel.position]
  if (!symmetric) position[axis] += delta / 2

  return { field, value, position }
}
