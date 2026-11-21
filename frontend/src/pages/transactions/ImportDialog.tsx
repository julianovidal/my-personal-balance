import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2Icon, DownloadIcon, TriangleAlertIcon, XCircleIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { api } from "@/api/client"
import { invalidateTransactionQueries } from "@/api/queries"
import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getApiErrorMessage } from "@/lib/auth-errors"
import { formatMoney } from "@/lib/money"
import { useAccountImportMapping } from "@/pages/accounts/ImportMappingSheet"
import type { Account, AccountImportMapping, ImportPreviewResponse, Tag } from "@/types"

const NO_TAG = "none"

const TEMPLATE = [
  "date,description,amount,currency,tag_id",
  "2026-02-01,Supermarket,-82.45,EUR,",
  "2026-02-03,Salary,3200.00,EUR,",
].join("\n")

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv;charset=utf-8;" }))
  const link = document.createElement("a")
  link.href = url
  link.download = "transactions_template.csv"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Per specs/import-preview-gating-unconfigured-mapping.md: configured = any column saved. */
export function isMappingConfigured(mapping?: AccountImportMapping | null) {
  if (!mapping) return false
  return [
    mapping.date_column,
    mapping.description_column,
    mapping.amount_column,
    mapping.currency_column,
    mapping.tag_id_column,
  ].some((column) => column !== null)
}

type Props = {
  open: boolean
  accounts: Account[]
  tags: Tag[]
  onOpenChange: (open: boolean) => void
}

export function ImportDialog({ open, accounts, tags, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        {open && <ImportFlow accounts={accounts} tags={tags} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ImportFlow({ accounts, tags, onClose }: { accounts: Account[]; tags: Tag[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [accountId, setAccountId] = useState("")
  const [tagId, setTagId] = useState(NO_TAG)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  const mapping = useAccountImportMapping(accountId ? Number(accountId) : null)
  const configured = isMappingConfigured(mapping.data)
  const showMappingWarning = Boolean(accountId) && mapping.isSuccess && !configured

  const reset = () => {
    setPreview(null)
    setResult(null)
  }

  const send = async <T,>(path: string) => {
    const data = new FormData()
    data.append("file", file as File)
    const query = tagId !== NO_TAG ? `?default_tag_id=${tagId}` : ""
    return (
      await api.post<T>(`${path}/${accountId}${query}`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data
  }

  const previewUpload = useMutation({
    mutationFn: () => send<ImportPreviewResponse>("/transactions/import/preview"),
    onSuccess: (data) => {
      setPreview(data)
      setResult(null)
    },
  })

  const upload = useMutation({
    mutationFn: () => send<{ imported: number; skipped: number }>("/transactions/import"),
    onSuccess: (data) => {
      setResult(data)
      setPreview(null)
      setFile(null)
      invalidateTransactionQueries(qc)
    },
  })

  const submitPreview = (event: FormEvent) => {
    event.preventDefault()
    if (file && accountId && configured) previewUpload.mutate()
  }

  const accountCurrency = accounts.find((a) => String(a.id) === accountId)?.currency ?? "EUR"
  const error = previewUpload.error ?? upload.error

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Import transactions</DialogTitle>
        <DialogDescription>
          Upload a CSV or XLSX file. You'll see a preview before anything is saved.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={submitPreview} className="grid gap-4">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="import-account">Account</FieldLabel>
              <SimpleSelect
                id="import-account"
                value={accountId}
                placeholder="Select account"
                onValueChange={(v) => {
                  setAccountId(v)
                  reset()
                }}
                options={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="import-tag">Default tag</FieldLabel>
              <SimpleSelect
                id="import-tag"
                value={tagId}
                onValueChange={(v) => {
                  setTagId(v)
                  reset()
                }}
                options={[
                  { value: NO_TAG, label: "No default tag" },
                  ...tags.map((t) => ({ value: String(t.id), label: t.label })),
                ]}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="import-file">File</FieldLabel>
            <Input
              id="import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                reset()
              }}
            />
            <FieldDescription>
              Required columns: date, description, amount. Optional: currency, tag_id.{" "}
              <button type="button" className="underline underline-offset-4" onClick={downloadTemplate}>
                <DownloadIcon className="mr-1 inline size-3" />
                Download CSV template
              </button>
            </FieldDescription>
          </Field>
        </FieldGroup>

        {showMappingWarning && (
          <div className="flex gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              This account has no import settings configured yet. Set them under{" "}
              <Link to="/accounts" className="font-medium text-foreground underline" onClick={onClose}>
                Accounts
              </Link>{" "}
              → Import settings first.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {getApiErrorMessage(error)}
          </p>
        )}

        {!preview && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {result ? "Done" : "Cancel"}
            </Button>
            <Button type="submit" disabled={!configured || !file || previewUpload.isPending}>
              {previewUpload.isPending ? "Reading file..." : "Preview import"}
            </Button>
          </DialogFooter>
        )}
      </form>

      {result && (
        <div role="status" className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <CheckCircle2Icon className="size-4" />
          Imported {result.imported} {result.imported === 1 ? "row" : "rows"}, skipped {result.skipped}.
        </div>
      )}

      {preview && (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Total: {preview.total_rows}</Badge>
            <Badge variant="secondary">Valid: {preview.valid_rows}</Badge>
            <Badge variant={preview.invalid_rows ? "destructive" : "secondary"}>
              Invalid: {preview.invalid_rows}
            </Badge>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                  <TableHead className="w-12">Row</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.preview.map((row) => (
                  <TableRow key={`${row.row}-${row.description}`}>
                    <TableCell className="text-muted-foreground">{row.row}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                    <TableCell className="max-w-48 truncate">{row.description}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.amount, row.currency || accountCurrency)}
                    </TableCell>
                    <TableCell>
                      {row.status === "ok" ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2Icon className="size-3.5" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <XCircleIcon className="size-3.5" /> {row.message}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {preview.errors.length > 0 && (
            <div className="rounded-lg border bg-muted p-3 text-xs">
              <p className="font-medium">Validation errors</p>
              {preview.errors.slice(0, 5).map((e) => (
                <p key={`${e.row}-${e.message}`}>
                  Row {e.row}: {e.message}
                </p>
              ))}
              {preview.errors.length > 5 && <p>…and {preview.errors.length - 5} more.</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={reset}>
              Back
            </Button>
            <Button
              disabled={preview.valid_rows === 0 || upload.isPending}
              onClick={() => upload.mutate()}
            >
              {upload.isPending
                ? "Importing..."
                : `Import ${preview.valid_rows} ${preview.valid_rows === 1 ? "row" : "rows"}`}
            </Button>
          </DialogFooter>
        </div>
      )}
    </div>
  )
}
