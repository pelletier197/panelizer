import type { Panel } from '../types/panel'
import { panelBoxSize } from './geometry'

/** How close (mm) a panel must be to a snap target before it magnetically
 *  jumps to it while dragging. */
export const SNAP_THRESHOLD_MM = 15

/** Axis-aligned bounding box of a panel, in millimetres. */
export interface Bounds {
  min: [number, number, number]
  max: [number, number, number]
}

export function panelBounds(panel: Panel, position = panel.position): Bounds {
  const size = panelBoxSize(panel)
  return {
    min: [0, 1, 2].map((i) => position[i] - size[i] / 2) as [number, number, number],
    max: [0, 1, 2].map((i) => position[i] + size[i] / 2) as [number, number, number],
  }
}

/**
 * Magnetically snap a dragged panel to its neighbours.
 *
 * Each axis is considered independently. For every neighbour we look for two
 * kinds of relationship and keep the closest one within `threshold` mm:
 *
 *  - **alignment** — the panels' matching faces or centres line up (min↔min,
 *    centre↔centre, max↔max), which keeps a carcass flush;
 *  - **contact** — a face of the dragged panel meets a face of the neighbour
 *    (dragged.min touches neighbour.max, or dragged.max touches neighbour.min),
 *    which is how panels butt together.
 *
 * Returns the adjusted centre position; axes with no nearby target are left
 * untouched.
 */
export function snapPosition(
  dragged: Panel,
  position: [number, number, number],
  others: Panel[],
  threshold: number,
): [number, number, number] {
  const size = panelBoxSize(dragged)
  const neighbours = others.map((p) => panelBounds(p))
  const result: [number, number, number] = [...position]

  for (let axis = 0; axis < 3; axis++) {
    const half = size[axis] / 2
    const centre = position[axis]
    const min = centre - half
    const max = centre + half

    let bestTarget = centre
    let bestDistance = threshold // only targets strictly closer than this win
    let snapped = false
    const consider = (targetCentre: number, distance: number) => {
      if (distance <= bestDistance) {
        bestTarget = targetCentre
        bestDistance = distance
        snapped = true
      }
    }

    for (const n of neighbours) {
      const nMin = n.min[axis]
      const nMax = n.max[axis]
      const nCentre = (nMin + nMax) / 2

      // Alignment (targets expressed as the resulting centre position).
      consider(nCentre, Math.abs(centre - nCentre))
      consider(nMin + half, Math.abs(min - nMin))
      consider(nMax - half, Math.abs(max - nMax))

      // Face contact.
      consider(nMax + half, Math.abs(min - nMax))
      consider(nMin - half, Math.abs(max - nMin))
    }

    if (snapped) result[axis] = bestTarget
  }

  return result
}

/**
 * While resizing, magnetically snap the moving face onto a nearby neighbour
 * edge on the same axis.
 *
 * `rawDelta` is the pointer's raw face displacement (mm). We turn it into the
 * face's would-be world coordinate, look for the closest neighbour edge
 * (their min/max bound on this axis) within `threshold`, and if one is close
 * enough return the delta that lands the face exactly on it. Otherwise the
 * raw delta passes through untouched.
 */
export function snapResizeFace(
  panel: Panel,
  axis: number,
  faceSign: 1 | -1,
  rawDelta: number,
  others: Panel[],
  threshold: number,
): number {
  const half = panelBoxSize(panel)[axis] / 2
  const faceStart = panel.position[axis] + faceSign * half
  const faceNow = faceStart + rawDelta

  let best = rawDelta
  let bestDistance = threshold
  for (const other of others) {
    const b = panelBounds(other)
    for (const edge of [b.min[axis], b.max[axis]]) {
      const distance = Math.abs(faceNow - edge)
      if (distance < bestDistance) {
        bestDistance = distance
        best = edge - faceStart
      }
    }
  }
  return best
}
