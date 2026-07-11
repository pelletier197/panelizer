import { create } from 'zustand'
import type { Panel } from '../types/panel'
import type { Design } from '../lib/persistence'
import type { Material } from '../lib/materials'
import type { Unit } from '../lib/units'
import { createPanel } from '../lib/panel'
import { createMaterial } from '../lib/materials'
import { loadFromStorage, saveToStorage } from '../lib/persistence'

/** Active viewport tool.
 *  - `move` / `resize` show a drag gizmo (translate / per-face resize).
 *  - `move-snap` and `measure` show clickable panel corners. */
export type Tool = 'move' | 'move-snap' | 'resize' | 'measure'

type Point = [number, number, number]

/** An undoable design snapshot. Selection and tool are transient and left out. */
interface Snapshot {
  panels: Panel[]
  materials: Material[]
  unit: Unit
}

/** How many undo steps to keep. */
const HISTORY_LIMIT = 100

/** A corner the user picked as the first click of a corner-pick tool
 *  (`move-snap`, `resize-point`, `measure`). */
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
  /** Whether orbit navigation is live. Resize handles switch this off while
   *  the pointer is on them so a face-drag never spins the camera. */
  orbitEnabled: boolean
  /** Undo/redo stacks of design snapshots (transient, not persisted). */
  past: Snapshot[]
  future: Snapshot[]
  /** The pre-drag snapshot captured on the first live update of a drag, so the
   *  whole drag collapses into one undo step (not one per frame). Internal. */
  dragOrigin: Snapshot | null
  /** One-shot guard so a resize drag-release doesn't select the panel under
   *  the cursor. Internal. */
  suppressSelect: boolean
  setTool: (tool: Tool) => void
  setToolPick: (pick: ToolPick | null) => void
  setMeasurement: (m: { a: Point; b: Point } | null) => void
  setOrbitEnabled: (enabled: boolean) => void
  undo: () => void
  redo: () => void

  addPanel: (preset?: Partial<Panel>) => void
  updatePanel: (id: string, patch: Partial<Panel>) => void
  movePanelLive: (id: string, position: [number, number, number]) => void
  resizePanelLive: (id: string, patch: Partial<Panel>) => void
  removePanel: (id: string) => void
  duplicatePanel: (id: string) => void
  setPanelMaterial: (panelId: string, materialId: string) => void
  select: (id: string | null) => void
  /** Select from a click in the 3D scene — no-ops once if a resize drag just
   *  armed suppression, so releasing a handle doesn't select the panel under it. */
  sceneSelect: (id: string) => void
  /** Swallow the next scene-select (the click synthesised when a drag ends). */
  armSelectSuppression: () => void

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

  const snapshot = (s: DesignState): Snapshot => ({
    panels: s.panels,
    materials: s.materials,
    unit: s.unit,
  })

  // Every persisted change funnels through here so state, autosave, and the
  // undo history stay in sync. The pre-change snapshot is pushed onto `past`
  // and the redo stack is cleared (a fresh edit forks history). Selection is
  // transient and intentionally left out of both autosave and history.
  const commit = (next: Partial<DesignState>) => {
    const current = get()
    const merged = { ...current, ...next }
    saveToStorage({ panels: merged.panels, materials: merged.materials, unit: merged.unit })
    // A drag's "before" is the state at its first live frame (`dragOrigin`), so
    // the whole drag is one undo step; a plain edit has no dragOrigin.
    const before = current.dragOrigin ?? snapshot(current)
    set({
      ...next,
      past: [...current.past, before].slice(-HISTORY_LIMIT),
      future: [],
      dragOrigin: null,
    })
  }

  // Live (non-persisted) drag update. Captures the pre-drag snapshot once so
  // the eventual commit can attribute the whole drag to a single undo step.
  const live = (panels: Panel[]) => {
    const current = get()
    set({ panels, dragOrigin: current.dragOrigin ?? snapshot(current) })
  }

  // Move one step through history. `snap` is the snapshot to apply; the current
  // state is pushed onto the opposite stack so the move is itself reversible.
  const applyHistory = (snap: Snapshot, from: 'past' | 'future') => {
    const current = get()
    saveToStorage(snap)
    const stillThere = snap.panels.some((p) => p.id === current.selectedId)
    set({
      panels: snap.panels,
      materials: snap.materials,
      unit: snap.unit,
      selectedId: stillThere ? current.selectedId : null,
      toolPick: null,
      dragOrigin: null,
      past: from === 'past' ? current.past.slice(0, -1) : [...current.past, snapshot(current)],
      future: from === 'future' ? current.future.slice(1) : [snapshot(current), ...current.future],
    })
  }

  return {
    panels: initial.panels,
    materials: initial.materials,
    unit: initial.unit,
    selectedId: null,
    tool: 'move',
    toolPick: null,
    measurement: null,
    orbitEnabled: true,
    past: [],
    future: [],
    dragOrigin: null,
    suppressSelect: false,

    // Switching tools clears any in-progress pick and the shown measurement,
    // and always restores orbit (in case a drag was interrupted).
    setTool: (tool) => set({ tool, toolPick: null, measurement: null, orbitEnabled: true, dragOrigin: null }),
    setToolPick: (toolPick) => set({ toolPick }),
    setMeasurement: (measurement) => set({ measurement }),
    setOrbitEnabled: (orbitEnabled) => set({ orbitEnabled }),

    undo: () => {
      const { past } = get()
      if (past.length > 0) applyHistory(past[past.length - 1], 'past')
    },
    redo: () => {
      const { future } = get()
      if (future.length > 0) applyHistory(future[0], 'future')
    },

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
      live(get().panels.map((p) => (p.id === id ? { ...p, position } : p)))
    },

    // Live length/width/position update while dragging a resize face handle;
    // same non-autosaved pattern as movePanelLive.
    resizePanelLive: (id, patch) => {
      live(get().panels.map((p) => (p.id === id ? { ...p, ...patch } : p)))
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

    select: (id) => set({ selectedId: id, dragOrigin: null }),

    sceneSelect: (id) => {
      if (get().suppressSelect) {
        set({ suppressSelect: false })
        return
      }
      set({ selectedId: id, dragOrigin: null })
    },

    // Arm suppression for the click the browser fires when a drag ends, and
    // self-clear next frame so a later genuine click still selects.
    armSelectSuppression: () => {
      set({ suppressSelect: true })
      requestAnimationFrame(() => set({ suppressSelect: false }))
    },

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
