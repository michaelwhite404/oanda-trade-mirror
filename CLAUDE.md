# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OANDA Trade Mirror is a TypeScript/Node.js application that monitors trades from source OANDA forex accounts and automatically replicates them to mirror accounts. Uses MongoDB for persistence, supports multiple source accounts (each with their own mirrors), and includes full audit logging. Features a React dashboard for account management and trade monitoring.

## Commands

```bash
pnpm install                    # Install all dependencies
pnpm start                      # Run the server (API + orchestrator)
pnpm dev                        # Run the frontend dev server
pnpm build                      # Build both server and client
pnpm migrate                    # Migrate .env accounts to MongoDB

# Package-specific commands
pnpm --filter @oanda-trade-mirror/server start    # Run server only
pnpm --filter @oanda-trade-mirror/client dev      # Run client dev server
pnpm --filter @oanda-trade-mirror/client build    # Build client for production
```

No test or lint commands are currently configured.

## Architecture

This is a pnpm monorepo with two packages:

```
oanda-trade-mirror/
├── package.json                # Workspace root
├── pnpm-workspace.yaml
├── packages/
│   ├── server/                 # Backend: Express API + trade orchestrator
│   │   ├── package.json
│   │   ├── .env                # Environment config
│   │   └── src/
│   │       ├── index.ts        # Entry point - Express server + orchestrator
│   │       ├── api/            # REST API routes
│   │       │   ├── index.ts
│   │       │   ├── accountRoutes.ts
│   │       │   ├── tradeRoutes.ts
│   │       │   └── logRoutes.ts
│   │       ├── config/
│   │       ├── types/
│   │       ├── db/models/
│   │       ├── services/
│   │       ├── core/
│   │       ├── oanda/
│   │       ├── accounts/
│   │       └── scripts/
│   └── client/                 # Frontend: React + Vite + Tailwind
│       ├── package.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── api/client.ts   # API client
│           ├── hooks/          # React Query hooks
│           ├── components/
│           │   ├── ui/         # shadcn/ui components
│           │   ├── accounts/
│           │   ├── trades/
│           │   └── layout/
│           └── pages/
│               ├── Dashboard.tsx
│               ├── Accounts.tsx
│               ├── Trades.tsx
│               └── Logs.tsx
```

## API Endpoints

### Accounts
- `GET /api/accounts/sources` - List active source accounts
- `POST /api/accounts/sources` - Create source account
- `DELETE /api/accounts/sources/:id` - Deactivate source account
- `GET /api/accounts/sources/:id/mirrors` - List mirrors for source
- `POST /api/accounts/sources/:id/mirrors` - Create mirror account
- `DELETE /api/accounts/mirrors/:id` - Deactivate mirror
- `PATCH /api/accounts/mirrors/:id` - Update scale factor
- `POST /api/accounts/validate` - Validate OANDA credentials

### Trades
- `GET /api/trades/:sourceId` - Recent trades with mirror status
- `GET /api/trades/:sourceId/:txnId` - Single trade details
- `POST /api/trades/:sourceId` - Place manual trade on source

### Logs
- `GET /api/logs` - Execution logs with filters (level, category, limit, offset)

### Health
- `GET /api/health` - System health check

## Data Flow

1. `MirrorOrchestrator` polls all active source accounts on interval
2. `tradeMonitor` fetches transactions since `lastTransactionId` using `/transactions/sinceid`
3. Filters for `ORDER_FILL` transactions and creates `TradeHistory` records
4. `tradeDispatcher` executes scaled trades on each mirror account
5. Updates `mirrorExecutions` array with results (success/failed)
6. All operations logged to `ExecutionLog` collection

## MongoDB Collections

- **sourceAccounts**: Source trading accounts with `lastTransactionId` for polling
- **mirrorAccounts**: Mirror accounts with `sourceAccountId` reference and `scaleFactor`
- **tradeHistory**: Trade records with `mirrorExecutions[]` array tracking each mirror result
- **executionLogs**: Audit trail with auto-expire after 90 days (TTL index)

## Configuration

Environment variables (in `packages/server/.env`):
```
MONGODB_URI=mongodb://localhost:27017/oanda-trade-mirror
POLLING_INTERVAL_MS=3000
PORT=3001
OANDA_ENVIRONMENT=practice  # or 'live'

# Legacy (for migration script only):
SOURCE_ACCOUNT_ID=xxx
SOURCE_TOKEN=xxx
MIRROR_1_ID=xxx
MIRROR_1_TOKEN=xxx
```

## Getting Started

1. Start MongoDB locally or configure `MONGODB_URI`
2. Install dependencies: `pnpm install`
3. (Optional) Set legacy .env variables and run `pnpm migrate` to import existing accounts
4. Start the server: `pnpm start` (runs on http://localhost:3001)
5. Start the frontend dev server: `pnpm dev` (runs on http://localhost:5173)

For production, build the client (`pnpm --filter client build`) and the server will serve the static files.

## Key Interfaces

**ISourceAccount**: Source account with `oandaAccountId`, `apiToken`, `environment`, `lastTransactionId`

**IMirrorAccount**: Mirror account linked to source with `scaleFactor`

**ITradeHistory**: Trade record with `mirrorExecutions[]` tracking per-mirror results

**TradeInstruction**: Trade to execute (instrument, units, side, type, tp/sl)

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Mongoose
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query
- **Database**: MongoDB
- **Package Manager**: pnpm with workspaces
