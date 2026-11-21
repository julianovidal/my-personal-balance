import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { api } from "@/api/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiErrorMessage } from "@/lib/auth-errors"
import { CURRENCIES } from "@/lib/currencies"
import type { Account } from "@/types"

type Props = {
  open: boolean
  account: Account | null
  onOpenChange: (open: boolean) => void
}

export function AccountFormDialog({ open, account, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed so the form starts fresh for each account. */}
        {open && (
          <AccountForm
            key={account?.id ?? "new"}
            account={account}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AccountForm({ account, onDone }: { account: Account | null; onDone: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(account?.name ?? "")
  const [currency, setCurrency] = useState(account?.currency ?? "EUR")

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), currency }
      if (account) await api.put(`/accounts/${account.id}`, body)
      else await api.post("/accounts", body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] })
      qc.invalidateQueries({ queryKey: ["accounts-balances"] })
      onDone()
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) save.mutate()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{account ? "Edit account" : "Add account"}</DialogTitle>
        <DialogDescription>
          {account
            ? "Changing the currency does not convert existing amounts."
            : "Transactions imported into this account use its currency by default."}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="account-name">Name</FieldLabel>
          <Input
            id="account-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main checking"
            required
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="account-currency">Currency</FieldLabel>
          <Select value={currency} onValueChange={(value) => value && setCurrency(value)}>
            <SelectTrigger id="account-currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
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
        <Button type="submit" disabled={!name.trim() || save.isPending}>
          {save.isPending ? "Saving..." : account ? "Save changes" : "Create account"}
        </Button>
      </DialogFooter>
    </form>
  )
}
