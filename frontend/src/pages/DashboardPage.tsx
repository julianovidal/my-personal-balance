import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";
import { DashboardChartsResponse, DashboardSummary } from "@/types";

function PatrimonyChart({ rows }: { rows: DashboardChartsResponse["patrimony_by_year"] }) {
  const width = 1000;
  const height = 260;
  const paddingX = 48;
  const paddingY = 28;
  const values = rows.map((row) => Number(row.patrimony));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;

  const points = rows.map((row, index) => {
    const x = paddingX + (index / Math.max(rows.length - 1, 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((Number(row.patrimony) - min) / range) * (height - paddingY * 2);
    return { x, y, label: String(row.year), value: row.patrimony };
  });
  const yearlyBalances = points.map((point, index) => {
    const current = Number(point.value);
    const previous = index > 0 ? Number(points[index - 1].value) : 0;
    return current - previous;
  });
  const barMin = yearlyBalances.length ? Math.min(...yearlyBalances, 0) : 0;
  const barMax = yearlyBalances.length ? Math.max(...yearlyBalances, 0) : 1;
  const barRange = barMax - barMin || 1;
  const barZeroY = height - paddingY - ((0 - barMin) / barRange) * (height - paddingY * 2);
  const slotWidth = (width - paddingX * 2) / Math.max(rows.length, 1);
  const barWidth = Math.max(Math.min(slotWidth * 0.55, 42), 10);

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  if (rows.length < 2) {
    return <p className="text-sm text-muted-foreground">Not enough data to plot patrimony evolution yet.</p>;
  }

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} className="stroke-border" />
        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} className="stroke-border" />
        <line x1={paddingX} y1={barZeroY} x2={width - paddingX} y2={barZeroY} className="stroke-border/70" strokeDasharray="4 4" />
        {points.map((point, index) => {
          const value = yearlyBalances[index];
          const barY = height - paddingY - ((value - barMin) / barRange) * (height - paddingY * 2);
          const rectY = Math.min(barY, barZeroY);
          const rectHeight = Math.max(Math.abs(barZeroY - barY), 1);
          return (
          <rect
            key={`${point.label}-bar`}
            x={point.x - barWidth / 2}
            y={rectY}
            width={barWidth}
            height={rectHeight}
            className={value >= 0 ? "fill-primary/25" : "fill-muted-foreground/30"}
          />
          );
        })}
        <path d={path} className="fill-none stroke-primary" strokeWidth="2.5" />
        {points.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="4" className="fill-primary" />
        ))}
        {points.map((point) => (
          <text key={`${point.label}-axis`} x={point.x} y={height - 10} textAnchor="middle" className="fill-muted-foreground text-[12px]">
            {point.label}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded bg-primary/25" />Year balance (income-expenses)</span>
        <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-primary" />Patrimony</span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {points.map((point) => (
          <span key={`${point.label}-legend`}>{point.label}: {formatMoney(point.value)}</span>
        ))}
      </div>
    </div>
  );
}

function IncomeExpenseChart({ rows }: { rows: DashboardChartsResponse["income_vs_expenses_last_12_months"] }) {
  const width = 1000;
  const height = 280;
  const paddingX = 48;
  const paddingY = 28;
  const centerY = height / 2;
  const parsed = rows.map((row) => ({
    ...row,
    income: Number(row.income),
    expenses: Number(row.expenses),
  }));
  const maxBar = parsed.length ? Math.max(...parsed.map((row) => Math.max(row.income, row.expenses)), 1) : 1;
  const halfHeight = Math.max((height - paddingY * 2) / 2, 1);
  const slotWidth = (width - paddingX * 2) / Math.max(parsed.length, 1);
  const barWidth = Math.max(slotWidth * 0.32, 8);

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No monthly data available yet.</p>;
  }

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full">
        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} className="stroke-border" />
        <line x1={paddingX} y1={centerY} x2={width - paddingX} y2={centerY} className="stroke-border" />
        {parsed.map((row, index) => {
          const baseX = paddingX + slotWidth * index + (slotWidth - barWidth * 2 - 4) / 2;
          const incomeHeight = (row.income / maxBar) * halfHeight;
          const expensesHeight = (row.expenses / maxBar) * halfHeight;
          return (
            <g key={row.month}>
              <rect x={baseX} y={centerY - incomeHeight} width={barWidth} height={incomeHeight} className="fill-primary/80" />
              <rect x={baseX + barWidth + 4} y={centerY} width={barWidth} height={expensesHeight} className="fill-muted-foreground/70" />
              <text x={paddingX + slotWidth * index + slotWidth / 2} y={height - 10} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {row.month.slice(2)}
              </text>
            </g>
          );
        })}
        <text x={paddingX + 4} y={paddingY + 10} className="fill-muted-foreground text-[11px]">Income</text>
        <text x={paddingX + 4} y={height - paddingY - 4} className="fill-muted-foreground text-[11px]">Expenses</text>
      </svg>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary/80" />Income</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/70" />Expenses</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await api.get<DashboardSummary>("/dashboard/summary");
      return res.data;
    }
  });
  const { data: charts, isLoading: isChartsLoading } = useQuery({
    queryKey: ["dashboard-charts"],
    queryFn: async () => {
      const res = await api.get<DashboardChartsResponse>("/dashboard/charts");
      return res.data;
    }
  });
  const latestTransactions = data?.latest_transactions ?? [];
  const isLatestEmpty = !isLoading && latestTransactions.length === 0;
  const patrimonyRows = useMemo(() => charts?.patrimony_by_year ?? [], [charts]);
  const monthlyRows = useMemo(() => charts?.income_vs_expenses_last_12_months ?? [], [charts]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Current month</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <h3 className="text-sm uppercase tracking-wide text-muted-foreground">Income</h3>
            {isLoading ? (
              <div className="mt-2 h-8 w-28 animate-pulse rounded bg-muted" />
            ) : (
              <p className="mt-2 text-2xl font-semibold">{formatMoney(data?.current_month_income ?? 0)}</p>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="text-sm uppercase tracking-wide text-muted-foreground">Expenses</h3>
            {isLoading ? (
              <div className="mt-2 h-8 w-28 animate-pulse rounded bg-muted" />
            ) : (
              <p className="mt-2 text-2xl font-semibold">{formatMoney(data?.current_month_expenses ?? 0)}</p>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="text-sm uppercase tracking-wide text-muted-foreground">Net</h3>
            {isLoading ? (
              <div className="mt-2 h-8 w-28 animate-pulse rounded bg-muted" />
            ) : (
              <p className="mt-2 text-2xl font-semibold">{formatMoney(data?.current_month_net ?? 0)}</p>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Patrimony Evolution (Yearly)</h2>
          {isChartsLoading ? <div className="h-64 animate-pulse rounded bg-muted" /> : <PatrimonyChart rows={patrimonyRows} />}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Income vs Expenses (Last 12 Months)</h2>
          {isChartsLoading ? <div className="h-72 animate-pulse rounded bg-muted" /> : <IncomeExpenseChart rows={monthlyRows} />}
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Latest transactions</h2>
          <Badge variant="secondary">All accounts</Badge>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 z-10 bg-muted text-left text-muted-foreground hover:bg-muted">
                <TableHead className="px-3 py-2">Date</TableHead>
                <TableHead className="px-3 py-2">Description</TableHead>
                <TableHead className="px-3 py-2 text-right">Amount</TableHead>
                <TableHead className="px-3 py-2">Currency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={`loading-${index}`} className="border-t border-border hover:bg-muted/60">
                      <TableCell className="px-3 py-2"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                      <TableCell className="px-3 py-2"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></TableCell>
                      <TableCell className="px-3 py-2"><div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                      <TableCell className="px-3 py-2"><div className="h-4 w-14 animate-pulse rounded bg-muted" /></TableCell>
                    </TableRow>
                  ))
                : null}
              {latestTransactions.map((tx, index) => (
                <TableRow key={tx.id} className={`border-t border-border ${index % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/60`}>
                  <TableCell className="px-3 py-2">{tx.date}</TableCell>
                  <TableCell className="px-3 py-2">{tx.description}</TableCell>
                  <TableCell className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(tx.amount)}</TableCell>
                  <TableCell className="px-3 py-2">{tx.currency}</TableCell>
                </TableRow>
              ))}
              {isLatestEmpty ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-6 py-10 text-center text-sm text-muted-foreground">
                    No recent transactions yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
