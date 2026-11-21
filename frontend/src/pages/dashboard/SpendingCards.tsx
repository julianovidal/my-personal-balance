import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCents, toCents } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { CurrencyInsights } from "@/types"

import { percentChange } from "./period"

type Props = {
  data: CurrencyInsights
  monthName: string
  day: number
  latestBalance: string | null
}

export function SpendingCards({ data, monthName, day, latestBalance }: Props) {
  const c = data.currency
  const spent = toCents(data.spending.month_to_date)
  const usual = data.spending.usual === null ? null : toCents(data.spending.usual)
  const change = percentChange(spent, usual)
  const income = toCents(data.income_to_date)
  const months = data.baseline_months.length

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Spent in {monthName} so far</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCents(spent, c)}
          </CardTitle>
          {change !== null && (
            <CardAction>
              <Badge variant="outline" className={cn(change > 0 ? "text-(--chart-out)" : "text-(--chart-in)")}>
                {change > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                {change > 0 ? "+" : ""}
                {change}%
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="font-medium">
            {usual === null
              ? "Not enough history to compare yet"
              : spent > usual
                ? `${formatCents(spent - usual, c)} more than usual`
                : `${formatCents(usual - spent, c)} less than usual`}
          </div>
          <div className="text-muted-foreground">Days 1–{day}, against the same days before</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Usual by day {day}</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {usual === null ? "—" : formatCents(usual, c)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="font-medium">
            {data.spending.full_month_usual
              ? `${formatCents(toCents(data.spending.full_month_usual), c)} in a usual full month`
              : "Needs 3 months with data"}
          </div>
          <div className="text-muted-foreground">
            Median of {months} {months === 1 ? "month" : "months"} with data
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Income in {monthName} so far</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCents(income, c)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="font-medium">
            {income - spent >= 0
              ? `${formatCents(income - spent, c)} left after spending`
              : `${formatCents(spent - income, c)} more spent than earned`}
          </div>
          <div className="text-muted-foreground">Transfers between accounts are left out</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Balance</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {latestBalance === null ? "—" : formatCents(toCents(latestBalance), c)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="font-medium">All {c} accounts</div>
          <div className="text-muted-foreground">At the end of the data</div>
        </CardFooter>
      </Card>
    </div>
  )
}
