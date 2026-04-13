import type { OHLC, PatternType, MarketPhase } from './types';

/**
 * Detects candle patterns using Dow-Homma method for Forex trading
 * Patterns: Hammer, Bullish Engulfing, Falling Star, Bearish Engulfing, Doji
 */

interface CandleMetrics {
  body: number;
  upperWick: number;
  lowerWick: number;
  range: number;
  bodyPercent: number;
}

function calculateCandleMetrics(candle: OHLC): CandleMetrics {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const bodyPercent = range > 0 ? (body / range) * 100 : 0;

  return { body, upperWick, lowerWick, range, bodyPercent };
}

/**
 * Detects Hammer (Tonkachi) pattern - Bullish
 * Characteristics: Small body at top, long lower wick (2x+ body), small upper wick
 */
export function isHammer(candle: OHLC): boolean {
  const metrics = calculateCandleMetrics(candle);
  const isBullish = candle.close > candle.open;

  // Small body, long lower wick at least 2x the body, minimal upper wick
  return (
    isBullish &&
    metrics.body > 0 &&
    metrics.lowerWick >= metrics.body * 2 &&
    metrics.upperWick <= metrics.body * 0.5 &&
    metrics.range > 0
  );
}

/**
 * Detects Bullish Engulfing (Sutsumi) pattern
 * Current candle's body must completely engulf the previous candle's body
 */
export function isBullishEngulfing(current: OHLC, previous: OHLC): boolean {
  const currentMetrics = calculateCandleMetrics(current);
  const previousMetrics = calculateCandleMetrics(previous);

  const isBullish = current.close > current.open;
  const isPreviousBearish = previous.close < previous.open;

  // Current open must be lower than previous close, current close must be higher than previous open
  const engulfsPrevious =
    current.open < previous.close &&
    current.close > previous.open;

  return (
    isBullish &&
    isPreviousBearish &&
    engulfsPrevious &&
    currentMetrics.body > previousMetrics.body
  );
}

/**
 * Detects Falling Star (Nagareboshi) pattern - Bearish
 * Characteristics: Small body at bottom, long upper wick (2x+ body), small lower wick
 */
export function isFallingStar(candle: OHLC): boolean {
  const metrics = calculateCandleMetrics(candle);
  const isBearish = candle.close < candle.open;

  // Small body, long upper wick at least 2x the body, minimal lower wick
  return (
    isBearish &&
    metrics.body > 0 &&
    metrics.upperWick >= metrics.body * 2 &&
    metrics.lowerWick <= metrics.body * 0.5 &&
    metrics.range > 0
  );
}

/**
 * Detects Bearish Engulfing (Sutsumi) pattern
 * Current candle's body must completely engulf the previous candle's body
 */
export function isBearishEngulfing(current: OHLC, previous: OHLC): boolean {
  const currentMetrics = calculateCandleMetrics(current);
  const previousMetrics = calculateCandleMetrics(previous);

  const isBearish = current.close < current.open;
  const isPreviousBullish = previous.close > previous.open;

  // Current open must be higher than previous close, current close must be lower than previous open
  const engulfsPrevious =
    current.open > previous.close &&
    current.close < previous.open;

  return (
    isBearish &&
    isPreviousBullish &&
    engulfsPrevious &&
    currentMetrics.body > previousMetrics.body
  );
}

/**
 * Detects Doji pattern - Sign of exhaustion (neutral)
 * Characteristics: Very small body with roughly equal upper and lower wicks
 */
export function isDoji(candle: OHLC): boolean {
  const metrics = calculateCandleMetrics(candle);

  // Body should be less than 5% of the range (very small)
  const isSmallBody = metrics.bodyPercent < 5;

  // Wicks should be roughly balanced (within 30% difference)
  const wickDifference = Math.abs(metrics.upperWick - metrics.lowerWick);
  const maxWick = Math.max(metrics.upperWick, metrics.lowerWick);
  const isBalanced = maxWick > 0 && (wickDifference / maxWick) < 0.3;

  return isSmallBody && isBalanced && metrics.range > 0;
}

/**
 * Main pattern detection function
 * Returns the pattern detected in the last candle (most recent)
 */
export function detectPattern(history: OHLC[]): PatternType {
  if (!history || history.length === 0) return 'NONE';

  const lastCandle = history[history.length - 1];

  // Check single-candle patterns first
  if (isHammer(lastCandle)) return 'HAMMER';
  if (isFallingStar(lastCandle)) return 'FALLING_STAR';
  if (isDoji(lastCandle)) return 'DOJI';

  // Check multi-candle patterns (need at least 2 candles)
  if (history.length >= 2) {
    const previousCandle = history[history.length - 2];
    if (isBullishEngulfing(lastCandle, previousCandle))
      return 'BULLISH_ENGULFING';
    if (isBearishEngulfing(lastCandle, previousCandle))
      return 'BEARISH_ENGULFING';
  }

  return 'NONE';
}

/**
 * Determines if a pattern is bullish
 */
export function isBullishPattern(pattern: PatternType): boolean {
  return pattern === 'HAMMER' || pattern === 'BULLISH_ENGULFING';
}

/**
 * Determines if a pattern is bearish
 */
export function isBearishPattern(pattern: PatternType): boolean {
  return pattern === 'FALLING_STAR' || pattern === 'BEARISH_ENGULFING';
}

/**
 * Consensus-Based Indicator Analysis
 * Evaluates 6 indicators for BUY/SELL consensus
 */
export interface ConsensusResult {
  buyIndicators: number;
  sellIndicators: number;
  totalIndicators: number;
  confluenceScore: number; // percentage of indicators agreeing
  highConfidence: boolean; // true if 4+ indicators agree
  agreeingDirection: 'BUY' | 'SELL' | 'NEUTRAL';
  indicatorDetails: {
    emaAlignment: 'BUY' | 'SELL' | 'NEUTRAL';
    macdSignal: 'BUY' | 'SELL' | 'NEUTRAL';
    patternSignal: 'BUY' | 'SELL' | 'NEUTRAL';
    bollingerBands: 'BUY' | 'SELL' | 'NEUTRAL';
    rsiDivergence: 'BUY' | 'SELL' | 'NEUTRAL';
    volumeConfirmation: 'BUY' | 'SELL' | 'NEUTRAL';
  };
}

/**
 * Performs consensus analysis across all 6 indicators
 */
export function performConsensusAnalysis(params: {
  price: number;
  ema8: number;
  ema20: number;
  ema50: number;
  macdHistogram: number;
  pattern: PatternType;
  bollingerBands?: { upper: number; middle: number; lower: number };
  rsi?: { rsi7: number; rsi14: number };
  volume?: number;
  history?: OHLC[];
}): ConsensusResult {
  const {
    price,
    ema8,
    ema20,
    ema50,
    macdHistogram,
    pattern,
    bollingerBands,
    rsi,
    volume,
    history = []
  } = params;

  const indicatorDetails = {
    emaAlignment: analyzeEMAAlignment(price, ema8, ema20, ema50),
    macdSignal: analyzeMACDSignal(macdHistogram),
    patternSignal: analyzePatternSignal(pattern),
    bollingerBands: analyzeBollingerBands(price, bollingerBands),
    rsiDivergence: analyzeRSIDivergence(rsi, history),
    volumeConfirmation: analyzeVolumeConfirmation(volume, history)
  };

  // Count agreements
  const buyCount = Object.values(indicatorDetails).filter(signal => signal === 'BUY').length;
  const sellCount = Object.values(indicatorDetails).filter(signal => signal === 'SELL').length;

  let agreeingDirection: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let confluenceScore = 0;

  if (buyCount > sellCount) {
    agreeingDirection = 'BUY';
    confluenceScore = (buyCount / 6) * 100;
  } else if (sellCount > buyCount) {
    agreeingDirection = 'SELL';
    confluenceScore = (sellCount / 6) * 100;
  }

  const highConfidence = Math.max(buyCount, sellCount) >= 4;

  return {
    buyIndicators: buyCount,
    sellIndicators: sellCount,
    totalIndicators: 6,
    confluenceScore: Math.round(confluenceScore),
    highConfidence,
    agreeingDirection,
    indicatorDetails
  };
}

/**
 * Analyzes EMA alignment for trend direction
 */
function analyzeEMAAlignment(price: number, ema8: number, ema20: number, ema50: number): 'BUY' | 'SELL' | 'NEUTRAL' {
  // Bullish: price > ema8 > ema20 > ema50
  const bullish = price > ema8 && ema8 > ema20 && ema20 > ema50;
  // Bearish: price < ema8 < ema20 < ema50
  const bearish = price < ema8 && ema8 < ema20 && ema20 < ema50;

  if (bullish) return 'BUY';
  if (bearish) return 'SELL';
  return 'NEUTRAL';
}

/**
 * Analyzes MACD histogram for momentum
 */
function analyzeMACDSignal(histogram: number): 'BUY' | 'SELL' | 'NEUTRAL' {
  if (histogram > 0.0001) return 'BUY'; // Positive momentum
  if (histogram < -0.0001) return 'SELL'; // Negative momentum
  return 'NEUTRAL';
}

/**
 * Analyzes Dow-Homma pattern for direction
 */
function analyzePatternSignal(pattern: PatternType): 'BUY' | 'SELL' | 'NEUTRAL' {
  if (isBullishPattern(pattern)) return 'BUY';
  if (isBearishPattern(pattern)) return 'SELL';
  return 'NEUTRAL';
}

/**
 * Analyzes Bollinger Bands for overextension (volatility)
 */
function analyzeBollingerBands(price: number, bands?: { upper: number; middle: number; lower: number }): 'BUY' | 'SELL' | 'NEUTRAL' {
  if (!bands) return 'NEUTRAL';

  const { upper, lower } = bands;

  // Price below lower band = oversold (potential BUY)
  if (price < lower) return 'BUY';
  // Price above upper band = overbought (potential SELL)
  if (price > upper) return 'SELL';

  return 'NEUTRAL';
}

/**
 * Analyzes RSI for divergence signals
 */
function analyzeRSIDivergence(rsi?: { rsi7: number; rsi14: number }, history?: OHLC[]): 'BUY' | 'SELL' | 'NEUTRAL' {
  if (!rsi || !history || history.length < 3) return 'NEUTRAL';

  const { rsi7, rsi14 } = rsi;

  // Simple divergence check: RSI7 and RSI14 both oversold (<30) = potential BUY
  if (rsi7 < 30 && rsi14 < 30) return 'BUY';
  // Both overbought (>70) = potential SELL
  if (rsi7 > 70 && rsi14 > 70) return 'SELL';

  return 'NEUTRAL';
}

/**
 * Analyzes volume for confirmation
 */
function analyzeVolumeConfirmation(currentVolume?: number, history?: OHLC[]): 'BUY' | 'SELL' | 'NEUTRAL' {
  if (!currentVolume || !history || history.length < 2) return 'NEUTRAL';

  // Calculate average volume of previous candles
  const previousVolumes = history.slice(0, -1).map(c => c.volume || 0).filter(v => v > 0);
  if (previousVolumes.length === 0) return 'NEUTRAL';

  const avgVolume = previousVolumes.reduce((sum, vol) => sum + vol, 0) / previousVolumes.length;

  // Volume increasing (above average) = confirmation
  if (currentVolume > avgVolume * 1.2) return 'BUY'; // Simplified - in real trading this would depend on direction

  return 'NEUTRAL';
}

/**
 * Determines market phase based on EMA alignment and price action
 * Accumulation: Price below 50/20 EMA, consolidating
 * Markup: Price above all EMAs in bullish order (8>20>50)
 * Distribution: Price above 50 EMA but below 20, showing weakness
 * Markdown: Price below all EMAs in bearish order (8<20<50)
 */
export function determineMarketPhase(
  price: number,
  ema8: number,
  ema20: number,
  ema50: number
): MarketPhase {
  // Bullish alignment: 8 > 20 > 50
  const bullishAlign = ema8 > ema20 && ema20 > ema50;
  // Bearish alignment: 8 < 20 < 50
  const bearishAlign = ema8 < ema20 && ema20 < ema50;
  
  const priceAbove50 = price > ema50;
  const priceBetween20And50 = price > ema20 && price < ema50;
  const priceAbove20 = price > ema20;
  const priceBelow50 = price < ema50;
  
  // MARKUP: Strong bullish trend, price above all EMAs
  if (bullishAlign && price > ema8 && price > ema20 && price > ema50) {
    return 'MARKUP';
  }
  
  // MARKDOWN: Strong bearish trend, price below all EMAs
  if (bearishAlign && price < ema8 && price < ema20 && price < ema50) {
    return 'MARKDOWN';
  }
  
  // DISTRIBUTION: Price retreating from highs, between 20 and 50 EMAs
  if (priceBetween20And50 && !bullishAlign) {
    return 'DISTRIBUTION';
  }
  
  // ACCUMULATION: Price consolidating below 20 EMA
  if (priceBelow50 && price < ema20) {
    return 'ACCUMULATION';
  }
  
  // Default to the stronger trend signal
  return bullishAlign ? 'MARKUP' : 'MARKDOWN';
}

/**
 * Calculates volatility alerts
 * Returns alert message if volatility is abnormally high
 */
export function calculateVolatilityAlert(
  history: OHLC[],
  currentAtr: number,
  averageAtr: number,
  price: number
): { alert: string; isHigh: boolean; slMultiplier: number } {
  if (!history || history.length === 0) {
    return { alert: '', isHigh: false, slMultiplier: 1 };
  }
  
  const currentCandle = history[history.length - 1];
  const currentRange = currentCandle.high - currentCandle.low;
  
  // Calculate average range of previous 4 candles
  let sumRange = 0;
  for (const candle of history) {
    sumRange += candle.high - candle.low;
  }
  const avgRange = sumRange / history.length;
  
  // Check if current ATR is 2x higher than average
  const atrAlert = currentAtr > averageAtr * 2;
  
  // Check if current candle range is 3x larger than average of previous candles
  const rangeAlert = currentRange > avgRange * 3;
  
  let alert = '';
  let slMultiplier = 1;
  let isHigh = false;
  
  if (atrAlert) {
    alert = 'ℹ️ Wait for Stabilization - ATR spike detected';
    isHigh = true;
    slMultiplier = 1.5;
  }
  
  if (rangeAlert) {
    alert = '⚠️ VOLATILE: High Risk - Current candle range 3x larger than average';
    isHigh = true;
    slMultiplier = 2; // Increase SL distance to avoid being stopped by noise
  }
  
  if (atrAlert && rangeAlert) {
    alert = '⚠️ EXTREME VOLATILITY: High Risk - Wait for market stabilization';
    isHigh = true;
    slMultiplier = 2.5;
  }
  
  return { alert, isHigh, slMultiplier };
}

/**
 * Determines support/resistance levels from recent candles
 * Support: previous low becomes support
 * Resistance: previous high becomes resistance
 */
export function identifyLevels(
  history: OHLC[]
): { support: number; resistance: number } {
  if (!history || history.length < 2) {
    return { support: 0, resistance: 0 };
  }
  
  // Resistance is the highest high of previous candles
  let resistance = Math.max(...history.slice(0, -1).map(c => c.high));
  
  // Support is the lowest low of previous candles
  let support = Math.min(...history.slice(0, -1).map(c => c.low));
  
  return { support, resistance };
}

/**
 * Validates trade conditions per Dow-Homma method
 */
export function validateTradeConditions(params: {
  pattern: PatternType;
  price: number;
  support: number;
  resistance: number;
  macdHistogram: number;
  isBullish: boolean;
}): boolean {
  const { pattern, price, support, resistance, macdHistogram, isBullish } = params;
  
  if (pattern === 'NONE') return false;
  
  if (isBullish) {
    // BUY: Bullish pattern + at/near support + MACD histogram increasing
    const nearSupport = price <= support * 1.01; // Within 1% of support
    const macdBullish = macdHistogram > 0;
    return isBullishPattern(pattern) && nearSupport && macdBullish;
  } else {
    // SELL: Bearish pattern + at/near resistance + MACD histogram negative/decreasing
    const nearResistance = price >= resistance * 0.99; // Within 1% of resistance
    const macdBearish = macdHistogram < 0;
    return isBearishPattern(pattern) && nearResistance && macdBearish;
  }
}
