import { useEffect, useState } from 'react'
import {
  evaluateMeasurement,
  formatMeasurement,
  roundToUnitGrid,
  sameSystem,
  UNIT_SUFFIX,
  type Unit,
} from '../../lib/units'

interface MeasurementInputProps {
  label: string
  /** The value in millimetres — geometry is always stored in mm. */
  value: number
  onChange: (mm: number) => void
  /** The single document unit. Bare numbers are read in it; entry in the other
   *  measuring system is rejected (a mm value can't be typed into an inch doc). */
  unit: Unit
  /** Imperial working precision (fraction denominator) the value snaps to. */
  precision: number
  /** Optional lower bound in mm (dimensions clamp to >= 1; positions don't). */
  min?: number
  /** Snap the committed value onto the working grid so what's shown is exactly
   *  what's stored. On for sizes and typed positions. */
  snap?: boolean
}

/**
 * Text field for a length in the document's unit. Type a decimal or, in inch,
 * fractions/mixed numbers (`3/4`, `13 1/2`). The document works in ONE unit —
 * entry in the other system is refused, so a value never silently converts to a
 * lossy fraction. Size fields snap to the unit grid on commit (What You See Is
 * What's Stored); only an edited field writes back.
 */
export function MeasurementInput({ label, value, onChange, unit, precision, min, snap = false }: MeasurementInputProps) {
  const [text, setText] = useState(() => formatMeasurement(value, unit))
  const [focused, setFocused] = useState(false)
  // Only an edited field writes back — the shown text can be a rounded display,
  // so committing an untouched field could shift the stored value.
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!focused) setText(formatMeasurement(value, unit))
  }, [value, unit, focused])

  const commit = () => {
    const result = evaluateMeasurement(text, value, unit)
    // Reject unparseable input, or a unit from the other measuring system.
    if (result === null || (result.explicitUnit && !sameSystem(result.explicitUnit, unit))) {
      setText(formatMeasurement(value, unit))
      return
    }
    let mm = min === undefined ? result.mm : Math.max(min, result.mm)
    if (snap) mm = roundToUnitGrid(mm, unit, precision)
    onChange(mm)
    setText(formatMeasurement(mm, unit))
  }

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__control">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setDirty(true)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            if (dirty) commit()
            else setText(formatMeasurement(value, unit))
            setDirty(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <span className="field__suffix">{UNIT_SUFFIX[unit]}</span>
      </span>
    </label>
  )
}
