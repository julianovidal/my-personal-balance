import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ClassifierPage } from "@/pages/ClassifierPage"

import { renderWithProviders } from "./render"

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
const classifierApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock("@/api/client", () => ({ api }))
vi.mock("@/api/classifierClient", () => ({ classifierApi }))

const ACCOUNTS = [
  { id: 1, name: "Checking", currency: "EUR", user_id: 1 },
  { id: 2, name: "Card", currency: "EUR", user_id: 1 },
]
const TAGS = [
  { id: 5, label: "Food", user_id: 1 },
  { id: 6, label: "Rent", user_id: 1 },
]
const UNTAGGED = {
  1: [
    { id: 10, date: "2026-03-01", description: "Bakery", account_id: 1, amount: "-4.20", currency: "EUR" },
    { id: 11, date: "2026-03-02", description: "Landlord", account_id: 1, amount: "-900.00", currency: "EUR" },
  ],
  2: [],
} as Record<number, unknown[]>

const META = {
  account_id: 1,
  user_id: 1,
  trained_at: "2026-03-05T10:00:00",
  model_name: "logreg",
  score: 0.8731,
  sample_count: 120,
  class_count: 6,
}

describe("ClassifierPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockImplementation(async (url: string) => ({ data: url === "/accounts" ? ACCOUNTS : TAGS }))
    api.put.mockResolvedValue({ data: {} })
    classifierApi.get.mockImplementation(async (_url: string, { params }: { params: { account_id: number } }) => ({
      data: UNTAGGED[params.account_id],
    }))
    classifierApi.post.mockImplementation(async (url: string) => {
      if (url === "/api/classifier/train") return { data: { trained: true, reason: null, meta: META } }
      return {
        data: {
          model_ready: true,
          reason: null,
          meta: META,
          predictions: [
            { transaction_id: 10, suggested_tag_id: 5, confidence: 0.91, low_confidence: false },
            { transaction_id: 11, suggested_tag_id: 6, confidence: 0.42, low_confidence: true },
          ],
        },
      }
    })
  })

  it("selects the first account and lists its untagged transactions", async () => {
    renderWithProviders(<ClassifierPage />)
    expect(await screen.findByText("Bakery")).toBeInTheDocument()
    expect(classifierApi.get).toHaveBeenCalledWith("/api/classifier/transactions/untagged", {
      params: { account_id: 1 },
    })
    expect(screen.getByText("-€900.00")).toBeInTheDocument()
  })

  it("retrains and shows the model details", async () => {
    renderWithProviders(<ClassifierPage />)
    await screen.findByText("Bakery")
    await userEvent.click(screen.getByRole("button", { name: /Retrain model/ }))
    expect(classifierApi.post).toHaveBeenCalledWith("/api/classifier/train", { account_id: 1 })
    expect(await screen.findByText("Model retrained.")).toBeInTheDocument()
    expect(screen.getByText("87%")).toBeInTheDocument()
    expect(screen.getByText(/logreg · 120 samples · 6 tags/)).toBeInTheDocument()
  })

  it("shows why training was refused", async () => {
    classifierApi.post.mockResolvedValueOnce({
      data: { trained: false, reason: "Need at least 2 different tags in training data", meta: null },
    })
    renderWithProviders(<ClassifierPage />)
    await screen.findByText("Bakery")
    await userEvent.click(screen.getByRole("button", { name: /Retrain model/ }))
    expect(await screen.findByRole("status")).toHaveTextContent("Need at least 2 different tags")
  })

  it("predicts for the loaded rows and fills the tag pickers", async () => {
    renderWithProviders(<ClassifierPage />)
    await screen.findByText("Bakery")
    await userEvent.click(screen.getByRole("button", { name: /Predict all/ }))
    expect(classifierApi.post).toHaveBeenCalledWith("/api/classifier/predict", {
      account_id: 1,
      transaction_ids: [10, 11],
    })
    expect(await screen.findByText("Suggested tags for 2 transactions, 1 with low confidence.")).toBeInTheDocument()
    expect(screen.getByText("91%")).toBeInTheDocument()
    expect(screen.getByLabelText("Tag for Bakery")).toHaveTextContent("Food")
    expect(screen.getByLabelText("Tag for Landlord")).toHaveTextContent("Rent")
  })

  it("marks only low-confidence suggestions and still fills their tag pickers", async () => {
    renderWithProviders(<ClassifierPage />)
    await screen.findByText("Bakery")
    await userEvent.click(screen.getByRole("button", { name: /Predict all/ }))
    await screen.findByText("Suggested tags for 2 transactions, 1 with low confidence.")
    const landlord = screen.getByText("Landlord").closest("tr")!
    const bakery = screen.getByText("Bakery").closest("tr")!
    expect(within(landlord).getAllByText("Low confidence").length).toBeGreaterThan(0)
    expect(within(bakery).queryByText("Low confidence")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Tag for Landlord")).toHaveTextContent("Rent")
  })

  it("does not overwrite a tag the user already picked", async () => {
    renderWithProviders(<ClassifierPage />)
    await screen.findByText("Bakery")
    await userEvent.click(screen.getByLabelText("Tag for Bakery"))
    await userEvent.click(await screen.findByRole("option", { name: "Rent" }))
    await userEvent.click(screen.getByRole("button", { name: /Predict all/ }))
    await screen.findByText("Suggested tags for 2 transactions, 1 with low confidence.")
    expect(screen.getByLabelText("Tag for Bakery")).toHaveTextContent("Rent")
  })

  it("tells the user to retrain when there is no model", async () => {
    classifierApi.post.mockResolvedValueOnce({
      data: { model_ready: false, reason: "Model not found for this account. Please retrain first.", meta: null, predictions: [] },
    })
    renderWithProviders(<ClassifierPage />)
    await screen.findByText("Bakery")
    await userEvent.click(screen.getByRole("button", { name: /Predict all/ }))
    expect(await screen.findByRole("status")).toHaveTextContent("Please retrain first")
  })

  it("applies the chosen tag through the backend", async () => {
    renderWithProviders(<ClassifierPage />)
    await screen.findByText("Bakery")
    const apply = screen.getByRole("button", { name: "Apply tag to Bakery" })
    expect(apply).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: /Predict all/ }))
    await waitFor(() => expect(apply).toBeEnabled())
    await userEvent.click(apply)
    expect(api.put).toHaveBeenCalledWith("/transactions/10", {
      date: "2026-03-01",
      description: "Bakery",
      account_id: 1,
      tag_id: 5,
      is_transfer: false,
      destination_account_id: null,
      amount: "-4.20",
      currency: "EUR",
    })
    expect(await screen.findByText('Tagged "Bakery" as Food.')).toBeInTheDocument()
    // The untagged list is refetched after applying.
    await waitFor(() => expect(classifierApi.get).toHaveBeenCalledTimes(2))
  })

  it("resets predictions and loads the other account when switching", async () => {
    renderWithProviders(<ClassifierPage />)
    await screen.findByText("Bakery")
    await userEvent.click(screen.getByRole("button", { name: /Predict all/ }))
    await screen.findByText("91%")
    await userEvent.click(screen.getByLabelText("Account"))
    await userEvent.click(await screen.findByRole("option", { name: "Card" }))
    expect(await screen.findByText("Every transaction in Card has a tag.")).toBeInTheDocument()
    expect(screen.queryByText("91%")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Predict all/ })).toBeDisabled()
    const cards = screen.getByText("Suggested").closest("[data-slot=card]") as HTMLElement
    expect(within(cards).getByText("0")).toBeInTheDocument()
  })
})
