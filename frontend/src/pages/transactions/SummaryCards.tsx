import { ArrowDownRightIcon, ArrowUpRightIcon, ScaleIcon } from "lucide-react"

import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAmount, toCents } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { MonthlySummaryResponse } from "@/types"

type Props = {
  summary?: MonthlySummaryResponse
  loading: boolean
  currency: string | null
  periodLabel: string
}

export function SummaryCards({ summary, loading, currency, periodLabel }: Props) {
  const net = toCents(summary?.overall.net)
  const cards = [
    { label: "Income", value: summary?.overall.income, icon: ArrowUpRightIcon, tone: "" },
    { label: "Expenses", value: summary?.overall.expenses, icon: ArrowDownRightIcon, tone: "" },
    { label: "Net", value: summary?.overall.net, icon: ScaleIcon, tone: net < 0 ? "text-destructive" : "" },
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
                {formatAmount(value ?? 0, currency)}
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
