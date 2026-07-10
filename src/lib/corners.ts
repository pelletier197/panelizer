import type { Panel } from '../types/panel'
import { panelBounds } from './snapping'

export type Point = [number, number, number]

/** The 8 corner points of a panel's box, in mm. */
export function panelCorners(panel: Panel): Point[] {
  const b = panelBounds(panel)
  const corners: Point[] = []
  for (const x of [b.min[0], b.max[0]]) {
    for (const y of [b.min[1], b.max[1]]) {
      for (const z of [b.min[2], b.max[2]]) {
        corners.push([x, y, z])
      }
    }
  }
  return corners
}

/** Euclidean distance between two points (mm). */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}
