const BASE_URL = '/api';

interface ApiError {
  error: string;
  details?: unknown;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  return response.ok;
}

async function handleResponse<T>(response: Response, retryFetch?: () => Promise<Response>): Promise<T> {
  if (response.status === 401 && retryFetch) {
    // Token expired, try to refresh
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;
    if (refreshed) {
      // Retry the original request
      const retryResponse = await retryFetch();
      if (!retryResponse.ok) {
        const error: ApiError = await retryResponse.json();
        throw new Error(error.error || 'An error occurred');
      }
      return retryResponse.json();
    }

    // Refresh failed, redirect to login
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || 'An error occurred');
  }
  return response.json();
}

function fetchWithCredentials(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include',
  });
}

export const api = {
  // Source Accounts
  async getSourceAccounts() {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/sources`);
    const response = await doFetch();
    return handleResponse<SourceAccount[]>(response, doFetch);
  },

  async createSourceAccount(data: CreateSourceAccountRequest) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const response = await doFetch();
    return handleResponse<SourceAccount>(response, doFetch);
  },

  async deleteSourceAccount(id: string) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/sources/${id}`, {
      method: 'DELETE',
    });
    const response = await doFetch();
    return handleResponse<{ success: boolean }>(response, doFetch);
  },

  async updateSourceAccount(id: string, data: { alias?: string }) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const response = await doFetch();
    return handleResponse<{ success: boolean }>(response, doFetch);
  },

  // Mirror Accounts
  async getMirrorAccounts(sourceId: string) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/sources/${sourceId}/mirrors`);
    const response = await doFetch();
    return handleResponse<MirrorAccount[]>(response, doFetch);
  },

  async createMirrorAccount(sourceId: string, data: CreateMirrorAccountRequest) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/sources/${sourceId}/mirrors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const response = await doFetch();
    return handleResponse<MirrorAccount>(response, doFetch);
  },

  async deleteMirrorAccount(id: string) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/mirrors/${id}`, {
      method: 'DELETE',
    });
    const response = await doFetch();
    return handleResponse<{ success: boolean }>(response, doFetch);
  },

  async toggleMirrorAccount(id: string) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/mirrors/${id}/toggle`, {
      method: 'POST',
    });
    const response = await doFetch();
    return handleResponse<{ success: boolean; isActive: boolean }>(response, doFetch);
  },

  async pauseAllMirrors(sourceId: string) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/sources/${sourceId}/mirrors/pause-all`, {
      method: 'POST',
    });
    const response = await doFetch();
    return handleResponse<{ success: boolean; updatedCount: number }>(response, doFetch);
  },

  async resumeAllMirrors(sourceId: string) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/sources/${sourceId}/mirrors/resume-all`, {
      method: 'POST',
    });
    const response = await doFetch();
    return handleResponse<{ success: boolean; updatedCount: number }>(response, doFetch);
  },

  async updateMirrorAccount(id: string, data: { scalingMode?: ScalingMode; scaleFactor?: number; alias?: string }) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/mirrors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const response = await doFetch();
    return handleResponse<{ success: boolean }>(response, doFetch);
  },

  async validateCredentials(data: ValidateCredentialsRequest) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const response = await doFetch();
    return handleResponse<{ valid: boolean; error?: string }>(response, doFetch);
  },

  // Trades
  async getTrades(sourceId: string, params: GetTradesParams = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.instrument) searchParams.set('instrument', params.instrument);
    if (params.side) searchParams.set('side', params.side);
    if (params.status) searchParams.set('status', params.status);
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) searchParams.set('dateTo', params.dateTo);

    const doFetch = () => fetchWithCredentials(`${BASE_URL}/trades/${sourceId}?${searchParams}`);
    const response = await doFetch();
    return handleResponse<Trade[]>(response, doFetch);
  },

  async getTradeDetails(sourceId: string, txnId: string) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/trades/${sourceId}/${txnId}`);
    const response = await doFetch();
    return handleResponse<Trade>(response, doFetch);
  },

  async getSyncStatus(sourceId: string) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/trades/${sourceId}/sync-status`);
    const response = await doFetch();
    return handleResponse<SyncStatus>(response, doFetch);
  },

  async retryMirrorExecution(tradeId: string, mirrorAccountId: string) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/trades/${tradeId}/retry/${mirrorAccountId}`, {
      method: 'POST',
    });
    const response = await doFetch();
    return handleResponse<{ success: boolean; executedUnits?: number; oandaTransactionId?: string; error?: string }>(response, doFetch);
  },

  async placeTrade(sourceId: string, data: PlaceTradeRequest) {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/trades/${sourceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const response = await doFetch();
    return handleResponse<PlaceTradeResponse>(response, doFetch);
  },

  // Logs
  async getLogs(params: GetLogsParams = {}) {
    const searchParams = new URLSearchParams();
    if (params.level) searchParams.set('level', params.level);
    if (params.category) searchParams.set('category', params.category);
    if (params.sourceAccountId) searchParams.set('sourceAccountId', params.sourceAccountId);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));

    const doFetch = () => fetchWithCredentials(`${BASE_URL}/logs?${searchParams}`);
    const response = await doFetch();
    return handleResponse<LogsResponse>(response, doFetch);
  },

  // Health
  async getHealth() {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/health`);
    const response = await doFetch();
    return handleResponse<{ status: string; timestamp: string }>(response, doFetch);
  },

  // Stream status
  async getStreamStatus() {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/streams/status`);
    const response = await doFetch();
    return handleResponse<StreamStatusResponse>(response, doFetch);
  },

  // Balances
  async getBalances() {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/balances`);
    const response = await doFetch();
    return handleResponse<BalancesResponse>(response, doFetch);
  },

  // Positions
  async getPositions() {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/positions`);
    const response = await doFetch();
    return handleResponse<PositionsResponse>(response, doFetch);
  },

  // Stats
  async getStats() {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/accounts/stats`);
    const response = await doFetch();
    return handleResponse<StatsResponse>(response, doFetch);
  },

  // Users (admin only)
  async getUsers() {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/users`);
    const response = await doFetch();
    return handleResponse<UserAccount[]>(response, doFetch);
  },

  async inviteUser(data: InviteUserRequest) {
    const doFetch = () =>
      fetchWithCredentials(`${BASE_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    const response = await doFetch();
    return handleResponse<UserAccount>(response, doFetch);
  },

  async resendInvite(id: string) {
    const doFetch = () =>
      fetchWithCredentials(`${BASE_URL}/users/${id}/resend-invite`, {
        method: "POST",
      });
    const response = await doFetch();
    return handleResponse<{ success: boolean }>(response, doFetch);
  },

  async updateUser(id: string, data: UpdateUserRequest) {
    const doFetch = () =>
      fetchWithCredentials(`${BASE_URL}/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    const response = await doFetch();
    return handleResponse<UserAccount>(response, doFetch);
  },

  async deleteUser(id: string) {
    const doFetch = () =>
      fetchWithCredentials(`${BASE_URL}/users/${id}`, {
        method: "DELETE",
      });
    const response = await doFetch();
    return handleResponse<{ success: boolean }>(response, doFetch);
  },

  // Auth - public endpoints for registration
  async verifyInvite(token: string) {
    const response = await fetch(`${BASE_URL}/auth/verify-invite/${token}`);
    return handleResponse<VerifyInviteResponse>(response);
  },

  async completeRegistration(data: CompleteRegistrationRequest) {
    const response = await fetch(`${BASE_URL}/auth/complete-registration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    return handleResponse<{ user: { id: string; username: string; email: string; role: string } }>(response);
  },

  async updateProfile(data: { username: string }) {
    const doFetch = () =>
      fetchWithCredentials(`${BASE_URL}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    const response = await doFetch();
    return handleResponse<{ user: { id: string; username: string; email: string; role: string; lastLoginAt: string | null; avatarUrl: string | null; authProvider: string } }>(response, doFetch);
  },

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const doFetch = () =>
      fetchWithCredentials(`${BASE_URL}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    const response = await doFetch();
    return handleResponse<{ success: boolean }>(response, doFetch);
  },

  async setPassword(data: { newPassword: string }) {
    const doFetch = () =>
      fetchWithCredentials(`${BASE_URL}/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    const response = await doFetch();
    return handleResponse<{ success: boolean; hasPassword: boolean }>(response, doFetch);
  },

  async forgotPassword(email: string) {
    const response = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async verifyResetToken(token: string) {
    const response = await fetch(`${BASE_URL}/auth/verify-reset/${token}`);
    return handleResponse<{ valid: boolean; email: string }>(response);
  },

  async resetPassword(data: { token: string; password: string }) {
    const response = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean }>(response);
  },

  // API Keys
  async getApiKeys() {
    const doFetch = () => fetchWithCredentials(`${BASE_URL}/api-keys`);
    const response = await doFetch();
    return handleResponse<ApiKeyInfo[]>(response, doFetch);
  },

  async createApiKey(data: CreateApiKeyRequest) {
    const doFetch = () =>
      fetchWithCredentials(`${BASE_URL}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    const response = await doFetch();
    return handleResponse<ApiKeyWithSecret>(response, doFetch);
  },

  async updateApiKey(id: string, data: { name: string }) {
    const doFetch = () =>
      fetchWithCredentials(`${BASE_URL}/api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    const response = await doFetch();
    return handleResponse<ApiKeyInfo>(response, doFetch);
  },

  async deleteApiKey(id: string) {
    const doFetch = () =>
      fetchWithCredentials(`${BASE_URL}/api-keys/${id}`, {
        method: "DELETE",
      });
    const response = await doFetch();
    return handleResponse<{ success: boolean }>(response, doFetch);
  },
};

// Types
export interface SourceAccount {
  _id: string;
  oandaAccountId: string;
  environment: 'practice' | 'live';
  alias: string | null;
  isActive: boolean;
  lastTransactionId: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ScalingMode = 'dynamic' | 'static';

export interface MirrorAccount {
  _id: string;
  sourceAccountId: string;
  oandaAccountId: string;
  environment: 'practice' | 'live';
  alias: string | null;
  scalingMode: ScalingMode;
  scaleFactor: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MirrorExecution {
  mirrorAccountId: string;
  oandaAccountId: string;
  status: 'pending' | 'success' | 'failed';
  executedUnits: number | null;
  oandaTransactionId: string | null;
  errorMessage: string | null;
  executedAt: string;
}

export interface Trade {
  _id: string;
  sourceAccountId: string;
  sourceTransactionId: string;
  instrument: string;
  units: number;
  side: 'buy' | 'sell';
  price: number;
  mirrorExecutions: MirrorExecution[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionLog {
  _id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'trade' | 'account' | 'system' | 'api';
  action: string;
  sourceAccountId?: string;
  mirrorAccountId?: string;
  transactionId?: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface CreateSourceAccountRequest {
  oandaAccountId: string;
  apiToken: string;
  environment: 'practice' | 'live';
  alias?: string;
}

export interface CreateMirrorAccountRequest {
  oandaAccountId: string;
  apiToken: string;
  environment: 'practice' | 'live';
  scalingMode?: ScalingMode;
  scaleFactor?: number;
  alias?: string;
}

export interface ValidateCredentialsRequest {
  oandaAccountId: string;
  apiToken: string;
  environment: 'practice' | 'live';
}

export interface PlaceTradeRequest {
  instrument: string;
  units: number;
  side: 'buy' | 'sell';
  tp?: number;
  sl?: number;
}

export interface PlaceTradeResponse {
  success: boolean;
  orderFillTransaction?: {
    id: string;
    instrument: string;
    units: string;
    price: string;
  };
  relatedTransactionIDs?: string[];
}

export interface GetTradesParams {
  limit?: number;
  instrument?: string;
  side?: 'buy' | 'sell';
  status?: 'pending' | 'success' | 'failed';
  dateFrom?: string;
  dateTo?: string;
}

export interface GetLogsParams {
  level?: 'info' | 'warn' | 'error' | 'debug';
  category?: 'trade' | 'account' | 'system' | 'api';
  sourceAccountId?: string;
  limit?: number;
  offset?: number;
}

export interface LogsResponse {
  logs: ExecutionLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface AccountBalance {
  accountId: string;
  sourceAccountId?: string;
  oandaAccountId: string;
  alias: string | null;
  environment: 'practice' | 'live';
  balance?: string;
  unrealizedPL?: string;
  nav?: string;
  currency?: string;
  openPositionCount?: number;
  openTradeCount?: number;
  error?: string;
}

export interface BalancesResponse {
  sources: AccountBalance[];
  mirrors: AccountBalance[];
}

export interface PositionSide {
  units: string;
  averagePrice: string;
  pl: string;
  unrealizedPL: string;
}

export interface Position {
  instrument: string;
  long: PositionSide | null;
  short: PositionSide | null;
  unrealizedPL: string;
}

export interface AccountPositions {
  accountId: string;
  sourceAccountId?: string;
  oandaAccountId: string;
  alias: string | null;
  environment: 'practice' | 'live';
  accountType: 'source' | 'mirror';
  positions: Position[];
  error?: string;
}

export interface PositionsResponse {
  sources: AccountPositions[];
  mirrors: AccountPositions[];
}

export interface AccountStats {
  totalRealizedPL: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
  tradesToday: number;
  mirrorSuccessCount: number;
  mirrorFailedCount: number;
  mirrorSuccessRate: number;
}

export interface AccountStatsData {
  accountId: string;
  oandaAccountId: string;
  alias: string | null;
  environment: 'practice' | 'live';
  stats?: AccountStats;
  error?: string;
}

export interface StatsResponse {
  accounts: AccountStatsData[];
}

export interface MirrorSyncStatus {
  mirrorAccountId: string;
  oandaAccountId: string;
  pendingCount: number;
  failedCount: number;
  successCount: number;
  lastSuccessAt: string | null;
}

export interface SyncStatus {
  totalTrades: number;
  pendingCount: number;
  failedCount: number;
  lastTradeAt: string | null;
  mirrorStatus: MirrorSyncStatus[];
}

export interface StreamInfo {
  accountId: string;
  oandaAccountId: string;
  status: 'connecting' | 'connected' | 'reconnecting' | 'fallback' | 'stopped';
}

export interface StreamStatusResponse {
  overallStatus: 'connected' | 'degraded' | 'disconnected';
  streamCount: number;
  streams: StreamInfo[];
}

// User types
export interface UserAccount {
  _id: string;
  username: string | null;
  email: string;
  role: "admin" | "viewer";
  isActive: boolean;
  registrationStatus: "pending" | "active";
  lastLoginAt: string | null;
  authProvider: "local" | "google";
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteUserRequest {
  email: string;
  role?: "admin" | "viewer";
}

export interface UpdateUserRequest {
  role?: "admin" | "viewer";
  isActive?: boolean;
}

export interface VerifyInviteResponse {
  email: string;
  role: string;
}

export interface CompleteRegistrationRequest {
  token: string;
  username: string;
  password: string;
}

// API Key types
export interface ApiKeyInfo {
  _id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyWithSecret extends ApiKeyInfo {
  key: string; // Only returned on creation
}

export interface CreateApiKeyRequest {
  name: string;
  expiresInDays?: number;
}