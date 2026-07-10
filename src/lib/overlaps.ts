import type { Panel } from '../types/panel'
import { panelBounds } from './snapping'

/** A box (mm) where two panels occupy the same space. */
export interface OverlapBox {
  center: [number, number, number]
  size: [number, number, number]
}

/** Ignore overlaps thinner than this (mere touching / float noise). */
const MIN_OVERLAP = 0.5

/**
 * Every region where two panels interpenetrate. This is purely informational —
 * an overlap marks where a real joint lives (a butt is the default; a miter or
 * dovetail is up to the builder). The app only tracks panel length, so the
 * highlight is a visual cue, not an error.
 */
export function overlapBoxes(panels: Panel[]): OverlapBox[] {
  const bounds = panels.map((p) => panelBounds(p))
  const boxes: OverlapBox[] = []

  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const a = bounds[i]
      const b = bounds[j]
      const lo: number[] = []
      const hi: number[] = []
      let intersects = true

      for (let axis = 0; axis < 3; axis++) {
        lo[axis] = Math.max(a.min[axis], b.min[axis])
        hi[axis] = Math.min(a.max[axis], b.max[axis])
        if (hi[axis] - lo[axis] < MIN_OVERLAP) {
          intersects = false
          break
        }
      }
      if (!intersects) continue

      boxes.push({
        center: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
        size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
      })
    }
  }

  return boxes
}
