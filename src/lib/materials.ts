/** A user-defined material — just identity: a name and a colour. Thickness is
 *  a property of the individual panel, not the material. */
export interface Material {
  id: string
  name: string
  color: string
}

/** Colour palette offered when editing a material. */
export const MATERIAL_COLORS = [
  '#d9b380', // plywood
  '#e2c48d', // birch
  '#c99f63', // oak
  '#b0805a', // walnut
  '#9aa0ab', // grey
  '#8fb0c9', // blue
  '#a7c99a', // green
  '#d59b9b', // red
]

/** The one material every new design starts with. */
export const DEFAULT_MATERIAL: Material = {
  id: 'plywood',
  name: 'Plywood',
  color: MATERIAL_COLORS[0],
}

export const defaultMaterials = (): Material[] => [{ ...DEFAULT_MATERIAL }]

export function createMaterial(existingCount: number): Material {
  return {
    id: crypto.randomUUID(),
    name: 'New material',
    color: MATERIAL_COLORS[existingCount % MATERIAL_COLORS.length],
  }
}

export function findMaterial(materials: Material[], id: string): Material {
  return materials.find((m) => m.id === id) ?? materials[0] ?? DEFAULT_MATERIAL
}
