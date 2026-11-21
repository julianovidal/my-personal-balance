import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { percentChange } from "@/pages/dashboard/period"
import { yearlyPoints } from "@/pages/dashboard/BalanceChart"
import { DashboardPage } from "@/pages/DashboardPage"
import { filtersFromSearch } from "@/pages/transactions/filters"
import type { CurrencyInsights, DashboardInsights, InsightTransaction } from "@/types"

import { renderWithProviders } from "./render"

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("@/api/client", () => ({ api }))
// Recharts cannot lay out in happy-dom; chart data is covered by the helper tests below.
vi.mock("@/pages/dashboard/BalanceChart", async (orig) => ({
  ...(await orig<typeof import("@/pages/dashboard/BalanceChart")>()),
  BalanceChart: () => <div data-testid="balance-chart" />,
}))
vi.mock("@/pages/dashboard/CashflowChart", () => ({ CashflowChart: () => <div data-testid="cashflow-chart" /> }))
vi.mock("@/pages/dashboard/TagComparison", () => ({ TagComparison: () => <div data-testid="tag-chart" /> }))

const tx = (patch: Partial<InsightTransaction>): InsightTransaction => ({
  id: 1,
  date: "2026-10-20",
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
  is_remainder: false,
  ...patch,
})

const eur = (patch: Partial<CurrencyInsights> = {}): CurrencyInsights => ({
  currency: "EUR",
  baseline_months: ["2026-09", "2026-08", "2026-07", "2026-06", "2026-05", "2026-04"],
  spending: { month_to_date: "5535.47", usual: "5000.00", difference: "535.47", full_month_usual: "6639.18" },
  income_to_date: "6000.00",
  tags: [{ tag_id: 5, label: "Education", month_to_date: "1255.00", usual: "340.55" }],
  signals: [
    { tag_id: 5, label: "Education", kind: "spike", month_to_date: "1255.00", usual: "340.55", difference: "914.45" },
    { tag_id: 6, label: "Pets", kind: "new", month_to_date: "120.00", usual: "0", difference: "120.00" },
  ],
  large_expenses: [
    { transaction: tx({ id: 42, description: "School fee", amount: "-1255.00" }), typical: "104.60", ratio: "12.0", reason: "tag" },
  ],
  top_expenses: [tx({ id: 42, description: "School fee", amount: "-1255.00" }), tx({ id: 43, description: "Toyota", amount: "-298.14" })],
  trend: [],
  ...patch,
})

const INSIGHTS: DashboardInsights = {
  anchor_date: "2026-10-28",
  month: "2026-10",
  is_partial_month: true,
  accounts: [
    { account_id: 1, name: "OpenBank", currency: "EUR", last_date: "2026-10-28", days_behind: 0, stale: false, inactive: false },
    { account_id: 2, name: "N26", currency: "EUR", last_date: "2026-10-01", days_behind: 27, stale: true, inactive: false },
    { account_id: 3, name: "Caixa", currency: "EUR", last_date: "2022-10-06", days_behind: 1483, stale: false, inactive: true },
  ],
  currencies: [eur()],
  recent: [tx({ id: 50, description: "Bakery" }), tx({ id: 51, description: "Move", is_transfer: true, transfer_direction: "out", linked_account_id: 2, amount: "-100.00" })],
}

const HISTORY = { anchor_date: "2026-10-28", series: [{ currency: "EUR", points: [{ month: "2026-10", balance: "194320.46" }] }] }

function mockApi(insights: DashboardInsights = INSIGHTS) {
  api.get.mockImplementation(async (url: string) => {
    if (url === "/dashboard/insights") return { data: insights }
    if (url === "/dashboard/balance-history") return { data: HISTORY }
    if (url === "/accounts")
      return { data: [{ id: 1, name: "OpenBank", currency: "EUR", user_id: 1 }, { id: 2, name: "N26", currency: "EUR", user_id: 1 }] }
    if (url === "/tags") return { data: [{ id: 5, label: "Education", user_id: 1 }] }
    throw new Error(`unmocked ${url}`)
  })
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi()
  })

  it("anchors on the data date, not today, and says how far into the month it is", async () => {
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText("Data through Oct 28, 2026")).toBeInTheDocument()
    expect(screen.getByText("October 2026, day 28 of 31")).toBeInTheDocument()
  })

  it("compares spending with the usual level for the same days", async () => {
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText("€5,535.47")).toBeInTheDocument()
    expect(screen.getByText("€535.47 more than usual")).toBeInTheDocument()
    expect(screen.getByText("+11%")).toBeInTheDocument()
    expect(screen.getByText("Median of 6 months with data")).toBeInTheDocument()
    expect(screen.getByText("€194,320.46")).toBeInTheDocument()
  })

  it("explains when there is not enough history", async () => {
    mockApi({
      ...INSIGHTS,
      currencies: [eur({ baseline_months: ["2026-09"], spending: { month_to_date: "10.00", usual: null, difference: null, full_month_usual: null }, signals: [], large_expenses: [] })],
    })
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText("Not enough history to compare yet")).toBeInTheDocument()
    expect(screen.getByText(/start once there are 3 earlier months/)).toBeInTheDocument()
  })

  it("lists unusual items with links to the matching transactions", async () => {
    renderWithProviders(<DashboardPage />)
    const spike = await screen.findByRole("link", { name: /Education is higher than usual/ })
    expect(spike).toHaveAttribute("href", "/transactions?from=2026-10-01&to=2026-10-28&tag_id=5")
    expect(within(spike).getByText("+€914.45")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /New spending on Pets/ })).toBeInTheDocument()
    const large = screen.getByRole("link", { name: /School fee/ })
    expect(large).toHaveAttribute("href", "/transactions?from=2026-10-20&to=2026-10-20&account_id=1")
    expect(within(large).getByText(/about 12× a typical expense in this tag/)).toBeInTheDocument()
    expect(screen.getByText("3 to check")).toBeInTheDocument()
  })

  it("does not repeat a flagged expense in the biggest list", async () => {
    renderWithProviders(<DashboardPage />)
    const card = (await screen.findByText("Biggest expenses")).closest("[data-slot=card]") as HTMLElement
    expect(within(card).getByText("Toyota")).toBeInTheDocument()
    expect(within(card).queryByText("School fee")).not.toBeInTheDocument()
  })

  it("warns about accounts that are behind but not about inactive ones", async () => {
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText("N26 behind")).toBeInTheDocument()
    expect(screen.getByText(/27 days behind/)).toBeInTheDocument()
    expect(screen.getByText(/Not counted as behind \(no data for 90\+ days\): Caixa/)).toBeInTheDocument()
  })

  it("shows recent transactions with transfers once", async () => {
    renderWithProviders(<DashboardPage />)
    const card = (await screen.findByText("Recent transactions")).closest("[data-slot=card]") as HTMLElement
    expect(within(card).getByText("Bakery")).toBeInTheDocument()
    expect(within(card).getByText(/To N26/)).toBeInTheDocument()
  })

  it("switches currency when there is more than one", async () => {
    mockApi({ ...INSIGHTS, currencies: [eur(), eur({ currency: "BRL", spending: { month_to_date: "300.00", usual: null, difference: null, full_month_usual: null }, signals: [], large_expenses: [], top_expenses: [] })] })
    renderWithProviders(<DashboardPage />)
    await screen.findByText("€5,535.47")
    await userEvent.click(screen.getByRole("tab", { name: "BRL" }))
    expect(await screen.findByText("R$300.00")).toBeInTheDocument()
  })

  it("shows an import prompt when there is no data", async () => {
    mockApi({ anchor_date: null, month: null, is_partial_month: false, accounts: [], currencies: [], recent: [] })
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText("No transactions yet")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Import transactions" })).toHaveAttribute("href", "/transactions?action=import")
  })
})

describe("dashboard helpers", () => {
  it("computes whole-percent change from cents", () => {
    expect(percentChange(11000, 10000)).toBe(10)
    expect(percentChange(9000, 10000)).toBe(-10)
    expect(percentChange(100, null)).toBeNull()
    expect(percentChange(100, 0)).toBeNull()
  })

  it("takes the last month of each year for the yearly balance", () => {
    expect(
      yearlyPoints([
        { month: "2025-11", balance: "1" },
        { month: "2025-12", balance: "2" },
        { month: "2026-01", balance: "3" },
      ])
    ).toEqual([
      { label: "2025", month: "2025-12", balance: "2" },
      { label: "2026", month: "2026-01", balance: "3" },
    ])
  })

  it("reads transaction filters from a dashboard link", () => {
    const f = filtersFromSearch(new URLSearchParams("from=2026-10-01&to=2026-10-28&tag_id=5"))
    expect(f).toMatchObject({ preset: "custom", from: "2026-10-01", to: "2026-10-28", tagId: "5", accountId: "all" })
    expect(filtersFromSearch(new URLSearchParams("from=bad&to=2026-10-28")).preset).toBe("this_month")
  })
})
