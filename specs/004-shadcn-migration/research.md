# Research: Migrate Frontend to Real shadcn/ui Components

**Feature**: 004-shadcn-migration  
**Date**: 2026-04-06

## Current State Analysis

### Existing Custom Components (`src/components/ui.tsx`)

All components live in a single file. The following are the components and their current API signatures:

| Component | Current Props | Usage in Pages |
|-----------|---------------|---------------|
| `Button` | `variant?: 'default' | 'outline' | 'destructive'`, standard button props | Layout, LoginPage, AccountsPage, ProfilePage, ClassifierPage |
| `Input` | Standard input props | LoginPage, AccountsPage, ProfilePage |
| `Select` | Standard HTML select props + children | AccountsPage, ClassifierPage |
| `Card` | Standard div props + children | DashboardPage, LoginPage, AccountsPage, ProfilePage, ClassifierPage |
| `Label` | Standard label props | LoginPage, AccountsPage, ProfilePage, ClassifierPage |
| `Badge` | `variant?: 'default' | 'success' | 'warning' | 'danger'` | DashboardPage |
| `DataTable` | `children` (wraps a table with scroll) | DashboardPage, TransactionsPage, ClassifierPage |
| `Modal` | `isOpen`, `onClose`, `title`, `children` | AccountsPage, ProfilePage |

### Component Mapping to shadcn/ui

| Custom Component | shadcn/ui Component(s) | Migration Complexity |
|-----------------|------------------------|----------------------|
| `Button` | `button` | Low — variant names align (`default`, `outline`, `destructive`) |
| `Input` | `input` | Low — same props interface |
| `Card` | `card` (`Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`, `CardFooter`) | Low — can wrap children directly in `Card`; sub-components optional |
| `Label` | `label` | Low — identical interface |
| `Badge` | `badge` | Medium — variant names differ (`default`, `secondary`, `destructive`, `outline`); `success`/`warning`/`danger` need mapping or custom variants |
| `DataTable` | `table` (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) | Medium — pages must adopt compound component structure for thead/tbody |
| `Modal` | `dialog` (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`) | High — API changes from `isOpen`/`onClose` props to compound component pattern |
| `Select` | `select` (`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`) | High — API changes from HTML select to compound component; all `<option>` elements become `<SelectItem>` |

### Prerequisites Already Met

- **Path alias** `@/*` → `src/*` is configured in both `tsconfig.json` and `vite.config.ts` ✅
- **CSS variables** for theming (background, foreground, primary, etc.) are already defined in `index.css` ✅
- **Tailwind design tokens** are already configured in `tailwind.config.js` matching shadcn/ui conventions ✅
- **Utility packages** already installed: `clsx`, `class-variance-authority`, `tailwind-merge`, `lucide-react` ✅
- **`cn()` utility** already exists in `src/lib/utils.ts` ✅

### Missing Prerequisites

- **No shadcn/ui** or **Radix UI** packages installed ❌
- **No `components.json`** (shadcn/ui config file) ❌
- **No test framework** (no vitest, jest, or testing-library) ❌

## Key Decisions

### Decision 1: shadcn/ui initialization approach

- **Decision**: Use `shadcn init` to generate `components.json` and verify CSS variable compatibility, then add individual components with `shadcn add <component>`
- **Rationale**: The existing CSS variable setup closely matches shadcn/ui defaults; init will confirm compatibility without overwriting existing styles
- **Alternatives considered**: Manual file creation — rejected because the CLI handles peer dependency installation and file generation correctly

### Decision 2: Badge variant mapping

- **Decision**: Map custom `success` → `secondary` (green intent via CSS), `warning` → custom `warning` variant, `danger` → `destructive`
- **Rationale**: shadcn/ui Badge ships with `default`, `secondary`, `destructive`, `outline`. The CVA-based Badge component in shadcn/ui supports adding custom variants by editing the generated file.
- **Alternatives considered**: Keeping all four custom variants exactly as named — possible but requires editing generated files; destructive/outline are sufficient for MVP, custom variants can be added as needed

### Decision 3: Modal → Dialog migration strategy

- **Decision**: Refactor all Modal usages to the shadcn/ui Dialog compound component pattern in-place within each page
- **Rationale**: The Dialog API (`<Dialog open={...} onOpenChange={...}>`) is more idiomatic and accessible than the custom `isOpen`/`onClose` prop API; the compound component pattern avoids prop drilling
- **Alternatives considered**: Creating a wrapper `Modal` component over Dialog that preserves the old API — rejected per constitution §I (complexity must be justified; no justification for a compatibility shim)

### Decision 4: DataTable migration strategy

- **Decision**: Replace `DataTable` wrapper with shadcn/ui Table primitives; update each page's table markup to use `TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`
- **Rationale**: shadcn/ui Table primitives are thin styled wrappers over native HTML elements; migration is straightforward and results in cleaner, more accessible markup
- **Alternatives considered**: Keeping a `DataTable` wrapper component over the Table primitive — rejected (unnecessary abstraction over a simple scroll wrapper)

### Decision 5: Test framework adoption

- **Decision**: Add Vitest + Testing Library as part of this migration; write interaction tests for at minimum the form-containing pages (LoginPage, AccountsPage, ProfilePage)
- **Rationale**: Constitution §II requires interaction tests for components that handle user input. No test framework currently exists. This migration touches all UI components and is the right moment to introduce tests.
- **Alternatives considered**: Deferring tests — rejected (constitution violation; cannot merge without tests on input-handling components)

### Decision 6: Component file structure

- **Decision**: Adopt the canonical shadcn/ui layout: each component lives in `src/components/ui/<component-name>.tsx`
- **Rationale**: Standard shadcn/ui convention; enables future `shadcn add` commands to place files correctly
- **Alternatives considered**: Keeping a single `ui.tsx` barrel file and just importing from shadcn — rejected (defeats the purpose of the migration and violates the structural goal)
