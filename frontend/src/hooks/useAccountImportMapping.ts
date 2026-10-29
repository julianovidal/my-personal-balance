import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { AccountImportMapping } from "@/types";

export function useAccountImportMapping(accountId: string, enabled = true) {
  return useQuery({
    queryKey: ["account-import-mapping", accountId],
    enabled: enabled && Boolean(accountId),
    refetchOnWindowFocus: false,
    queryFn: async () => (await api.get<AccountImportMapping>(`/accounts/${accountId}/import-mapping`)).data
  });
}
