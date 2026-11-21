import { useQuery, type QueryClient } from "@tanstack/react-query"

import { api } from "@/api/client"
import type { Account, Tag } from "@/types"

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts")).data,
  })
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => (await api.get<Tag[]>("/tags")).data,
  })
}

/** Same keys the old app clears after a transaction write. */
export function invalidateTransactionQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["transactions"] })
  qc.invalidateQueries({ queryKey: ["transactions-analytics"] })
  qc.invalidateQueries({ queryKey: ["transactions-summary"] })
  qc.invalidateQueries({ queryKey: ["dashboard"] })
  // Not cleared by the old app, but balances change with every transaction.
  qc.invalidateQueries({ queryKey: ["accounts-balances"] })
  qc.invalidateQueries({ queryKey: ["transactions-tag-trend"] })
}
