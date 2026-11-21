import { ArrowLeftRightIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney, toCents } from "@/lib/money"
import { cn } from "@/lib/utils"
import { formatDate } from "@/pages/transactions/dates"
import type { Account, InsightTransaction, Tag } from "@/types"

type ListProps = {
  title: string
  description: string
  items: InsightTransaction[]
  accounts: Account[]
  tags: Tag[]
  empty: string
  action?: { label: string; to: string }
}

export function TransactionList({ title, description, items, accounts, tags, empty, action }: ListProps) {
  const accountName = (id: number | null) => accounts.find((a) => a.id === id)?.name ?? "—"
  const tagLabel = (id: number | null) => tags.find((t) => t.id === id)?.label

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action && (
          <CardAction>
            <Link to={action.to} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {action.label}
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y">
            {items.map((tx) => {
              const tag = tx.is_transfer ? undefined : tagLabel(tx.tag_id)
              return (
                <li key={`${tx.id}-${tx.is_remainder}`} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className={cn("flex items-center gap-1.5 truncate text-sm", tx.is_remainder && "italic text-muted-foreground")}>
                      {tx.is_transfer && <ArrowLeftRightIcon className="size-3.5 shrink-0 text-muted-foreground" />}
                      <span className="truncate">{tx.is_remainder ? `${tx.description} (not yet split)` : tx.description}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(tx.date)} ·{" "}
                      {tx.is_transfer ? `To ${accountName(tx.linked_account_id)}` : accountName(tx.account_id)}
                    </p>
                  </div>
                  {tag && (
                    <Badge variant="secondary" className="hidden lg:inline-flex">
                      {tag}
                    </Badge>
                  )}
                  <span
                    className={cn(
                      "whitespace-nowrap text-sm font-medium tabular-nums",
                      toCents(tx.amount) > 0 && !tx.is_transfer && "text-(--chart-in)"
                    )}
                  >
                    {formatMoney(tx.amount, tx.currency)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
