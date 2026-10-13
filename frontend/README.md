# Family Safety Net - Frontend

React 18 + TypeScript SPA for Family Safety Net: tracks owner activity on Groww (stocks/mutual funds) and monthly car-loan EMI (Rs 16,166 due on the 24th).

---

## 1. Stack

- **Framework**: React 18, Vite 6
- **Language**: TypeScript 5 (Strict mode: `strict: true`, `noUncheckedIndexedAccess: true`)
- **Styling**: Tailwind CSS, shadcn/ui (`components.json`)
- **API Client**: `openapi-typescript` + `openapi-fetch` (contract-first generated types)
- **Testing**: Vitest, React Testing Library, MSW (Mock Service Worker), `@testing-library/jest-dom`
- **Linting & Formatting**: ESLint 9 (Flat config with `jsx-a11y`, `react-hooks`), Prettier

---

## 2. Getting Started

### Install dependencies

```bash
npm install
```

### Generate API Types from Backend Schema

```bash
npm run api:types
```

### Run quality checks & test suite

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
```

### Start development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

---

## 3. Architecture & Conventions

- **Feature-based folders**: `src/features/` (each contains `components/`, `hooks/`, `api/`, `pages/`, `__tests__/`). Features do not cross-import.
- **Shared layer**: `src/shared/` (`ui/`, `api/`, `lib/`, `testing/`, `hooks/`).
- **Contract-first API**: OpenAPI JSON copied from `backend/openapi.json` to `openapi/openapi.json`. Types generated to `src/shared/api/schema.d.ts`.
