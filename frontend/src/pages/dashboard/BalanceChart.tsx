import { useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCents, formatMoney, toCents } from "@/lib/money"
import { formatMonth } from "@/pages/transactions/dates"

const config = { balance: { label: "Balance", color: "var(--chart-in)" } } satisfies ChartConfig

type Point = { month: string; balance: string }

/** Year-end balance: the last month of each year (or the latest month for the current year). */
export function yearlyPoints(points: Point[]) {
  const byYear = new Map<string, Point>()
  for (const p of points) byYear.set(p.month.slice(0, 4), p)
  return [...byYear.entries()].map(([year, p]) => ({ label: year, month: p.month, balance: p.balance }))
}

const compact = (currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 })

export function BalanceChart({ points, currency }: { points: Point[]; currency: string }) {
  const [view, setView] = useState<"monthly" | "yearly">("monthly")
  const rows =
    view === "monthly"
      ? points.slice(-36).map((p) => ({ label: formatMonth(p.month), balance: toCents(p.balance) / 100 }))
      : yearlyPoints(points).map((p) => ({ label: p.label, balance: toCents(p.balance) / 100 }))
  const first = points.at(view === "monthly" ? -Math.min(points.length, 36) : 0)
  const last = points.at(-1)
  const change = first && last ? toCents(last.balance) - toCents(first.balance) : 0

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Balance over time</CardTitle>
        <CardDescription>
          {view === "monthly" ? "Month-end balance, last 3 years" : "Year-end balance, all years"}
          {first && last && (
            <span className="tabular-nums">
              {" "}
              · {change >= 0 ? "+" : "−"}
              {formatCents(Math.abs(change), currency)}
            </span>
          )}
        </CardDescription>
        <CardAction>
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <AreaChart data={rows} margin={{ left: 4, right: 8 }}>
            <defs>
              <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => compact(currency).format(v)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value) => (
                    <span className="font-mono tabular-nums">{formatMoney(Number(value), currency)}</span>
                  )}
                />
              }
            />
            <Area dataKey="balance" type="monotone" fill="url(#fillBalance)" stroke="var(--color-balance)" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
