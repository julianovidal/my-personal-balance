import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { api } from "@/api/client"
import { SimpleSelect } from "@/components/simple-select"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatMoney, toCents } from "@/lib/money"
import type { MonthlyAnalyticsResponse, Tag, TagMonthlyTrendResponse } from "@/types"

import { formatMonth } from "./dates"
import { ALL, filterParams, type Filters } from "./filters"

const expenseConfig = {
  total: { label: "Expenses", color: "var(--chart-2)" },
} satisfies ChartConfig

// Recharts needs numbers to draw. These values are only plotted; labels and
// tooltips are formatted from the original decimal strings' value.
const plot = (value: string) => Math.abs(Number(value))

const MAX_BARS = 10

/** Keeps the largest rows and folds the rest into "Other" (summed in cents). */
export function topWithOther(rows: { label: string; total_expense: string }[]) {
  const sorted = [...rows].sort((a, b) => toCents(b.total_expense) - toCents(a.total_expense))
  if (sorted.length <= MAX_BARS) return sorted.map((r) => ({ label: r.label, total: plot(r.total_expense) }))
  const head = sorted.slice(0, MAX_BARS - 1)
  const otherCents = sorted.slice(MAX_BARS - 1).reduce((sum, r) => sum + Math.abs(toCents(r.total_expense)), 0)
  return [
    ...head.map((r) => ({ label: r.label, total: plot(r.total_expense) })),
    { label: `Other (${sorted.length - head.length})`, total: otherCents / 100 },
  ]
}

type Props = { filters: Filters; tags: Tag[]; currency: string | null }

export function ExpenseCharts({ filters, tags, currency }: Props) {
  return (
    <div className="grid gap-4 @4xl/main:grid-cols-2">
      <ExpenseBreakdown filters={filters} currency={currency} />
      <TagTrend tags={tags} accountId={filters.accountId} currency={currency} />
    </div>
  )
}

function ExpenseBreakdown({ filters, currency }: { filters: Filters; currency: string | null }) {
  const [by, setBy] = useState<"by_tag" | "by_account">("by_tag")
  const analytics = useQuery({
    queryKey: ["transactions-analytics", filters.from, filters.to, filters.accountId, filters.tagId],
    queryFn: async () =>
      (
        await api.get<MonthlyAnalyticsResponse>(
          `/transactions/analytics/monthly?${filterParams(filters).toString()}`
        )
      ).data,
  })
  const rows = topWithOther((analytics.data?.[by] ?? []).filter((r) => r.currency === currency))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses breakdown</CardTitle>
        <CardDescription>For the selected period and filters</CardDescription>
        <CardAction>
          <Tabs value={by} onValueChange={(v) => setBy(v as typeof by)}>
            <TabsList>
              <TabsTrigger value="by_tag">By tag</TabsTrigger>
              <TabsTrigger value="by_account">By account</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent>
        {analytics.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 || !currency ? (
          <EmptyChart text="No expenses for the selected filters." />
        ) : (
          <ChartContainer
            config={expenseConfig}
            className="aspect-auto w-full"
            style={{ height: Math.max(rows.length * 36 + 16, 120) }}
          >
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="label"
                type="category"
                width={120}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <XAxis type="number" hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <span className="font-mono tabular-nums">{formatMoney(Number(value), currency)}</span>
                    )}
                  />
                }
              />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function TagTrend({
  tags,
  accountId,
  currency,
}: {
  tags: Tag[]
  accountId: string
  currency: string | null
}) {
  const [tagId, setTagId] = useState("")
  const trend = useQuery({
    queryKey: ["transactions-tag-trend", tagId, accountId === ALL ? "" : accountId],
    enabled: Boolean(tagId),
    queryFn: async () => {
      const params = new URLSearchParams({ tag_id: tagId })
      if (accountId !== ALL) params.set("account_id", accountId)
      return (await api.get<TagMonthlyTrendResponse>(`/transactions/analytics/tag-trend?${params}`)).data
    },
  })
  // The trend covers the last 12 months, not the filtered period, so with no
  // currency chosen (empty period) it falls back to the first series.
  const allSeries = trend.data?.series ?? []
  const series = allSeries.find((s) => s.currency === currency) ?? (currency ? undefined : allSeries[0])
  const points = (series?.points ?? []).map((p) => ({
    month: formatMonth(p.month),
    total: plot(p.total_expense),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag trend</CardTitle>
        <CardDescription>Monthly expenses, last 12 months</CardDescription>
        <CardAction className="w-40">
          <SimpleSelect
            aria-label="Trend tag"
            value={tagId}
            onValueChange={setTagId}
            placeholder="Select a tag"
            options={tags.map((t) => ({ value: String(t.id), label: t.label }))}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {!tagId ? (
          <EmptyChart text="Select a tag to see its monthly trend." />
        ) : trend.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : !series ? (
          <EmptyChart text={currency ? `No ${currency} expenses for this tag in the last 12 months.` : "No expenses for this tag in the last 12 months."} />
        ) : (
          <ChartContainer config={expenseConfig} className="aspect-auto h-64 w-full">
            <BarChart data={points} margin={{ left: 0, right: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <span className="font-mono tabular-nums">{formatMoney(Number(value), series.currency)}</span>
                    )}
                  />
                }
              />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {text}
    </div>
  )
}
