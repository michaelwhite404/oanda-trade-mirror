# OANDA Trade Mirror

Automatically mirror trades from a source OANDA account to one or more mirror accounts using the OANDA REST API. Features a React dashboard for account management and trade monitoring.

## Features

- Real-time trade mirroring via OANDA streaming API
- Multiple source accounts, each with multiple mirrors
- Configurable scale factors (static or NAV-based dynamic scaling)
- JWT authentication with Google OAuth support
- PWA support for mobile installation
- Push notifications for trade alerts
- Full audit logging

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- MongoDB (local or cloud)

### Development Setup

1. Install dependencies:
```bash
pnpm install
```

2. Copy environment files:
```bash
cp packages/server/.env.example packages/server/.env
cp packages/client/.env.example packages/client/.env
```

3. Edit `packages/server/.env` with your configuration:
   - Generate JWT_SECRET: `openssl rand -base64 32`
   - Add Google OAuth credentials (optional)
   - Generate VAPID keys: `npx web-push generate-vapid-keys`

4. Start MongoDB locally or configure `MONGODB_URI`

5. Start the development servers:
```bash
# Terminal 1: Start the backend
pnpm start

# Terminal 2: Start the frontend dev server
pnpm dev
```

6. Open http://localhost:5173 and create your first user

## Production Deployment

### Option 1: Docker (Recommended)

1. Build and run with Docker Compose:
```bash
# Set environment variables
export JWT_SECRET=$(openssl rand -base64 32)
export GOOGLE_CLIENT_ID=your-client-id
export GOOGLE_CLIENT_SECRET=your-secret

# Start services
docker compose up -d
```

2. Or build the image directly:
```bash
docker build -t oanda-trade-mirror .
docker run -p 3001:3001 \
  -e MONGODB_URI=mongodb://your-mongo:27017/oanda-trade-mirror \
  -e JWT_SECRET=your-secret \
  oanda-trade-mirror
```

### Option 2: Manual Deployment

1. Build both packages:
```bash
pnpm build
```

2. Set production environment variables (see `.env.example`)

3. Start the server:
```bash
NODE_ENV=production node packages/server/dist/index.js
```

The server serves the built React app from the same port.

### Environment Variables

See `packages/server/.env.example` for all available configuration options.

**Required for production:**
- `JWT_SECRET` - Secure random string for JWT signing
- `MONGODB_URI` - MongoDB connection string
- `NODE_ENV=production`

**Required for Google OAuth:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`

**Required for push notifications:**
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`

### Health Check

The server exposes a health endpoint at `GET /api/health` for monitoring.

## Architecture

```
oanda-trade-mirror/
├── packages/
│   ├── server/          # Express API + trade orchestrator
│   │   ├── src/
│   │   │   ├── api/     # REST endpoints
│   │   │   ├── core/    # Trade mirroring logic
│   │   │   ├── db/      # MongoDB models
│   │   │   └── services/
│   │   └── dist/        # Compiled output
│   └── client/          # React + Vite frontend
│       ├── src/
│       └── dist/        # Built static files
├── Dockerfile
└── docker-compose.yml
```

## License

MIT
