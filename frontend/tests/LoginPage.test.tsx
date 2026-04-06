import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";

const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister })
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form with email and password fields", () => {
    renderLoginPage();
    expect(screen.getByText("Expense Manager")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  it("calls login handler and navigates on valid form submission", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLoginPage();

    const emailInputs = screen.getAllByRole("textbox");
    const emailInput = emailInputs[0];
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: "user@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: /login/i }).closest("form")!);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("user@example.com", "password123");
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("shows error message when login fails", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Unauthorized"));
    renderLoginPage();

    const emailInputs = screen.getAllByRole("textbox");
    fireEvent.change(emailInputs[0], { target: { value: "bad@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /login/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/Authentication failed/i)).toBeInTheDocument();
    });
  });

  it("switches to register mode and shows name field", () => {
    renderLoginPage();
    fireEvent.click(screen.getByText(/Need an account\? Register/i));
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Account/i })).toBeInTheDocument();
  });
});
