import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, RefreshCwIcon, SparklesIcon } from "lucide-react"

import { api } from "@/api/client"
import { classifierApi } from "@/api/classifierClient"
import { useAccounts, useTags } from "@/api/queries"
import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getApiErrorMessage } from "@/lib/auth-errors"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { formatDate } from "@/pages/transactions/dates"
import type {
  Account,
  ClassifierModelMeta,
  ClassifierPredictResponse,
  ClassifierTrainResponse,
  ClassifierUntaggedTransaction,
  Tag,
} from "@/types"

type Prediction = { tagId: number; confidence: number; low: boolean }

export function ClassifierPage() {
  const accounts = useAccounts()
  const tags = useTags().data ?? []
  const [chosen, setChosen] = useState<string | null>(null)
  // Default to the first account once they load, like the old page.
  const accountId = chosen ?? (accounts.data?.[0] ? String(accounts.data[0].id) : "")
  const account = accounts.data?.find((a) => String(a.id) === accountId)

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Tag suggestions</CardTitle>
          <CardDescription>
            Each account has its own model, trained on that account's tagged transactions. Suggestions are
            only saved when you apply them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-xs gap-1.5">
            <Label htmlFor="classifier-account">Account</Label>
            {accounts.isPending ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <SimpleSelect
                id="classifier-account"
                value={accountId}
                placeholder="Select account"
                onValueChange={setChosen}
                options={(accounts.data ?? []).map((a) => ({ value: String(a.id), label: a.name }))}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Keyed by account: model info, predictions and picks reset when the account changes. */}
      {account && <AccountClassifier key={account.id} account={account} tags={tags} />}
      {accounts.isSuccess && accounts.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Create an account first to use the classifier.</p>
      )}
    </div>
  )
}

function AccountClassifier({ account, tags }: { account: Account; tags: Tag[] }) {
  const qc = useQueryClient()
  const [meta, setMeta] = useState<ClassifierModelMeta | null>(null)
  const [status, setStatus] = useState<{ tone: "ok" | "warn"; text: string } | null>(null)
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({})
  const [picked, setPicked] = useState<Record<number, string>>({})

  const untaggedKey = ["classifier-untagged-transactions", String(account.id)]
  const untagged = useQuery({
    queryKey: untaggedKey,
    queryFn: async () =>
      (
        await classifierApi.get<ClassifierUntaggedTransaction[]>("/api/classifier/transactions/untagged", {
          params: { account_id: account.id },
        })
      ).data,
  })
  const rows = untagged.data ?? []

  const retrain = useMutation({
    mutationFn: async () =>
      (await classifierApi.post<ClassifierTrainResponse>("/api/classifier/train", { account_id: account.id })).data,
    onSuccess: (data) => {
      setMeta(data.meta)
      setStatus(
        data.trained
          ? { tone: "ok", text: "Model retrained." }
          : { tone: "warn", text: data.reason ?? "Model training failed." }
      )
    },
  })

  const predict = useMutation({
    mutationFn: async () =>
      (
        await classifierApi.post<ClassifierPredictResponse>("/api/classifier/predict", {
          account_id: account.id,
          transaction_ids: rows.map((r) => r.id),
        })
      ).data,
    onSuccess: (data) => {
      setMeta(data.meta)
      if (!data.model_ready) {
        setStatus({ tone: "warn", text: data.reason ?? "Model not ready. Retrain first." })
        return
      }
      const next: Record<number, Prediction> = {}
      for (const p of data.predictions)
        next[p.transaction_id] = { tagId: p.suggested_tag_id, confidence: p.confidence, low: p.low_confidence === true }
      setPredictions(next)
      // Suggestions fill the tag picker, but never overwrite a tag the user picked.
      setPicked((prev) => {
        const merged = { ...prev }
        for (const p of data.predictions) merged[p.transaction_id] ??= String(p.suggested_tag_id)
        return merged
      })
      const count = data.predictions.length
      const low = data.predictions.filter((p) => p.low_confidence === true).length
      setStatus({
        tone: "ok",
        text:
          `Suggested tags for ${count} ${count === 1 ? "transaction" : "transactions"}` +
          (low ? `, ${low} with low confidence.` : "."),
      })
    },
  })

  const apply = useMutation({
    mutationFn: async (tx: ClassifierUntaggedTransaction) =>
      api.put(`/transactions/${tx.id}`, {
        date: tx.date,
        description: tx.description,
        account_id: tx.account_id,
        tag_id: Number(picked[tx.id]),
        is_transfer: false,
        destination_account_id: null,
        amount: tx.amount,
        currency: tx.currency,
      }),
    onSuccess: (_data, tx) => {
      qc.invalidateQueries({ queryKey: untaggedKey })
      qc.invalidateQueries({ queryKey: ["transactions"] })
      const label = tags.find((t) => String(t.id) === picked[tx.id])?.label
      setStatus({ tone: "ok", text: `Tagged "${tx.description}"${label ? ` as ${label}` : ""}.` })
    },
  })

  const error = retrain.error ?? predict.error ?? apply.error ?? untagged.error
  const predictedCount = rows.filter((r) => predictions[r.id]).length
  const tagLabel = (id: number) => tags.find((t) => t.id === id)?.label ?? `Tag ${id}`
  const tagOptions = tags.map((t) => ({ value: String(t.id), label: t.label }))

  return (
    <>
      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Untagged</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {untagged.isPending ? <Skeleton className="h-8 w-16" /> : rows.length}
            </CardTitle>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">Non-transfer transactions in {account.name}</CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Suggested</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{predictedCount}</CardTitle>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            {predictedCount ? "Review and apply below" : "Run Predict to get suggestions"}
          </CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Model</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {meta ? `${Math.round(meta.score * 100)}%` : "—"}
            </CardTitle>
            {meta && (
              <CardAction>
                <Badge variant="outline">macro-F1</Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardFooter className="flex-col items-start gap-0.5 text-sm text-muted-foreground">
            {meta ? (
              <>
                <span>
                  {meta.model_name} · {meta.sample_count} samples · {meta.class_count} tags
                </span>
                <span>Trained {new Date(meta.trained_at).toLocaleString()}</span>
              </>
            ) : (
              "Shown after you retrain or predict"
            )}
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Untagged transactions</CardTitle>
          <CardDescription>Needs at least 20 tagged transactions and 2 different tags to train.</CardDescription>
          <CardAction className="flex gap-2">
            <Button variant="outline" disabled={retrain.isPending} onClick={() => retrain.mutate()}>
              <RefreshCwIcon className={cn(retrain.isPending && "animate-spin")} />
              <span className="hidden sm:inline">{retrain.isPending ? "Retraining..." : "Retrain model"}</span>
            </Button>
            <Button disabled={!rows.length || predict.isPending} onClick={() => predict.mutate()}>
              <SparklesIcon />
              <span className="hidden sm:inline">{predict.isPending ? "Predicting..." : "Predict all"}</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3">
          {status && (
            <p
              role="status"
              className={cn("text-sm", status.tone === "warn" ? "text-destructive" : "text-muted-foreground")}
            >
              {status.text}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {getApiErrorMessage(error)}
            </p>
          )}

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="hidden md:table-cell">Suggestion</TableHead>
                  <TableHead className="w-44">Tag</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Apply</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {untagged.isPending &&
                  [0, 1, 2, 3].map((i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {untagged.isSuccess && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Every transaction in {account.name} has a tag.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((tx) => {
                  const prediction = predictions[tx.id]
                  const value = picked[tx.id] ?? ""
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(tx.date)}</TableCell>
                      <TableCell className="max-w-0 w-full">
                        <p className="truncate">{tx.description}</p>
                        {prediction && (
                          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground md:hidden">
                            Suggested {tagLabel(prediction.tagId)} · {Math.round(prediction.confidence * 100)}%
                            {prediction.low && <LowConfidenceBadge />}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {formatMoney(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {prediction ? (
                          <Confidence
                            label={tagLabel(prediction.tagId)}
                            value={prediction.confidence}
                            low={prediction.low}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <SimpleSelect
                          aria-label={`Tag for ${tx.description}`}
                          value={value}
                          placeholder="Select tag"
                          onValueChange={(v) => setPicked((p) => ({ ...p, [tx.id]: v }))}
                          options={tagOptions}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          aria-label={`Apply tag to ${tx.description}`}
                          disabled={!value || apply.isPending}
                          onClick={() => apply.mutate(tx)}
                        >
                          <CheckIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// A guess from the model with no similar tagged row behind it.
function LowConfidenceBadge() {
  return (
    <Badge variant="outline" className="shrink-0 text-muted-foreground">
      Low confidence
    </Badge>
  )
}

function Confidence({ label, value, low }: { label: string; value: number; low: boolean }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex min-w-32 flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate">{label}</span>
        <span className="flex items-center gap-1.5">
          {low && <LowConfidenceBadge />}
          <span className={cn("tabular-nums", pct < 50 && "text-muted-foreground")}>{pct}%</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-1.5 rounded-full", pct < 50 ? "bg-muted-foreground/50" : "bg-primary")}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  )
}
