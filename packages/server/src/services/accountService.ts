import { Types } from 'mongoose';
import axios from 'axios';
import { SourceAccount, SourceAccountDocument, MirrorAccount, MirrorAccountDocument } from '../db';
import { OandaEnvironment, getOandaBaseUrl } from '../types/oanda';
import { auditService } from './auditService';

interface CreateSourceAccountParams {
  oandaAccountId: string;
  apiToken: string;
  environment: OandaEnvironment;
}

interface CreateMirrorAccountParams {
  sourceAccountId: Types.ObjectId;
  oandaAccountId: string;
  apiToken: string;
  environment: OandaEnvironment;
  scaleFactor?: number;
}

class AccountService {
  async validateOandaCredentials(
    oandaAccountId: string,
    apiToken: string,
    environment: OandaEnvironment
  ): Promise<{ valid: boolean; error?: string }> {
    const baseUrl = getOandaBaseUrl(environment);

    try {
      const response = await axios.get(`${baseUrl}/accounts/${oandaAccountId}/summary`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });

      if (response.data?.account?.id === oandaAccountId) {
        return { valid: true };
      }

      return { valid: false, error: 'Account ID mismatch' };
    } catch (error: unknown) {
      const axiosError = error as { response?: { status: number; data?: { errorMessage?: string } }; message: string };
      if (axiosError.response?.status === 401) {
        return { valid: false, error: 'Invalid API token' };
      }
      if (axiosError.response?.status === 404) {
        return { valid: false, error: 'Account not found' };
      }
      return { valid: false, error: axiosError.message };
    }
  }

  async createSourceAccount(params: CreateSourceAccountParams): Promise<SourceAccountDocument> {
    // Validate credentials first
    const validation = await this.validateOandaCredentials(
      params.oandaAccountId,
      params.apiToken,
      params.environment
    );

    if (!validation.valid) {
      throw new Error(`Invalid OANDA credentials: ${validation.error}`);
    }

    const sourceAccount = await SourceAccount.create({
      oandaAccountId: params.oandaAccountId,
      apiToken: params.apiToken,
      environment: params.environment,
      isActive: true,
      lastTransactionId: null,
      lastSyncedAt: null,
    });

    await auditService.info('account', 'Source account created', {
      sourceAccountId: sourceAccount._id as Types.ObjectId,
      details: { oandaAccountId: params.oandaAccountId, environment: params.environment },
    });

    return sourceAccount;
  }

  async createMirrorAccount(params: CreateMirrorAccountParams): Promise<MirrorAccountDocument> {
    // Validate credentials first
    const validation = await this.validateOandaCredentials(
      params.oandaAccountId,
      params.apiToken,
      params.environment
    );

    if (!validation.valid) {
      throw new Error(`Invalid OANDA credentials: ${validation.error}`);
    }

    // Verify source account exists
    const sourceAccount = await SourceAccount.findById(params.sourceAccountId);
    if (!sourceAccount) {
      throw new Error('Source account not found');
    }

    const mirrorAccount = await MirrorAccount.create({
      sourceAccountId: params.sourceAccountId,
      oandaAccountId: params.oandaAccountId,
      apiToken: params.apiToken,
      environment: params.environment,
      scaleFactor: params.scaleFactor ?? 1.0,
      isActive: true,
    });

    await auditService.info('account', 'Mirror account created', {
      sourceAccountId: params.sourceAccountId,
      mirrorAccountId: mirrorAccount._id as Types.ObjectId,
      details: {
        oandaAccountId: params.oandaAccountId,
        environment: params.environment,
        scaleFactor: params.scaleFactor ?? 1.0,
      },
    });

    return mirrorAccount;
  }

  async getActiveSourceAccounts(): Promise<SourceAccountDocument[]> {
    return SourceAccount.find({ isActive: true });
  }

  async getMirrorAccountsForSource(sourceAccountId: Types.ObjectId): Promise<MirrorAccountDocument[]> {
    return MirrorAccount.find({ sourceAccountId, isActive: true });
  }

  async getSourceAccountById(id: Types.ObjectId): Promise<SourceAccountDocument | null> {
    return SourceAccount.findById(id);
  }

  async updateLastTransactionId(
    sourceAccountId: Types.ObjectId,
    lastTransactionId: string
  ): Promise<void> {
    await SourceAccount.findByIdAndUpdate(sourceAccountId, {
      lastTransactionId,
      lastSyncedAt: new Date(),
    });
  }

  async deactivateSourceAccount(sourceAccountId: Types.ObjectId): Promise<void> {
    await SourceAccount.findByIdAndUpdate(sourceAccountId, { isActive: false });
    await MirrorAccount.updateMany({ sourceAccountId }, { isActive: false });

    await auditService.info('account', 'Source account deactivated', {
      sourceAccountId,
    });
  }

  async deactivateMirrorAccount(mirrorAccountId: Types.ObjectId): Promise<void> {
    await MirrorAccount.findByIdAndUpdate(mirrorAccountId, { isActive: false });

    await auditService.info('account', 'Mirror account deactivated', {
      mirrorAccountId,
    });
  }

  async updateScaleFactor(mirrorAccountId: Types.ObjectId, scaleFactor: number): Promise<void> {
    if (scaleFactor < 0.01 || scaleFactor > 100) {
      throw new Error('Scale factor must be between 0.01 and 100');
    }

    await MirrorAccount.findByIdAndUpdate(mirrorAccountId, { scaleFactor });

    await auditService.info('account', 'Mirror account scale factor updated', {
      mirrorAccountId,
      details: { scaleFactor },
    });
  }
}

export const accountService = new AccountService();
