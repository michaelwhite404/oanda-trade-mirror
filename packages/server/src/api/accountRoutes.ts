import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { accountService } from '../services/accountService';
import { OandaEnvironment } from '../types/oanda';
import { getAccountSummary } from '../oanda/oandaApi';

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

    const mirrors = await accountService.getMirrorAccountsForSource(
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

export default router;
