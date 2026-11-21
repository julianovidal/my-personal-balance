import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { api } from "@/api/client"
import { invalidateTransactionQueries } from "@/api/queries"
import { SimpleSelect } from "@/components/simple-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getApiErrorMessage } from "@/lib/auth-errors"
import { CURRENCIES } from "@/lib/currencies"
import { centsToDecimal, isPositiveAmount, toCents } from "@/lib/money"
import type { Account, Tag, Transaction } from "@/types"

import { today } from "./dates"

export type Kind = "expense" | "income" | "transfer"
const NO_TAG = "none"

type FormState = {
  kind: Kind
  accountId: string
  destinationId: string
  date: string
  description: string
  amount: string // always positive in the form; the kind decides the sign
  currency: string
  tagId: string
}

export function formFromTransaction(tx: Transaction | null): FormState {
  if (!tx) {
    return {
      kind: "expense",
      accountId: "",
      destinationId: "",
      date: today(),
      description: "",
      amount: "",
      currency: "EUR",
      tagId: NO_TAG,
    }
  }
  const amount = centsToDecimal(Math.abs(toCents(tx.amount)))
  if (tx.is_transfer) {
    // The pair is edited from the source side, whichever row was clicked.
    const linked = tx.linked_account_id ? String(tx.linked_account_id) : ""
    const own = String(tx.account_id)
    const incoming = tx.transfer_direction === "in"
    return {
      kind: "transfer",
      accountId: incoming ? linked : own,
      destinationId: incoming ? own : linked,
      date: tx.date,
      description: tx.description,
      amount,
      currency: tx.currency,
      tagId: NO_TAG,
    }
  }
  return {
    kind: toCents(tx.amount) < 0 ? "expense" : "income",
    accountId: String(tx.account_id),
    destinationId: "",
    date: tx.date,
    description: tx.description,
    amount,
    currency: tx.currency,
    tagId: tx.tag_id ? String(tx.tag_id) : NO_TAG,
  }
}

export function toPayload(form: FormState) {
  const cents = toCents(form.amount)
  const transfer = form.kind === "transfer"
  return {
    date: form.date,
    description: form.description.trim(),
    account_id: Number(form.accountId),
    tag_id: transfer || form.tagId === NO_TAG ? null : Number(form.tagId),
    is_transfer: transfer,
    destination_account_id: transfer ? Number(form.destinationId) : null,
    amount: centsToDecimal(form.kind === "expense" ? -cents : cents),
    currency: form.currency,
  }
}

type Props = {
  open: boolean
  transaction: Transaction | null
  accounts: Account[]
  tags: Tag[]
  onOpenChange: (open: boolean) => void
}

export function TransactionFormDialog({ open, transaction, accounts, tags, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {open && (
          <TransactionForm
            key={transaction?.id ?? "new"}
            transaction={transaction}
            accounts={accounts}
            tags={tags}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TransactionForm({
  transaction,
  accounts,
  tags,
  onDone,
}: {
  transaction: Transaction | null
  accounts: Account[]
  tags: Tag[]
  onDone: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState(() => formFromTransaction(transaction))
  const [touched, setTouched] = useState(false)
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  const save = useMutation({
    mutationFn: async () => {
      const payload = toPayload(form)
      if (transaction) await api.put(`/transactions/${transaction.id}`, payload)
      else await api.post("/transactions", payload)
    },
    onSuccess: () => {
      invalidateTransactionQueries(qc)
      onDone()
    },
  })

  const errors = {
    accountId: !form.accountId ? "Choose an account." : "",
    destinationId:
      form.kind === "transfer" && !form.destinationId ? "Choose the destination account." : "",
    description: !form.description.trim() ? "Add a description." : "",
    amount: !isPositiveAmount(form.amount) ? "Enter an amount like 12.50." : "",
    date: !form.date ? "Pick a date." : "",
  }
  const valid = Object.values(errors).every((e) => !e)

  const onAccountChange = (accountId: string) => {
    const account = accounts.find((a) => String(a.id) === accountId)
    set({
      accountId,
      currency: account?.currency ?? form.currency,
      destinationId: form.destinationId === accountId ? "" : form.destinationId,
    })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (valid) save.mutate()
  }

  const accountOptions = accounts.map((a) => ({ value: String(a.id), label: a.name }))
  const show = (key: keyof typeof errors) => (touched ? errors[key] : "")

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{transaction ? "Edit transaction" : "Add transaction"}</DialogTitle>
        <DialogDescription>
          {form.kind === "transfer"
            ? "A transfer creates a matching pair: money out of one account, into the other."
            : "Amounts are entered as positive numbers; the type sets the sign."}
        </DialogDescription>
      </DialogHeader>

      <ToggleGroup
        aria-label="Transaction type"
        variant="outline"
        className="w-full *:flex-1"
        value={[form.kind]}
        onValueChange={(values) => {
          const kind = values[0] as Kind | undefined
          if (kind) set({ kind })
        }}
      >
        <ToggleGroupItem value="expense">Expense</ToggleGroupItem>
        <ToggleGroupItem value="income">Income</ToggleGroupItem>
        <ToggleGroupItem value="transfer">Transfer</ToggleGroupItem>
      </ToggleGroup>

      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!show("accountId") || undefined}>
            <FieldLabel htmlFor="tx-account">{form.kind === "transfer" ? "From account" : "Account"}</FieldLabel>
            <SimpleSelect
              id="tx-account"
              value={form.accountId}
              onValueChange={onAccountChange}
              placeholder="Select account"
              options={accountOptions}
            />
            {show("accountId") && <FieldError>{show("accountId")}</FieldError>}
          </Field>
          {form.kind === "transfer" ? (
            <Field data-invalid={!!show("destinationId") || undefined}>
              <FieldLabel htmlFor="tx-destination">To account</FieldLabel>
              <SimpleSelect
                id="tx-destination"
                value={form.destinationId}
                onValueChange={(destinationId) => set({ destinationId })}
                placeholder="Select destination"
                options={accountOptions.filter((o) => o.value !== form.accountId)}
              />
              {show("destinationId") && <FieldError>{show("destinationId")}</FieldError>}
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="tx-tag">Tag</FieldLabel>
              <SimpleSelect
                id="tx-tag"
                value={form.tagId}
                onValueChange={(tagId) => set({ tagId })}
                options={[
                  { value: NO_TAG, label: "No tag" },
                  ...tags.map((t) => ({ value: String(t.id), label: t.label })),
                ]}
              />
            </Field>
          )}
        </div>

        <Field data-invalid={!!show("description") || undefined}>
          <FieldLabel htmlFor="tx-description">Description</FieldLabel>
          <Input
            id="tx-description"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            aria-invalid={!!show("description") || undefined}
          />
          {show("description") && <FieldError>{show("description")}</FieldError>}
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field data-invalid={!!show("amount") || undefined}>
            <FieldLabel htmlFor="tx-amount">Amount</FieldLabel>
            <Input
              id="tx-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value.replace(",", ".") })}
              aria-invalid={!!show("amount") || undefined}
            />
            {show("amount") && <FieldError>{show("amount")}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="tx-currency">Currency</FieldLabel>
            <SimpleSelect
              id="tx-currency"
              value={form.currency}
              onValueChange={(currency) => set({ currency })}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field data-invalid={!!show("date") || undefined}>
            <FieldLabel htmlFor="tx-date">Date</FieldLabel>
            <Input
              id="tx-date"
              type="date"
              value={form.date}
              onChange={(e) => set({ date: e.target.value })}
            />
            {show("date") && <FieldError>{show("date")}</FieldError>}
          </Field>
        </div>
      </FieldGroup>

      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getApiErrorMessage(save.error)}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving..." : transaction ? "Save changes" : "Add transaction"}
        </Button>
      </DialogFooter>
    </form>
  )
}
