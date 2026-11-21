import { ArrowRightIcon, CircleCheckIcon, SparklesIcon, TrendingUpIcon, ZapIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCents, toCents } from "@/lib/money"
import { formatDate } from "@/pages/transactions/dates"
import { transactionsLink } from "@/pages/transactions/filters"
import type { CurrencyInsights, Tag } from "@/types"

type Props = {
  data: CurrencyInsights
  tags: Tag[]
  period: { from: string; to: string }
}

export function UnusualCard({ data, tags, period }: Props) {
  const c = data.currency
  const tagLabel = (id: number | null) => (id === null ? "Untagged" : (tags.find((t) => t.id === id)?.label ?? "Untagged"))
  const count = data.signals.length + data.large_expenses.length
  const notEnough = data.baseline_months.length < 3

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anything unusual?</CardTitle>
        <CardDescription>Tags well above their usual level, and single expenses far bigger than normal</CardDescription>
        <CardAction>
          <Badge variant={count ? "secondary" : "outline"}>{count ? `${count} to check` : "All normal"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-2">
        {count === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <CircleCheckIcon className="size-4" />
            {notEnough
              ? "Tag comparisons start once there are 3 earlier months with data."
              : "Nothing stands out against your last months."}
          </div>
        )}

        {data.signals.map((s) => (
          <Link
            key={`signal-${s.tag_id}`}
            to={transactionsLink({ ...period, tagId: s.tag_id })}
            className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            {s.kind === "spike" ? (
              <TrendingUpIcon className="size-4 shrink-0 text-(--chart-out)" />
            ) : (
              <SparklesIcon className="size-4 shrink-0 text-(--chart-out)" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {s.kind === "spike" ? `${s.label} is higher than usual` : `New spending on ${s.label}`}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatCents(toCents(s.month_to_date), c)}
                {s.kind === "spike"
                  ? ` so far, usually ${formatCents(toCents(s.usual), c)} by now`
                  : " so far, usually nothing by now"}
              </p>
            </div>
            <span className="text-sm font-medium tabular-nums text-(--chart-out)">
              +{formatCents(toCents(s.difference), c)}
            </span>
            <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}

        {data.large_expenses.map((e) => {
          const tx = e.transaction
          return (
            <Link
              key={`large-${tx.id}-${tx.is_remainder}`}
              to={transactionsLink({ from: tx.date, to: tx.date, accountId: tx.account_id })}
              className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <ZapIcon className="size-4 shrink-0 text-(--chart-out)" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tx.description}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(tx.date)} · {tagLabel(tx.tag_id)} · about {Math.round(Number(e.ratio))}× a typical{" "}
                  {e.reason === "untagged" ? "untagged expense" : "expense in this tag"} (
                  {formatCents(toCents(e.typical), c)})
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">{formatCents(toCents(tx.amount), tx.currency)}</span>
              <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
