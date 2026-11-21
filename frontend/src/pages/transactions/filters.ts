import type { DatePreset } from "./dates"
import { rangeForPreset } from "./dates"

export const ALL = "all"

export type Filters = {
  preset: DatePreset
  from: string
  to: string
  accountId: string // ALL or an id
  tagId: string // ALL or an id
}

export function initialFilters(): Filters {
  return { preset: "this_month", ...rangeForPreset("this_month"), accountId: ALL, tagId: ALL }
}

/** Query params shared by list, summary and analytics. Optional filters are sent only when set. */
export function filterParams(filters: Filters) {
  const params = new URLSearchParams({ date_from: filters.from, date_to: filters.to })
  if (filters.accountId !== ALL) params.set("account_id", filters.accountId)
  if (filters.tagId !== ALL) params.set("tag_id", filters.tagId)
  return params
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Lets other pages link to a filtered list: /transactions?from=…&to=…&tag_id=…&account_id=… */
export function filtersFromSearch(search: URLSearchParams): Filters {
  const base = initialFilters()
  const from = search.get("from")
  const to = search.get("to")
  const hasRange = from !== null && to !== null && DATE.test(from) && DATE.test(to) && from <= to
  return {
    ...base,
    ...(hasRange ? { preset: "custom" as const, from, to } : {}),
    accountId: search.get("account_id") ?? ALL,
    tagId: search.get("tag_id") ?? ALL,
  }
}

export function transactionsLink(params: { from: string; to: string; tagId?: number | null; accountId?: number }) {
  const search = new URLSearchParams({ from: params.from, to: params.to })
  if (params.tagId != null) search.set("tag_id", String(params.tagId))
  if (params.accountId != null) search.set("account_id", String(params.accountId))
  return `/transactions?${search}`
}
