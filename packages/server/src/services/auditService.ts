import { Types } from 'mongoose';
import { ExecutionLog } from '../db';
import { LogLevel, LogCategory } from '../types/models';

interface LogOptions {
  sourceAccountId?: Types.ObjectId;
  mirrorAccountId?: Types.ObjectId;
  transactionId?: string;
  details?: Record<string, unknown>;
}

class AuditService {
  private async log(
    level: LogLevel,
    category: LogCategory,
    action: string,
    options: LogOptions = {}
  ): Promise<void> {
    try {
      await ExecutionLog.create({
        timestamp: new Date(),
        level,
        category,
        action,
        sourceAccountId: options.sourceAccountId,
        mirrorAccountId: options.mirrorAccountId,
        transactionId: options.transactionId,
        details: options.details || {},
      });
    } catch (error) {
      // Don't let logging failures break the application
      console.error('[Audit] Failed to write log:', error);
    }

    // Also log to console for real-time visibility
    const prefix = `[${level.toUpperCase()}][${category}]`;
    const message = `${prefix} ${action}`;

    if (level === 'error') {
      console.error(message, options.details || '');
    } else if (level === 'warn') {
      console.warn(message, options.details || '');
    } else {
      console.log(message, options.details || '');
    }
  }

  async info(category: LogCategory, action: string, options?: LogOptions): Promise<void> {
    return this.log('info', category, action, options);
  }

  async warn(category: LogCategory, action: string, options?: LogOptions): Promise<void> {
    return this.log('warn', category, action, options);
  }

  async error(category: LogCategory, action: string, options?: LogOptions): Promise<void> {
    return this.log('error', category, action, options);
  }

  async debug(category: LogCategory, action: string, options?: LogOptions): Promise<void> {
    return this.log('debug', category, action, options);
  }

  // Convenience methods for common operations
  async logTradeDetected(
    sourceAccountId: Types.ObjectId,
    transactionId: string,
    instrument: string,
    units: number,
    side: string
  ): Promise<void> {
    return this.info('trade', 'Trade detected on source account', {
      sourceAccountId,
      transactionId,
      details: { instrument, units, side },
    });
  }

  async logMirrorExecution(
    sourceAccountId: Types.ObjectId,
    mirrorAccountId: Types.ObjectId,
    transactionId: string,
    success: boolean,
    details: Record<string, unknown>
  ): Promise<void> {
    if (success) {
      return this.info('trade', 'Mirror execution successful', {
        sourceAccountId,
        mirrorAccountId,
        transactionId,
        details,
      });
    } else {
      return this.error('trade', 'Mirror execution failed', {
        sourceAccountId,
        mirrorAccountId,
        transactionId,
        details,
      });
    }
  }

  async logSystemStart(): Promise<void> {
    return this.info('system', 'Trade mirror system started');
  }

  async logSystemShutdown(): Promise<void> {
    return this.info('system', 'Trade mirror system shutting down');
  }

  async logApiError(
    action: string,
    error: Error,
    sourceAccountId?: Types.ObjectId
  ): Promise<void> {
    return this.error('api', action, {
      sourceAccountId,
      details: {
        errorMessage: error.message,
        errorStack: error.stack,
      },
    });
  }
}

export const auditService = new AuditService();
