export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number; // Add volume to OHLC
}

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
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
  };
  rsi?: {
    rsi7: number;
    rsi14: number;
  };
  atr?: number;
  volume?: number;
  sl?: number;
  tp?: number;
  history?: OHLC[]; // Last 4 candles OHLC data
  averageAtr?: number; // Average ATR for volatility comparison
}

export type SignalType = 'BUY' | 'SELL' | 'NEUTRAL';

export type PatternType = 'HAMMER' | 'BULLISH_ENGULFING' | 'FALLING_STAR' | 'BEARISH_ENGULFING' | 'DOJI' | 'NONE';

export type MarketPhase = 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'MARKDOWN';

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
  sl?: number;
  tp?: number;
  atr?: number;
  volatility?: 'LOW' | 'MEDIUM' | 'HIGH';
  patternDetected?: PatternType;  // New: detected candle pattern
  marketPhase?: MarketPhase;      // New: current market phase
  volatilityAlert?: string;       // New: alert message if volatility is abnormal
  technicalReasoning?: string;    // New: detailed reasoning for SELL signals
}

export interface RiskMetrics {
  accountBalance: number;
  maxRiskPerTrade: number;
  currentExposure: number;
  riskPercentage: number;
  recommendedLotSize: number;
}

export interface MarketCard {
  id: string;
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
  signal?: ForexSignal;
  isLoading: boolean;
  lastUpdated: Date;
}
