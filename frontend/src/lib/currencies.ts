// Mirrors backend/app/core/currency.py ALLOWED_CURRENCIES.
export const CURRENCIES = ["EUR", "USD", "BRL"] as const
export type Currency = (typeof CURRENCIES)[number]
