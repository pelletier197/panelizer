/** Axis along which a panel's thickness runs. The panel's face lies in the
 *  plane of the other two axes. World convention: Y is up (height), Z is depth. */
export type Axis = 'x' | 'y' | 'z'

/**
 * A rectangular plywood panel — the atomic building block of a cabinet.
 *
 * A panel is fully described by a face (`length` x `width`) and a `thickness`
 * that runs along its `normal` axis. Thickness is the one dimension the user
 * cannot change by dragging in the viewport; it is edited in the properties
 * panel and typically follows the chosen material.
 *
 * All measurements are in millimetres. `position` is the centre of the panel
 * in world space. `thickness` is edited in the properties panel and is the one
 * dimension the viewport won't let you drag. `materialId` is just identity
 * (name + colour), independent of thickness.
 */
export interface Panel {
  id: string
  name: string
  normal: Axis
  length: number
  width: number
  thickness: number
  position: [number, number, number]
  materialId: string
}
