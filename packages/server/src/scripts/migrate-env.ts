/**
 * Migration Script: .env accounts to MongoDB
 *
 * This script migrates existing account configuration from .env file
 * to the MongoDB database. Run this once after setting up MongoDB.
 *
 * Usage: npx ts-node src/scripts/migrate-env.ts
 */

import { Types } from 'mongoose';
import { config, legacyEnvAccounts } from '../config/config';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { AccountManager } from '../accounts/accountManager';
import { SourceAccount, MirrorAccount } from '../db';

async function migrate(): Promise<void> {
  console.log('=== OANDA Trade Mirror: .env to MongoDB Migration ===\n');

  // Connect to MongoDB
  console.log(`Connecting to MongoDB: ${config.mongodbUri}`);
  await connectDatabase();
  console.log('Connected.\n');

  const { source, mirrors } = legacyEnvAccounts;

  // Validate source account configuration
  if (!source.accountId || !source.token) {
    console.error('ERROR: SOURCE_ACCOUNT_ID and SOURCE_TOKEN must be set in .env');
    await disconnectDatabase();
    process.exit(1);
  }

  console.log(`Source account: ${source.accountId}`);
  console.log(`Mirror accounts: ${mirrors.length}`);
  console.log('');

  // Check if source account already exists
  const existingSource = await SourceAccount.findOne({
    oandaAccountId: source.accountId,
  });

  let sourceAccountId: Types.ObjectId;

  if (existingSource) {
    console.log(`Source account ${source.accountId} already exists in database.`);
    sourceAccountId = existingSource._id as Types.ObjectId;
  } else {
    // Validate and create source account
    console.log(`Validating source account credentials...`);
    const validation = await AccountManager.validateCredentials(
      source.accountId,
      source.token,
      config.defaultOandaEnvironment
    );

    if (!validation.valid) {
      console.error(`ERROR: Source account validation failed: ${validation.error}`);
      await disconnectDatabase();
      process.exit(1);
    }

    console.log(`Creating source account in database...`);
    const sourceAccount = await AccountManager.createSourceAccount(
      source.accountId,
      source.token,
      config.defaultOandaEnvironment
    );
    sourceAccountId = sourceAccount._id as Types.ObjectId;
    console.log(`Source account created: ${sourceAccountId}`);
  }

  console.log('');

  // Create mirror accounts
  for (const mirror of mirrors) {
    console.log(`Processing mirror account: ${mirror.accountId}`);

    // Check if mirror already exists
    const existingMirror = await MirrorAccount.findOne({
      sourceAccountId,
      oandaAccountId: mirror.accountId,
    });

    if (existingMirror) {
      console.log(`  Mirror account already exists, skipping.`);
      continue;
    }

    // Validate credentials
    console.log(`  Validating credentials...`);
    const validation = await AccountManager.validateCredentials(
      mirror.accountId!,
      mirror.token!,
      config.defaultOandaEnvironment
    );

    if (!validation.valid) {
      console.error(`  ERROR: Validation failed: ${validation.error}`);
      console.log(`  Skipping this mirror account.`);
      continue;
    }

    // Create mirror account
    console.log(`  Creating mirror account...`);
    const mirrorAccount = await AccountManager.createMirrorAccount(
      sourceAccountId,
      mirror.accountId!,
      mirror.token!,
      config.defaultOandaEnvironment,
      mirror.scaleFactor
    );
    console.log(`  Mirror account created: ${mirrorAccount._id}`);
    console.log(`  Scale factor: ${mirror.scaleFactor}`);
  }

  console.log('\n=== Migration Complete ===\n');

  // Print summary
  const sourceAccounts = await SourceAccount.find({});
  const mirrorAccounts = await MirrorAccount.find({});

  console.log('Database Summary:');
  console.log(`  Source accounts: ${sourceAccounts.length}`);
  console.log(`  Mirror accounts: ${mirrorAccounts.length}`);

  await disconnectDatabase();
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
