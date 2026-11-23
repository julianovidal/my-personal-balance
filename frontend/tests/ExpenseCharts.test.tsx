import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ExpenseCharts, topWithOther } from "@/pages/transactions/ExpenseCharts"
import type { Filters } from "@/pages/transactions/filters"

import { renderWithProviders } from "./render"

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("@/api/client", () => ({ api }))

// happy-dom cannot measure Recharts layout; these tests cover the data paths that
// decide whether a chart is drawn, not the chart itself.
const FILTERS: Filters = { preset: "this_month", from: "2026-01-01", to: "2026-01-31", accountId: "all", tagId: "all" }
const TAGS = [{ id: 4, label: "Food", user_id: 1 }]

describe("ExpenseCharts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockImplementation(async (url: string) => {
      if (url.startsWith("/transactions/analytics/monthly"))
        return { data: { by_tag: [{ currency: "EUR", label: "Food", total_expense: "40.00" }], by_account: [] } }
      if (url.startsWith("/transactions/analytics/tag-trend"))
        return {
          data: {
            tag_id: 4,
            series: [{ currency: "EUR", points: [{ month: "2026-01", total_expense: "40.00" }] }],
          },
        }
      throw new Error(`unmocked GET ${url}`)
    })
  })

  it("shows the breakdown empty state when the chosen currency has no expenses", async () => {
    renderWithProviders(<ExpenseCharts filters={FILTERS} tags={TAGS} currency="BRL" />)
    expect(await screen.findByText("No expenses for the selected filters.")).toBeInTheDocument()
  })

  it("shows the trend empty state when the tag has no expenses in the chosen currency", async () => {
    renderWithProviders(<ExpenseCharts filters={FILTERS} tags={TAGS} currency="BRL" />)
    await userEvent.click(screen.getByLabelText("Trend tag"))
    await userEvent.click(await screen.findByRole("option", { name: "Food" }))
    expect(await screen.findByText("No BRL expenses for this tag in the last 12 months.")).toBeInTheDocument()
  })

  it("groups the long tail into Other in cents", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ label: `T${i}`, total_expense: `${12 - i}.10` }))
    const out = topWithOther(rows)
    expect(out).toHaveLength(10)
    expect(out.at(-1)).toEqual({ label: "Other (3)", total: 6.3 })
  })
})
