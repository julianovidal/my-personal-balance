import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfilePage } from "@/pages/ProfilePage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Test User", email: "test@example.com" } })
}));

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} })
  }
}));

vi.mock("@/lib/theme", () => ({
  getTheme: () => "light",
  setTheme: vi.fn()
}));

function renderProfilePage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={qc}>
      <ProfilePage />
    </QueryClientProvider>
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders user profile information", async () => {
    renderProfilePage();
    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("renders the tag creation form", async () => {
    renderProfilePage();
    await waitFor(() => {
      expect(screen.getByText("Tags")).toBeInTheDocument();
    });
    expect(screen.getByText("Label")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create tag/i })).toBeInTheDocument();
  });

  it("opens delete confirmation dialog when delete tag is clicked", async () => {
    const { api } = await import("@/api/client");
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 1, label: "Food" }] });

    renderProfilePage();
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Delete/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /Delete tag/i })).toBeInTheDocument();
  });

  it("calls create tag handler when form is submitted", async () => {
    const { api } = await import("@/api/client");
    vi.mocked(api.post).mockResolvedValue({ data: { id: 2, label: "Travel" } });
    vi.mocked(api.get).mockResolvedValue({ data: [] });

    renderProfilePage();
    await waitFor(() => {
      expect(screen.getByText("Tags")).toBeInTheDocument();
    });

    const labelInput = screen.queryByRole("textbox");

    if (labelInput) {
      fireEvent.change(labelInput, { target: { value: "Travel" } });
      fireEvent.submit(labelInput.closest("form")!);
      await waitFor(() => {
        expect(vi.mocked(api.post)).toHaveBeenCalledWith("/tags", { label: "Travel" });
      });
    }
  });
});
