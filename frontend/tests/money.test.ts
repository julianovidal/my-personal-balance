import { describe, expect, it } from "vitest"

import { formatCents, formatMoney, toCents, totalsByCurrency } from "@/lib/money"

describe("money helpers", () => {
  it("converts floats to integer cents", () => {
    expect(toCents(0.1)).toBe(10)
    expect(toCents("1234.56")).toBe(123456)
    expect(toCents(-9.995)).toBe(-999)
    expect(toCents(null)).toBe(0)
    expect(toCents("abc")).toBe(0)
  })

  it("adds in cents, so 0.1 + 0.2 is exactly 0.30", () => {
    const [eur] = totalsByCurrency([
      { currency: "EUR", balance: 0.1 },
      { currency: "EUR", balance: 0.2 },
    ])
    expect(eur.cents).toBe(30)
  })

  it("never mixes currencies", () => {
    expect(
      totalsByCurrency([
        { currency: "EUR", balance: 10 },
        { currency: "BRL", balance: 5 },
        { currency: "EUR", balance: 2.5 },
      ])
    ).toEqual([
      { currency: "BRL", cents: 500, count: 1 },
      { currency: "EUR", cents: 1250, count: 2 },
    ])
  })

  it("formats with the currency", () => {
    expect(formatCents(123456, "EUR")).toBe("€1,234.56")
    expect(formatMoney(-5, "USD")).toBe("-$5.00")
    expect(formatMoney(10, "BRL")).toBe("R$10.00")
  })
})
