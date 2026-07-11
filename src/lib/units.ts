/**
 * Units are a display/entry concern only — everything is stored internally in
 * millimetres. A design has one *default* unit (used for bare numbers and as
 * the starting display unit), but any field can be entered in another unit by
 * typing it explicitly (e.g. `24.5 in`), and imperial fractions are understood.
 */
export type Unit = 'mm' | 'cm' | 'inch'

export const DOCUMENT_UNITS: { value: Unit; label: string }[] = [
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'inch', label: 'inch' },
]

/** Short suffix shown next to inputs and in the parts-table headers. */
export const UNIT_SUFFIX: Record<Unit, string> = { mm: 'mm', cm: 'cm', inch: 'in' }

const MM_PER_UNIT: Record<Unit, number> = { mm: 1, cm: 10, inch: 25.4 }

/** Units accepted when *typing* a value. Wider than the selectable document
 *  units: metres and feet are convenient to enter even if we never display in
 *  them. Keys are matched case-insensitively against the typed suffix. */
const INPUT_UNIT_MM: Record<string, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  inch: 25.4,
  inches: 25.4,
  '"': 25.4,
  ft: 304.8,
  foot: 304.8,
  feet: 304.8,
  "'": 304.8,
}

export function toMm(value: number, unit: Unit): number {
  return value * MM_PER_UNIT[unit]
}

export function fromMm(mm: number, unit: Unit): number {
  return mm / MM_PER_UNIT[unit]
}

/**
 * Parse a free-text measurement into millimetres, or `null` if it makes no
 * sense. Accepts decimals (`24.5`), whole+fraction (`23 3/4`), bare fractions
 * (`3/4`) and an optional trailing unit; a bare number uses `defaultUnit`.
 */
export function parseMeasurement(raw: string, defaultUnit: Unit): number | null {
  const text = raw.trim().toLowerCase()
  if (!text) return null

  const match = text.match(/^([0-9./\s-]+?)\s*([a-z"']*)$/)
  if (!match) return null
  const [, numberPart, unitPart] = match

  const mmPerUnit = unitPart ? INPUT_UNIT_MM[unitPart] : MM_PER_UNIT[defaultUnit]
  if (mmPerUnit === undefined) return null

  const value = parseNumeric(numberPart)
  return value === null ? null : value * mmPerUnit
}

function parseNumeric(part: string): number | null {
  const text = part.trim()

  const mixed = text.match(/^(-?\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/) // "23 3/4"
  if (mixed) {
    const whole = parseFloat(mixed[1])
    const den = Number(mixed[3])
    if (den === 0) return null
    const sign = whole < 0 ? -1 : 1
    return whole + sign * (Number(mixed[2]) / den)
  }

  const fraction = text.match(/^(-?\d+)\/(\d+)$/) // "3/4"
  if (fraction) {
    const den = Number(fraction[2])
    return den === 0 ? null : Number(fraction[1]) / den
  }

  return /^-?\d+(?:\.\d+)?$/.test(text) ? parseFloat(text) : null
}

/** Format a millimetre value for display in the given unit. Inches render as
 *  shop-friendly fractions to the nearest 1/16"; metric renders as decimals. */
export function formatMeasurement(mm: number, unit: Unit): string {
  const value = fromMm(mm, unit)
  if (unit === 'inch') return formatInches(value)
  const decimals = unit === 'mm' ? 0 : 1
  return trimZeros(value.toFixed(decimals))
}

function formatInches(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const whole = Math.floor(abs)

  let numerator = Math.round((abs - whole) * 16)
  let denominator = 16
  if (numerator === 16) return `${sign}${whole + 1}`
  if (numerator === 0) return `${sign}${whole}`

  while (numerator % 2 === 0 && denominator % 2 === 0) {
    numerator /= 2
    denominator /= 2
  }
  const fraction = `${numerator}/${denominator}`
  return whole > 0 ? `${sign}${whole} ${fraction}` : `${sign}${fraction}`
}

/** Map an explicitly-typed unit suffix to the display unit a field should
 *  adopt. Metres collapse to cm, feet to inches (we don't display those). */
export function detectDisplayUnit(raw: string): Unit | null {
  const token = raw.trim().toLowerCase().match(/[a-z"']+$/)?.[0]
  if (!token) return null
  if (token === 'mm') return 'mm'
  if (token === 'cm' || token === 'm') return 'cm'
  if (['in', 'inch', 'inches', '"', 'ft', 'feet', 'foot', "'"].includes(token)) return 'inch'
  return null
}

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text
}
