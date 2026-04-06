import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountsPage } from "@/pages/AccountsPage";

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} })
  }
}));

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

  it("renders the import mapping form with account label", async () => {
    renderAccountsPage();
    await waitFor(() => {
      expect(screen.getByText("Account import settings")).toBeInTheDocument();
    });
    expect(screen.getByText("Date column name")).toBeInTheDocument();
    expect(screen.getByText("Save mapping")).toBeInTheDocument();
  });
});
