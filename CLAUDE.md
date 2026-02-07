# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OANDA Trade Mirror is a TypeScript/Node.js application that monitors trades from source OANDA forex accounts and automatically replicates them to mirror accounts. Uses MongoDB for persistence, supports multiple source accounts (each with their own mirrors), and includes full audit logging. Features a React dashboard for account management and trade monitoring, with authentication (local + Google OAuth), user management, and real-time updates via WebSocket.

## Commands

```bash
pnpm install                    # Install all dependencies
pnpm start                      # Run the server (API + orchestrator)
pnpm dev                        # Run the frontend dev server
pnpm dev:server                 # Run the server in watch mode
pnpm build                      # Build both server and client
pnpm test                       # Run server tests
pnpm migrate                    # Migrate .env accounts to MongoDB
pnpm deploy                     # Deploy to production

# Package-specific commands
pnpm --filter @oanda-trade-mirror/server start    # Run server only
pnpm --filter @oanda-trade-mirror/server test     # Run server tests
pnpm --filter @oanda-trade-mirror/client dev      # Run client dev server
pnpm --filter @oanda-trade-mirror/client build    # Build client for production
```

## Architecture

This is a pnpm monorepo with two packages:

```
oanda-trade-mirror/
├── package.json                # Workspace root
├── pnpm-workspace.yaml
├── .fly/                       # Fly.io deployment configs
│   ├── production.toml
│   └── staging.toml
├── .github/workflows/          # CI/CD
│   └── deploy-staging.yml      # Auto-deploy to staging on push to main
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
│   │       │   ├── logRoutes.ts
│   │       │   ├── authRoutes.ts
│   │       │   ├── userRoutes.ts
│   │       │   ├── apiKeyRoutes.ts
│   │       │   ├── webhookRoutes.ts
│   │       │   └── pushRoutes.ts
│   │       ├── middleware/     # Express middleware
│   │       │   ├── authMiddleware.ts
│   │       │   └── rateLimiter.ts
│   │       ├── config/
│   │       ├── types/
│   │       ├── db/models/
│   │       ├── services/
│   │       ├── core/
│   │       ├── oanda/
│   │       ├── streaming/      # Real-time transaction streaming
│   │       ├── websocket/      # WebSocket server for frontend updates
│   │       └── scripts/
│   └── client/                 # Frontend: React + Vite + Tailwind
│       ├── package.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── api/client.ts   # API client
│           ├── context/        # React contexts (Auth, WebSocket)
│           ├── hooks/          # React Query hooks
│           ├── components/
│           │   ├── ui/         # shadcn/ui components
│           │   ├── accounts/
│           │   ├── trades/
│           │   ├── users/
│           │   ├── auth/
│           │   └── layout/
│           └── pages/
│               ├── Dashboard.tsx
│               ├── Accounts.tsx
│               ├── Trades.tsx
│               ├── Logs.tsx
│               ├── Users.tsx
│               ├── Account.tsx
│               ├── Login.tsx
│               ├── Register.tsx
│               ├── ForgotPassword.tsx
│               └── ResetPassword.tsx
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout (clears session)
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/complete-registration` - Complete invite registration
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/sessions` - List active sessions
- `DELETE /api/auth/sessions/:id` - Revoke a session

### Users (admin only)
- `GET /api/users` - List all users
- `POST /api/users/invite` - Invite new user by email
- `POST /api/users/:id/resend-invite` - Resend invite email
- `PATCH /api/users/:id` - Update user role or status
- `DELETE /api/users/:id` - Deactivate user

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

### API Keys
- `GET /api/api-keys` - List API keys
- `POST /api/api-keys` - Create API key
- `DELETE /api/api-keys/:id` - Revoke API key

### Webhooks
- `GET /api/webhooks` - List webhook configurations
- `POST /api/webhooks` - Create webhook
- `PATCH /api/webhooks/:id` - Update webhook
- `DELETE /api/webhooks/:id` - Delete webhook

### Logs
- `GET /api/logs` - Execution logs with filters (level, category, limit, offset)

### Health
- `GET /api/health` - System health check
- `GET /api/streams/status` - Streaming connection status

Note: API is also accessible via `api.*` subdomain (e.g., `api.forextradingmirror.com/health`).

## Data Flow

### Streaming Mode (default)
1. `StreamManager` establishes persistent connections to OANDA's streaming API
2. Receives real-time `ORDER_FILL` transactions
3. Creates `TradeHistory` records and dispatches to mirrors immediately
4. Falls back to polling if stream connection fails

### Polling Mode (fallback)
1. `MirrorOrchestrator` polls all active source accounts on interval
2. `tradeMonitor` fetches transactions since `lastTransactionId` using `/transactions/sinceid`
3. Filters for `ORDER_FILL` transactions and creates `TradeHistory` records
4. `tradeDispatcher` executes scaled trades on each mirror account
5. Updates `mirrorExecutions` array with results (success/failed)
6. All operations logged to `ExecutionLog` collection

## MongoDB Collections

- **users**: User accounts with auth credentials, roles, sessions
- **sourceAccounts**: Source trading accounts with `lastTransactionId` for polling
- **mirrorAccounts**: Mirror accounts with `sourceAccountId` reference and `scaleFactor`
- **tradeHistory**: Trade records with `mirrorExecutions[]` array tracking each mirror result
- **executionLogs**: Audit trail with auto-expire after 90 days (TTL index)
- **apiKeys**: API keys for external integrations
- **webhookConfigs**: Webhook endpoint configurations

## Configuration

Environment variables (in `packages/server/.env`). See `.env.example` for full list.

Key variables:
```
# Required
MONGODB_URI=mongodb://localhost:27017/oanda-trade-mirror
JWT_SECRET=<generate with: openssl rand -base64 32>
PORT=3001

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Production
NODE_ENV=production
CORS_ORIGIN=https://your-app.example.com,https://api.your-app.example.com
COOKIE_DOMAIN=.your-app.example.com
APP_URL=https://your-app.example.com

# OANDA
OANDA_ENVIRONMENT=practice  # or 'live'
STREAMING_ENABLED=true
POLLING_INTERVAL_MS=3000
```

## Getting Started

1. Start MongoDB locally or configure `MONGODB_URI`
2. Install dependencies: `pnpm install`
3. Copy `packages/server/.env.example` to `packages/server/.env` and configure
4. Start the server: `pnpm start` (runs on http://localhost:3001)
5. Start the frontend dev server: `pnpm dev` (runs on http://localhost:5173)
6. Create the first user (first user automatically becomes admin)

For production, build the client (`pnpm --filter client build`) and the server will serve the static files.

## Deployment

Uses Fly.io with separate staging and production apps:
- **Staging**: `oanda-trade-mirror-staging` - auto-deploys on push to main
- **Production**: `oanda-trade-mirror` - manual deploy via `pnpm deploy`

## Rate Limiting

API routes are rate-limited:
- Auth strict (10 req/15min): login, registration, password reset
- Auth moderate (30 req/15min): token refresh, OAuth callback
- API general (200 req/15min): all authenticated routes
- Health/streams: no limit

## Key Interfaces

**IUser**: User account with `email`, `passwordHash`, `role`, `sessions[]`

**ISourceAccount**: Source account with `oandaAccountId`, `apiToken`, `environment`, `lastTransactionId`

**IMirrorAccount**: Mirror account linked to source with `scaleFactor`

**ITradeHistory**: Trade record with `mirrorExecutions[]` tracking per-mirror results

**TradeInstruction**: Trade to execute (instrument, units, side, type, tp/sl)

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Mongoose, Passport (OAuth)
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query
- **Database**: MongoDB
- **Real-time**: WebSocket (client updates), OANDA Streaming API
- **Deployment**: Fly.io, GitHub Actions
- **Package Manager**: pnpm with workspaces
