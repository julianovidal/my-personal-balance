import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/utils";
import { useAccountImportMapping } from "@/hooks/useAccountImportMapping";
import { Account, AccountImportMapping, AccountsBalanceResponse } from "@/types";

const CURRENCIES = ["EUR", "USD", "BRL"] as const;

const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

type MappingFields = {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  currencyColumn: string;
  tagIdColumn: string;
};

function fieldsFromMapping(mapping?: AccountImportMapping | null): MappingFields {
  return {
    dateColumn: mapping?.date_column ?? "",
    descriptionColumn: mapping?.description_column ?? "",
    amountColumn: mapping?.amount_column ?? "",
    currencyColumn: mapping?.currency_column ?? "",
    tagIdColumn: mapping?.tag_id_column ?? ""
  };
}

function fieldsEqual(a: MappingFields, b: MappingFields): boolean {
  return (
    a.dateColumn === b.dateColumn &&
    a.descriptionColumn === b.descriptionColumn &&
    a.amountColumn === b.amountColumn &&
    a.currencyColumn === b.currencyColumn &&
    a.tagIdColumn === b.tagIdColumn
  );
}

export function AccountsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");

  const [importSettingsAccount, setImportSettingsAccount] = useState<Account | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [mappingBaseline, setMappingBaseline] = useState<MappingFields | null>(null);
  const [mappingFormHydratedForId, setMappingFormHydratedForId] = useState<number | null>(null);
  const [dateColumn, setDateColumn] = useState("");
  const [descriptionColumn, setDescriptionColumn] = useState("");
  const [amountColumn, setAmountColumn] = useState("");
  const [currencyColumn, setCurrencyColumn] = useState("");
  const [tagIdColumn, setTagIdColumn] = useState("");

  const importAccountId = importSettingsAccount ? String(importSettingsAccount.id) : "";

  const currentMappingFields = useMemo(
    (): MappingFields => ({
      dateColumn,
      descriptionColumn,
      amountColumn,
      currencyColumn,
      tagIdColumn
    }),
    [dateColumn, descriptionColumn, amountColumn, currencyColumn, tagIdColumn]
  );

  const isMappingDirty = Boolean(
    importSettingsAccount && mappingBaseline && !fieldsEqual(currentMappingFields, mappingBaseline)
  );

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts")).data
  });
  const { data: balances, isLoading: isBalancesLoading } = useQuery({
    queryKey: ["accounts-balances"],
    queryFn: async () => (await api.get<AccountsBalanceResponse>("/accounts/balances")).data
  });
  const isAccountsLoading = !balances && accounts.length === 0;

  const { data: mapping, isFetching: isMappingLoading } = useAccountImportMapping(
    importAccountId,
    Boolean(importSettingsAccount)
  );

  useEffect(() => {
    if (!importSettingsAccount) {
      setMappingFormHydratedForId(null);
      return;
    }
    if (isMappingLoading) return;
    if (mappingFormHydratedForId === importSettingsAccount.id) return;

    const next = fieldsFromMapping(mapping);
    setDateColumn(next.dateColumn);
    setDescriptionColumn(next.descriptionColumn);
    setAmountColumn(next.amountColumn);
    setCurrencyColumn(next.currencyColumn);
    setTagIdColumn(next.tagIdColumn);
    setMappingBaseline(next);
    setMappingFormHydratedForId(importSettingsAccount.id);
  }, [importSettingsAccount, mapping, isMappingLoading, mappingFormHydratedForId]);

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

  const closeImportSettings = () => {
    setImportSettingsAccount(null);
    setDiscardConfirmOpen(false);
    setMappingBaseline(null);
    setMappingFormHydratedForId(null);
    setDateColumn("");
    setDescriptionColumn("");
    setAmountColumn("");
    setCurrencyColumn("");
    setTagIdColumn("");
  };

  const requestCloseImportSettings = () => {
    if (isMappingDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    closeImportSettings();
  };

  const saveMapping = useMutation({
    mutationFn: async () => {
      if (!importSettingsAccount) return;
      await api.put(`/accounts/${importSettingsAccount.id}/import-mapping`, {
        date_column: dateColumn,
        description_column: descriptionColumn,
        amount_column: amountColumn,
        currency_column: currencyColumn,
        tag_id_column: tagIdColumn
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-import-mapping", importAccountId] });
      closeImportSettings();
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

  const openImportSettings = (account: Account) => {
    setDiscardConfirmOpen(false);
    setImportSettingsAccount(account);
  };

  const onSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    save.mutate();
  };

  const onMappingSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    saveMapping.mutate();
  };

  const confirmDeleteAccount = () => {
    if (!accountToDelete) return;
    remove.mutate(accountToDelete.id);
  };

  const confirmDiscardImportChanges = () => {
    closeImportSettings();
  };

  const balanceByAccount = new Map((balances?.by_account ?? []).map((item) => [item.account_id, item]));

  return (
    <div className="grid gap-4">
      <Card className="p-5">
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
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Import settings for ${a.name}`}
                  title="Import settings"
                  onClick={() => openImportSettings(a)}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </Button>
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

      {/* Delete account confirmation dialog */}
      <Dialog open={Boolean(accountToDelete)} onOpenChange={(open) => { if (!open) setAccountToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>

      {/* Add / Edit account dialog */}
      <Dialog open={isAccountModalOpen} onOpenChange={(open) => { if (!open) setIsAccountModalOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit account" : "Add account"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label className={labelClass}>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label className={labelClass}>Currency</Label>
              <Select value={currency} onChange={(event) => setCurrency(event.target.value)} required>
                {CURRENCIES.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" className="w-full">{editing ? "Update" : "Create"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Per-account import mapping */}
      <Dialog
        open={Boolean(importSettingsAccount)}
        onOpenChange={(open) => {
          if (!open) requestCloseImportSettings();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Import settings{importSettingsAccount ? ` — ${importSettingsAccount.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Configure how your import file columns map to expected transaction fields.
          </p>
          <form onSubmit={onMappingSubmit} className="space-y-3">
            <div>
              <Label className={labelClass}>Date column name</Label>
              <Input value={dateColumn} onChange={(e) => setDateColumn(e.target.value)} placeholder="e.g. transaction_date" />
            </div>
            <div>
              <Label className={labelClass}>Description column name</Label>
              <Input value={descriptionColumn} onChange={(e) => setDescriptionColumn(e.target.value)} placeholder="e.g. details" />
            </div>
            <div>
              <Label className={labelClass}>Amount column name</Label>
              <Input value={amountColumn} onChange={(e) => setAmountColumn(e.target.value)} placeholder="e.g. value" />
            </div>
            <div>
              <Label className={labelClass}>Currency column name</Label>
              <Input value={currencyColumn} onChange={(e) => setCurrencyColumn(e.target.value)} placeholder="e.g. curr" />
            </div>
            <div>
              <Label className={labelClass}>Tag ID column name (optional)</Label>
              <Input value={tagIdColumn} onChange={(e) => setTagIdColumn(e.target.value)} placeholder="e.g. category_id" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={requestCloseImportSettings}>
                Cancel
              </Button>
              <Button type="submit" disabled={!importSettingsAccount || saveMapping.isPending}>
                {saveMapping.isPending ? "Saving..." : "Save mapping"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={discardConfirmOpen} onOpenChange={(open) => { if (!open) setDiscardConfirmOpen(false); }}>
        <DialogContent aria-label="Discard changes">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You have unsaved import settings. Discard them and close?
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDiscardConfirmOpen(false)}>
              Keep editing
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDiscardImportChanges}>
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
