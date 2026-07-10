import { useDesignStore } from '../../store/designStore'

/** A small banner over the viewport telling the user the next step of the
 *  active corner tool. Hidden in `move` mode. */
export function ToolHint() {
  const tool = useDesignStore((s) => s.tool)
  const pick = useDesignStore((s) => s.toolPick)

  if (tool === 'move') return null

  const text =
    tool === 'snap'
      ? pick
        ? 'Now click the corner to move it onto'
        : 'Click a corner to grab'
      : pick
        ? 'Click the other corner to measure'
        : 'Click the first corner'

  return <div className="tool-hint">{text}</div>
}
