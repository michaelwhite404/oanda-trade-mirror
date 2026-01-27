const BASE_URL = '/api';

interface ApiError {
  error: string;
  details?: unknown;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || 'An error occurred');
  }
  return response.json();
}

export const api = {
  // Source Accounts
  async getSourceAccounts() {
    const response = await fetch(`${BASE_URL}/accounts/sources`);
    return handleResponse<SourceAccount[]>(response);
  },

  async createSourceAccount(data: CreateSourceAccountRequest) {
    const response = await fetch(`${BASE_URL}/accounts/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<SourceAccount>(response);
  },

  async deleteSourceAccount(id: string) {
    const response = await fetch(`${BASE_URL}/accounts/sources/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async updateSourceAccount(id: string, data: { alias?: string }) {
    const response = await fetch(`${BASE_URL}/accounts/sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean }>(response);
  },

  // Mirror Accounts
  async getMirrorAccounts(sourceId: string) {
    const response = await fetch(`${BASE_URL}/accounts/sources/${sourceId}/mirrors`);
    return handleResponse<MirrorAccount[]>(response);
  },

  async createMirrorAccount(sourceId: string, data: CreateMirrorAccountRequest) {
    const response = await fetch(`${BASE_URL}/accounts/sources/${sourceId}/mirrors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<MirrorAccount>(response);
  },

  async deleteMirrorAccount(id: string) {
    const response = await fetch(`${BASE_URL}/accounts/mirrors/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async toggleMirrorAccount(id: string) {
    const response = await fetch(`${BASE_URL}/accounts/mirrors/${id}/toggle`, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean; isActive: boolean }>(response);
  },

  async updateMirrorAccount(id: string, data: { scalingMode?: ScalingMode; scaleFactor?: number; alias?: string }) {
    const response = await fetch(`${BASE_URL}/accounts/mirrors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async validateCredentials(data: ValidateCredentialsRequest) {
    const response = await fetch(`${BASE_URL}/accounts/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ valid: boolean; error?: string }>(response);
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

    const response = await fetch(`${BASE_URL}/trades/${sourceId}?${searchParams}`);
    return handleResponse<Trade[]>(response);
  },

  async getTradeDetails(sourceId: string, txnId: string) {
    const response = await fetch(`${BASE_URL}/trades/${sourceId}/${txnId}`);
    return handleResponse<Trade>(response);
  },

  async getSyncStatus(sourceId: string) {
    const response = await fetch(`${BASE_URL}/trades/${sourceId}/sync-status`);
    return handleResponse<SyncStatus>(response);
  },

  async placeTrade(sourceId: string, data: PlaceTradeRequest) {
    const response = await fetch(`${BASE_URL}/trades/${sourceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<PlaceTradeResponse>(response);
  },

  // Logs
  async getLogs(params: GetLogsParams = {}) {
    const searchParams = new URLSearchParams();
    if (params.level) searchParams.set('level', params.level);
    if (params.category) searchParams.set('category', params.category);
    if (params.sourceAccountId) searchParams.set('sourceAccountId', params.sourceAccountId);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));

    const response = await fetch(`${BASE_URL}/logs?${searchParams}`);
    return handleResponse<LogsResponse>(response);
  },

  // Health
  async getHealth() {
    const response = await fetch(`${BASE_URL}/health`);
    return handleResponse<{ status: string; timestamp: string }>(response);
  },

  // Balances
  async getBalances() {
    const response = await fetch(`${BASE_URL}/accounts/balances`);
    return handleResponse<BalancesResponse>(response);
  },

  // Positions
  async getPositions() {
    const response = await fetch(`${BASE_URL}/accounts/positions`);
    return handleResponse<PositionsResponse>(response);
  },

  // Stats
  async getStats() {
    const response = await fetch(`${BASE_URL}/accounts/stats`);
    return handleResponse<StatsResponse>(response);
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
