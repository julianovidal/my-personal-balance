import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { SimpleSelect } from "@/components/simple-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Account, Tag } from "@/types"

import { DATE_PRESETS, rangeForPreset, shiftMonths, type DatePreset } from "./dates"
import { ALL, type Filters } from "./filters"

type Props = {
  filters: Filters
  onChange: (next: Filters) => void
  accounts: Account[]
  tags: Tag[]
}

export function TransactionFilters({ filters, onChange, accounts, tags }: Props) {
  const setPreset = (preset: DatePreset) => {
    if (preset === "custom") onChange({ ...filters, preset })
    else onChange({ ...filters, preset, ...rangeForPreset(preset) })
  }
  const shift = (months: number) =>
    onChange({
      ...filters,
      preset: "custom",
      from: shiftMonths(filters.from, months),
      to: shiftMonths(filters.to, months, true),
    })

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <div className="col-span-2 grid gap-1.5 md:col-span-1">
        <Label htmlFor="filter-preset">Period</Label>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Previous month"
            onClick={() => shift(-1)}
          >
            <ChevronLeftIcon />
          </Button>
          <SimpleSelect
            id="filter-preset"
            value={filters.preset}
            onValueChange={(v) => setPreset(v as DatePreset)}
            options={DATE_PRESETS}
          />
          <Button variant="outline" size="icon-lg" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-from">From</Label>
        <Input
          id="filter-from"
          type="date"
          value={filters.from}
          max={filters.to}
          onChange={(e) => e.target.value && onChange({ ...filters, preset: "custom", from: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-to">To</Label>
        <Input
          id="filter-to"
          type="date"
          value={filters.to}
          min={filters.from}
          onChange={(e) => e.target.value && onChange({ ...filters, preset: "custom", to: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-account">Account</Label>
        <SimpleSelect
          id="filter-account"
          value={filters.accountId}
          onValueChange={(accountId) => onChange({ ...filters, accountId })}
          options={[
            { value: ALL, label: "All accounts" },
            ...accounts.map((a) => ({ value: String(a.id), label: a.name })),
          ]}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-tag">Tag</Label>
        <SimpleSelect
          id="filter-tag"
          value={filters.tagId}
          onValueChange={(tagId) => onChange({ ...filters, tagId })}
          options={[
            { value: ALL, label: "All tags" },
            ...tags.map((t) => ({ value: String(t.id), label: t.label })),
          ]}
        />
      </div>
    </div>
  )
}
