import { ArrowDownRightIcon, ArrowUpRightIcon, ScaleIcon } from "lucide-react"

import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, toCents } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { MonthlySummaryCard } from "@/types"

type Props = {
  /** Totals for one currency; undefined when the period has no rows. */
  totals?: MonthlySummaryCard
  loading: boolean
  /** Currency to show zeros in when there are no totals. Null shows a dash. */
  currency: string | null
  periodLabel: string
}

export function SummaryCards({ totals, loading, currency, periodLabel }: Props) {
  const shownCurrency = totals?.currency ?? currency
  const net = toCents(totals?.net)
  const cards = [
    { label: "Income", value: totals?.income, icon: ArrowUpRightIcon, tone: "" },
    { label: "Expenses", value: totals?.expenses, icon: ArrowDownRightIcon, tone: "" },
    { label: "Net", value: totals?.net, icon: ScaleIcon, tone: net < 0 ? "text-destructive" : "" },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label} className="@container/card">
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-36" />
            ) : (
              <CardTitle className={cn("text-2xl font-semibold tabular-nums @[250px]/card:text-3xl", tone)}>
                {shownCurrency ? formatMoney(value ?? 0, shownCurrency) : "—"}
              </CardTitle>
            )}
            <CardAction>
              <Icon className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">{periodLabel}</CardFooter>
        </Card>
      ))}
    </div>
  )
}
