import { fromDateInput, toDateInput } from "@/pages/transactions/dates"

/** The month being looked at: day 1 of the anchor's month up to the anchor date. */
export function anchorPeriod(anchor: string) {
  const day = fromDateInput(anchor)
  const start = new Date(day.getFullYear(), day.getMonth(), 1)
  const daysInMonth = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate()
  return {
    from: toDateInput(start),
    to: anchor,
    day: day.getDate(),
    daysInMonth,
    monthName: new Intl.DateTimeFormat("en-US", { month: "long" }).format(start),
    monthLabel: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(start),
  }
}

/** Percentage change in whole percent, from cents. Null when there is no usual value. */
export function percentChange(nowCents: number, usualCents: number | null) {
  if (usualCents === null || usualCents === 0) return null
  return Math.round(((nowCents - usualCents) / usualCents) * 100)
}
