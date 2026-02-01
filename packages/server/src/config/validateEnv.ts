/**
 * Validates required environment variables at startup
 * Logs warnings for missing optional variables
 * Throws error for missing critical variables in production
 */

interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Critical in production
  if (isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-in-production') {
      errors.push('JWT_SECRET must be set to a secure value in production');
    }

    if (!process.env.MONGODB_URI) {
      errors.push('MONGODB_URI must be set in production');
    }
  }

  // Always warn about default JWT secret
  if (!process.env.JWT_SECRET) {
    warnings.push('JWT_SECRET not set - using insecure default (OK for development only)');
  }

  // Google OAuth (warn if not configured)
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    warnings.push('Google OAuth not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)');
  }

  // VAPID keys for push notifications (warn if not configured)
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    warnings.push('VAPID keys not configured - push notifications will not work');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function logEnvValidation(): void {
  const result = validateEnv();

  // Log warnings
  for (const warning of result.warnings) {
    console.warn(`[Config] WARNING: ${warning}`);
  }

  // Log errors and exit if invalid
  if (!result.valid) {
    for (const error of result.errors) {
      console.error(`[Config] ERROR: ${error}`);
    }
    console.error('[Config] Environment validation failed. Exiting.');
    process.exit(1);
  }

  if (result.warnings.length === 0) {
    console.log('[Config] Environment validation passed');
  }
}
