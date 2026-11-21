import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/api/client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiErrorMessage } from "@/lib/auth-errors"
import type { Account, AccountImportMapping } from "@/types"

type MappingKey = Exclude<keyof AccountImportMapping, "account_id">
type MappingFields = Record<MappingKey, string>

const FIELDS: { key: MappingKey; label: string; placeholder: string; hint?: string }[] = [
  { key: "date_column", label: "Date column", placeholder: "e.g. transaction_date", hint: "Required" },
  { key: "description_column", label: "Description column", placeholder: "e.g. details", hint: "Required" },
  { key: "amount_column", label: "Amount column", placeholder: "e.g. value", hint: "Required" },
  {
    key: "currency_column",
    label: "Currency column",
    placeholder: "e.g. curr",
    hint: "Optional. Falls back to the account currency.",
  },
  { key: "tag_id_column", label: "Tag ID column", placeholder: "e.g. category_id", hint: "Optional" },
]

function toFields(mapping?: AccountImportMapping | null): MappingFields {
  return {
    date_column: mapping?.date_column ?? "",
    description_column: mapping?.description_column ?? "",
    amount_column: mapping?.amount_column ?? "",
    currency_column: mapping?.currency_column ?? "",
    tag_id_column: mapping?.tag_id_column ?? "",
  }
}

export function useAccountImportMapping(accountId: number | null) {
  return useQuery({
    queryKey: ["account-import-mapping", accountId === null ? "" : String(accountId)],
    enabled: accountId !== null,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      (await api.get<AccountImportMapping>(`/accounts/${accountId}/import-mapping`)).data,
  })
}

type Props = { account: Account | null; onClose: () => void }

export function ImportMappingSheet({ account, onClose }: Props) {
  const mapping = useAccountImportMapping(account?.id ?? null)
  const [dirty, setDirty] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const close = () => {
    setDirty(false)
    setConfirmDiscard(false)
    onClose()
  }

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true)
    else close()
  }

  return (
    <>
      <Sheet open={account !== null} onOpenChange={(open) => !open && requestClose()}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Import settings</SheetTitle>
            <SheetDescription>
              Column names in the CSV or XLSX files you import into{" "}
              <span className="font-medium text-foreground">{account?.name}</span>.
            </SheetDescription>
          </SheetHeader>
          {account && mapping.isPending && (
            <div className="grid gap-4 p-4">
              {FIELDS.map((f) => (
                <Skeleton key={f.key} className="h-12 w-full" />
              ))}
            </div>
          )}
          {account && mapping.isError && (
            <p role="alert" className="p-4 text-sm text-destructive">
              Couldn't load import settings. {getApiErrorMessage(mapping.error)}
            </p>
          )}
          {account && mapping.isSuccess && (
            // Keyed by account: the form takes the loaded mapping once, so a
            // background refetch never overwrites what the user is typing.
            <MappingForm
              key={account.id}
              account={account}
              initial={toFields(mapping.data)}
              onDirtyChange={setDirty}
              onCancel={requestClose}
              onSaved={close}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved import settings. Discard them and close?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={close}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

type FormProps = {
  account: Account
  initial: MappingFields
  onDirtyChange: (dirty: boolean) => void
  onCancel: () => void
  onSaved: () => void
}

function MappingForm({ account, initial, onDirtyChange, onCancel, onSaved }: FormProps) {
  const qc = useQueryClient()
  const [fields, setFields] = useState(initial)

  const update = (key: MappingKey, value: string) => {
    const next = { ...fields, [key]: value }
    setFields(next)
    onDirtyChange(FIELDS.some((f) => next[f.key] !== initial[f.key]))
  }

  const save = useMutation({
    mutationFn: () => api.put(`/accounts/${account.id}/import-mapping`, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-import-mapping", String(account.id)] })
      onSaved()
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          {FIELDS.map((f) => (
            <Field key={f.key}>
              <FieldLabel htmlFor={`mapping-${f.key}`}>{f.label}</FieldLabel>
              <Input
                id={`mapping-${f.key}`}
                value={fields[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => update(f.key, e.target.value)}
              />
              {f.hint && <FieldDescription>{f.hint}</FieldDescription>}
            </Field>
          ))}
        </FieldGroup>
        {save.isError && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {getApiErrorMessage(save.error)}
          </p>
        )}
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving..." : "Save mapping"}
        </Button>
      </SheetFooter>
    </form>
  )
}
