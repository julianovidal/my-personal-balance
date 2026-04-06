import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { classifierApi } from "@/api/classifierClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  ClassifierModelMeta,
  ClassifierPredictResponse,
  ClassifierTrainResponse,
  ClassifierUntaggedTransaction,
  Tag,
} from "@/types";

export function ClassifierPage() {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [selectedTags, setSelectedTags] = useState<Record<number, string>>({});
  const [predictionByTx, setPredictionByTx] = useState<Record<number, { suggested_tag_id: number; confidence: number }>>({});
  const [modelMeta, setModelMeta] = useState<ClassifierModelMeta | null>(null);
  const [modelStatus, setModelStatus] = useState<string>("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts")).data,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => (await api.get<Tag[]>("/tags")).data,
  });

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(String(accounts[0].id));
    }
  }, [accounts, accountId]);

  useEffect(() => {
    setPredictionByTx({});
    setSelectedTags({});
    setModelMeta(null);
    setModelStatus("");
  }, [accountId]);

  const { data: transactions = [], isFetching: isLoadingTransactions } = useQuery({
    queryKey: ["classifier-untagged-transactions", accountId],
    enabled: Boolean(accountId),
    queryFn: async () => {
      const res = await classifierApi.get<ClassifierUntaggedTransaction[]>("/api/classifier/transactions/untagged", {
        params: { account_id: Number(accountId) },
      });
      return res.data;
    },
  });

  const retrainMutation = useMutation({
    mutationFn: async () => {
      const res = await classifierApi.post<ClassifierTrainResponse>("/api/classifier/train", {
        account_id: Number(accountId),
      });
      return res.data;
    },
    onSuccess: (data) => {
      setModelMeta(data.meta ?? null);
      setModelStatus(data.trained ? "Model retrained." : (data.reason ?? "Model training failed."));
    },
  });

  const predictMutation = useMutation({
    mutationFn: async () => {
      const txIds = transactions.map((tx) => tx.id);
      const res = await classifierApi.post<ClassifierPredictResponse>("/api/classifier/predict", {
        account_id: Number(accountId),
        transaction_ids: txIds,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setModelMeta(data.meta ?? null);
      if (!data.model_ready) {
        setModelStatus(data.reason ?? "Model not ready. Retrain first.");
        return;
      }

      const nextPredictions: Record<number, { suggested_tag_id: number; confidence: number }> = {};
      for (const item of data.predictions) {
        nextPredictions[item.transaction_id] = {
          suggested_tag_id: item.suggested_tag_id,
          confidence: item.confidence,
        };
      }
      setPredictionByTx(nextPredictions);
      setSelectedTags((prev) => {
        const next = { ...prev };
        for (const item of data.predictions) {
          next[item.transaction_id] = String(item.suggested_tag_id);
        }
        return next;
      });
      setModelStatus(`Predicted ${data.predictions.length} transactions.`);
    },
  });

  const applyTagMutation = useMutation({
    mutationFn: async (tx: ClassifierUntaggedTransaction) => {
      const selected = selectedTags[tx.id];
      if (!selected) return;
      await api.put(`/transactions/${tx.id}`, {
        date: tx.date,
        description: tx.description,
        account_id: tx.account_id,
        tag_id: Number(selected),
        is_transfer: false,
        destination_account_id: null,
        amount: tx.amount,
        currency: tx.currency,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classifier-untagged-transactions", accountId] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setModelStatus("Tag applied.");
    },
  });

  const hasTransactions = transactions.length > 0;
  const canPredict = Boolean(accountId) && hasTransactions && !predictMutation.isPending;
  const canRetrain = Boolean(accountId) && !retrainMutation.isPending;

  const accountName = useMemo(
    () => accounts.find((item) => item.id === Number(accountId))?.name ?? "",
    [accounts, accountId],
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-xl font-semibold">Classifier</h2>
          <p className="text-sm text-muted-foreground">
            Predict tags for untagged transactions using an account-scoped model.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2 md:col-span-2">
            <Button disabled={!canRetrain} onClick={() => retrainMutation.mutate()}>
              {retrainMutation.isPending ? "Retraining..." : "Retrain Model"}
            </Button>
            <Button disabled={!canPredict} onClick={() => predictMutation.mutate()}>
              {predictMutation.isPending ? "Predicting..." : "Predict All"}
            </Button>
          </div>
        </div>

        {modelMeta ? (
          <p className="text-xs text-muted-foreground">
            Model: {modelMeta.model_name} | Score: {modelMeta.score.toFixed(4)} | Samples: {modelMeta.sample_count} | Classes: {modelMeta.class_count}
          </p>
        ) : null}

        {modelStatus ? <p className="text-sm">{modelStatus}</p> : null}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-base font-semibold">
          Untagged transactions {accountName ? `for ${accountName}` : ""}
        </h3>
        {isLoadingTransactions ? <p className="text-sm text-muted-foreground">Loading transactions...</p> : null}
        {!isLoadingTransactions && !hasTransactions ? (
          <p className="text-sm text-muted-foreground">No untagged transactions found.</p>
        ) : null}

        {hasTransactions ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted text-left hover:bg-muted">
                  <TableHead className="px-3 py-2 text-xs uppercase tracking-wide">Date</TableHead>
                  <TableHead className="px-3 py-2 text-xs uppercase tracking-wide">Description</TableHead>
                  <TableHead className="px-3 py-2 text-right text-xs uppercase tracking-wide">Amount</TableHead>
                  <TableHead className="px-3 py-2 text-xs uppercase tracking-wide">Prediction</TableHead>
                  <TableHead className="px-3 py-2 text-xs uppercase tracking-wide">Tag</TableHead>
                  <TableHead className="px-3 py-2 text-right text-xs uppercase tracking-wide">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const prediction = predictionByTx[tx.id];
                  const selectedTag = selectedTags[tx.id] ?? "";
                  return (
                    <TableRow key={tx.id} className="border-t border-border">
                      <TableCell className="px-3 py-2">{tx.date}</TableCell>
                      <TableCell className="px-3 py-2">{tx.description}</TableCell>
                      <TableCell className="px-3 py-2 text-right">{formatMoney(Number(tx.amount))}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                        {prediction
                          ? `${tags.find((tag) => tag.id === prediction.suggested_tag_id)?.label ?? prediction.suggested_tag_id} (${Math.round(prediction.confidence * 100)}%)`
                          : "-"}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <Select
                          value={selectedTag || "__none__"}
                          onValueChange={(value) => {
                            setSelectedTags((prev) => ({ ...prev, [tx.id]: value === "__none__" ? "" : value }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select tag" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Select tag</SelectItem>
                            {tags.map((tag) => (
                              <SelectItem key={tag.id} value={String(tag.id)}>
                                {tag.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        <Button
                          disabled={!selectedTag || applyTagMutation.isPending}
                          onClick={() => applyTagMutation.mutate(tx)}
                        >
                          Apply
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
