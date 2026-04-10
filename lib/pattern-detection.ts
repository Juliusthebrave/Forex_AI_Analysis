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
