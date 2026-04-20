/**
 * TYPES & INTERFACES
 * Consistently used across the AI system
 */
export type PatternType = 'HAMMER' | 'FALLING_STAR' | 'BULLISH_ENGULFING' | 'BEARISH_ENGULFING' | 'DOJI' | 'NONE';
export type MarketPhase = 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'MARKDOWN' | 'CONSOLIDATION';

export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
  vol?: number; // Volume is critical for M5 validation
}

interface CandleMetrics {
  body: number;
  upperWick: number;
  lowerWick: number;
  range: number;
  bodyPercent: number;
}

/**
 * HELPER: Basic Candle Math
 */
function calculateCandleMetrics(candle: OHLC): CandleMetrics {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const bodyPercent = range > 0 ? (body / range) * 100 : 0;

  return { body, upperWick, lowerWick, range, bodyPercent };
}

/**
 * PATTERN DETECTORS (Optimized for M5)
 */
export function isHammer(candle: OHLC): boolean {
  const m = calculateCandleMetrics(candle);
  const isBullish = candle.close > candle.open;
  // M5 Requirement: Lower wick must be 2.5x body to show strong rejection
  return isBullish && m.body > 0 && m.lowerWick >= m.body * 2.5 && m.upperWick <= m.body * 0.5;
}

export function isFallingStar(candle: OHLC): boolean {
  const m = calculateCandleMetrics(candle);
  const isBearish = candle.close < candle.open;
  return isBearish && m.body > 0 && m.upperWick >= m.body * 2.5 && m.lowerWick <= m.body * 0.5;
}

export function isBullishEngulfing(curr: OHLC, prev: OHLC): boolean {
  const isBullish = curr.close > curr.open;
  const isPrevBearish = prev.close < prev.open;
  const engulfs = curr.open <= prev.close && curr.close > prev.open;
  return isBullish && isPrevBearish && engulfs;
}

export function isBearishEngulfing(curr: OHLC, prev: OHLC): boolean {
  const isBearish = curr.close < curr.open;
  const isPrevBullish = prev.close > prev.open;
  const engulfs = curr.open >= prev.close && curr.close < prev.open;
  return isBearish && isPrevBullish && engulfs;
}

export function isDoji(candle: OHLC): boolean {
  const m = calculateCandleMetrics(candle);
  return m.bodyPercent < 10 && m.range > 0;
}

/**
 * MAIN PATTERN DETECTION ENGINE
 */
export function detectPattern(history: OHLC[]): PatternType {
  if (!history || history.length < 2) return 'NONE';
  const last = history[history.length - 1];
  const prev = history[history.length - 2];

  if (isHammer(last)) return 'HAMMER';
  if (isFallingStar(last)) return 'FALLING_STAR';
  if (isDoji(last)) return 'DOJI';
  if (isBullishEngulfing(last, prev)) return 'BULLISH_ENGULFING';
  if (isBearishEngulfing(last, prev)) return 'BEARISH_ENGULFING';

  return 'NONE';
}

/**
 * MARKET PHASE LOGIC
 * Helps the AI understand if we are in a 'Markup' (Buy) or 'Markdown' (Sell)
 */
export function determineMarketPhase(price: number, ema8: number, ema20: number, ema50: number): MarketPhase {
  const bullishStack = ema8 > ema20 && ema20 > ema50;
  const bearishStack = ema8 < ema20 && ema20 < ema50;

  if (bullishStack && price > ema8) return 'MARKUP';
  if (bearishStack && price < ema8) return 'MARKDOWN';
  if (price > ema50 && price < ema20) return 'DISTRIBUTION';
  if (price < ema50 && price > ema20) return 'ACCUMULATION';
  return 'CONSOLIDATION';
}

/**
 * VOLUME CONFIRMATION (M5 Specialty)
 * Prevents entries during low-liquidity 'Fake-outs'
 */
export function analyzeVolumeConfirmation(currentVol: number, history: OHLC[]): 'BUY' | 'SELL' | 'NEUTRAL' {
  if (!currentVol || history.length < 5) return 'NEUTRAL';
  
  const previousVolumes = history.slice(-6, -1).map(c => c.vol || 0);
  const avgVol = previousVolumes.reduce((a, b) => a + b, 0) / previousVolumes.length;

  // Signal is valid only if current volume is 20% higher than recent average
  return currentVol > avgVol * 1.2 ? 'BUY' : 'NEUTRAL';
}

/**
 * SUPPORT & RESISTANCE
 */
export function identifyLevels(history: OHLC[]): { support: number; resistance: number } {
  if (!history || history.length < 10) return { support: 0, resistance: 0 };
  const resistance = Math.max(...history.map(c => c.high));
  const support = Math.min(...history.map(c => c.low));
  return { support, resistance };
}

/**
 * CONSENSUS ANALYSIS
 * Merges all indicators into one confidence score
 */
export function performConsensusAnalysis(params: {
  price: number, ema8: number, ema20: number, ema50: number,
  rsi: number, vol: number, history: OHLC[]
}) {
  const pattern = detectPattern(params.history);
  const phase = determineMarketPhase(params.price, params.ema8, params.ema20, params.ema50);
  const volSignal = analyzeVolumeConfirmation(params.vol, params.history);

  // EMA Alignment
  let emaSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  if (params.price > params.ema8 && params.ema8 > params.ema20) emaSignal = 'BUY';
  if (params.price < params.ema8 && params.ema8 < params.ema20) emaSignal = 'SELL';

  return {
    pattern,
    phase,
    volSignal,
    emaSignal,
    isBullish: pattern === 'HAMMER' || pattern === 'BULLISH_ENGULFING',
    isBearish: pattern === 'FALLING_STAR' || pattern === 'BEARISH_ENGULFING'
  };
}