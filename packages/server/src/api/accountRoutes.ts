import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { accountService } from '../services/accountService';
import { OandaEnvironment } from '../types/oanda';
import { getAccountSummary, getOpenPositions, getTransactionHistory, getTransactionDetails } from '../oanda/oandaApi';
import { TradeHistory } from '../db';

const router = Router();

// GET /api/accounts/sources - List all active source accounts
router.get('/sources', async (_req: Request, res: Response) => {
  try {
    const sources = await accountService.getActiveSourceAccounts();
    // Don't expose API tokens in response
    const sanitized = sources.map((s) => ({
      _id: s._id,
      oandaAccountId: s.oandaAccountId,
      environment: s.environment,
      alias: s.alias,
      isActive: s.isActive,
      lastTransactionId: s.lastTransactionId,
      lastSyncedAt: s.lastSyncedAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/accounts/sources - Create a new source account
router.post('/sources', async (req: Request, res: Response) => {
  try {
    const { oandaAccountId, apiToken, environment, alias } = req.body;

    if (!oandaAccountId || !apiToken) {
      res.status(400).json({ error: 'oandaAccountId and apiToken are required' });
      return;
    }

    const source = await accountService.createSourceAccount({
      oandaAccountId,
      apiToken,
      environment: (environment as OandaEnvironment) || 'practice',
      alias: alias || undefined,
    });

    res.status(201).json({
      _id: source._id,
      oandaAccountId: source.oandaAccountId,
      environment: source.environment,
      alias: source.alias,
      isActive: source.isActive,
      createdAt: source.createdAt,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// DELETE /api/accounts/sources/:id - Deactivate a source account
router.delete('/sources/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid source account ID' });
      return;
    }

    await accountService.deactivateSourceAccount(new Types.ObjectId(id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/accounts/sources/:id/mirrors - List mirrors for a source account
router.get('/sources/:id/mirrors', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid source account ID' });
      return;
    }

    // Return all mirrors including paused ones for UI display
    const mirrors = await accountService.getAllMirrorAccountsForSource(
      new Types.ObjectId(id)
    );

    // Don't expose API tokens in response
    const sanitized = mirrors.map((m) => ({
      _id: m._id,
      sourceAccountId: m.sourceAccountId,
      oandaAccountId: m.oandaAccountId,
      environment: m.environment,
      alias: m.alias,
      scalingMode: m.scalingMode,
      scaleFactor: m.scaleFactor,
      isActive: m.isActive,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/accounts/sources/:id/mirrors - Create a mirror account for a source
router.post('/sources/:id/mirrors', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid source account ID' });
      return;
    }

    const { oandaAccountId, apiToken, environment, scalingMode, scaleFactor, alias } = req.body;

    if (!oandaAccountId || !apiToken) {
      res.status(400).json({ error: 'oandaAccountId and apiToken are required' });
      return;
    }

    const mirror = await accountService.createMirrorAccount({
      sourceAccountId: new Types.ObjectId(id),
      oandaAccountId,
      apiToken,
      environment: (environment as OandaEnvironment) || 'practice',
      scalingMode: scalingMode || 'dynamic',
      scaleFactor: scaleFactor || 1.0,
      alias: alias || undefined,
    });

    res.status(201).json({
      _id: mirror._id,
      sourceAccountId: mirror.sourceAccountId,
      oandaAccountId: mirror.oandaAccountId,
      environment: mirror.environment,
      alias: mirror.alias,
      scalingMode: mirror.scalingMode,
      scaleFactor: mirror.scaleFactor,
      isActive: mirror.isActive,
      createdAt: mirror.createdAt,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// DELETE /api/accounts/mirrors/:id - Deactivate a mirror account
router.delete('/mirrors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid mirror account ID' });
      return;
    }

    await accountService.deactivateMirrorAccount(new Types.ObjectId(id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// PATCH /api/accounts/sources/:id - Update a source account (alias)
router.patch('/sources/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid source account ID' });
      return;
    }

    const { alias } = req.body;
    if (alias !== undefined) {
      await accountService.updateSourceAccountAlias(
        new Types.ObjectId(id),
        alias || null
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/accounts/mirrors/:id/toggle - Pause/resume a mirror account
router.post('/mirrors/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid mirror account ID' });
      return;
    }

    const isActive = await accountService.toggleMirrorAccountActive(new Types.ObjectId(id));
    res.json({ success: true, isActive });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// PATCH /api/accounts/mirrors/:id - Update a mirror account (scaling mode, scale factor, alias)
router.patch('/mirrors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid mirror account ID' });
      return;
    }

    const { scalingMode, scaleFactor, alias } = req.body;
    const mirrorId = new Types.ObjectId(id);

    if (scalingMode !== undefined) {
      await accountService.updateScalingMode(mirrorId, scalingMode);
    }

    if (scaleFactor !== undefined) {
      await accountService.updateScaleFactor(mirrorId, scaleFactor);
    }

    if (alias !== undefined) {
      await accountService.updateMirrorAccountAlias(mirrorId, alias || null);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/accounts/validate - Validate OANDA credentials
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { oandaAccountId, apiToken, environment } = req.body;

    if (!oandaAccountId || !apiToken) {
      res.status(400).json({ error: 'oandaAccountId and apiToken are required' });
      return;
    }

    const result = await accountService.validateOandaCredentials(
      oandaAccountId,
      apiToken,
      (environment as OandaEnvironment) || 'practice'
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/accounts/balances - Get balances for all active accounts
router.get('/balances', async (_req: Request, res: Response) => {
  try {
    const sources = await accountService.getActiveSourceAccounts();

    const balances = await Promise.all(
      sources.map(async (source) => {
        try {
          const summary = await getAccountSummary(
            source.oandaAccountId,
            source.apiToken,
            source.environment
          );

          return {
            accountId: source._id,
            oandaAccountId: source.oandaAccountId,
            alias: source.alias,
            environment: source.environment,
            balance: summary.account.balance,
            unrealizedPL: summary.account.unrealizedPL,
            nav: summary.account.NAV,
            currency: summary.account.currency,
            openPositionCount: summary.account.openPositionCount,
            openTradeCount: summary.account.openTradeCount,
          };
        } catch (error) {
          return {
            accountId: source._id,
            oandaAccountId: source.oandaAccountId,
            alias: source.alias,
            environment: source.environment,
            error: (error as Error).message,
          };
        }
      })
    );

    // Also fetch mirror account balances
    const mirrorBalances = await Promise.all(
      sources.map(async (source) => {
        const mirrors = await accountService.getMirrorAccountsForSource(source._id as Types.ObjectId);
        return Promise.all(
          mirrors.map(async (mirror) => {
            try {
              const summary = await getAccountSummary(
                mirror.oandaAccountId,
                mirror.apiToken,
                mirror.environment
              );

              return {
                accountId: mirror._id,
                sourceAccountId: source._id,
                oandaAccountId: mirror.oandaAccountId,
                alias: mirror.alias,
                environment: mirror.environment,
                balance: summary.account.balance,
                unrealizedPL: summary.account.unrealizedPL,
                nav: summary.account.NAV,
                currency: summary.account.currency,
                openPositionCount: summary.account.openPositionCount,
                openTradeCount: summary.account.openTradeCount,
              };
            } catch (error) {
              return {
                accountId: mirror._id,
                sourceAccountId: source._id,
                oandaAccountId: mirror.oandaAccountId,
                alias: mirror.alias,
                environment: mirror.environment,
                error: (error as Error).message,
              };
            }
          })
        );
      })
    );

    res.json({
      sources: balances,
      mirrors: mirrorBalances.flat(),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/accounts/positions - Get open positions for all active accounts
router.get('/positions', async (_req: Request, res: Response) => {
  try {
    const sources = await accountService.getActiveSourceAccounts();

    const sourcePositions = await Promise.all(
      sources.map(async (source) => {
        try {
          const data = await getOpenPositions(
            source.oandaAccountId,
            source.apiToken,
            source.environment
          );

          return {
            accountId: source._id,
            oandaAccountId: source.oandaAccountId,
            alias: source.alias,
            environment: source.environment,
            accountType: 'source' as const,
            positions: data.positions.map((pos: {
              instrument: string;
              long: { units: string; averagePrice: string; pl: string; unrealizedPL: string };
              short: { units: string; averagePrice: string; pl: string; unrealizedPL: string };
              unrealizedPL: string;
            }) => ({
              instrument: pos.instrument,
              long: pos.long.units !== '0' ? {
                units: pos.long.units,
                averagePrice: pos.long.averagePrice,
                pl: pos.long.pl,
                unrealizedPL: pos.long.unrealizedPL,
              } : null,
              short: pos.short.units !== '0' ? {
                units: pos.short.units,
                averagePrice: pos.short.averagePrice,
                pl: pos.short.pl,
                unrealizedPL: pos.short.unrealizedPL,
              } : null,
              unrealizedPL: pos.unrealizedPL,
            })),
          };
        } catch (error) {
          return {
            accountId: source._id,
            oandaAccountId: source.oandaAccountId,
            alias: source.alias,
            environment: source.environment,
            accountType: 'source' as const,
            positions: [],
            error: (error as Error).message,
          };
        }
      })
    );

    const mirrorPositions = await Promise.all(
      sources.map(async (source) => {
        const mirrors = await accountService.getMirrorAccountsForSource(source._id as Types.ObjectId);
        return Promise.all(
          mirrors.map(async (mirror) => {
            try {
              const data = await getOpenPositions(
                mirror.oandaAccountId,
                mirror.apiToken,
                mirror.environment
              );

              return {
                accountId: mirror._id,
                sourceAccountId: source._id,
                oandaAccountId: mirror.oandaAccountId,
                alias: mirror.alias,
                environment: mirror.environment,
                accountType: 'mirror' as const,
                positions: data.positions.map((pos: {
                  instrument: string;
                  long: { units: string; averagePrice: string; pl: string; unrealizedPL: string };
                  short: { units: string; averagePrice: string; pl: string; unrealizedPL: string };
                  unrealizedPL: string;
                }) => ({
                  instrument: pos.instrument,
                  long: pos.long.units !== '0' ? {
                    units: pos.long.units,
                    averagePrice: pos.long.averagePrice,
                    pl: pos.long.pl,
                    unrealizedPL: pos.long.unrealizedPL,
                  } : null,
                  short: pos.short.units !== '0' ? {
                    units: pos.short.units,
                    averagePrice: pos.short.averagePrice,
                    pl: pos.short.pl,
                    unrealizedPL: pos.short.unrealizedPL,
                  } : null,
                  unrealizedPL: pos.unrealizedPL,
                })),
              };
            } catch (error) {
              return {
                accountId: mirror._id,
                sourceAccountId: source._id,
                oandaAccountId: mirror.oandaAccountId,
                alias: mirror.alias,
                environment: mirror.environment,
                accountType: 'mirror' as const,
                positions: [],
                error: (error as Error).message,
              };
            }
          })
        );
      })
    );

    res.json({
      sources: sourcePositions,
      mirrors: mirrorPositions.flat(),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/accounts/stats - Get P&L summary and trade statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const sources = await accountService.getActiveSourceAccounts();

    // Get stats for each source account
    const stats = await Promise.all(
      sources.map(async (source) => {
        try {
          // Get transaction IDs for ORDER_FILL transactions in the last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const txnData = await getTransactionHistory(
            source.oandaAccountId,
            source.apiToken,
            source.environment,
            thirtyDaysAgo.toISOString(),
            undefined,
            'ORDER_FILL'
          );

          // Get detailed transactions if we have any
          let transactions: Array<{
            id: string;
            type: string;
            instrument?: string;
            units?: string;
            pl?: string;
            time: string;
            reason?: string;
          }> = [];

          if (txnData.pages && txnData.pages.length > 0) {
            // Fetch transaction details from the first page
            const pageUrl = txnData.pages[0];
            const match = pageUrl.match(/from=(\d+)&to=(\d+)/);
            if (match) {
              const details = await getTransactionDetails(
                source.oandaAccountId,
                source.apiToken,
                [match[1], match[2]],
                source.environment
              );
              transactions = details.transactions || [];
            }
          }

          // Filter for ORDER_FILL transactions with P/L (closed trades)
          const closedTrades = transactions.filter(
            (t) => t.type === 'ORDER_FILL' && t.pl && parseFloat(t.pl) !== 0
          );

          // Calculate statistics
          const wins = closedTrades.filter((t) => parseFloat(t.pl!) > 0);
          const losses = closedTrades.filter((t) => parseFloat(t.pl!) < 0);

          const totalPL = closedTrades.reduce((sum, t) => sum + parseFloat(t.pl!), 0);
          const totalWinPL = wins.reduce((sum, t) => sum + parseFloat(t.pl!), 0);
          const totalLossPL = losses.reduce((sum, t) => sum + parseFloat(t.pl!), 0);

          const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
          const avgWin = wins.length > 0 ? totalWinPL / wins.length : 0;
          const avgLoss = losses.length > 0 ? totalLossPL / losses.length : 0;

          // Get trade counts from our database
          const dbTradeCount = await TradeHistory.countDocuments({
            sourceAccountId: source._id,
          });

          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayTradeCount = await TradeHistory.countDocuments({
            sourceAccountId: source._id,
            createdAt: { $gte: todayStart },
          });

          // Get mirror execution stats
          const mirrorStats = await TradeHistory.aggregate([
            { $match: { sourceAccountId: source._id } },
            { $unwind: '$mirrorExecutions' },
            {
              $group: {
                _id: '$mirrorExecutions.status',
                count: { $sum: 1 },
              },
            },
          ]);

          const mirrorSuccessCount = mirrorStats.find((s) => s._id === 'success')?.count || 0;
          const mirrorFailedCount = mirrorStats.find((s) => s._id === 'failed')?.count || 0;

          return {
            accountId: source._id,
            oandaAccountId: source.oandaAccountId,
            alias: source.alias,
            environment: source.environment,
            stats: {
              totalRealizedPL: totalPL,
              winCount: wins.length,
              lossCount: losses.length,
              winRate: winRate,
              avgWin: avgWin,
              avgLoss: avgLoss,
              totalTrades: dbTradeCount,
              tradesToday: todayTradeCount,
              mirrorSuccessCount,
              mirrorFailedCount,
              mirrorSuccessRate:
                mirrorSuccessCount + mirrorFailedCount > 0
                  ? (mirrorSuccessCount / (mirrorSuccessCount + mirrorFailedCount)) * 100
                  : 100,
            },
          };
        } catch (error) {
          return {
            accountId: source._id,
            oandaAccountId: source.oandaAccountId,
            alias: source.alias,
            environment: source.environment,
            error: (error as Error).message,
          };
        }
      })
    );

    res.json({ accounts: stats });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
