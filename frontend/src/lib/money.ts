// The backend sends amounts as decimal strings. To avoid adding binary floats,
// each value is converted to integer cents before any arithmetic.
export function toCents(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

const formatters = new Map<string, Intl.NumberFormat>()

export function formatCents(cents: number, currency: string): string {
  let formatter = formatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { style: "currency", currency })
    formatters.set(currency, formatter)
  }
  return formatter.format(cents / 100)
}

export function formatMoney(value: number | string | null | undefined, currency: string) {
  return formatCents(toCents(value), currency)
}

/** Strict "123" / "123.4" / "123.45" check for amount inputs (no sign, no thousands). */
export function isPositiveAmount(value: string) {
  return /^\d+(\.\d{1,2})?$/.test(value.trim()) && toCents(value) > 0
}

/** Signed amount input: optional leading minus. */
export function isSignedAmount(value: string) {
  return /^-?\d+(\.\d{1,2})?$/.test(value.trim()) && toCents(value) !== 0
}

/** Cents back to a plain decimal string for the API, e.g. -1234 -> "-12.34". */
export function centsToDecimal(cents: number) {
  const sign = cents < 0 ? "-" : ""
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`
}
