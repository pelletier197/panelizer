import { useRef } from 'react'
import type { Mesh } from 'three'
import { Edges, TransformControls } from '@react-three/drei'
import type { Panel } from '../../types/panel'
import { MM_TO_M, panelBoxSize } from '../../lib/geometry'
import { findMaterial } from '../../lib/materials'
import { SNAP_THRESHOLD_MM, snapPosition } from '../../lib/snapping'
import { useDesignStore } from '../../store/designStore'
import { ResizeHandles } from './ResizeHandles'

const toMetres = ([x, y, z]: [number, number, number]): [number, number, number] => [
  x * MM_TO_M,
  y * MM_TO_M,
  z * MM_TO_M,
]

/** Renders one panel as a box, handles click-to-select, and — when selected —
 *  attaches a translate gizmo. Dragging only moves the panel; its size (and so
 *  its thickness) is never touched here, matching the "thickness is locked in
 *  the viewport" rule. */
export function PanelMesh({ panel }: { panel: Panel }) {
  const meshRef = useRef<Mesh>(null!)
  const selected = useDesignStore((s) => s.selectedId === panel.id)
  const sceneSelect = useDesignStore((s) => s.sceneSelect)
  const updatePanel = useDesignStore((s) => s.updatePanel)
  const movePanelLive = useDesignStore((s) => s.movePanelLive)
  const panels = useDesignStore((s) => s.panels)
  const tool = useDesignStore((s) => s.tool)
  const color = useDesignStore((s) => findMaterial(s.materials, panel.materialId).color)

  const size = toMetres(panelBoxSize(panel))
  const position = toMetres(panel.position)

  // While dragging, magnetically snap to the other panels (in mm space).
  const snapDuringDrag = () => {
    const obj = meshRef.current
    if (!obj) return
    const dragged: [number, number, number] = [
      obj.position.x / MM_TO_M,
      obj.position.y / MM_TO_M,
      obj.position.z / MM_TO_M,
    ]
    const others = panels.filter((p) => p.id !== panel.id)
    const [x, y, z] = snapPosition(panel, dragged, others, SNAP_THRESHOLD_MM)
    obj.position.set(x * MM_TO_M, y * MM_TO_M, z * MM_TO_M)
    movePanelLive(panel.id, [x, y, z]) // keep overlaps / neighbours live during drag
  }

  const commitPosition = () => {
    const obj = meshRef.current
    if (!obj) return
    updatePanel(panel.id, {
      position: [
        Math.round(obj.position.x / MM_TO_M),
        Math.round(obj.position.y / MM_TO_M),
        Math.round(obj.position.z / MM_TO_M),
      ],
    })
  }

  return (
    <>
      <mesh
        ref={meshRef}
        position={position}
        onClick={(e) => {
          e.stopPropagation()
          sceneSelect(panel.id)
        }}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? '#2a6cff' : '#000000'}
          emissiveIntensity={selected ? 0.35 : 0}
        />
        <Edges threshold={15} color={selected ? '#2a6cff' : '#5a4a32'} />
      </mesh>

      {selected && tool === 'move' && (
        <TransformControls
          object={meshRef}
          mode="translate"
          onObjectChange={snapDuringDrag}
          onMouseUp={commitPosition}
        />
      )}

      {selected && tool === 'resize' && <ResizeHandles panel={panel} />}
    </>
  )
}
