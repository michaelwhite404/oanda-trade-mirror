import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer } from 'http';
import { config } from './config/config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logEnvValidation } from './config/validateEnv';
import { MirrorOrchestrator } from './core/mirrorOrchestrator';
import { auditService } from './services/auditService';
import { websocketServer } from './websocket/websocketServer';
import { passport, configurePassport } from './config/passport';
import apiRoutes from './api';

// Validate environment variables at startup
logEnvValidation();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (required behind Fly.io reverse proxy for req.hostname, req.ip, etc.)
app.set('trust proxy', true);

// Create HTTP server for both Express and WebSocket
const httpServer = createServer(app);

let orchestrator: MirrorOrchestrator | null = null;

// CORS configuration — supports comma-separated origins in CORS_ORIGIN
const rawCorsOrigin = process.env.CORS_ORIGIN;
const corsOrigin = rawCorsOrigin
  ? rawCorsOrigin.includes(',')
    ? rawCorsOrigin.split(',').map(o => o.trim())
    : rawCorsOrigin
  : process.env.NODE_ENV === 'production'
    ? false
    : 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Configure Passport for OAuth
configurePassport();
app.use(passport.initialize());

// API routes — served at /api and at the root of the api.* subdomain
app.use('/api', apiRoutes);
app.use('/', (req, _res, next) => {
  const host = req.hostname;
  if (host.startsWith('api.')) {
    return apiRoutes(req, _res, next);
  }
  next();
});

// Serve static frontend in production
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// Return JSON 404 for unmatched API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// SPA fallback - serve index.html for client-side routes (skip api subdomain)
app.get('*', (req, res) => {
  if (req.hostname.startsWith('api.')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

async function main(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Initialize WebSocket server
    websocketServer.initialize(httpServer);

    // Create and start the orchestrator
    orchestrator = new MirrorOrchestrator({
      pollingIntervalMs: config.pollingIntervalMs,
    });

    await orchestrator.start();

    // Start HTTP server (serves both Express and WebSocket)
    httpServer.listen(PORT, () => {
      console.log(`[Server] API server running on http://localhost:${PORT}`);
      console.log(`[Server] WebSocket server running on ws://localhost:${PORT}/ws`);
    });

    console.log('[Main] Trade mirror system running');
    if (config.streaming.enabled) {
      console.log('[Main] Mode: Streaming');
    } else {
      console.log(`[Main] Mode: Polling (interval: ${config.pollingIntervalMs}ms)`);
    }
  } catch (error) {
    console.error('[Main] Failed to start:', error);
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  console.log('[Main] Shutting down...');

  // Shutdown WebSocket server
  websocketServer.shutdown();

  if (orchestrator) {
    await orchestrator.stop();
  }

  await disconnectDatabase();

  console.log('[Main] Shutdown complete');
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  await auditService.error('system', 'Uncaught exception', {
    details: { error: error.message, stack: error.stack },
  });
  console.error('[Main] Uncaught exception:', error);
  await shutdown();
});

process.on('unhandledRejection', async (reason) => {
  await auditService.error('system', 'Unhandled rejection', {
    details: { reason: String(reason) },
  });
  console.error('[Main] Unhandled rejection:', reason);
});

// Start the application
main();
