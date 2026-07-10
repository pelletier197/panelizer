import { create } from 'zustand'
import type { Panel } from '../types/panel'
import type { Design } from '../lib/persistence'
import type { Material } from '../lib/materials'
import type { Unit } from '../lib/units'
import { createPanel } from '../lib/panel'
import { createMaterial } from '../lib/materials'
import { loadFromStorage, saveToStorage } from '../lib/persistence'

/** Active viewport tool. `move` shows the translate gizmo; `snap` and
 *  `measure` show clickable panel corners. */
export type Tool = 'move' | 'snap' | 'measure'

type Point = [number, number, number]

/** A corner the user picked as the first click of a snap/measure operation. */
export interface ToolPick {
  panelId: string
  index: number
  point: Point
}

interface DesignState {
  panels: Panel[]
  materials: Material[]
  unit: Unit
  selectedId: string | null
  tool: Tool
  toolPick: ToolPick | null
  measurement: { a: Point; b: Point } | null
  setTool: (tool: Tool) => void
  setToolPick: (pick: ToolPick | null) => void
  setMeasurement: (m: { a: Point; b: Point } | null) => void

  addPanel: (preset?: Partial<Panel>) => void
  updatePanel: (id: string, patch: Partial<Panel>) => void
  movePanelLive: (id: string, position: [number, number, number]) => void
  removePanel: (id: string) => void
  duplicatePanel: (id: string) => void
  setPanelMaterial: (panelId: string, materialId: string) => void
  select: (id: string | null) => void

  addMaterial: () => void
  updateMaterial: (id: string, patch: Partial<Material>) => void
  removeMaterial: (id: string) => void

  setUnit: (unit: Unit) => void
  loadDesign: (design: Design) => void
  clear: () => void
}

/** Nudge each new panel diagonally so freshly added parts don't stack exactly
 *  on top of one another and become impossible to click. */
const spawnOffset = (index: number): [number, number, number] => [index * 30, index * 30, 0]

export const useDesignStore = create<DesignState>((set, get) => {
  const initial = loadFromStorage()

  // Every persisted change funnels through here so state and autosave stay in
  // sync. Selection is transient and intentionally left out of autosave.
  const commit = (next: Partial<DesignState>) => {
    const merged = { ...get(), ...next }
    saveToStorage({ panels: merged.panels, materials: merged.materials, unit: merged.unit })
    set(next)
  }

  return {
    panels: initial.panels,
    materials: initial.materials,
    unit: initial.unit,
    selectedId: null,
    tool: 'move',
    toolPick: null,
    measurement: null,

    // Switching tools clears any in-progress pick and the shown measurement.
    setTool: (tool) => set({ tool, toolPick: null, measurement: null }),
    setToolPick: (toolPick) => set({ toolPick }),
    setMeasurement: (measurement) => set({ measurement }),

    addPanel: (preset = {}) => {
      const panel = createPanel({
        position: spawnOffset(get().panels.length),
        materialId: get().materials[0].id,
        ...preset,
      })
      commit({ panels: [...get().panels, panel], selectedId: panel.id })
    },

    updatePanel: (id, patch) => {
      commit({ panels: get().panels.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
    },

    // Live position update during a drag: no autosave (the drop commits it),
    // so overlaps and neighbours recompute in real time without disk churn.
    movePanelLive: (id, position) => {
      set({ panels: get().panels.map((p) => (p.id === id ? { ...p, position } : p)) })
    },

    removePanel: (id) => {
      commit({
        panels: get().panels.filter((p) => p.id !== id),
        selectedId: get().selectedId === id ? null : get().selectedId,
      })
    },

    duplicatePanel: (id) => {
      const source = get().panels.find((p) => p.id === id)
      if (!source) return
      const copy = createPanel({
        ...source,
        name: `${source.name} copy`,
        position: [source.position[0] + 30, source.position[1], source.position[2]],
      })
      commit({ panels: [...get().panels, copy], selectedId: copy.id })
    },

    setPanelMaterial: (panelId, materialId) => {
      commit({
        panels: get().panels.map((p) => (p.id === panelId ? { ...p, materialId } : p)),
      })
    },

    select: (id) => set({ selectedId: id }),

    addMaterial: () => {
      commit({ materials: [...get().materials, createMaterial(get().materials.length)] })
    },

    updateMaterial: (id, patch) => {
      commit({ materials: get().materials.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
    },

    // Can't delete the last material; panels using a removed one fall back to
    // the first remaining material (thickness is unaffected).
    removeMaterial: (id) => {
      const remaining = get().materials.filter((m) => m.id !== id)
      if (remaining.length === 0) return
      const fallback = remaining[0].id
      const panels = get().panels.map((p) =>
        p.materialId === id ? { ...p, materialId: fallback } : p,
      )
      commit({ materials: remaining, panels })
    },

    setUnit: (unit) => commit({ unit }),

    loadDesign: ({ panels, materials, unit }) => commit({ panels, materials, unit, selectedId: null }),

    clear: () => commit({ panels: [], selectedId: null }),
  }
})
