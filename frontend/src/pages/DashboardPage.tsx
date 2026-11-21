import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarClockIcon, CircleAlertIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { api } from "@/api/client"
import { useAccounts, useTags } from "@/api/queries"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getApiErrorMessage } from "@/lib/auth-errors"
import { formatDate } from "@/pages/transactions/dates"
import { transactionsLink } from "@/pages/transactions/filters"
import type { BalanceHistory, DashboardInsights } from "@/types"

import { BalanceChart } from "./dashboard/BalanceChart"
import { CashflowChart } from "./dashboard/CashflowChart"
import { FreshnessCard } from "./dashboard/FreshnessCard"
import { anchorPeriod } from "./dashboard/period"
import { SpendingCards } from "./dashboard/SpendingCards"
import { TagComparison } from "./dashboard/TagComparison"
import { TransactionList } from "./dashboard/TransactionLists"
import { UnusualCard } from "./dashboard/UnusualCard"

// Both keys start with "dashboard", so invalidateTransactionQueries refreshes them.
export const INSIGHTS_KEY = ["dashboard", "insights"]
export const BALANCE_HISTORY_KEY = ["dashboard", "balance-history"]

export function DashboardPage() {
  const accounts = useAccounts().data ?? []
  const tags = useTags().data ?? []
  const insights = useQuery({
    queryKey: INSIGHTS_KEY,
    queryFn: async () => (await api.get<DashboardInsights>("/dashboard/insights")).data,
  })
  const history = useQuery({
    queryKey: BALANCE_HISTORY_KEY,
    queryFn: async () => (await api.get<BalanceHistory>("/dashboard/balance-history")).data,
  })
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null)

  if (insights.isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-6 w-72" />
        <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    )
  }
  if (insights.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Couldn't load the dashboard. {getApiErrorMessage(insights.error)}
      </p>
    )
  }

  const data = insights.data
  if (!data.anchor_date || data.currencies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">No transactions yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Import a bank export or add a transaction, and the dashboard will compare each month with your usual
          spending.
        </p>
        <Link to="/transactions?action=import" className={buttonVariants()}>
          Import transactions
        </Link>
      </div>
    )
  }

  const period = anchorPeriod(data.anchor_date)
  const current = data.currencies.find((c) => c.currency === chosenCurrency) ?? data.currencies[0]
  const series = history.data?.series.find((s) => s.currency === current.currency)
  const latestBalance = series?.points.at(-1)?.balance ?? null
  const flagged = new Set(current.large_expenses.map((e) => e.transaction.id))
  const biggest = current.top_expenses.filter((t) => !flagged.has(t.id))
  const behind = data.accounts.filter((a) => a.stale)

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CalendarClockIcon className="size-4 text-muted-foreground" />
            Data through {formatDate(data.anchor_date)}
          </span>
          <span className="text-muted-foreground">
            {period.monthLabel}
            {data.is_partial_month && `, day ${period.day} of ${period.daysInMonth}`}
          </span>
          {behind.length > 0 && (
            <span className="inline-flex items-center gap-1 text-(--chart-out)">
              <CircleAlertIcon className="size-3.5" />
              {behind.map((a) => a.name).join(", ")} behind
            </span>
          )}
        </div>
        {data.currencies.length > 1 && (
          <Tabs value={current.currency} onValueChange={(v) => setChosenCurrency(v as string)}>
            <TabsList aria-label="Currency">
              {data.currencies.map((c) => (
                <TabsTrigger key={c.currency} value={c.currency}>
                  {c.currency}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      <SpendingCards data={current} monthName={period.monthName} day={period.day} latestBalance={latestBalance} />

      <div className="grid gap-4 md:gap-6 @4xl/main:grid-cols-2">
        <UnusualCard data={current} tags={tags} period={period} />
        <TagComparison data={current} monthName={period.monthName} />
      </div>

      <div className="grid gap-4 md:gap-6 @4xl/main:grid-cols-2">
        {series && series.points.length > 0 ? (
          <BalanceChart points={series.points} currency={current.currency} />
        ) : (
          <Skeleton className="h-80" />
        )}
        <CashflowChart data={current} partialMonth={data.is_partial_month} />
      </div>

      <div className="grid gap-4 md:gap-6 @4xl/main:grid-cols-3">
        <TransactionList
          title="Biggest expenses"
          description={`In ${period.monthName} so far, besides the ones flagged above`}
          items={biggest}
          accounts={accounts}
          tags={tags}
          empty="Nothing else stands out."
          action={{ label: "See month", to: transactionsLink(period) }}
        />
        <TransactionList
          title="Recent transactions"
          description="Latest 10, transfers shown once"
          items={data.recent}
          accounts={accounts}
          tags={tags}
          empty="No transactions yet."
          action={{ label: "See all", to: "/transactions" }}
        />
        <FreshnessCard accounts={data.accounts} />
      </div>
    </div>
  )
}
