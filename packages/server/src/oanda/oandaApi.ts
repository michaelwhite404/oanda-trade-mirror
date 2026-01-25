import axios from 'axios';
import { TradeInstruction } from '../types/models';
import { OandaEnvironment, getOandaBaseUrl } from '../types/oanda';

// Legacy constant for backwards compatibility
export const OANDA_BASE = 'https://api-fxpractice.oanda.com/v3';

export const getAccountTrades = async (
  accountId: string,
  token: string,
  environment: OandaEnvironment = 'practice'
) => {
  const baseUrl = getOandaBaseUrl(environment);
  const response = await axios.get(`${baseUrl}/accounts/${accountId}/trades`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const placeMarketOrder = async (
  accountId: string,
  token: string,
  instruction: TradeInstruction,
  environment: OandaEnvironment = 'practice'
) => {
  const baseUrl = getOandaBaseUrl(environment);
  const units = instruction.side === 'buy' ? instruction.units : -instruction.units;

  return axios.post(
    `${baseUrl}/accounts/${accountId}/orders`,
    {
      order: {
        instrument: instruction.instrument,
        units: String(units),
        type: instruction.type,
        positionFill: 'DEFAULT',
        takeProfitOnFill: instruction.tp ? { price: instruction.tp.toString() } : undefined,
        stopLossOnFill: instruction.sl ? { price: instruction.sl.toString() } : undefined,
      },
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

export const getAccountSummary = async (
  accountId: string,
  token: string,
  environment: OandaEnvironment = 'practice'
) => {
  const baseUrl = getOandaBaseUrl(environment);
  const response = await axios.get(`${baseUrl}/accounts/${accountId}/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getTransactionsSinceId = async (
  accountId: string,
  token: string,
  sinceId: string,
  environment: OandaEnvironment = 'practice'
) => {
  const baseUrl = getOandaBaseUrl(environment);
  const response = await axios.get(`${baseUrl}/accounts/${accountId}/transactions/sinceid`, {
    params: { id: sinceId },
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};
