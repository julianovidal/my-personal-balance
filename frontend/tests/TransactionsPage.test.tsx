import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { rangeForPreset } from "@/pages/transactions/dates"
import { TransactionsPage } from "@/pages/TransactionsPage"
import type { Transaction } from "@/types"

import { renderWithProviders } from "./render"

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock("@/api/client", () => ({ api }))

// Recharts needs layout sizes that happy-dom does not compute; charts are not under test here.
vi.mock("@/pages/transactions/ExpenseCharts", () => ({ ExpenseCharts: () => null }))

const ACCOUNTS = [
  { id: 1, name: "Checking", currency: "EUR", user_id: 1 },
  { id: 2, name: "Savings", currency: "EUR", user_id: 1 },
]
const TAGS = [{ id: 5, label: "Food", user_id: 1 }]

const tx = (patch: Partial<Transaction>): Transaction => ({
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
  ...patch,
})

const ITEMS = [
  tx({}),
  tx({
    id: 2,
    description: "Move to savings",
    amount: "-200.00",
    tag_id: null,
    is_transfer: true,
    transfer_direction: "out",
    linked_account_id: 2,
  }),
  tx({ id: 3, description: "Groceries part", amount: "-20.00", parent_transaction_id: 9 }),
  tx({ id: -9, description: "Missing Spllited Transactions", amount: "-5.00", tag_id: null, parent_transaction_id: 9 }),
]

let mapping: Record<string, string | null> = {
  account_id: "1",
  date_column: "Date",
  description_column: null,
  amount_column: null,
  currency_column: null,
  tag_id_column: null,
}

function routeGet(url: string) {
  if (url === "/accounts") return ACCOUNTS
  if (url === "/tags") return TAGS
  if (url.startsWith("/transactions?"))
    return { items: ITEMS, total: 45, page: Number(new URLSearchParams(url.split("?")[1]).get("page")), page_size: 20, total_pages: 3 }
  if (url.startsWith("/transactions/summary/monthly"))
    return { overall: { income: "1000.00", expenses: "250.50", net: "749.50" }, by_account: [] }
  if (url.match(/^\/accounts\/\d+\/import-mapping$/)) return mapping
  if (url === "/transactions/9/splits")
    return {
      parent: tx({ id: 9, description: "Supermarket", amount: "-25.00", tag_id: null }),
      rows: [tx({ id: 3, description: "Groceries part", amount: "-20.00", parent_transaction_id: 9 })],
      remaining_amount: "-5.00",
    }
  throw new Error(`unmocked GET ${url}`)
}

const listCalls = () =>
  api.get.mock.calls.map(([u]) => u as string).filter((u) => u.startsWith("/transactions?"))
const lastListParams = () => new URLSearchParams(listCalls().at(-1)!.split("?")[1])

function renderPage(route = "/transactions") {
  return renderWithProviders(
    <Routes>
      <Route path="/transactions" element={<TransactionsPage />} />
    </Routes>,
    { route }
  )
}

async function pick(label: string, option: string, scope: HTMLElement = document.body) {
  await userEvent.click(within(scope).getByLabelText(label))
  await userEvent.click(await screen.findByRole("option", { name: option }))
}

async function openRowMenu(description: string) {
  await userEvent.click(await screen.findByRole("button", { name: `Actions for ${description}` }))
  return screen.findByRole("menu")
}

describe("TransactionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mapping = { ...mapping, date_column: "Date" }
    api.get.mockImplementation(async (url: string) => ({ data: routeGet(url) }))
    api.post.mockResolvedValue({ data: {} })
    api.put.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: { ok: true } })
  })

  describe("list and filters", () => {
    it("loads this month by default and shows rows with their own currency", async () => {
      renderPage()
      expect(await screen.findByText("Coffee")).toBeInTheDocument()
      const { from, to } = rangeForPreset("this_month")
      expect(lastListParams().get("date_from")).toBe(from)
      expect(lastListParams().get("date_to")).toBe(to)
      expect(lastListParams().has("account_id")).toBe(false)
      expect(screen.getByText("-€3.50")).toBeInTheDocument()
    })

    it("labels transfers, split parts and the unsplit remainder", async () => {
      renderPage()
      const transfer = (await screen.findByText("Move to savings")).closest("tr")!
      expect(within(transfer).getByText(/To Savings/)).toBeInTheDocument()
      const part = screen.getByText("Groceries part").closest("tr")!
      expect(within(part).getByText("Split")).toBeInTheDocument()
      expect(screen.getByText("Not yet split")).toBeInTheDocument()
      expect(screen.queryByText("Missing Spllited Transactions")).not.toBeInTheDocument()
    })

    it("shows summary totals in the shared currency", async () => {
      renderPage()
      expect(await screen.findByText("€1,000.00")).toBeInTheDocument()
      expect(screen.getByText("€250.50")).toBeInTheDocument()
      expect(screen.getByText("€749.50")).toBeInTheDocument()
    })

    it("adds the account filter and returns to page 1", async () => {
      renderPage()
      await screen.findByText("Coffee")
      await userEvent.click(screen.getByRole("button", { name: "Next page" }))
      await waitFor(() => expect(lastListParams().get("page")).toBe("2"))
      await pick("Account", "Savings")
      await waitFor(() => expect(lastListParams().get("account_id")).toBe("2"))
      expect(lastListParams().get("page")).toBe("1")
    })

    it("moves the period one month back", async () => {
      renderPage()
      await screen.findByText("Coffee")
      const { from } = rangeForPreset("last_month")
      await userEvent.click(screen.getByRole("button", { name: "Previous month" }))
      await waitFor(() => expect(lastListParams().get("date_from")).toBe(from))
    })

    it("debounces the search before querying", async () => {
      renderPage()
      await screen.findByText("Coffee")
      const before = listCalls().length
      await userEvent.type(screen.getByLabelText("Search descriptions"), "cof")
      await waitFor(() => expect(lastListParams().get("search_text")).toBe("cof"))
      // One request for the final text, not one per keystroke.
      expect(listCalls().length - before).toBe(1)
    })
  })

  describe("add and edit", () => {
    it("adds an expense with a negative decimal-string amount", async () => {
      renderPage()
      await userEvent.click(await screen.findByRole("button", { name: /Add transaction/ }))
      const dialog = await screen.findByRole("dialog")
      await pick("Account", "Checking", dialog)
      await pick("Tag", "Food", dialog)
      await userEvent.type(within(dialog).getByLabelText("Description"), "Lunch")
      await userEvent.type(within(dialog).getByLabelText("Amount"), "12,5")
      await userEvent.click(within(dialog).getByRole("button", { name: "Add transaction" }))
      expect(api.post).toHaveBeenCalledWith(
        "/transactions",
        expect.objectContaining({
          account_id: 1,
          description: "Lunch",
          amount: "-12.50",
          tag_id: 5,
          is_transfer: false,
          destination_account_id: null,
          currency: "EUR",
        })
      )
    })

    it("shows field errors instead of sending an incomplete form", async () => {
      renderPage()
      await userEvent.click(await screen.findByRole("button", { name: /Add transaction/ }))
      const dialog = await screen.findByRole("dialog")
      await userEvent.click(within(dialog).getByRole("button", { name: "Add transaction" }))
      expect(within(dialog).getByText("Choose an account.")).toBeInTheDocument()
      expect(within(dialog).getByText("Enter an amount like 12.50.")).toBeInTheDocument()
      expect(api.post).not.toHaveBeenCalled()
    })

    it("creates a transfer without a tag", async () => {
      renderPage()
      await userEvent.click(await screen.findByRole("button", { name: /Add transaction/ }))
      const dialog = await screen.findByRole("dialog")
      await userEvent.click(within(dialog).getByRole("button", { name: "Transfer" }))
      await pick("From account", "Checking", dialog)
      await pick("To account", "Savings", dialog)
      await userEvent.type(within(dialog).getByLabelText("Description"), "Move")
      await userEvent.type(within(dialog).getByLabelText("Amount"), "100")
      await userEvent.click(within(dialog).getByRole("button", { name: "Add transaction" }))
      expect(api.post).toHaveBeenCalledWith(
        "/transactions",
        expect.objectContaining({
          account_id: 1,
          destination_account_id: 2,
          amount: "100.00",
          tag_id: null,
          is_transfer: true,
        })
      )
    })

    it("edits a transaction with its values prefilled", async () => {
      renderPage()
      const menu = await openRowMenu("Coffee")
      await userEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }))
      const dialog = await screen.findByRole("dialog")
      expect(within(dialog).getByLabelText("Amount")).toHaveValue("3.50")
      await userEvent.clear(within(dialog).getByLabelText("Description"))
      await userEvent.type(within(dialog).getByLabelText("Description"), "Espresso")
      await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }))
      expect(api.put).toHaveBeenCalledWith(
        "/transactions/1",
        expect.objectContaining({ description: "Espresso", amount: "-3.50", tag_id: 5 })
      )
    })

    it("opens the add dialog from ?action=add", async () => {
      renderPage("/transactions?action=add")
      expect(await screen.findByRole("heading", { name: "Add transaction" })).toBeInTheDocument()
    })
  })

  describe("row actions", () => {
    it("deletes after confirmation and warns about transfer pairs", async () => {
      renderPage()
      const menu = await openRowMenu("Move to savings")
      await userEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }))
      const dialog = await screen.findByRole("alertdialog")
      expect(within(dialog).getByText(/Both sides of the transfer are deleted/)).toBeInTheDocument()
      await userEvent.click(within(dialog).getByRole("button", { name: "Delete transaction" }))
      expect(api.delete).toHaveBeenCalledWith("/transactions/2")
    })

    it("offers only the split editor on split parts and the remainder", async () => {
      renderPage()
      const menu = await openRowMenu("Missing Spllited Transactions")
      expect(within(menu).queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument()
      expect(within(menu).queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument()
      expect(within(menu).getByRole("menuitem", { name: "Edit split" })).toBeInTheDocument()
    })

    it("does not offer split on transfers", async () => {
      renderPage()
      const menu = await openRowMenu("Move to savings")
      expect(within(menu).queryByRole("menuitem", { name: /Split/ })).not.toBeInTheDocument()
    })
  })

  describe("split", () => {
    async function openSplit() {
      renderPage()
      const menu = await openRowMenu("Groceries part")
      await userEvent.click(within(menu).getByRole("menuitem", { name: "Edit split" }))
      return screen.findByRole("dialog")
    }

    it("loads the parent and updates what is left while typing, keeping focus", async () => {
      const dialog = await openSplit()
      expect(api.get).toHaveBeenCalledWith("/transactions/9/splits")
      expect(await within(dialog).findByText("Supermarket")).toBeInTheDocument()
      expect(within(dialog).getByTestId("split-remaining")).toHaveTextContent("€5.00")

      await userEvent.click(within(dialog).getByRole("button", { name: "Add part" }))
      const amount = within(dialog).getByLabelText("Part 2 amount")
      expect(amount).toHaveValue("5.00")
      await userEvent.clear(amount)
      await userEvent.type(amount, "2.50")
      expect(amount).toHaveFocus()
      expect(amount).toHaveValue("2.50")
      expect(within(dialog).getByTestId("split-remaining")).toHaveTextContent("€2.50")

      const description = within(dialog).getByLabelText("Part 2 description")
      await userEvent.type(description, "Snacks")
      expect(description).toHaveFocus()
      expect(description).toHaveValue("Snacks")
    })

    it("blocks saving when the parts exceed the total", async () => {
      const dialog = await openSplit()
      const amount = await within(dialog).findByLabelText("Part 1 amount")
      await userEvent.clear(amount)
      await userEvent.type(amount, "30")
      expect(within(dialog).getByTestId("split-remaining")).toHaveTextContent("Over by €5.00")
      expect(within(dialog).getByRole("button", { name: "Save splits" })).toBeDisabled()
    })

    it("saves parts as decimal strings with their ids", async () => {
      const dialog = await openSplit()
      await userEvent.click(await within(dialog).findByRole("button", { name: "Add part" }))
      await userEvent.type(within(dialog).getByLabelText("Part 2 description"), "Snacks")
      await userEvent.click(within(dialog).getByRole("button", { name: "Save splits" }))
      expect(api.put).toHaveBeenCalledWith("/transactions/9/splits", {
        rows: [
          { id: 3, description: "Groceries part", amount: "20.00", tag_id: 5 },
          { id: null, description: "Snacks", amount: "5.00", tag_id: null },
        ],
      })
    })
  })

  describe("import", () => {
    async function openImport() {
      renderPage()
      await userEvent.click(await screen.findByRole("button", { name: /Import/ }))
      return screen.findByRole("dialog")
    }

    it("keeps Preview disabled with no account and shows no warning", async () => {
      const dialog = await openImport()
      expect(within(dialog).getByRole("button", { name: "Preview import" })).toBeDisabled()
      expect(within(dialog).queryByText(/no import settings/)).not.toBeInTheDocument()
    })

    it("warns and links to Accounts when the account has no mapping", async () => {
      mapping = { ...mapping, date_column: null }
      const dialog = await openImport()
      await pick("Account", "Checking", dialog)
      expect(await within(dialog).findByText(/no import settings configured/)).toBeInTheDocument()
      expect(within(dialog).getByRole("link", { name: "Accounts" })).toHaveAttribute("href", "/accounts")
      await userEvent.upload(within(dialog).getByLabelText("File"), new File(["x"], "a.csv"))
      expect(within(dialog).getByRole("button", { name: "Preview import" })).toBeDisabled()
    })

    it("previews, then imports the valid rows", async () => {
      api.post.mockImplementation(async (url: string) => {
        if (url.startsWith("/transactions/import/preview/1"))
          return {
            data: {
              total_rows: 2,
              valid_rows: 1,
              invalid_rows: 1,
              preview: [
                { row: 1, date: "2026-03-01", description: "Shop", amount: "-9.99", currency: "EUR", tag_id: null, status: "ok", message: null },
                { row: 2, date: "2026-03-02", description: "Bad", amount: "0", currency: null, tag_id: null, status: "error", message: "Invalid amount" },
              ],
              errors: [{ row: 2, message: "Invalid amount" }],
            },
          }
        return { data: { imported: 1, skipped: 1 } }
      })
      const dialog = await openImport()
      await pick("Account", "Checking", dialog)
      await pick("Default tag", "Food", dialog)
      await userEvent.upload(within(dialog).getByLabelText("File"), new File(["x"], "a.csv"))
      const preview = within(dialog).getByRole("button", { name: "Preview import" })
      await waitFor(() => expect(preview).toBeEnabled())
      await userEvent.click(preview)

      expect(await within(dialog).findByText("Shop")).toBeInTheDocument()
      expect(within(dialog).getAllByText("Invalid amount").length).toBeGreaterThan(0)
      expect(api.post.mock.calls[0][0]).toBe("/transactions/import/preview/1?default_tag_id=5")
      expect(api.post.mock.calls[0][1]).toBeInstanceOf(FormData)

      await userEvent.click(within(dialog).getByRole("button", { name: "Import 1 row" }))
      expect(await within(dialog).findByRole("status")).toHaveTextContent("Imported 1 row, skipped 1.")
      expect(api.post.mock.calls[1][0]).toBe("/transactions/import/1?default_tag_id=5")
    })
  })
})
