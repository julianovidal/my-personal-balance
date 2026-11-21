import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon, Trash2Icon } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiErrorMessage } from "@/lib/auth-errors"
import { centsToDecimal, formatCents, isPositiveAmount, toCents } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { SplitTransactionResponse, Tag, Transaction } from "@/types"

import { formatDate } from "./dates"

const NO_TAG = "none"

type Row = { key: string; id?: number; description: string; amount: string; tagId: string }

let nextKey = 0
const newKey = () => `row-${nextKey++}`

function rowsFrom(data: SplitTransactionResponse): Row[] {
  return data.rows.map((r) => ({
    key: newKey(),
    id: r.id,
    description: r.description,
    amount: centsToDecimal(Math.abs(toCents(r.amount))),
    tagId: r.tag_id ? String(r.tag_id) : NO_TAG,
  }))
}

/** The split target is the parent: a split child or remainder row points at it. */
export function splitTargetId(tx: Transaction) {
  return tx.parent_transaction_id ?? (tx.id > 0 ? tx.id : null)
}

type Props = { transaction: Transaction | null; tags: Tag[]; onClose: () => void }

export function SplitDialog({ transaction, tags, onClose }: Props) {
  const targetId = transaction ? splitTargetId(transaction) : null
  const splits = useQuery({
    queryKey: ["transaction-splits", targetId],
    enabled: targetId !== null,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      (await api.get<SplitTransactionResponse>(`/transactions/${targetId}/splits`)).data,
  })

  return (
    <Dialog open={transaction !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Split transaction</DialogTitle>
          <DialogDescription>
            Divide one transaction into parts with their own description and tag.
          </DialogDescription>
        </DialogHeader>
        {splits.isPending && <Skeleton className="h-40 w-full" />}
        {splits.isError && (
          <p role="alert" className="text-sm text-destructive">
            {getApiErrorMessage(splits.error)}
          </p>
        )}
        {splits.isSuccess && (
          <SplitEditor key={splits.data.parent.id} data={splits.data} tags={tags} onSaved={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SplitEditor({
  data,
  tags,
  onSaved,
}: {
  data: SplitTransactionResponse
  tags: Tag[]
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const parent = data.parent
  const [rows, setRows] = useState<Row[]>(() => {
    const existing = rowsFrom(data)
    return existing.length ? existing : [{ key: newKey(), description: "", amount: "", tagId: NO_TAG }]
  })

  const totalCents = Math.abs(toCents(parent.amount))
  const usedCents = rows.reduce((sum, r) => sum + (isPositiveAmount(r.amount) ? toCents(r.amount) : 0), 0)
  const remaining = totalCents - usedCents
  const rowsValid = rows.every((r) => r.description.trim() && isPositiveAmount(r.amount))
  const canSave = rowsValid && remaining >= 0

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const save = useMutation({
    mutationFn: () =>
      api.put<SplitTransactionResponse>(`/transactions/${parent.id}/splits`, {
        rows: rows.map((r) => ({
          id: r.id ?? null,
          description: r.description.trim(),
          amount: centsToDecimal(toCents(r.amount)),
          tag_id: r.tagId === NO_TAG ? null : Number(r.tagId),
        })),
      }),
    onSuccess: () => {
      invalidateTransactionQueries(qc)
      qc.invalidateQueries({ queryKey: ["transaction-splits", parent.id] })
      onSaved()
    },
  })

  const tagOptions = [
    { value: NO_TAG, label: "No tag" },
    ...tags.map((t) => ({ value: String(t.id), label: t.label })),
  ]

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <p className="font-medium">{parent.description}</p>
        <p className="text-muted-foreground">
          {formatDate(parent.date)} · {formatCents(toCents(parent.amount), parent.currency)}
        </p>
      </div>

      <div className="grid gap-2">
        {rows.map((row, index) => (
          <div key={row.key} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_7rem_10rem_auto]">
            <Input
              aria-label={`Part ${index + 1} description`}
              placeholder="Description"
              value={row.description}
              onChange={(e) => update(row.key, { description: e.target.value })}
              className="col-span-2 sm:col-span-1"
            />
            <Input
              aria-label={`Part ${index + 1} amount`}
              inputMode="decimal"
              placeholder="0.00"
              value={row.amount}
              onChange={(e) => update(row.key, { amount: e.target.value.replace(",", ".") })}
              aria-invalid={(row.amount !== "" && !isPositiveAmount(row.amount)) || undefined}
            />
            <SimpleSelect
              aria-label={`Part ${index + 1} tag`}
              value={row.tagId}
              onValueChange={(tagId) => update(row.key, { tagId })}
              options={tagOptions}
              className="max-sm:order-last max-sm:col-span-2"
            />
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={`Remove part ${index + 1}`}
              onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              {
                key: newKey(),
                description: "",
                amount: remaining > 0 ? centsToDecimal(remaining) : "",
                tagId: NO_TAG,
              },
            ])
          }
        >
          <PlusIcon />
          Add part
        </Button>
        <p
          data-testid="split-remaining"
          className={cn("text-sm tabular-nums", remaining < 0 ? "text-destructive" : "text-muted-foreground")}
        >
          {remaining < 0
            ? `Over by ${formatCents(-remaining, parent.currency)}`
            : `Not yet split: ${formatCents(remaining, parent.currency)}`}
        </p>
      </div>

      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getApiErrorMessage(save.error)}
        </p>
      )}

      <DialogFooter>
        <Button disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving..." : rows.length === 0 ? "Remove all splits" : "Save splits"}
        </Button>
      </DialogFooter>
    </div>
  )
}
