import dotenv from 'dotenv';
dotenv.config();

// Application configuration
export const config = {
  // MongoDB connection string
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/oanda-trade-mirror',

  // Polling interval in milliseconds (used for fallback mode)
  pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '3000', 10),

  // OANDA environment (for migration script)
  defaultOandaEnvironment: (process.env.OANDA_ENVIRONMENT || 'practice') as 'practice' | 'live',

  // Streaming configuration
  streaming: {
    // Enable streaming mode (vs polling)
    enabled: process.env.STREAMING_ENABLED !== 'false',
    // Initial reconnect delay in milliseconds
    reconnectDelayMs: parseInt(process.env.STREAM_RECONNECT_DELAY_MS || '5000', 10),
    // Max reconnect delay (for exponential backoff)
    maxReconnectDelayMs: parseInt(process.env.STREAM_MAX_RECONNECT_DELAY_MS || '300000', 10),
    // Max time without heartbeat before reconnecting
    heartbeatTimeoutMs: parseInt(process.env.STREAM_HEARTBEAT_TIMEOUT_MS || '30000', 10),
    // Number of consecutive failures before falling back to polling
    maxConsecutiveFailures: parseInt(process.env.STREAM_MAX_FAILURES || '10', 10),
    // Fallback polling interval (longer than normal polling)
    fallbackPollingIntervalMs: parseInt(process.env.FALLBACK_POLLING_INTERVAL_MS || '10000', 10),
  },
};

// Legacy exports for backwards compatibility with migration script
export const legacyEnvAccounts = {
  source: {
    accountId: process.env.SOURCE_ACCOUNT_ID,
    token: process.env.SOURCE_TOKEN,
  },
  mirrors: [
    {
      accountId: process.env.MIRROR_1_ID,
      token: process.env.MIRROR_1_TOKEN,
      scaleFactor: parseFloat(process.env.MIRROR_1_SCALE_FACTOR || '1.0'),
    },
    {
      accountId: process.env.MIRROR_2_ID,
      token: process.env.MIRROR_2_TOKEN,
      scaleFactor: parseFloat(process.env.MIRROR_2_SCALE_FACTOR || '1.0'),
    },
  ].filter((m) => m.accountId && m.token),
};
