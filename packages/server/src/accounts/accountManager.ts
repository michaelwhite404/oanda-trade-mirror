import { Types } from 'mongoose';
import { accountService } from '../services/accountService';
import { SourceAccountDocument, MirrorAccountDocument } from '../db';
import { OandaEnvironment } from '../types/oanda';

// Re-export accountService methods as the AccountManager API
// This provides a clean interface for account management operations

export const AccountManager = {
  /**
   * Validate OANDA credentials before creating an account
   */
  validateCredentials: async (
    oandaAccountId: string,
    apiToken: string,
    environment: OandaEnvironment
  ): Promise<{ valid: boolean; error?: string }> => {
    return accountService.validateOandaCredentials(oandaAccountId, apiToken, environment);
  },

  /**
   * Create a new source account to monitor
   */
  createSourceAccount: async (
    oandaAccountId: string,
    apiToken: string,
    environment: OandaEnvironment = 'practice'
  ): Promise<SourceAccountDocument> => {
    return accountService.createSourceAccount({
      oandaAccountId,
      apiToken,
      environment,
    });
  },

  /**
   * Create a new mirror account linked to a source
   */
  createMirrorAccount: async (
    sourceAccountId: Types.ObjectId,
    oandaAccountId: string,
    apiToken: string,
    environment: OandaEnvironment = 'practice',
    scaleFactor: number = 1.0
  ): Promise<MirrorAccountDocument> => {
    return accountService.createMirrorAccount({
      sourceAccountId,
      oandaAccountId,
      apiToken,
      environment,
      scaleFactor,
    });
  },

  /**
   * Get all active source accounts
   */
  getActiveSourceAccounts: async (): Promise<SourceAccountDocument[]> => {
    return accountService.getActiveSourceAccounts();
  },

  /**
   * Get all mirror accounts for a source
   */
  getMirrorAccounts: async (sourceAccountId: Types.ObjectId): Promise<MirrorAccountDocument[]> => {
    return accountService.getMirrorAccountsForSource(sourceAccountId);
  },

  /**
   * Deactivate a source account (also deactivates its mirrors)
   */
  deactivateSourceAccount: async (sourceAccountId: Types.ObjectId): Promise<void> => {
    return accountService.deactivateSourceAccount(sourceAccountId);
  },

  /**
   * Deactivate a single mirror account
   */
  deactivateMirrorAccount: async (mirrorAccountId: Types.ObjectId): Promise<void> => {
    return accountService.deactivateMirrorAccount(mirrorAccountId);
  },

  /**
   * Update the scale factor for a mirror account
   */
  updateScaleFactor: async (mirrorAccountId: Types.ObjectId, scaleFactor: number): Promise<void> => {
    return accountService.updateScaleFactor(mirrorAccountId, scaleFactor);
  },
};
