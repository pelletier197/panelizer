import { useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Cursor-following tooltip that replaces the slow, unstyled native `title`
 * attribute. Spread `trigger` onto any element and render `node` alongside it:
 *
 *   const tip = useTooltip('Click to select')
 *   return <button {...tip.trigger}>…{tip.node}</button>
 *
 * `node` portals to <body>, so it can sit anywhere in the JSX (including inside
 * table rows) without disturbing layout.
 */
export function useTooltip(text: string) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const track = (e: React.MouseEvent) => setPos({ x: e.clientX, y: e.clientY })
  const trigger = {
    onMouseEnter: track,
    onMouseMove: track,
    onMouseLeave: () => setPos(null),
  }

  const node = pos
    ? createPortal(
        <div className="tooltip" style={{ left: pos.x, top: pos.y }}>
          {text}
        </div>,
        document.body,
      )
    : null

  return { trigger, node }
}
