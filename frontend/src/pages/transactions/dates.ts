// Dates are handled as "YYYY-MM-DD" strings in local time, like <input type="date">.

export type DatePreset =
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months"
  | "this_year"
  | "last_year"
  | "custom"

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "last_6_months", label: "Last 6 months" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "custom", label: "Custom" },
]

export function toDateInput(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, "0")
  const d = String(value.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function fromDateInput(value: string) {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Today in local time. `toISOString()` is UTC and gives yesterday or tomorrow near midnight. */
export function today() {
  return toDateInput(new Date())
}

export function rangeForPreset(preset: Exclude<DatePreset, "custom">, now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const range = (from: Date, to: Date) => ({ from: toDateInput(from), to: toDateInput(to) })
  switch (preset) {
    case "this_month":
      return range(new Date(year, month, 1), new Date(year, month + 1, 0))
    case "last_month":
      return range(new Date(year, month - 1, 1), new Date(year, month, 0))
    case "this_year":
      return range(new Date(year, 0, 1), new Date(year, 11, 31))
    case "last_year":
      return range(new Date(year - 1, 0, 1), new Date(year - 1, 11, 31))
    default: {
      const span = preset === "last_3_months" ? 3 : preset === "last_6_months" ? 6 : 12
      return range(new Date(year, month - (span - 1), 1), new Date(year, month + 1, 0))
    }
  }
}

function isEndOfMonth(value: Date) {
  return value.getDate() === new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate()
}

/** Moves a date by whole months, clamping the day; month ends stay month ends when asked. */
export function shiftMonths(value: string, months: number, keepMonthEnd = false) {
  const source = fromDateInput(value)
  const targetMonth = source.getMonth() + months
  const lastDay = new Date(source.getFullYear(), targetMonth + 1, 0).getDate()
  const day = keepMonthEnd && isEndOfMonth(source) ? lastDay : Math.min(source.getDate(), lastDay)
  return toDateInput(new Date(source.getFullYear(), targetMonth, day))
}

const DAY = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" })

export function formatDate(value: string) {
  return DAY.format(fromDateInput(value))
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" })

/** "2026-03" -> "Mar 26" */
export function formatMonth(value: string) {
  const [y, m] = value.split("-").map(Number)
  return MONTH.format(new Date(y, (m || 1) - 1, 1))
}
