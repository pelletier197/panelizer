import type { Panel } from '../types/panel'
import { DEFAULT_MATERIAL } from './materials'

/** Default thickness for a new panel (mm). Freely editable per panel. */
export const DEFAULT_THICKNESS = 18

/** Build a panel with sensible defaults, applying any overrides. The generated
 *  `id` is always fresh and cannot be overridden, so this is also safe to use
 *  when cloning from an existing panel's fields. */
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
  }
  return { ...base, ...overrides, id: base.id }
}
