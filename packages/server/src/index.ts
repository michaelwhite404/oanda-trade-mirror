import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config/config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { MirrorOrchestrator } from './core/mirrorOrchestrator';
import { auditService } from './services/auditService';
import apiRoutes from './api';

const app = express();
const PORT = process.env.PORT || 3001;

let orchestrator: MirrorOrchestrator | null = null;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// Serve static frontend in production
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// SPA fallback - serve index.html for client-side routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

async function main(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Create and start the orchestrator
    orchestrator = new MirrorOrchestrator({
      pollingIntervalMs: config.pollingIntervalMs,
    });

    await orchestrator.start();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`[Server] API server running on http://localhost:${PORT}`);
    });

    console.log('[Main] Trade mirror system running');
    console.log(`[Main] Polling interval: ${config.pollingIntervalMs}ms`);
  } catch (error) {
    console.error('[Main] Failed to start:', error);
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  console.log('[Main] Shutting down...');

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
