import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
import type { CurrencyInsights } from "@/types"

const config = {
  now: { label: "This month so far", color: "var(--chart-out)" },
  usual: { label: "Usual by this day", color: "var(--chart-2)" },
} satisfies ChartConfig

const MAX_TAGS = 8

export function TagComparison({ data, monthName }: { data: CurrencyInsights; monthName: string }) {
  // Plotted values only; tooltips format them back as money.
  const rows = data.tags.slice(0, MAX_TAGS).map((t) => ({
    label: t.label,
    now: toCents(t.month_to_date) / 100,
    usual: t.usual === null ? 0 : toCents(t.usual) / 100,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where it went</CardTitle>
        <CardDescription>
          Top {Math.min(MAX_TAGS, data.tags.length)} tags in {monthName} so far, next to their usual spending
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No spending in this month yet.</p>
        ) : (
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height: rows.length * 44 + 56 }}>
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16 }} barGap={2}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="label" type="category" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <XAxis type="number" hide />
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
              <Bar dataKey="now" fill="var(--color-now)" radius={3} />
              <Bar dataKey="usual" fill="var(--color-usual)" radius={3} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
