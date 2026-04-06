# Quickstart: Adding shadcn/ui Components After Migration

**Feature**: 004-shadcn-migration  
**Date**: 2026-04-06

## Prerequisites

After the migration is complete, the project has:
- `components.json` configured at the frontend root
- `src/components/ui/` directory with existing shadcn/ui components
- pnpm as the package manager

## Adding a New shadcn/ui Component

From the `frontend/` directory:

```bash
pnpm dlx shadcn@latest add <component-name>
```

Examples:

```bash
pnpm dlx shadcn@latest add tooltip
pnpm dlx shadcn@latest add popover
pnpm dlx shadcn@latest add calendar
```

The component file is placed at `src/components/ui/<component-name>.tsx` automatically.

## Importing Components in Pages

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
```

## Customizing a Generated Component

shadcn/ui components are copied into your source — they are yours to edit. Open `src/components/ui/<component-name>.tsx` and modify variants, styles, or behavior directly.

## Verifying the Setup

```bash
# Run the dev server
pnpm dev

# Run tests
pnpm test
```

## Component Reference

All currently installed components and their props are documented in [contracts/ui-components.md](./contracts/ui-components.md).

For the full shadcn/ui component catalog, consult the official documentation.
