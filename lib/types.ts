export interface ForexSignalRequest {
  symbol: string;
  price: number;
  ema8: number;
  ema20: number;
  ema50: number;
  macd: {
    line: number;
    signal: number;
    histogram: number;
  };
}

export type SignalType = 'BUY' | 'SELL' | 'NEUTRAL';

export interface ForexSignal {
  id: string;
  symbol: string;
  signal: SignalType;
  price: number;
  analysis: string;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: Date;
  telegramSent: boolean;
}

export interface RiskMetrics {
  accountBalance: number;
  maxRiskPerTrade: number;
  currentExposure: number;
  riskPercentage: number;
  recommendedLotSize: number;
}
