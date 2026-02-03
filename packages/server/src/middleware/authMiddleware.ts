import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { authService, TokenPayload } from '../services/authService';
import { UserRole } from '../types/models';
import { ApiKey, ApiKeyScope } from '../db/models/ApiKey';
import { User } from '../db/models/User';

declare global {
  namespace Express {
    interface Request {
      authUser?: TokenPayload;
      authMethod?: 'cookie' | 'apiKey';
      apiKeyScopes?: ApiKeyScope[];
    }
  }
}

interface ApiKeyAuthResult {
  payload: TokenPayload;
  scopes: ApiKeyScope[];
}

async function authenticateWithApiKey(apiKey: string): Promise<ApiKeyAuthResult | null> {
  // Find all active API keys and check against hash
  // We need to check the prefix first to narrow down candidates
  const keyPrefix = apiKey.substring(0, 12);

  const candidates = await ApiKey.find({
    keyPrefix,
    isActive: true,
  });

  for (const candidate of candidates) {
    // Check if expired
    if (candidate.expiresAt && candidate.expiresAt < new Date()) {
      continue;
    }

    // Verify the key hash
    const isValid = await bcrypt.compare(apiKey, candidate.keyHash);
    if (isValid) {
      // Update last used timestamp
      candidate.lastUsedAt = new Date();
      await candidate.save();

      // Get the user
      const user = await User.findById(candidate.userId);
      if (!user || !user.isActive || user.registrationStatus !== 'active') {
        return null;
      }

      return {
        payload: {
          userId: user._id.toString(),
          username: user.username || user.email,
          role: user.role,
        },
        scopes: candidate.scopes,
      };
    }
  }

  return null;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Check for API key in Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7);

    // Check if it looks like an API key (starts with otm_)
    if (apiKey.startsWith('otm_')) {
      authenticateWithApiKey(apiKey)
        .then((result) => {
          if (result) {
            req.authUser = result.payload;
            req.authMethod = 'apiKey';
            req.apiKeyScopes = result.scopes;
            next();
          } else {
            res.status(401).json({ error: 'Invalid or expired API key' });
          }
        })
        .catch(() => {
          res.status(401).json({ error: 'Authentication failed' });
        });
      return;
    }
  }

  // Fall back to cookie-based authentication
  const token = req.cookies?.accessToken;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = authService.verifyAccessToken(token);
    req.authUser = payload;
    req.authMethod = 'cookie';
    // Cookie auth has full access (no scope restrictions)
    req.apiKeyScopes = ['full'];
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Middleware to require specific API key scopes.
 * If the user authenticated via cookie, they have full access.
 * If the user authenticated via API key, they must have one of the required scopes or 'full'.
 */
export function requireScope(...scopes: ApiKeyScope[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userScopes = req.apiKeyScopes || [];

    // 'full' scope grants access to everything
    if (userScopes.includes('full')) {
      next();
      return;
    }

    // Check if user has at least one of the required scopes
    const hasScope = scopes.some((scope) => userScopes.includes(scope));
    if (!hasScope) {
      res.status(403).json({
        error: 'Insufficient scope',
        required: scopes,
        current: userScopes,
      });
      return;
    }

    next();
  };
}
