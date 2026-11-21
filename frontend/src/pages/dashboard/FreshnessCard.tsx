import { CircleAlertIcon, CircleCheckIcon, UploadIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatDate } from "@/pages/transactions/dates"
import type { AccountFreshness } from "@/types"

export function FreshnessCard({ accounts }: { accounts: AccountFreshness[] }) {
  const active = accounts.filter((a) => !a.inactive && a.last_date)
  const inactive = accounts.filter((a) => a.inactive)
  const empty = accounts.filter((a) => !a.last_date)
  const behind = active.filter((a) => a.stale)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data by account</CardTitle>
        <CardDescription>
          {behind.length
            ? `${behind.length} ${behind.length === 1 ? "account is" : "accounts are"} behind; this month may look lower than it is`
            : "Every active account is up to date"}
        </CardDescription>
        <CardAction>
          <Link to="/transactions?action=import" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <UploadIcon />
            Import
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {active.map((a) => (
            <li key={a.account_id} className="flex items-center gap-2 py-2">
              {a.stale ? (
                <CircleAlertIcon className="size-4 shrink-0 text-(--chart-out)" aria-label="Behind" />
              ) : (
                <CircleCheckIcon className="size-4 shrink-0 text-(--chart-in)" aria-label="Up to date" />
              )}
              <span className="flex-1 truncate">{a.name}</span>
              <span className={cn("tabular-nums text-muted-foreground", a.stale && "text-foreground")}>
                {a.last_date && formatDate(a.last_date)}
                {a.stale && ` · ${a.days_behind} days behind`}
              </span>
            </li>
          ))}
        </ul>
        {(inactive.length > 0 || empty.length > 0) && (
          <p className="mt-2 text-xs text-muted-foreground">
            {inactive.length > 0 && `Not counted as behind (no data for 90+ days): ${inactive.map((a) => a.name).join(", ")}. `}
            {empty.length > 0 && `No data yet: ${empty.map((a) => a.name).join(", ")}.`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
