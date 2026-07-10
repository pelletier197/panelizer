import { useEffect, useRef, useState, type ReactNode } from 'react'

interface MenuProps {
  /** Trigger button contents. */
  label: ReactNode
  /** Which edge the popover aligns to. */
  align?: 'left' | 'right'
  ariaLabel?: string
  /** Rendered with a `close` callback so items can dismiss the menu. */
  children: (close: () => void) => ReactNode
}

/** A button that opens a popover, closing on outside click or Escape. */
export function Menu({ label, align = 'left', ariaLabel, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="menu" ref={ref}>
      <button
        className="menu__trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div className={`menu__popover menu__popover--${align}`}>{children(() => setOpen(false))}</div>
      )}
    </div>
  )
}
