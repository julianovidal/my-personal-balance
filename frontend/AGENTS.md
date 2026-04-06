# My Personal Balance - Frontend

This project is the frontend for My Personal Balance.

## Project Specification

- React 19
- TypeScript 5
- Tailwind CSS 3
- shadcn-style components
- Vite 8

## Package Manager

This project uses **pnpm** as the package manager. Do not use `npm` or `yarn`.

### Setup

```bash
# Enable pnpm via Corepack (Node.js 22 includes Corepack)
corepack enable pnpm
```

### Common Commands

```bash
# Install dependencies
pnpm install

# Start development server (available at http://localhost:5173)
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

The lockfile is `pnpm-lock.yaml`. Always commit changes to this file.

## Development Guidelines

### Code Standards

- Follow ESLint + React/TypeScript conventions
- Components that render financial data or handle user input must have unit or interaction tests
- Use the established shadcn-style component library; do not add one-off custom components without documented justification

### File Organization

```text
src/
├── api/          # API client modules
├── components/   # Reusable UI components
├── contexts/     # React context providers
├── lib/          # Utilities and theme
├── pages/        # Page-level components
└── types/        # TypeScript type definitions
```
