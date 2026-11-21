import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatMoney, toCents } from "@/lib/money"
import { formatMonth } from "@/pages/transactions/dates"
import type { CurrencyInsights } from "@/types"

const config = {
  income: { label: "Income", color: "var(--chart-in)" },
  expenses: { label: "Expenses", color: "var(--chart-out)" },
} satisfies ChartConfig

export function CashflowChart({ data, partialMonth }: { data: CurrencyInsights; partialMonth: boolean }) {
  const rows = data.trend.map((p, i) => ({
    label: formatMonth(p.month) + (partialMonth && i === data.trend.length - 1 ? "*" : ""),
    income: toCents(p.income) / 100,
    expenses: toCents(p.expenses) / 100,
  }))
  const missing = data.trend.filter((p) => !p.has_data).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs expenses</CardTitle>
        <CardDescription>
          12 months up to the data date
          {partialMonth && " · * month still in progress"}
          {missing > 0 && ` · ${missing} ${missing === 1 ? "month" : "months"} without data`}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart data={rows} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex w-full justify-between gap-4">
                      <span className="text-muted-foreground">{config[name as keyof typeof config]?.label}</span>
                      <span className="font-mono tabular-nums">{formatMoney(Number(value), data.currency)}</span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="income" fill="var(--color-income)" radius={3} />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={3} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
