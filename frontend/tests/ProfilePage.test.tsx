import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ProfilePage } from "@/pages/ProfilePage"

import { renderWithProviders } from "./render"

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock("@/api/client", () => ({ api }))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, name: "Ana Souza", email: "ana@example.com" } }),
}))

const TAGS = [
  { id: 1, label: "Food", user_id: 1 },
  { id: 2, label: "Rent", user_id: 1 },
]

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    api.get.mockResolvedValue({ data: TAGS })
    api.post.mockResolvedValue({ data: {} })
    api.put.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: { ok: true } })
  })

  it("shows the user's name, email and initials", () => {
    renderWithProviders(<ProfilePage />)
    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
    expect(screen.getByText("ana@example.com")).toBeInTheDocument()
    expect(screen.getByText("AS")).toBeInTheDocument()
  })

  it("lists tags with a count", async () => {
    renderWithProviders(<ProfilePage />)
    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.getByText("Rent")).toBeInTheDocument()
    expect(screen.getByText("2 tags")).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith("/tags")
  })

  it("shows an empty state when there are no tags", async () => {
    api.get.mockResolvedValue({ data: [] })
    renderWithProviders(<ProfilePage />)
    expect(await screen.findByText(/No tags yet/)).toBeInTheDocument()
  })

  it("creates a trimmed tag and clears the input", async () => {
    renderWithProviders(<ProfilePage />)
    const input = screen.getByLabelText("New tag label")
    expect(screen.getByRole("button", { name: "Add tag" })).toBeDisabled()
    await userEvent.type(input, "  Travel  ")
    await userEvent.click(screen.getByRole("button", { name: "Add tag" }))
    expect(api.post).toHaveBeenCalledWith("/tags", { label: "Travel" })
    await waitFor(() => expect(input).toHaveValue(""))
  })

  it("shows the backend error when creating fails", async () => {
    const config = { headers: {} } as InternalAxiosRequestConfig
    api.post.mockRejectedValue(
      new AxiosError("x", undefined, config, null, {
        status: 400,
        statusText: "",
        headers: {},
        config,
        data: { detail: "Tag already exists" },
      })
    )
    renderWithProviders(<ProfilePage />)
    await userEvent.type(screen.getByLabelText("New tag label"), "Food")
    await userEvent.click(screen.getByRole("button", { name: "Add tag" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Tag already exists")
  })

  it("renames a tag inline", async () => {
    renderWithProviders(<ProfilePage />)
    await userEvent.click(await screen.findByRole("button", { name: "Rename Food" }))
    const input = screen.getByLabelText("New name for Food")
    await userEvent.clear(input)
    await userEvent.type(input, "Groceries")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(api.put).toHaveBeenCalledWith("/tags/1", { label: "Groceries" })
    await waitFor(() => expect(screen.queryByLabelText("New name for Food")).not.toBeInTheDocument())
  })

  it("cancels a rename with Escape", async () => {
    renderWithProviders(<ProfilePage />)
    await userEvent.click(await screen.findByRole("button", { name: "Rename Food" }))
    await userEvent.keyboard("{Escape}")
    expect(screen.queryByLabelText("New name for Food")).not.toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
  })

  it("asks for confirmation before deleting a tag", async () => {
    renderWithProviders(<ProfilePage />)
    await userEvent.click(await screen.findByRole("button", { name: "Delete Rent" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText('Delete tag "Rent"?')).toBeInTheDocument()
    expect(api.delete).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete tag" }))
    expect(api.delete).toHaveBeenCalledWith("/tags/2")
  })

  it("does not delete when the dialog is cancelled", async () => {
    renderWithProviders(<ProfilePage />)
    await userEvent.click(await screen.findByRole("button", { name: "Delete Rent" }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(api.delete).not.toHaveBeenCalled()
  })

  it("switches the theme and stores the choice", async () => {
    renderWithProviders(<ProfilePage />)
    await userEvent.click(screen.getByRole("button", { name: "Dark" }))
    expect(document.documentElement).toHaveClass("dark")
    expect(localStorage.getItem("theme")).toBe("dark")
  })
})
