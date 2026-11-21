import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AccountsPage } from "@/pages/AccountsPage"

import { renderWithProviders } from "./render"

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock("@/api/client", () => ({ api }))

const ACCOUNTS = [
  { id: 1, name: "Checking", currency: "EUR", user_id: 1 },
  { id: 2, name: "Brazil", currency: "BRL", user_id: 1 },
  { id: 3, name: "Savings", currency: "EUR", user_id: 1 },
]
const BALANCES = {
  overall_balance: 999,
  by_account: [
    { account_id: 1, account_name: "Checking", currency: "EUR", balance: 0.1 },
    { account_id: 2, account_name: "Brazil", currency: "BRL", balance: -50 },
    { account_id: 3, account_name: "Savings", currency: "EUR", balance: 0.2 },
  ],
}
const MAPPING = {
  account_id: 1,
  date_column: "Date",
  description_column: "Memo",
  amount_column: "Value",
  currency_column: null,
  tag_id_column: null,
}

function mockGets(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    "/accounts": ACCOUNTS,
    "/accounts/balances": BALANCES,
    "/accounts/1/import-mapping": MAPPING,
    ...overrides,
  }
  api.get.mockImplementation(async (url: string) => ({ data: routes[url] }))
}

async function openActions(name: string) {
  await userEvent.click(await screen.findByRole("button", { name: `Actions for ${name}` }))
  return screen.findByRole("menu")
}

describe("AccountsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGets()
    api.post.mockResolvedValue({ data: {} })
    api.put.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: { ok: true } })
  })

  it("lists accounts with balances in their own currency", async () => {
    renderWithProviders(<AccountsPage />)
    const row = (await screen.findByText("Checking")).closest("tr")!
    expect(within(row).getByText("€0.10")).toBeInTheDocument()
    const brazil = screen.getByText("Brazil").closest("tr")!
    expect(within(brazil).getByText("-R$50.00")).toBeInTheDocument()
  })

  it("shows one total per currency instead of a mixed overall", async () => {
    renderWithProviders(<AccountsPage />)
    expect(await screen.findByText("Total in EUR")).toBeInTheDocument()
    expect(screen.getByText("€0.30")).toBeInTheDocument()
    expect(screen.getByText("Total in BRL")).toBeInTheDocument()
    expect(screen.queryByText("999")).not.toBeInTheDocument()
  })

  it("shows an empty state", async () => {
    mockGets({ "/accounts": [], "/accounts/balances": { overall_balance: 0, by_account: [] } })
    renderWithProviders(<AccountsPage />)
    expect(await screen.findByText("No accounts yet")).toBeInTheDocument()
  })

  it("creates an account with a trimmed name and the default currency", async () => {
    renderWithProviders(<AccountsPage />)
    await userEvent.click(screen.getByRole("button", { name: "Add account" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText("Name"), "  Wallet  ")
    await userEvent.click(within(dialog).getByRole("button", { name: "Create account" }))
    expect(api.post).toHaveBeenCalledWith("/accounts", { name: "Wallet", currency: "EUR" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("keeps focus in the name field while typing", async () => {
    renderWithProviders(<AccountsPage />)
    await userEvent.click(screen.getByRole("button", { name: "Add account" }))
    const input = within(await screen.findByRole("dialog")).getByLabelText("Name")
    await userEvent.type(input, "Abc")
    expect(input).toHaveFocus()
    expect(input).toHaveValue("Abc")
  })

  it("edits an account, prefilled, and can change the currency", async () => {
    renderWithProviders(<AccountsPage />)
    const menu = await openActions("Brazil")
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Brazil")
    await userEvent.click(within(dialog).getByLabelText("Currency"))
    await userEvent.click(await screen.findByRole("option", { name: "USD" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }))
    expect(api.put).toHaveBeenCalledWith("/accounts/2", { name: "Brazil", currency: "USD" })
  })

  it("warns that deleting removes transactions, then deletes", async () => {
    renderWithProviders(<AccountsPage />)
    const menu = await openActions("Savings")
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/transactions are deleted with it/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete account" }))
    expect(api.delete).toHaveBeenCalledWith("/accounts/3")
  })

  it("opens import settings with the saved mapping and saves changes", async () => {
    renderWithProviders(<AccountsPage />)
    const menu = await openActions("Checking")
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Import settings" }))
    const date = await screen.findByLabelText("Date column")
    expect(date).toHaveValue("Date")
    expect(api.get).toHaveBeenCalledWith("/accounts/1/import-mapping")
    await userEvent.type(screen.getByLabelText("Currency column"), "Curr")
    await userEvent.click(screen.getByRole("button", { name: "Save mapping" }))
    expect(api.put).toHaveBeenCalledWith("/accounts/1/import-mapping", {
      date_column: "Date",
      description_column: "Memo",
      amount_column: "Value",
      currency_column: "Curr",
      tag_id_column: "",
    })
    await waitFor(() => expect(screen.queryByLabelText("Date column")).not.toBeInTheDocument())
  })

  it("asks before discarding unsaved import settings", async () => {
    renderWithProviders(<AccountsPage />)
    const menu = await openActions("Checking")
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Import settings" }))
    await userEvent.type(await screen.findByLabelText("Amount column"), "X")
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))

    const confirm = await screen.findByRole("alertdialog")
    await userEvent.click(within(confirm).getByRole("button", { name: "Keep editing" }))
    expect(screen.getByLabelText("Amount column")).toHaveValue("ValueX")

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Discard" })
    )
    await waitFor(() => expect(screen.queryByLabelText("Amount column")).not.toBeInTheDocument())
    expect(api.put).not.toHaveBeenCalled()
  })

  it("closes import settings without asking when nothing changed", async () => {
    renderWithProviders(<AccountsPage />)
    const menu = await openActions("Checking")
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Import settings" }))
    await screen.findByLabelText("Date column")
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByLabelText("Date column")).not.toBeInTheDocument())
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
