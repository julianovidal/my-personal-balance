# UI Component Contracts: shadcn/ui Migration

**Feature**: 004-shadcn-migration  
**Date**: 2026-04-06

These contracts define the public interface for each shadcn/ui component after migration. Pages import from `@/components/ui/<component-name>`.

---

## Button

**Import**: `import { Button } from "@/components/ui/button"`

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `variant` | `"default" \| "outline" \| "destructive" \| "ghost" \| "link" \| "secondary"` | `"default"` | Replaces previous `default \| outline \| destructive` |
| `size` | `"default" \| "sm" \| "lg" \| "icon"` | `"default"` | New — not present in custom component |
| `asChild` | `boolean` | `false` | Radix Slot pattern for polymorphic rendering |
| `...props` | `React.ButtonHTMLAttributes<HTMLButtonElement>` | — | All native button props forwarded |

**Breaking changes from custom**: None for `default`, `outline`, `destructive` variants.

---

## Input

**Import**: `import { Input } from "@/components/ui/input"`

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `...props` | `React.InputHTMLAttributes<HTMLInputElement>` | — | Identical to custom component |

**Breaking changes from custom**: None.

---

## Label

**Import**: `import { Label } from "@/components/ui/label"`

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `...props` | `React.LabelHTMLAttributes<HTMLLabelElement>` | — | Identical to custom component |

**Breaking changes from custom**: None.

---

## Card

**Import**: `import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"`

| Component | Props | Notes |
| --------- | ----- | ----- |
| `Card` | `React.HTMLAttributes<HTMLDivElement>` | Root container — replaces custom `Card` directly |
| `CardHeader` | `React.HTMLAttributes<HTMLDivElement>` | Optional — use for cards with a title/description header |
| `CardTitle` | `React.HTMLAttributes<HTMLHeadingElement>` | Optional heading inside CardHeader |
| `CardContent` | `React.HTMLAttributes<HTMLDivElement>` | Wraps the main card body |
| `CardFooter` | `React.HTMLAttributes<HTMLDivElement>` | Optional footer area |

**Breaking changes from custom**: `Card` alone still works; sub-components are additive.

---

## Badge

**Import**: `import { Badge } from "@/components/ui/badge"`

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `variant` | `"default" \| "secondary" \| "destructive" \| "outline" \| "warning"` | `"default"` | `warning` added as custom variant in generated file |

**Variant mapping from custom**:

| Old variant | New variant |
| ----------- | ----------- |
| `default` | `default` |
| `success` | `secondary` (green styling via CSS) |
| `warning` | `warning` (custom variant added to generated badge.tsx) |
| `danger` | `destructive` |

---

## Select (compound component — breaking change)

**Import**: `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"`

**Before** (custom HTML select):
```tsx
<Select value={val} onChange={e => setVal(e.target.value)}>
  <option value="a">Option A</option>
</Select>
```

**After** (shadcn/ui compound):
```tsx
<Select value={val} onValueChange={setVal}>
  <SelectTrigger>
    <SelectValue placeholder="Choose..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">Option A</SelectItem>
  </SelectContent>
</Select>
```

**Breaking changes**: Full API change. All pages using `Select` must be updated.

---

## Dialog (replaces Modal — breaking change)

**Import**: `import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"`

**Before** (custom Modal):
```tsx
<Modal isOpen={open} onClose={() => setOpen(false)} title="Edit Account">
  {children}
</Modal>
```

**After** (shadcn/ui Dialog):
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Account</DialogTitle>
    </DialogHeader>
    {children}
  </DialogContent>
</Dialog>
```

**Breaking changes**: Full API change. `isOpen`/`onClose` → `open`/`onOpenChange`. All pages using `Modal` must be updated.

---

## Table (replaces DataTable — breaking change)

**Import**: `import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table"`

**Before** (custom DataTable wrapper):
```tsx
<DataTable>
  <thead>
    <tr><th>Name</th></tr>
  </thead>
  <tbody>
    <tr><td>Value</td></tr>
  </tbody>
</DataTable>
```

**After** (shadcn/ui Table):
```tsx
<Table>
  <TableHeader>
    <TableRow><TableHead>Name</TableHead></TableRow>
  </TableHeader>
  <TableBody>
    <TableRow><TableCell>Value</TableCell></TableRow>
  </TableBody>
</Table>
```

**Breaking changes**: Full API change. All pages using `DataTable` must be updated.
