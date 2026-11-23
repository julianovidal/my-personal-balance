import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  EllipsisVerticalIcon,
  FileSpreadsheetIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react"

import { api } from "@/api/client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getApiErrorMessage } from "@/lib/auth-errors"
import { formatCents, toCents } from "@/lib/money"
import { cn } from "@/lib/utils"
import { AccountFormDialog } from "@/pages/accounts/AccountFormDialog"
import { ImportMappingSheet } from "@/pages/accounts/ImportMappingSheet"
import type { Account, AccountsBalanceResponse } from "@/types"

/** Server totals per currency, with how many accounts use each currency. */
function currencyTotals(data: AccountsBalanceResponse | undefined) {
  const counts = new Map<string, number>()
  for (const item of data?.by_account ?? []) counts.set(item.currency, (counts.get(item.currency) ?? 0) + 1)
  return (data?.totals ?? []).map((total) => ({
    currency: total.currency,
    cents: toCents(total.balance),
    count: counts.get(total.currency) ?? 0,
  }))
}

export function AccountsPage() {
  const qc = useQueryClient()
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts")).data,
  })
  const balances = useQuery({
    queryKey: ["accounts-balances"],
    queryFn: async () => (await api.get<AccountsBalanceResponse>("/accounts/balances")).data,
  })

  const [form, setForm] = useState<{ open: boolean; account: Account | null }>({
    open: false,
    account: null,
  })
  const [importFor, setImportFor] = useState<Account | null>(null)
  const [toDelete, setToDelete] = useState<Account | null>(null)

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      setToDelete(null)
      qc.invalidateQueries({ queryKey: ["accounts"] })
      qc.invalidateQueries({ queryKey: ["accounts-balances"] })
    },
  })

  const list = accounts.data ?? []
  const balanceById = new Map((balances.data?.by_account ?? []).map((b) => [b.account_id, b]))
  const totals = currencyTotals(balances.data)
  const openCreate = () => setForm({ open: true, account: null })

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <SummaryCards
        loading={balances.isPending}
        totals={totals}
        accountCount={list.length}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your accounts</CardTitle>
          <CardDescription>Each balance is the sum of the account's transactions.</CardDescription>
          <CardAction>
            <Button onClick={openCreate}>
              <PlusIcon />
              Add account
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Currency</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.isPending &&
                  [0, 1, 2, 3].map((i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {accounts.isError && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-destructive">
                      Couldn't load accounts. {getApiErrorMessage(accounts.error)}
                    </TableCell>
                  </TableRow>
                )}
                {accounts.isSuccess && list.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center">
                      <p className="font-medium">No accounts yet</p>
                      <p className="text-sm text-muted-foreground">
                        Create your first account to start tracking balances.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
                {list.map((account) => {
                  const balance = balanceById.get(account.id)
                  const cents = toCents(balance?.balance)
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <WalletIcon className="size-4 text-muted-foreground" />
                          <span className="truncate">{account.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{account.currency}</Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          cents < 0 && "text-destructive"
                        )}
                      >
                        {balances.isPending ? (
                          <Skeleton className="ml-auto h-5 w-24" />
                        ) : (
                          formatCents(cents, account.currency)
                        )}
                      </TableCell>
                      <TableCell>
                        <AccountActions
                          account={account}
                          onEdit={() => setForm({ open: true, account })}
                          onImport={() => setImportFor(account)}
                          onDelete={() => setToDelete(account)}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AccountFormDialog
        open={form.open}
        account={form.account}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
      />

      <ImportMappingSheet account={importFor} onClose={() => setImportFor(null)} />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              All of this account's transactions are deleted with it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {remove.isError && (
            <p role="alert" className="text-sm text-destructive">
              {getApiErrorMessage(remove.error)}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => toDelete && remove.mutate(toDelete.id)}
            >
              {remove.isPending ? "Deleting..." : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SummaryCards({
  loading,
  totals,
  accountCount,
}: {
  loading: boolean
  totals: { currency: string; cents: number; count: number }[]
  accountCount: number
}) {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {loading && (
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total balance</CardDescription>
            <Skeleton className="h-8 w-40" />
          </CardHeader>
        </Card>
      )}
      {totals.map((total) => (
        <Card key={total.currency} className="@container/card">
          <CardHeader>
            <CardDescription>Total in {total.currency}</CardDescription>
            <CardTitle
              className={cn(
                "text-2xl font-semibold tabular-nums @[250px]/card:text-3xl",
                total.cents < 0 && "text-destructive"
              )}
            >
              {formatCents(total.cents, total.currency)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">{total.currency}</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            Across {total.count} {total.count === 1 ? "account" : "accounts"}
          </CardFooter>
        </Card>
      ))}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Accounts</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {accountCount}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          {totals.length > 1
            ? `In ${totals.length} currencies, shown separately`
            : "Totals are never mixed across currencies"}
        </CardFooter>
      </Card>
    </div>
  )
}

function AccountActions({
  account,
  onEdit,
  onImport,
  onDelete,
}: {
  account: Account
  onEdit: () => void
  onImport: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Actions for ${account.name}`} />
        }
      >
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={onEdit}>
          <PencilIcon />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onImport}>
          <FileSpreadsheetIcon />
          Import settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
