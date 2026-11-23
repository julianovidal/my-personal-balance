import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon, SearchIcon, UploadIcon } from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { api } from "@/api/client"
import { invalidateTransactionQueries, useAccounts, useTags } from "@/api/queries"
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
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/auth-errors"
import { formatMoney } from "@/lib/money"
import type { MonthlySummaryResponse, PaginatedTransactionsResponse, Transaction } from "@/types"

import { formatDate } from "./transactions/dates"
import { ExpenseCharts } from "./transactions/ExpenseCharts"
import { ALL, filterParams, filtersFromSearch, type Filters } from "./transactions/filters"
import { ImportDialog } from "./transactions/ImportDialog"
import { SplitDialog } from "./transactions/SplitDialog"
import { SummaryCards } from "./transactions/SummaryCards"
import { TransactionFilters } from "./transactions/TransactionFilters"
import { TransactionFormDialog } from "./transactions/TransactionFormDialog"
import { TransactionsTable } from "./transactions/TransactionsTable"

export function TransactionsPage() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const action = searchParams.get("action")

  const accounts = useAccounts().data ?? []
  const tags = useTags().data ?? []

  const [filters, setFilters] = useState<Filters>(() => filtersFromSearch(searchParams))
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search.trim())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Links like /transactions?action=add (used by the dashboard) open a dialog once.
  const [form, setForm] = useState<{ open: boolean; tx: Transaction | null }>(() => ({
    open: action === "add",
    tx: null,
  }))
  const [importOpen, setImportOpen] = useState(action === "import")
  const [splitTx, setSplitTx] = useState<Transaction | null>(null)
  const [toDelete, setToDelete] = useState<Transaction | null>(null)

  useEffect(() => {
    if (action) setSearchParams({}, { replace: true })
  }, [action, setSearchParams])

  const changeFilters = (next: Filters) => {
    setFilters(next)
    setPage(1)
  }

  const list = useQuery({
    queryKey: [
      "transactions",
      filters.from,
      filters.to,
      filters.accountId,
      filters.tagId,
      debouncedSearch,
      page,
      pageSize,
    ],
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const params = filterParams(filters)
      params.set("page", String(page))
      params.set("page_size", String(pageSize))
      if (debouncedSearch) params.set("search_text", debouncedSearch)
      return (await api.get<PaginatedTransactionsResponse>(`/transactions?${params}`)).data
    },
  })

  const summary = useQuery({
    queryKey: ["transactions-summary", filters.from, filters.to, filters.accountId, filters.tagId],
    queryFn: async () =>
      (await api.get<MonthlySummaryResponse>(`/transactions/summary/monthly?${filterParams(filters)}`)).data,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      setToDelete(null)
      invalidateTransactionQueries(qc)
    },
  })

  // Totals come back per currency and are never added together. With more than
  // one, tabs pick which currency the cards and charts show.
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null)
  const totals = summary.data?.totals ?? []
  const current = totals.find((t) => t.currency === chosenCurrency) ?? totals[0]
  const selectedAccount = accounts.find((a) => String(a.id) === filters.accountId)
  const currency = current?.currency ?? (filters.accountId !== ALL ? (selectedAccount?.currency ?? null) : null)
  const periodLabel = `${formatDate(filters.from)} – ${formatDate(filters.to)}`

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Apply to the totals, charts and list below.</CardDescription>
          <CardAction className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <UploadIcon />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button onClick={() => setForm({ open: true, tx: null })}>
              <PlusIcon />
              <span className="hidden sm:inline">Add transaction</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TransactionFilters filters={filters} onChange={changeFilters} accounts={accounts} tags={tags} />
        </CardContent>
      </Card>

      {totals.length > 1 && (
        <div className="flex justify-end">
          <Tabs value={current?.currency} onValueChange={(v) => setChosenCurrency(v as string)}>
            <TabsList aria-label="Currency">
              {totals.map((t) => (
                <TabsTrigger key={t.currency} value={t.currency}>
                  {t.currency}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <SummaryCards totals={current} loading={summary.isPending} currency={currency} periodLabel={periodLabel} />

      <ExpenseCharts filters={filters} tags={tags} currency={currency} />

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
          <CardAction className="w-44 sm:w-64">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search descriptions"
                placeholder="Search descriptions"
                className="pl-7"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {list.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn't load transactions. {getApiErrorMessage(list.error)}
            </p>
          ) : (
            <TransactionsTable
              data={list.data}
              loading={list.isPending}
              accounts={accounts}
              tags={tags}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              onEdit={(tx) => setForm({ open: true, tx })}
              onSplit={setSplitTx}
              onDelete={setToDelete}
              onClearFilters={() => {
                changeFilters({ ...filters, accountId: ALL, tagId: ALL })
                setSearch("")
              }}
            />
          )}
        </CardContent>
      </Card>

      <TransactionFormDialog
        open={form.open}
        transaction={form.tx}
        accounts={accounts}
        tags={tags}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
      />
      <ImportDialog open={importOpen} accounts={accounts} tags={tags} onOpenChange={setImportOpen} />
      <SplitDialog transaction={splitTx} tags={tags} onClose={() => setSplitTx(null)} />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && (
                <>
                  {formatDate(toDelete.date)} · {toDelete.description} ·{" "}
                  {formatMoney(toDelete.amount, toDelete.currency)}
                  {toDelete.is_transfer && ". Both sides of the transfer are deleted."}
                </>
              )}
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
              onClick={() => toDelete && toDelete.id > 0 && remove.mutate(toDelete.id)}
            >
              {remove.isPending ? "Deleting..." : "Delete transaction"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
