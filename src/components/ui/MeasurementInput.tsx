import { useEffect, useState } from 'react'
import {
  detectDisplayUnit,
  formatMeasurement,
  parseMeasurement,
  UNIT_SUFFIX,
  type Unit,
} from '../../lib/units'

interface MeasurementInputProps {
  label: string
  /** The value in millimetres — the canonical unit everywhere in the app. */
  value: number
  onChange: (mm: number) => void
  /** Document default: used for bare numbers and as the initial display unit. */
  defaultUnit: Unit
  /** Optional lower bound in mm (dimensions clamp to >= 1; positions don't). */
  min?: number
}

/**
 * A text field for a length that understands units. You can type a bare number
 * (interpreted in the document's default unit), or an explicit one like
 * `24.5 in`, `3/4"`, or `2.5cm`. When you enter an explicit unit the field
 * remembers it, so different fields can show different units at once; fields
 * you haven't overridden follow the document default.
 */
export function MeasurementInput({
  label,
  value,
  onChange,
  defaultUnit,
  min,
}: MeasurementInputProps) {
  const [displayUnit, setDisplayUnit] = useState<Unit>(defaultUnit)
  const [overridden, setOverridden] = useState(false)
  const [text, setText] = useState(() => formatMeasurement(value, defaultUnit))
  const [focused, setFocused] = useState(false)

  // Fields that haven't been explicitly overridden track the document default.
  useEffect(() => {
    if (!overridden) setDisplayUnit(defaultUnit)
  }, [defaultUnit, overridden])

  // Reflect external changes (gizmo drag, material swap, import) unless the
  // user is mid-edit, in which case we leave their typing alone.
  useEffect(() => {
    if (!focused) setText(formatMeasurement(value, displayUnit))
  }, [value, displayUnit, focused])

  const commit = () => {
    const parsed = parseMeasurement(text, defaultUnit)
    if (parsed === null) {
      setText(formatMeasurement(value, displayUnit)) // reject: restore last good value
      return
    }

    const explicit = detectDisplayUnit(text)
    if (explicit) {
      setDisplayUnit(explicit)
      setOverridden(true)
    }

    const mm = min === undefined ? parsed : Math.max(min, parsed)
    onChange(mm)
    setText(formatMeasurement(mm, explicit ?? displayUnit))
  }

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__control">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            commit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <span className="field__suffix">{UNIT_SUFFIX[displayUnit]}</span>
      </span>
    </label>
  )
}
