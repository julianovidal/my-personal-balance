import {
  ArrowLeftRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  SearchXIcon,
  SplitIcon,
  Trash2Icon,
} from "lucide-react"

import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMoney, toCents } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { Account, PaginatedTransactionsResponse, Tag, Transaction } from "@/types"

import { formatDate } from "./dates"

export const PAGE_SIZES = [10, 20, 50]

type Props = {
  data?: PaginatedTransactionsResponse
  loading: boolean
  accounts: Account[]
  tags: Tag[]
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onEdit: (tx: Transaction) => void
  onSplit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
  onClearFilters: () => void
}

/** The backend adds a synthetic row (negative id) for the part of a split not yet assigned. */
const isRemainder = (tx: Transaction) => tx.id < 0
const isSplitPart = (tx: Transaction) => tx.parent_transaction_id !== null && tx.id > 0

export function TransactionsTable(props: Props) {
  const { data, loading, accounts, tags, page, pageSize } = props
  const accountName = (id: number | null) => accounts.find((a) => a.id === id)?.name ?? "—"
  const tagLabel = (id: number | null) => tags.find((t) => t.id === id)?.label
  const items = data?.items ?? []
  const totalPages = Math.max(data?.total_pages ?? 1, 1)

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="hidden md:table-cell">Account</TableHead>
              <TableHead className="hidden lg:table-cell">Tag</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-48">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <SearchXIcon className="size-6 text-muted-foreground" />
                    <div>
                      <p className="font-medium">No transactions found</p>
                      <p className="text-sm text-muted-foreground">
                        Try another period, or clear the account, tag and search filters.
                      </p>
                    </div>
                    <Button variant="outline" onClick={props.onClearFilters}>
                      Clear filters
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {items.map((tx) => {
              const cents = toCents(tx.amount)
              const tag = tx.is_transfer ? undefined : tagLabel(tx.tag_id)
              return (
                <TableRow key={tx.id} className={cn((isRemainder(tx) || isSplitPart(tx)) && "bg-muted/30")}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(tx.date)}</TableCell>
                  <TableCell className="max-w-0 w-full">
                    <div className="flex min-w-0 items-center gap-2">
                      {tx.is_transfer && <ArrowLeftRightIcon className="size-3.5 shrink-0 text-muted-foreground" />}
                      <span className={cn("truncate", isRemainder(tx) && "italic text-muted-foreground")}>
                        {isRemainder(tx) ? "Not yet split" : tx.description}
                      </span>
                      {isSplitPart(tx) && <Badge variant="outline">Split</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {tx.is_transfer && (
                        <>
                          {tx.transfer_direction === "in" ? "From " : "To "}
                          {accountName(tx.linked_account_id)}
                          <span className="md:hidden"> · </span>
                        </>
                      )}
                      <span className="md:hidden">
                        {accountName(tx.account_id)}
                        {tag && ` · ${tag}`}
                      </span>
                    </p>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap md:table-cell">{accountName(tx.account_id)}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {tag ? <Badge variant="secondary">{tag}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap text-right font-medium tabular-nums",
                      cents > 0 && !tx.is_transfer && "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {formatMoney(tx.amount, tx.currency)}
                  </TableCell>
                  <TableCell>
                    <RowActions tx={tx} {...props} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          {loading ? "Loading…" : `${data?.total ?? 0} ${data?.total === 1 ? "transaction" : "transactions"}`}
        </p>
        <div className="flex items-center gap-2">
          <span className="hidden text-muted-foreground sm:inline">Rows per page</span>
          <SimpleSelect
            aria-label="Rows per page"
            className="w-20"
            value={String(pageSize)}
            onValueChange={(v) => props.onPageSizeChange(Number(v))}
            options={PAGE_SIZES.map((s) => ({ value: String(s), label: String(s) }))}
          />
          <span className="tabular-nums">
            Page {data?.page ?? page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => props.onPageChange(page - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Next page"
            disabled={!data || page >= (data.total_pages ?? 0)}
            onClick={() => props.onPageChange(page + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}

function RowActions({ tx, onEdit, onSplit, onDelete }: Props & { tx: Transaction }) {
  // Remainder rows and split parts only open the split editor of their parent.
  const splitOnly = isRemainder(tx) || isSplitPart(tx)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={`Actions for ${tx.description}`} />}
      >
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {!splitOnly && (
          <DropdownMenuItem onClick={() => onEdit(tx)}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
        )}
        {!tx.is_transfer && (
          <DropdownMenuItem onClick={() => onSplit(tx)}>
            <SplitIcon />
            {splitOnly ? "Edit split" : "Split"}
          </DropdownMenuItem>
        )}
        {!splitOnly && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(tx)}>
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
