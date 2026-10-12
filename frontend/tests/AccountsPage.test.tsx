import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountsPage } from "@/pages/AccountsPage";
import { api } from "@/api/client";

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} })
  }
}));

const sampleAccount = { id: 1, name: "Checking", currency: "EUR" };

function mockAccountsApi() {
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url === "/accounts") {
      return { data: [sampleAccount] };
    }
    if (url === "/accounts/balances") {
      return {
        data: {
          overall_balance: "100.00",
          by_account: [{ account_id: 1, balance: "100.00" }]
        }
      };
    }
    if (url === "/accounts/1/import-mapping") {
      return {
        data: {
          date_column: "transaction_date",
          description_column: "details",
          amount_column: "value",
          currency_column: "curr",
          tag_id_column: ""
        }
      };
    }
    return { data: [] };
  });
}

function renderAccountsPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={qc}>
      <AccountsPage />
    </QueryClientProvider>
  );
}

describe("AccountsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountsApi();
  });

  it("renders accounts section with Add account button", async () => {
    renderAccountsPage();
    await waitFor(() => {
      expect(screen.getByText("Your accounts")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Add account")[0]).toBeInTheDocument();
  });

  it("opens the account dialog when Add account is clicked", async () => {
    renderAccountsPage();
    await waitFor(() => {
      expect(screen.getAllByText("Add account")[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Add account")[0]);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByText("Add account", { selector: "*[role='heading'], h2, [data-slot='dialog-title']" })).toBeInTheDocument();
  });

  it("keeps focus in the account name field while typing", async () => {
    const user = userEvent.setup();
    renderAccountsPage();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Add account" })[0]).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: "Add account" })[0]);
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByRole("textbox");
    await user.type(name, "Checking");

    expect(name).toHaveValue("Checking");
    expect(name).toHaveFocus();
  });

  it("does not render the page-level import settings card", async () => {
    renderAccountsPage();
    await waitFor(() => {
      expect(screen.getByText("Checking")).toBeInTheDocument();
    });
    expect(screen.queryByText("Account import settings")).not.toBeInTheDocument();
  });

  it("opens import settings modal for an account and loads mapping", async () => {
    const user = userEvent.setup();
    renderAccountsPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Import settings for Checking" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Import settings for Checking" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /Import settings — Checking/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(dialog).getByDisplayValue("transaction_date")).toBeInTheDocument();
    });
    expect(within(dialog).getByDisplayValue("details")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("value")).toBeInTheDocument();
  });

  it("saves import mapping and closes the modal", async () => {
    const user = userEvent.setup();
    renderAccountsPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Import settings for Checking" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Import settings for Checking" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByDisplayValue("transaction_date")).toBeInTheDocument();
    });

    const dateInput = within(dialog).getByDisplayValue("transaction_date");
    await user.clear(dateInput);
    await user.type(dateInput, "posted_date");
    await user.click(within(dialog).getByRole("button", { name: "Save mapping" }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith("/accounts/1/import-mapping", {
        date_column: "posted_date",
        description_column: "details",
        amount_column: "value",
        currency_column: "curr",
        tag_id_column: ""
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("keeps in-progress import field edits when mapping is refetched", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    render(
      <QueryClientProvider client={qc}>
        <AccountsPage />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Import settings for Checking" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Import settings for Checking" }));
    const importDialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(within(importDialog).getByDisplayValue("transaction_date")).toBeInTheDocument();
    });

    const dateInput = within(importDialog).getByDisplayValue("transaction_date");
    await user.clear(dateInput);
    await user.type(dateInput, "posted_from_clipboard");

    await qc.invalidateQueries({ queryKey: ["account-import-mapping", "1"] });
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/accounts/1/import-mapping");
    });

    expect(within(importDialog).getByDisplayValue("posted_from_clipboard")).toBeInTheDocument();
  });

  it("confirms discard when closing with unsaved changes", async () => {
    const user = userEvent.setup();
    renderAccountsPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Import settings for Checking" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Import settings for Checking" }));
    const importDialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(within(importDialog).getByDisplayValue("transaction_date")).toBeInTheDocument();
    });

    const dateInput = within(importDialog).getByDisplayValue("transaction_date");
    await user.clear(dateInput);
    await user.type(dateInput, "changed");

    await user.click(within(importDialog).getByRole("button", { name: "Cancel" }));

    const discardDialog = await screen.findByRole("dialog", { name: /Discard changes/i });
    expect(discardDialog).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();

    await user.click(within(discardDialog).getByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(api.put).not.toHaveBeenCalled();
  });
});
