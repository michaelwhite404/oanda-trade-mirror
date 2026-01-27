import { Types } from 'mongoose';
import axios from 'axios';
import { SourceAccount, SourceAccountDocument, MirrorAccount, MirrorAccountDocument } from '../db';
import { OandaEnvironment, getOandaBaseUrl } from '../types/oanda';
import { auditService } from './auditService';

interface CreateSourceAccountParams {
  oandaAccountId: string;
  apiToken: string;
  environment: OandaEnvironment;
  alias?: string;
}

interface CreateMirrorAccountParams {
  sourceAccountId: Types.ObjectId;
  oandaAccountId: string;
  apiToken: string;
  environment: OandaEnvironment;
  scalingMode?: 'dynamic' | 'static';
  scaleFactor?: number;
  alias?: string;
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
      alias: params.alias || null,
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
      alias: params.alias || null,
      scalingMode: params.scalingMode ?? 'dynamic',
      scaleFactor: params.scaleFactor ?? 1.0,
      isActive: true,
    });

    await auditService.info('account', 'Mirror account created', {
      sourceAccountId: params.sourceAccountId,
      mirrorAccountId: mirrorAccount._id as Types.ObjectId,
      details: {
        oandaAccountId: params.oandaAccountId,
        environment: params.environment,
        scalingMode: params.scalingMode ?? 'dynamic',
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

  async getAllMirrorAccountsForSource(sourceAccountId: Types.ObjectId): Promise<MirrorAccountDocument[]> {
    return MirrorAccount.find({ sourceAccountId });
  }

  async toggleMirrorAccountActive(mirrorAccountId: Types.ObjectId): Promise<boolean> {
    const mirror = await MirrorAccount.findById(mirrorAccountId);
    if (!mirror) {
      throw new Error('Mirror account not found');
    }

    const newStatus = !mirror.isActive;
    await MirrorAccount.findByIdAndUpdate(mirrorAccountId, { isActive: newStatus });

    await auditService.info('account', newStatus ? 'Mirror account resumed' : 'Mirror account paused', {
      mirrorAccountId,
      details: { isActive: newStatus },
    });

    return newStatus;
  }

  async setAllMirrorsActive(sourceAccountId: Types.ObjectId, isActive: boolean): Promise<number> {
    const result = await MirrorAccount.updateMany(
      { sourceAccountId },
      { isActive }
    );

    await auditService.info('account', isActive ? 'All mirror accounts resumed' : 'All mirror accounts paused', {
      sourceAccountId,
      details: { isActive, updatedCount: result.modifiedCount },
    });

    return result.modifiedCount;
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

  async updateScalingMode(mirrorAccountId: Types.ObjectId, scalingMode: 'dynamic' | 'static'): Promise<void> {
    if (scalingMode !== 'dynamic' && scalingMode !== 'static') {
      throw new Error('Scaling mode must be "dynamic" or "static"');
    }

    await MirrorAccount.findByIdAndUpdate(mirrorAccountId, { scalingMode });

    await auditService.info('account', 'Mirror account scaling mode updated', {
      mirrorAccountId,
      details: { scalingMode },
    });
  }

  async updateSourceAccountAlias(sourceAccountId: Types.ObjectId, alias: string | null): Promise<void> {
    await SourceAccount.findByIdAndUpdate(sourceAccountId, { alias });

    await auditService.info('account', 'Source account alias updated', {
      sourceAccountId,
      details: { alias },
    });
  }

  async updateMirrorAccountAlias(mirrorAccountId: Types.ObjectId, alias: string | null): Promise<void> {
    await MirrorAccount.findByIdAndUpdate(mirrorAccountId, { alias });

    await auditService.info('account', 'Mirror account alias updated', {
      mirrorAccountId,
      details: { alias },
    });
  }
}

export const accountService = new AccountService();
