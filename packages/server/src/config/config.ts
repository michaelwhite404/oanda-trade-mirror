import dotenv from 'dotenv';
dotenv.config();

// Application configuration
export const config = {
  // MongoDB connection string
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/oanda-trade-mirror',

  // Polling interval in milliseconds
  pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '3000', 10),

  // OANDA environment (for migration script)
  defaultOandaEnvironment: (process.env.OANDA_ENVIRONMENT || 'practice') as 'practice' | 'live',
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
