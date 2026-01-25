import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oanda-trade-mirror';

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[DB] Connected to MongoDB');
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  console.log('[DB] Disconnected from MongoDB');
};

mongoose.connection.on('error', (err) => {
  console.error('[DB] MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('[DB] MongoDB disconnected');
});
