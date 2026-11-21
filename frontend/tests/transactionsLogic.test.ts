import { describe, expect, it } from "vitest"

import { centsToDecimal, isPositiveAmount } from "@/lib/money"
import { rangeForPreset, shiftMonths, toDateInput } from "@/pages/transactions/dates"
import { formFromTransaction, toPayload } from "@/pages/transactions/TransactionFormDialog"
import type { Transaction } from "@/types"

const base: Transaction = {
  id: 1,
  date: "2026-03-10",
  description: "Coffee",
  account_id: 1,
  tag_id: 5,
  amount: "-3.50",
  currency: "EUR",
  is_transfer: false,
  transfer_group_id: null,
  transfer_direction: null,
  linked_account_id: null,
  parent_transaction_id: null,
}

describe("dates", () => {
  const now = new Date(2026, 2, 15) // 15 Mar 2026

  it("computes preset ranges in local time", () => {
    expect(rangeForPreset("this_month", now)).toEqual({ from: "2026-03-01", to: "2026-03-31" })
    expect(rangeForPreset("last_month", now)).toEqual({ from: "2026-02-01", to: "2026-02-28" })
    expect(rangeForPreset("last_3_months", now)).toEqual({ from: "2026-01-01", to: "2026-03-31" })
    expect(rangeForPreset("last_year", now)).toEqual({ from: "2025-01-01", to: "2025-12-31" })
  })

  it("shifts by months and keeps month ends", () => {
    expect(shiftMonths("2026-03-31", -1, true)).toBe("2026-02-28")
    expect(shiftMonths("2026-02-28", 1, true)).toBe("2026-03-31")
    expect(shiftMonths("2026-01-31", 1)).toBe("2026-02-28")
    expect(shiftMonths("2026-01-15", -1)).toBe("2025-12-15")
  })

  it("formats local dates without UTC drift", () => {
    expect(toDateInput(new Date(2026, 0, 1, 23, 59))).toBe("2026-01-01")
  })
})

describe("money input helpers", () => {
  it("accepts only positive amounts with up to two decimals", () => {
    expect(isPositiveAmount("12")).toBe(true)
    expect(isPositiveAmount("12.5")).toBe(true)
    expect(isPositiveAmount("12.50")).toBe(true)
    expect(isPositiveAmount("0")).toBe(false)
    expect(isPositiveAmount("-1")).toBe(false)
    expect(isPositiveAmount("1.234")).toBe(false)
    expect(isPositiveAmount("abc")).toBe(false)
  })

  it("prints cents as decimal strings", () => {
    expect(centsToDecimal(-1234)).toBe("-12.34")
    expect(centsToDecimal(5)).toBe("0.05")
    expect(centsToDecimal(100000)).toBe("1000.00")
  })
})

describe("transaction form mapping", () => {
  it("reads an expense as a positive amount and sends it negative", () => {
    const form = formFromTransaction(base)
    expect(form).toMatchObject({ kind: "expense", amount: "3.50", tagId: "5" })
    expect(toPayload(form)).toMatchObject({ amount: "-3.50", tag_id: 5, is_transfer: false })
  })

  it("reads income and keeps it positive", () => {
    const form = formFromTransaction({ ...base, amount: "100.00" })
    expect(form.kind).toBe("income")
    expect(toPayload(form).amount).toBe("100.00")
  })

  it("edits an incoming transfer from its source side", () => {
    const form = formFromTransaction({
      ...base,
      account_id: 2,
      amount: "50.00",
      is_transfer: true,
      transfer_direction: "in",
      linked_account_id: 1,
      tag_id: null,
    })
    expect(form).toMatchObject({ kind: "transfer", accountId: "1", destinationId: "2", amount: "50.00" })
    expect(toPayload(form)).toMatchObject({
      account_id: 1,
      destination_account_id: 2,
      amount: "50.00",
      tag_id: null,
      is_transfer: true,
    })
  })
})

describe("expense breakdown", async () => {
  const { topWithOther } = await import("@/pages/transactions/ExpenseCharts")
  it("keeps the top 9 and folds the rest into Other", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ label: `T${i}`, total_expense: `${(i + 1) * 10}.10` }))
    const out = topWithOther(rows)
    expect(out).toHaveLength(10)
    expect(out[0]).toEqual({ label: "T11", total: 120.1 })
    // T0..T2 = 10.10 + 20.10 + 30.10 = 60.30
    expect(out[9]).toEqual({ label: "Other (3)", total: 60.3 })
  })
  it("leaves short lists alone", () => {
    expect(topWithOther([{ label: "A", total_expense: "1.00" }])).toEqual([{ label: "A", total: 1 }])
  })
})
