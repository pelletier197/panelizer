import type { Panel } from '../types/panel'

/** Scene is modelled in millimetres but rendered in metres, so Three.js works
 *  with comfortable ~1-unit numbers. Multiply mm by this to get metres. */
export const MM_TO_M = 0.001

type Vec3 = [number, number, number]

/**
 * Map a panel's logical dimensions onto a world-space box size `[x, y, z]`.
 *
 * The `thickness` always runs along the panel's `normal`; `length` and `width`
 * fill the remaining two axes. With Y up and Z as depth this reads naturally:
 *  - normal `x` (upright side):   length -> Z (depth),  width -> Y (height)
 *  - normal `y` (shelf / top):    length -> X (span),   width -> Z (depth)
 *  - normal `z` (back / door):    length -> X (span),   width -> Y (height)
 */
export function panelBoxSize({ length, width, thickness, normal }: Panel): Vec3 {
  switch (normal) {
    case 'x':
      return [thickness, width, length]
    case 'y':
      return [length, thickness, width]
    case 'z':
      return [length, width, thickness]
  }
}
