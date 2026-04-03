import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Button, Card, Input, Label, Modal, Select } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { Account, AccountImportMapping, AccountsBalanceResponse } from "@/types";

const CURRENCIES = ["EUR", "USD", "BRL"] as const;

export function AccountsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [dateColumn, setDateColumn] = useState("");
  const [descriptionColumn, setDescriptionColumn] = useState("");
  const [amountColumn, setAmountColumn] = useState("");
  const [currencyColumn, setCurrencyColumn] = useState("");
  const [tagIdColumn, setTagIdColumn] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts")).data
  });
  const { data: balances, isLoading: isBalancesLoading } = useQuery({
    queryKey: ["accounts-balances"],
    queryFn: async () => (await api.get<AccountsBalanceResponse>("/accounts/balances")).data
  });
  const isAccountsLoading = !balances && accounts.length === 0;

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(String(accounts[0].id));
    }
  }, [accounts, selectedAccountId]);

  const { data: mapping } = useQuery({
    queryKey: ["account-import-mapping", selectedAccountId],
    enabled: Boolean(selectedAccountId),
    queryFn: async () => {
      const res = await api.get<AccountImportMapping>(`/accounts/${selectedAccountId}/import-mapping`);
      return res.data;
    }
  });

  useEffect(() => {
    setDateColumn(mapping?.date_column ?? "");
    setDescriptionColumn(mapping?.description_column ?? "");
    setAmountColumn(mapping?.amount_column ?? "");
    setCurrencyColumn(mapping?.currency_column ?? "");
    setTagIdColumn(mapping?.tag_id_column ?? "");
  }, [mapping]);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await api.put(`/accounts/${editing.id}`, { name, currency });
      } else {
        await api.post("/accounts", { name, currency });
      }
    },
    onSuccess: () => {
      setEditing(null);
      setIsAccountModalOpen(false);
      setName("");
      setCurrency("EUR");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["accounts-balances"] });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      setAccountToDelete(null);
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["accounts-balances"] });
    }
  });

  const saveMapping = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId) return;
      await api.put(`/accounts/${selectedAccountId}/import-mapping`, {
        date_column: dateColumn,
        description_column: descriptionColumn,
        amount_column: amountColumn,
        currency_column: currencyColumn,
        tag_id_column: tagIdColumn
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-import-mapping", selectedAccountId] });
    }
  });

  const startEdit = (a: Account) => {
    setEditing(a);
    setName(a.name);
    setCurrency(a.currency);
    setIsAccountModalOpen(true);
  };

  const startCreate = () => {
    setEditing(null);
    setName("");
    setCurrency("EUR");
    setIsAccountModalOpen(true);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  const onMappingSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMapping.mutate();
  };

  const confirmDeleteAccount = () => {
    if (!accountToDelete) return;
    remove.mutate(accountToDelete.id);
  };

  const balanceByAccount = new Map((balances?.by_account ?? []).map((item) => [item.account_id, item]));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Your accounts</h2>
            <p className="text-sm text-muted-foreground">
              {isBalancesLoading ? "Loading balances..." : `Overall balance: ${formatMoney(balances?.overall_balance)}`}
            </p>
          </div>
          <Button onClick={startCreate}>Add account</Button>
        </div>
        <div className="space-y-2">
          {isAccountsLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={`loading-${index}`} className="rounded-lg border border-border p-3">
                  <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-4 w-28 animate-pulse rounded bg-muted" />
                </div>
              ))
            : null}
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/40">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">{formatMoney(balanceByAccount.get(a.id)?.balance)} {a.currency}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => startEdit(a)}>Edit</Button>
                <Button variant="destructive" onClick={() => setAccountToDelete(a)}>Delete</Button>
              </div>
            </div>
          ))}
          {!isAccountsLoading && accounts.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
              <p className="font-medium">No accounts yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create your first account to start tracking balances.</p>
              <Button className="mt-4" onClick={startCreate}>Add account</Button>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="md:col-span-3">
        <h2 className="mb-3 text-xl font-semibold">Account import settings</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Configure how your import file columns map to expected transaction fields.
        </p>

        <form onSubmit={onMappingSubmit} className="space-y-3">
          <div>
            <Label>Account</Label>
            <Select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} required>
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Date column name</Label>
            <Input value={dateColumn} onChange={(e) => setDateColumn(e.target.value)} placeholder="e.g. transaction_date" />
          </div>
          <div>
            <Label>Description column name</Label>
            <Input value={descriptionColumn} onChange={(e) => setDescriptionColumn(e.target.value)} placeholder="e.g. details" />
          </div>
          <div>
            <Label>Amount column name</Label>
            <Input value={amountColumn} onChange={(e) => setAmountColumn(e.target.value)} placeholder="e.g. value" />
          </div>
          <div>
            <Label>Currency column name</Label>
            <Input value={currencyColumn} onChange={(e) => setCurrencyColumn(e.target.value)} placeholder="e.g. curr" />
          </div>
          <div>
            <Label>Tag ID column name (optional)</Label>
            <Input value={tagIdColumn} onChange={(e) => setTagIdColumn(e.target.value)} placeholder="e.g. category_id" />
          </div>

          <Button type="submit" disabled={!selectedAccountId}>
            Save mapping
          </Button>
        </form>
      </Card>

      <Modal
        open={Boolean(accountToDelete)}
        title="Delete account"
        onClose={() => setAccountToDelete(null)}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete account{" "}
            <span className="font-semibold text-foreground">{accountToDelete?.name}</span>?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAccountToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteAccount} disabled={remove.isPending}>
              {remove.isPending ? "Deleting..." : "Delete account"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={isAccountModalOpen}
        title={editing ? "Edit account" : "Add account"}
        onClose={() => setIsAccountModalOpen(false)}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)} required>
              {CURRENCIES.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full">{editing ? "Update" : "Create"}</Button>
        </form>
      </Modal>
    </div>
  );
}
