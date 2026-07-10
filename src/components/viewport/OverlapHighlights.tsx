import { useMemo } from 'react'
import { MM_TO_M } from '../../lib/geometry'
import { overlapBoxes } from '../../lib/overlaps'
import { useDesignStore } from '../../store/designStore'

/** Slightly grow each overlay so it pokes through the panels and doesn't
 *  z-fight with their faces (mm). */
const PAD = 1.5

/** Translucent markers wherever two panels share space. Purely a visual cue
 *  that a joint lives there — not an error. */
export function OverlapHighlights() {
  const panels = useDesignStore((s) => s.panels)
  const boxes = useMemo(() => overlapBoxes(panels), [panels])

  return (
    <>
      {boxes.map((box, i) => (
        <mesh
          key={i}
          position={[box.center[0] * MM_TO_M, box.center[1] * MM_TO_M, box.center[2] * MM_TO_M]}
        >
          <boxGeometry
            args={[
              (box.size[0] + PAD) * MM_TO_M,
              (box.size[1] + PAD) * MM_TO_M,
              (box.size[2] + PAD) * MM_TO_M,
            ]}
          />
          <meshStandardMaterial
            color="#1fd1c4"
            emissive="#1fd1c4"
            emissiveIntensity={0.4}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  )
}
