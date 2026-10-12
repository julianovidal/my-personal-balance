import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { api } from "@/api/client";
import { TransactionsPage } from "@/pages/TransactionsPage";
import { Transaction } from "@/types";

const parentTransaction: Transaction = {
  id: 1,
  date: "2026-10-01",
  description: "Grocery store",
  account_id: 1,
  tag_id: null,
  amount: "-100.00",
  currency: "EUR",
  is_transfer: false,
  transfer_group_id: null,
  transfer_direction: null,
  linked_account_id: null,
  parent_transaction_id: null
};

const secondTransaction: Transaction = {
  id: 2,
  date: "2026-10-02",
  description: "Coffee shop",
  account_id: 1,
  tag_id: null,
  amount: "-5.00",
  currency: "EUR",
  is_transfer: false,
  transfer_group_id: null,
  transfer_direction: null,
  linked_account_id: null,
  parent_transaction_id: null
};

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} })
  }
}));

function renderTransactionsPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/transactions"]}>
        <TransactionsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function openSplitDialog(user: ReturnType<typeof userEvent.setup>) {
  renderTransactionsPage();
  await screen.findByText("Grocery store");
  await user.click(screen.getByRole("button", { name: "Open actions menu" }));
  await user.click(screen.getByRole("button", { name: "Split" }));
  return screen.findByRole("dialog");
}

describe("TransactionsPage split dialog", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/accounts") {
        return { data: [{ id: 1, name: "Checking", currency: "EUR", user_id: 1 }] };
      }
      if (url === "/tags") {
        return { data: [{ id: 7, label: "Food", user_id: 1 }] };
      }
      if (url.includes("/splits")) {
        return { data: { parent: parentTransaction, rows: [], remaining_amount: "100.00" } };
      }
      if (url.startsWith("/transactions?")) {
        return {
          data: {
            items: [parentTransaction],
            total: 1,
            page: 1,
            page_size: 20,
            total_pages: 1
          }
        };
      }
      if (url.includes("/summary")) {
        return { data: { overall: { income: "0.00", expenses: "0.00", net: "0.00" }, by_account: [] } };
      }
      if (url.includes("/analytics")) {
        return { data: { by_tag: [], by_account: [] } };
      }
      return { data: [] };
    });
  });

  it("keeps focus in the split amount field while typing", async () => {
    const user = userEvent.setup();
    const dialog = await openSplitDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Add row" }));

    const amount = within(dialog).getByPlaceholderText("0.00");
    await user.type(amount, "12.50");

    expect(amount).toHaveValue("12.50");
    expect(amount).toHaveFocus();
    expect(within(dialog).getByText("Missing Spllited Transactions: 87.50")).toBeInTheDocument();
  });

  it("keeps focus in the split description field while typing", async () => {
    const user = userEvent.setup();
    const dialog = await openSplitDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Add row" }));

    const description = within(dialog).getByPlaceholderText("Description");
    await user.type(description, "Groceries");

    expect(description).toHaveValue("Groceries");
    expect(description).toHaveFocus();
  });

  it("moves focus into the dialog when it opens", async () => {
    const user = userEvent.setup();
    const dialog = await openSplitDialog(user);

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("keeps focus on the tag select after a choice", async () => {
    const user = userEvent.setup();
    const dialog = await openSplitDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Add row" }));

    const tag = within(dialog).getByRole("combobox");
    await user.selectOptions(tag, "7");

    expect(tag).toHaveValue("7");
    expect(tag).toHaveFocus();
  });

  it("closes with Escape after an amount is typed", async () => {
    const user = userEvent.setup();
    const dialog = await openSplitDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Add row" }));
    await user.type(within(dialog).getByPlaceholderText("0.00"), "12.50");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes from the close button after an amount is typed", async () => {
    const user = userEvent.setup();
    const dialog = await openSplitDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Add row" }));
    await user.type(within(dialog).getByPlaceholderText("0.00"), "12.50");

    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes from the backdrop after an amount is typed", async () => {
    const user = userEvent.setup();
    const dialog = await openSplitDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Add row" }));
    await user.type(within(dialog).getByPlaceholderText("0.00"), "12.50");

    const overlay = dialog.previousElementSibling;
    expect(overlay).toBeInstanceOf(HTMLElement);
    fireEvent.click(overlay as HTMLElement);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("TransactionsPage row actions menu", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/accounts") {
        return { data: [{ id: 1, name: "Checking", currency: "EUR", user_id: 1 }] };
      }
      if (url === "/tags") {
        return { data: [] };
      }
      if (url.startsWith("/transactions?")) {
        return {
          data: {
            items: [parentTransaction, secondTransaction],
            total: 2,
            page: 1,
            page_size: 20,
            total_pages: 1
          }
        };
      }
      if (url.includes("/summary")) {
        return { data: { overall: { income: "0.00", expenses: "0.00", net: "0.00" }, by_account: [] } };
      }
      if (url.includes("/analytics")) {
        return { data: { by_tag: [], by_account: [] } };
      }
      return { data: [] };
    });
  });

  it("portals the actions menu outside the table overflow wrapper on the last row", async () => {
    const user = userEvent.setup();
    renderTransactionsPage();
    await screen.findByText("Coffee shop");

    const menuButtons = screen.getAllByRole("button", { name: "Open actions menu" });
    await user.click(menuButtons[menuButtons.length - 1]);

    const edit = screen.getByRole("button", { name: "Edit" });
    const panel = document.querySelector('[data-actions-menu-panel="true"]');
    const tableScrollWrapper = screen.getByText("Coffee shop").closest(".overflow-x-auto");

    expect(panel).toBeTruthy();
    expect(panel?.parentElement).toBe(document.body);
    expect(tableScrollWrapper?.contains(edit)).toBe(false);
    expect(edit).toBeVisible();
  });

  it("opens edit from the last row actions menu", async () => {
    const user = userEvent.setup();
    renderTransactionsPage();
    await screen.findByText("Coffee shop");

    const menuButtons = screen.getAllByRole("button", { name: "Open actions menu" });
    await user.click(menuButtons[menuButtons.length - 1]);
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Edit transaction");
    expect(screen.getByDisplayValue("Coffee shop")).toBeInTheDocument();
  });
});
