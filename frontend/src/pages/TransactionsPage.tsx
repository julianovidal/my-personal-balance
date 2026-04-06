import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, MoreHorizontal, SearchX } from "lucide-react";
import { api } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";
import {
  Account,
  ImportPreviewResponse,
  MonthlyAnalyticsResponse,
  MonthlySummaryResponse,
  PaginatedTransactionsResponse,
  SplitTransactionResponse,
  TagMonthlyTrendResponse,
  Tag,
  Transaction
} from "@/types";

const CURRENCIES = ["EUR", "USD", "BRL"] as const;
type DateRangePreset =
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months"
  | "custom";

const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

function toDateInputValue(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromDateInputValue(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function isEndOfMonth(value: Date) {
  return value.getDate() === new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
}

function shiftDateInputByMonths(value: string, months: number, keepMonthEnd = false) {
  const source = fromDateInputValue(value);
  const day = source.getDate();
  const targetYear = source.getFullYear();
  const targetMonth = source.getMonth() + months;
  const targetLastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = keepMonthEnd && isEndOfMonth(source) ? targetLastDay : Math.min(day, targetLastDay);
  return toDateInputValue(new Date(targetYear, targetMonth, targetDay));
}

function getDateRangeFromPreset(preset: Exclude<DateRangePreset, "custom">, now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === "this_month") {
    return {
      from: toDateInputValue(new Date(year, month, 1)),
      to: toDateInputValue(new Date(year, month + 1, 0))
    };
  }

  if (preset === "last_month") {
    return {
      from: toDateInputValue(new Date(year, month - 1, 1)),
      to: toDateInputValue(new Date(year, month, 0))
    };
  }

  if (preset === "this_year") {
    return {
      from: toDateInputValue(new Date(year, 0, 1)),
      to: toDateInputValue(new Date(year, 11, 31))
    };
  }

  if (preset === "last_year") {
    return {
      from: toDateInputValue(new Date(year - 1, 0, 1)),
      to: toDateInputValue(new Date(year - 1, 11, 31))
    };
  }

  const monthSpan = preset === "last_3_months" ? 3 : preset === "last_6_months" ? 6 : 12;
  return {
    from: toDateInputValue(new Date(year, month - (monthSpan - 1), 1)),
    to: toDateInputValue(new Date(year, month + 1, 0))
  };
}

function ExpenseBars({ title, rows }: { title: string; rows: { label: string; total_expense: string }[] }) {
  const max = rows.length ? Math.max(...rows.map((row) => Number(row.total_expense))) : 0;

  return (
    <Card className="p-5">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      <div className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No expenses for selected filters.</p> : null}
        {rows.map((row) => {
          const value = Number(row.total_expense);
          const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0;
          return (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{row.label}</span>
                <span className="font-semibold">{formatMoney(value)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TagTrendBars({ rows }: { rows: { month: string; total_expense: string }[] }) {
  const max = rows.length ? Math.max(...rows.map((row) => Number(row.total_expense))) : 0;

  return (
    <Card className="p-5">
      <h3 className="mb-3 text-base font-semibold">Selected tag expense trend (last 12 months)</h3>
      <div className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Select a tag to see trend.</p> : null}
        {rows.map((row) => {
          const value = Number(row.total_expense);
          const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0;
          return (
            <div key={row.month}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{row.month}</span>
                <span className="font-semibold">{formatMoney(value)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function TransactionsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [dateFrom, setDateFrom] = useState(toDateInputValue(currentMonthStart));
  const [dateTo, setDateTo] = useState(toDateInputValue(currentMonthEnd));
  const [datePreset, setDatePreset] = useState<DateRangePreset>("this_month");
  const [accountFilter, setAccountFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [trendTagId, setTrendTagId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [accountId, setAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [createTagId, setCreateTagId] = useState("");
  const [isTransfer, setIsTransfer] = useState(false);
  const [destinationAccountId, setDestinationAccountId] = useState("");

  const [uploadAccountId, setUploadAccountId] = useState("");
  const [uploadTagId, setUploadTagId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<string>("");

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [openActionsMenuId, setOpenActionsMenuId] = useState<number | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitParent, setSplitParent] = useState<Transaction | null>(null);
  const [splitRows, setSplitRows] = useState<Array<{ id?: number; description: string; amount: string; tag_id: string }>>([]);
  const [splitResult, setSplitResult] = useState("");

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "add") {
      setEditing(null);
      setDate(new Date().toISOString().slice(0, 10));
      setDescription("");
      setAmount("");
      setCurrency("EUR");
      setAccountId("");
      setCreateTagId("");
      setIsTransactionModalOpen(true);
      navigate("/transactions", { replace: true });
    }
    if (action === "import") {
      setUploadAccountId("");
      setUploadTagId("");
      setFile(null);
      setImportPreview(null);
      setImportResult("");
      setIsImportModalOpen(true);
      navigate("/transactions", { replace: true });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    if (openActionsMenuId === null) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-actions-menu-root="true"]')) {
        setOpenActionsMenuId(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenActionsMenuId(null);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openActionsMenuId]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts")).data
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => (await api.get<Tag[]>("/tags")).data
  });

  const { data: txResponse, isLoading: isTransactionsLoading } = useQuery({
    queryKey: ["transactions", dateFrom, dateTo, accountFilter, tagFilter, textFilter, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        page: String(page),
        page_size: String(pageSize)
      });
      if (accountFilter) params.set("account_id", accountFilter);
      if (tagFilter) params.set("tag_id", tagFilter);
      if (textFilter.trim()) params.set("search_text", textFilter.trim());
      const res = await api.get<PaginatedTransactionsResponse>(`/transactions?${params.toString()}`);
      return res.data;
    }
  });

  const { data: analytics } = useQuery({
    queryKey: ["transactions-analytics", dateFrom, dateTo, accountFilter, tagFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (accountFilter) params.set("account_id", accountFilter);
      if (tagFilter) params.set("tag_id", tagFilter);
      const res = await api.get<MonthlyAnalyticsResponse>(`/transactions/analytics/monthly?${params.toString()}`);
      return res.data;
    }
  });

  const { data: trendData } = useQuery({
    queryKey: ["transactions-tag-trend", trendTagId, accountFilter],
    enabled: Boolean(trendTagId),
    queryFn: async () => {
      const params = new URLSearchParams({ tag_id: trendTagId });
      if (accountFilter) params.set("account_id", accountFilter);
      const res = await api.get<TagMonthlyTrendResponse>(`/transactions/analytics/tag-trend?${params.toString()}`);
      return res.data;
    }
  });

  const { data: monthlySummary } = useQuery({
    queryKey: ["transactions-summary", dateFrom, dateTo, accountFilter, tagFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (accountFilter) params.set("account_id", accountFilter);
      if (tagFilter) params.set("tag_id", tagFilter);
      const res = await api.get<MonthlySummaryResponse>(`/transactions/summary/monthly?${params.toString()}`);
      return res.data;
    }
  });

  const transactions = txResponse?.items ?? [];
  const isTransactionsEmpty = !isTransactionsLoading && transactions.length === 0;

  const saveTx = useMutation({
    mutationFn: async () => {
      const payload = {
        date,
        description,
        account_id: Number(accountId),
        tag_id: isTransfer ? null : (createTagId ? Number(createTagId) : null),
        is_transfer: isTransfer,
        destination_account_id: isTransfer ? Number(destinationAccountId) : null,
        amount,
        currency
      };

      if (editing) {
        await api.put(`/transactions/${editing.id}`, payload);
      } else {
        await api.post("/transactions", payload);
      }
    },
    onSuccess: () => {
      clearTransactionForm();
      setIsTransactionModalOpen(false);
      invalidateTransactionQueries(qc);
    }
  });

  const deleteTx = useMutation({
    mutationFn: async (id: number) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      setTransactionToDelete(null);
      invalidateTransactionQueries(qc);
    }
  });

  const previewUpload = useMutation({
    mutationFn: async () => {
      if (!file || !uploadAccountId) return;
      const data = new FormData();
      data.append("file", file);
      const query = uploadTagId ? `?default_tag_id=${uploadTagId}` : "";
      const res = await api.post<ImportPreviewResponse>(`/transactions/import/preview/${uploadAccountId}${query}`, data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (!data) return;
      setImportPreview(data);
      setImportResult("");
    }
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !uploadAccountId) return;
      const data = new FormData();
      data.append("file", file);
      const query = uploadTagId ? `?default_tag_id=${uploadTagId}` : "";
      const res = await api.post<{ imported: number; skipped: number }>(`/transactions/import/${uploadAccountId}${query}`, data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (!data) return;
      setImportResult(`Imported ${data.imported} rows, skipped ${data.skipped}.`);
      setImportPreview(null);
      setFile(null);
      invalidateTransactionQueries(qc);
    }
  });

  const saveSplits = useMutation({
    mutationFn: async () => {
      if (!splitParent) return;
      const payload = {
        rows: splitRows.map((row) => ({
          id: row.id ?? null,
          description: row.description,
          amount: Number(row.amount),
          tag_id: row.tag_id ? Number(row.tag_id) : null
        }))
      };
      const res = await api.put<SplitTransactionResponse>(`/transactions/${splitParent.id}/splits`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      if (!data) return;
      setSplitResult(`Saved splits. Remaining: ${formatMoney(data.remaining_amount)}`);
      setSplitRows(
        data.rows.map((row) => ({
          id: row.id,
          description: row.description,
          amount: String(Math.abs(Number(row.amount))),
          tag_id: row.tag_id ? String(row.tag_id) : ""
        }))
      );
      invalidateTransactionQueries(qc);
    }
  });

  const confirmDeleteTransaction = () => {
    if (!transactionToDelete || transactionToDelete.id <= 0) return;
    deleteTx.mutate(transactionToDelete.id);
  };

  const openSplitModal = async (tx: Transaction) => {
    const targetId = tx.parent_transaction_id ?? (tx.id > 0 ? tx.id : null);
    if (!targetId) return;
    const res = await api.get<SplitTransactionResponse>(`/transactions/${targetId}/splits`);
    setSplitParent(res.data.parent);
    setSplitRows(
      res.data.rows.map((row) => ({
        id: row.id,
        description: row.description,
        amount: String(Math.abs(Number(row.amount))),
        tag_id: row.tag_id ? String(row.tag_id) : ""
      }))
    );
    setSplitResult("");
    setIsSplitModalOpen(true);
  };

  const startEdit = (tx: Transaction) => {
    setEditing(tx);
    setDate(tx.date);
    setDescription(tx.description);
    setAmount(tx.is_transfer ? String(Math.abs(Number(tx.amount))) : tx.amount);
    setCurrency(tx.currency);
    if (tx.is_transfer) {
      setIsTransfer(true);
      if (tx.transfer_direction === "in") {
        setAccountId(tx.linked_account_id ? String(tx.linked_account_id) : "");
        setDestinationAccountId(String(tx.account_id));
      } else {
        setAccountId(String(tx.account_id));
        setDestinationAccountId(tx.linked_account_id ? String(tx.linked_account_id) : "");
      }
      setCreateTagId("");
    } else {
      setIsTransfer(false);
      setAccountId(String(tx.account_id));
      setDestinationAccountId("");
      setCreateTagId(tx.tag_id ? String(tx.tag_id) : "");
    }
    setIsTransactionModalOpen(true);
  };

  const clearTransactionForm = () => {
    setEditing(null);
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setAmount("");
    setCurrency("EUR");
    setAccountId("");
    setCreateTagId("");
    setIsTransfer(false);
    setDestinationAccountId("");
  };

  const resetImportForm = () => {
    setUploadAccountId("");
    setUploadTagId("");
    setFile(null);
    setImportPreview(null);
    setImportResult("");
  };

  const onFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const onDatePresetChange = (preset: DateRangePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return;
    const range = getDateRangeFromPreset(preset, new Date());
    setDateFrom(range.from);
    setDateTo(range.to);
    setPage(1);
  };

  const shiftDateRangeByMonths = (months: number) => {
    setDatePreset("custom");
    setDateFrom((prev) => shiftDateInputByMonths(prev, months));
    setDateTo((prev) => shiftDateInputByMonths(prev, months, true));
    setPage(1);
  };

  const clearFilters = () => {
    setAccountFilter("");
    setTagFilter("");
    setTextFilter("");
    setPage(1);
  };

  const downloadTemplate = () => {
    const content = [
      "date,description,amount,currency,tag_id",
      "2026-02-01,Supermarket,-82.45,EUR,",
      "2026-02-03,Salary,3200.00,EUR,"
    ].join("\n");

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "transactions_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const onAccountChange = (nextAccountId: string) => {
    setAccountId(nextAccountId);
    const selected = accounts.find((a) => String(a.id) === nextAccountId);
    if (selected) {
      setCurrency(selected.currency);
    }
    if (destinationAccountId && destinationAccountId === nextAccountId) {
      setDestinationAccountId("");
    }
  };

  const addSplitRow = () => {
    setSplitRows((prev) => [...prev, { description: "", amount: "", tag_id: "" }]);
  };

  const updateSplitRow = (index: number, field: "description" | "amount" | "tag_id", value: string) => {
    setSplitRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const removeSplitRow = (index: number) => {
    setSplitRows((prev) => prev.filter((_, i) => i !== index));
  };

  const splitRemaining = useMemo(() => {
    if (!splitParent) return 0;
    const total = splitRows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
    return Math.abs(Number(splitParent.amount)) - total;
  }, [splitParent, splitRows]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Filters</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                clearTransactionForm();
                setIsTransactionModalOpen(true);
              }}
            >
              Add transaction
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetImportForm();
                setIsImportModalOpen(true);
              }}
            >
              Import transactions
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          <div>
            <Label className={labelClass}>Date range</Label>
            <Select value={datePreset} onValueChange={(v) => onDatePresetChange(v as DateRangePreset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="this_year">This year</SelectItem>
                <SelectItem value="last_year">Last year</SelectItem>
                <SelectItem value="last_3_months">Last 3 months</SelectItem>
                <SelectItem value="last_6_months">Last 6 months</SelectItem>
                <SelectItem value="last_12_months">Last 12 months</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" type="button" onClick={() => shiftDateRangeByMonths(-1)}>
                -1 month
              </Button>
              <Button variant="outline" type="button" onClick={() => shiftDateRangeByMonths(1)}>
                +1 month
              </Button>
            </div>
          </div>
          <div>
            <Label className={labelClass}>From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDatePreset("custom");
                onFilterChange(setDateFrom, e.target.value);
              }}
            />
          </div>
          <div>
            <Label className={labelClass}>To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDatePreset("custom");
                onFilterChange(setDateTo, e.target.value);
              }}
            />
          </div>
          <div>
            <Label className={labelClass}>Account</Label>
            <Select value={accountFilter || "__all__"} onValueChange={(v) => onFilterChange(setAccountFilter, v === "__all__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All accounts</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={labelClass}>Tag</Label>
            <Select value={tagFilter || "__all__"} onValueChange={(v) => onFilterChange(setTagFilter, v === "__all__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={String(tag.id)}>{tag.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <h3 className="text-sm uppercase tracking-wide text-muted-foreground">Income</h3>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(monthlySummary?.overall.income ?? 0)}</p>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm uppercase tracking-wide text-muted-foreground">Expenses</h3>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(monthlySummary?.overall.expenses ?? 0)}</p>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm uppercase tracking-wide text-muted-foreground">Net</h3>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(monthlySummary?.overall.net ?? 0)}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ExpenseBars title="Monthly expenses by tag" rows={analytics?.by_tag ?? []} />
        <div className="space-y-3">
          <Card className="p-5">
            <Label className={labelClass}>Trend tag</Label>
            <Select value={trendTagId || "__none__"} onValueChange={(v) => setTrendTagId(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select tag</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={String(tag.id)}>{tag.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
          <TagTrendBars rows={trendData?.points ?? []} />
        </div>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Transactions</h2>
            <p className="text-sm text-muted-foreground">Browse, filter, and manage your records.</p>
          </div>
          <div className="w-full md:w-[32rem]">
            <div>
              <Label className={labelClass}>Search text</Label>
              <Input
                value={textFilter}
                onChange={(e) => {
                  setTextFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by description"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 z-10 bg-muted hover:bg-muted">
                <TableHead className="px-3 py-2">Date</TableHead>
                <TableHead className="px-3 py-2">Description</TableHead>
                <TableHead className="px-3 py-2">Account</TableHead>
                <TableHead className="px-3 py-2 text-right">Amount</TableHead>
                <TableHead className="px-3 py-2">Currency</TableHead>
                <TableHead className="px-3 py-2">Tag</TableHead>
                <TableHead className="px-3 py-2">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isTransactionsLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={`loading-${index}`} className="border-t border-border">
                    <TableCell className="px-3 py-2"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell className="px-3 py-2"><div className="h-4 w-48 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell className="px-3 py-2"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell className="px-3 py-2"><div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell className="px-3 py-2"><div className="h-4 w-12 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell className="px-3 py-2"><div className="h-4 w-16 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell className="px-3 py-2"><div className="h-8 w-8 animate-pulse rounded bg-muted" /></TableCell>
                  </TableRow>
                ))
              ) : null}

              {transactions.map((tx, index) => (
                <TableRow
                  key={tx.id}
                  className={`border-t border-border transition-colors hover:bg-muted/60 ${index % 2 === 0 ? "bg-background" : "bg-muted/20"} ${tx.parent_transaction_id ? "bg-muted/50" : ""}`}
                >
                  <TableCell className="px-3 py-2">{tx.date}</TableCell>
                  <TableCell className="px-3 py-2">{tx.description}</TableCell>
                  <TableCell className="px-3 py-2">{accounts.find((a) => a.id === tx.account_id)?.name ?? "-"}</TableCell>
                  <TableCell className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(tx.amount)}</TableCell>
                  <TableCell className="px-3 py-2">{tx.currency}</TableCell>
                  <TableCell className="px-3 py-2">{tx.is_transfer ? "-" : (tags.find((t) => t.id === tx.tag_id)?.label ?? "-")}</TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="relative inline-block" data-actions-menu-root="true">
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setOpenActionsMenuId((current) => (current === tx.id ? null : tx.id))}
                        aria-label="Open actions menu"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>

                      {openActionsMenuId === tx.id ? (
                        <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-border bg-card p-1 shadow-lg">
                          {tx.parent_transaction_id ? (
                            <button
                              type="button"
                              className="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                              onClick={() => {
                                openSplitModal(tx);
                                setOpenActionsMenuId(null);
                              }}
                            >
                              Split
                            </button>
                          ) : (
                            <>
                              {tx.id > 0 ? (
                                <button
                                  type="button"
                                  className="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                                  onClick={() => {
                                    startEdit(tx);
                                    setOpenActionsMenuId(null);
                                  }}
                                >
                                  Edit
                                </button>
                              ) : null}
                              {tx.id > 0 && !tx.is_transfer ? (
                                <button
                                  type="button"
                                  className="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                                  onClick={() => {
                                    openSplitModal(tx);
                                    setOpenActionsMenuId(null);
                                  }}
                                >
                                  Split
                                </button>
                              ) : null}
                              {tx.id > 0 ? (
                                <button
                                  type="button"
                                  className="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                                  onClick={() => {
                                    setTransactionToDelete(tx);
                                    setOpenActionsMenuId(null);
                                  }}
                                >
                                  Delete
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {isTransactionsEmpty ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-6 py-12">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <SearchX className="h-6 w-6 text-muted-foreground" />
                      <div>
                        <p className="font-medium">No transactions found</p>
                        <p className="text-sm text-muted-foreground">Try changing your filters or clear them to see results.</p>
                      </div>
                      <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            {isTransactionsLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading transactions...
              </span>
            ) : (
              <>Showing {transactions.length} of {txResponse?.total ?? 0} results</>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page size</span>
              <div className="w-20">
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button variant="outline" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1}>
              Previous
            </Button>
            <span>
              Page {txResponse?.page ?? 1} / {Math.max(txResponse?.total_pages ?? 1, 1)}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={(txResponse?.total_pages ?? 0) === 0 || page >= (txResponse?.total_pages ?? 0)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Delete transaction dialog */}
      <Dialog open={Boolean(transactionToDelete)} onOpenChange={(open) => { if (!open) setTransactionToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this transaction?
            </p>
            <p className="text-sm">
              <span className="font-semibold">{transactionToDelete?.date}</span>
              {" - "}
              <span className="font-semibold">{transactionToDelete?.description}</span>
              {" - "}
              <span className="font-semibold">
                {formatMoney(transactionToDelete?.amount)} {transactionToDelete?.currency}
              </span>
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTransactionToDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDeleteTransaction} disabled={deleteTx.isPending}>
                {deleteTx.isPending ? "Deleting..." : "Delete transaction"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit transaction dialog */}
      <Dialog
        open={isTransactionModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsTransactionModalOpen(false);
            clearTransactionForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit transaction" : "Add transaction"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveTx.mutate(); }} className="space-y-3">
            <div>
              <Label className={labelClass}>Account</Label>
              <Select value={accountId} onValueChange={onAccountChange} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={labelClass}>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border p-3">
              <input
                id="is_transfer"
                type="checkbox"
                checked={isTransfer}
                onChange={(e) => setIsTransfer(e.target.checked)}
              />
              <Label className={labelClass}>Account transfer</Label>
            </div>
            <div>
              <Label className={labelClass}>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            <div>
              <Label className={labelClass}>Amount</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <Label className={labelClass}>Currency</Label>
              <Select value={currency} onValueChange={setCurrency} required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((curr) => (
                    <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isTransfer ? (
              <div>
                <Label className={labelClass}>Destination account</Label>
                <Select value={destinationAccountId} onValueChange={setDestinationAccountId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => String(a.id) !== accountId)
                      .map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className={labelClass}>Tag</Label>
                <Select value={createTagId || "__none__"} onValueChange={(v) => setCreateTagId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No tag</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={String(tag.id)}>{tag.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full">{editing ? "Update" : "Save"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import CSV / XLSX dialog */}
      <Dialog
        open={isImportModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsImportModalOpen(false);
            resetImportForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import CSV / XLSX</DialogTitle>
          </DialogHeader>
          <div className="mb-3">
            <Button variant="outline" onClick={downloadTemplate}>Download CSV template</Button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); previewUpload.mutate(); }} className="space-y-3">
            <div>
              <Label className={labelClass}>Account</Label>
              <Select
                value={uploadAccountId}
                onValueChange={(v) => {
                  setUploadAccountId(v);
                  setImportPreview(null);
                  setImportResult("");
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={labelClass}>Default tag (optional)</Label>
              <Select
                value={uploadTagId || "__none__"}
                onValueChange={(v) => {
                  setUploadTagId(v === "__none__" ? "" : v);
                  setImportPreview(null);
                  setImportResult("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No default tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No default tag</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={String(tag.id)}>{tag.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={labelClass}>File</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setImportPreview(null);
                  setImportResult("");
                }}
                required
              />
            </div>
            <Button type="submit" className="w-full">Preview import</Button>
          </form>

          {importPreview ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Total: {importPreview.total_rows}</Badge>
                <Badge variant="secondary">Valid: {importPreview.valid_rows}</Badge>
                <Badge variant="secondary">Invalid: {importPreview.invalid_rows}</Badge>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="px-2 py-1">Row</TableHead>
                      <TableHead className="px-2 py-1">Date</TableHead>
                      <TableHead className="px-2 py-1">Description</TableHead>
                      <TableHead className="px-2 py-1">Amount</TableHead>
                      <TableHead className="px-2 py-1">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.preview.map((row) => (
                      <TableRow key={`${row.row}-${row.description}`} className="border-t border-border">
                        <TableCell className="px-2 py-1">{row.row}</TableCell>
                        <TableCell className="px-2 py-1">{row.date}</TableCell>
                        <TableCell className="px-2 py-1">{row.description}</TableCell>
                        <TableCell className="px-2 py-1">{formatMoney(row.amount)}</TableCell>
                        <TableCell className="px-2 py-1">{row.status === "ok" ? "OK" : row.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {importPreview.errors.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted p-3 text-xs text-foreground">
                  <p className="font-semibold">Validation errors</p>
                  {importPreview.errors.slice(0, 5).map((error) => (
                    <p key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</p>
                  ))}
                </div>
              ) : null}

              <form onSubmit={(e) => { e.preventDefault(); upload.mutate(); }}>
                <Button type="submit" className="w-full" disabled={importPreview.valid_rows === 0}>
                  Confirm import
                </Button>
              </form>
            </div>
          ) : null}

          {importResult ? <p className="mt-3 text-sm text-muted-foreground">{importResult}</p> : null}
          <p className="mt-3 text-xs text-muted-foreground">Required columns: date, description, amount, currency. Optional: tag_id.</p>
        </DialogContent>
      </Dialog>

      {/* Split transaction dialog */}
      <Dialog
        open={isSplitModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSplitModalOpen(false);
            setSplitParent(null);
            setSplitRows([]);
            setSplitResult("");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Split transaction</DialogTitle>
          </DialogHeader>
          {splitParent ? (
            <div className="space-y-3">
              <Card className="p-5">
                <p className="text-sm font-semibold">Original transaction</p>
                <p className="text-sm text-muted-foreground">{splitParent.date} - {splitParent.description}</p>
                <p className="text-sm text-muted-foreground">
                  Amount: {formatMoney(splitParent.amount)} {splitParent.currency}
                </p>
              </Card>

              <div className="overflow-x-auto rounded-lg border border-border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="px-3 py-2">Description</TableHead>
                      <TableHead className="px-3 py-2">Amount</TableHead>
                      <TableHead className="px-3 py-2">Tag (optional)</TableHead>
                      <TableHead className="px-3 py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {splitRows.map((row, index) => (
                      <TableRow key={`${row.id ?? "new"}-${index}`} className="border-t border-border">
                        <TableCell className="px-3 py-2">
                          <Input
                            value={row.description}
                            onChange={(e) => updateSplitRow(index, "description", e.target.value)}
                            placeholder="Description"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Input
                            value={row.amount}
                            onChange={(e) => updateSplitRow(index, "amount", e.target.value)}
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Select value={row.tag_id || "__none__"} onValueChange={(v) => updateSplitRow(index, "tag_id", v === "__none__" ? "" : v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="No tag" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">No tag</SelectItem>
                              {tags.map((tag) => (
                                <SelectItem key={tag.id} value={String(tag.id)}>
                                  {tag.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Button variant="destructive" onClick={() => removeSplitRow(index)}>Remove</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" onClick={addSplitRow}>Add row</Button>
                <p className="text-sm text-muted-foreground">Missing Spllited Transactions: {formatMoney(splitRemaining)}</p>
              </div>

              <Button className="w-full" onClick={() => saveSplits.mutate()}>
                Save splitted transactions
              </Button>
              {splitResult ? <p className="text-sm text-muted-foreground">{splitResult}</p> : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function invalidateTransactionQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["transactions"] });
  qc.invalidateQueries({ queryKey: ["transactions-analytics"] });
  qc.invalidateQueries({ queryKey: ["transactions-summary"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}
