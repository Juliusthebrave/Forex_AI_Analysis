import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { sendTelegramSignal } from '@/lib/telegram';
import type { ForexSignalRequest, SignalType } from '@/lib/types';
import {
  detectPattern,
  determineMarketPhase,
  calculateVolatilityAlert,
  identifyLevels,
  validateTradeConditions,
  performConsensusAnalysis
} from '@/lib/pattern-detection';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// Enhanced system prompt for Consensus-Based Strategy with Trend Detection
const SYSTEM_PROMPT = `You are an expert Forex analyst using a Consensus-Based Strategy across multiple technical indicators.

Analyze the market data and provide a comprehensive signal based on indicator confluence. Pay special attention to:

1. RSI Divergence: Look for oversold (<30) or overbought (>70) conditions
2. Bollinger Band Squeezes: Price breaking out of upper/lower bands indicates momentum
3. Volume Analysis: Low volume reduces confidence - be more cautious with signals
4. Consensus Requirements: Only high-confidence signals when 4+ indicators agree
5. TREND DETECTION: If EMA alignment (8>20>50 or 8<20<50) OR MACD crosses zero line, give decisive BUY/SELL EVEN IF RSI is neutral. Trends override momentum.

CRITICAL: If trigger reason contains "Trend" or "MACD Cross", you MUST send BUY or SELL (never NEUTRAL). Strong trends are high-conviction setups.

Ignore any frontend/dashboard reporting. Output only valid JSON for the MT5 -> AI -> Telegram pipeline.

Respond with ONLY valid JSON (no markdown):
{
  "signal": "BUY"|"SELL"|"NEUTRAL",
  "confidence": 0-100,
  "riskLevel": "LOW"|"MEDIUM"|"HIGH",
  "marketPhase": "ACCUMULATION"|"MARKUP"|"DISTRIBUTION"|"MARKDOWN",
  "analysis": "Brief 2-3 sentence analysis mentioning trigger type and confirmation indicators",
  "reasoning": "VERY CONCISE: Just the key factors in 5 words max (e.g., 'EMA Aligned + MACD Cross')"
}`;

interface AnalysisResponse {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  marketPhase: string;
  analysis: string;
  reasoning: string;
}

export async function POST(req: Request) {
  console.log('[API] POST /api/analyze - START');

  try {
    // ========== STEP 1: PARSE REQUEST ==========
    const receivedData = await req.json();
    console.log('[API] Received data:', {
      symbol: receivedData.symbol,
      price: receivedData.price,
      ema8: receivedData.ema8,
      hasMACD: !!receivedData.macd,
      hasHistory: !!receivedData.history,
      triggerReason: receivedData.triggerReason,
    });

    const {
      symbol,
      price,
      ema8,
      ema20,
      ema50,
      macd,
      upperBB,
      lowerBB,
      rsi,
      vol,
      accountBalance = 27,
      history = [],
      atr,
      averageAtr,
      triggerReason = ''
    } = receivedData;

    // ========== STEP 2: VALIDATE ==========
    if (!symbol || typeof price !== 'number') {
      console.warn('[API] Missing required: symbol or price');
      return Response.json({ status: 'analyzing' });
    }

    // ========== STEP 3: INSTANT RESPONSE TO MT5 ==========
    // Return immediately to MT5 so it doesn't wait
    const instantResponse = Response.json({ status: 'analyzing' });

    // ========== STEP 4: HEADLESS BACKGROUND PROCESSING ==========
    // Process MT5 -> AI -> Telegram only; do not update any web dashboard
    void processAnalysisInBackground({
      symbol,
      price,
      ema8,
      ema20,
      ema50,
      macd,
      upperBB,
      lowerBB,
      rsi,
      vol,
      accountBalance,
      history,
      atr,
      averageAtr,
      triggerReason
    });

    console.log('[API] POST /api/analyze - INSTANT RESPONSE SENT');
    return instantResponse;

  } catch (outerError) {
    const errorMsg = outerError instanceof Error ? outerError.message : String(outerError);
    console.error('[API] ‼️ CRITICAL ERROR:', errorMsg);
    // Still return instant response even on error
    return Response.json({ status: 'analyzing' });
  }
}

// Background processing function
async function processAnalysisInBackground(data: {
  symbol: string;
  price: number;
  ema8: number;
  ema20: number;
  ema50: number;
  macd: any;
  upperBB?: number;
  lowerBB?: number;
  rsi?: number;
  vol?: number;
  accountBalance: number;
  history: any[];
  atr?: number;
  averageAtr?: number;
  triggerReason?: string;
}) {
  const { symbol, price, ema8, ema20, ema50, macd, upperBB, lowerBB, rsi, vol, accountBalance, history, atr, averageAtr, triggerReason = '' } = data;

  try {
    console.log('[BACKGROUND] Starting Consensus-Based analysis...');

    // ========== CONSENSUS-BASED ANALYSIS ==========
    const pattern = detectPattern(history);
    const marketPhase = determineMarketPhase(price, ema8, ema20, ema50);
    const volatility = calculateVolatilityAlert(history, atr || 0, averageAtr || 0, price);
    const levels = identifyLevels(history);

    // Perform consensus analysis across all 6 indicators
    const consensus = performConsensusAnalysis({
      price,
      ema8,
      ema20,
      ema50,
      macdHistogram: macd?.histogram || 0,
      pattern,
      upperBB,
      lowerBB,
      rsi,
      vol,
      history
    });

    console.log('[BACKGROUND] Consensus result:', {
      agreeingDirection: consensus.agreeingDirection,
      confluenceScore: consensus.confluenceScore,
      highConfidence: consensus.highConfidence,
      buyIndicators: consensus.buyIndicators,
      sellIndicators: consensus.sellIndicators
    });

    // Determine signal based on consensus
    let signalDirection: 'BUY' | 'SELL' | 'NEUTRAL' = consensus.agreeingDirection;

    // Only give signal if high confidence (4+ indicators agree) OR if it's a strong pattern
    if (!consensus.highConfidence && signalDirection !== 'NEUTRAL') {
      // Check if we have a strong Dow-Homma pattern as backup
      if (pattern === 'HAMMER' || pattern === 'BULLISH_ENGULFING' || pattern === 'FALLING_STAR' || pattern === 'BEARISH_ENGULFING') {
        console.log('[BACKGROUND] Using strong pattern as backup signal');
      } else {
        signalDirection = 'NEUTRAL';
        console.log('[BACKGROUND] Low confidence - neutralizing signal');
      }
    }

    // Validate trade conditions with contextual analysis
    const tradeValid = validateTradeConditions({
      pattern,
      price,
      support: levels.support,
      resistance: levels.resistance,
      macdHistogram: macd?.histogram || 0,
      isBullish: signalDirection === 'BUY'
    });

    // Adjust signal based on validation
    if (!tradeValid && signalDirection !== 'NEUTRAL') {
      signalDirection = 'NEUTRAL';
    }

    // ========== AI ENHANCED ANALYSIS ==========
    console.log('[BACKGROUND] Calling Groq for enhanced analysis...');
    let aiResponse: AnalysisResponse = {
      signal: signalDirection,
      confidence: consensus.highConfidence ? Math.min(95, consensus.confluenceScore + 20) : Math.max(20, consensus.confluenceScore - 10),
      riskLevel: volatility.isHigh ? 'HIGH' : consensus.highConfidence ? 'LOW' : 'MEDIUM',
      marketPhase,
      analysis: 'Market analysis in progress',
      reasoning: 'Technical analysis based on consensus indicators'
    };

    // Adjust confidence based on volume - low volume reduces confidence
    if (vol !== undefined && history.length > 0) {
      const avgVolume = history.reduce((sum, candle) => sum + (candle.volume || 0), 0) / history.length;
      if (vol < avgVolume * 0.7) {
        // Low volume - reduce confidence by 15-20 points
        aiResponse.confidence = Math.max(10, aiResponse.confidence - 20);
        console.log('[BACKGROUND] Low volume detected - reducing confidence');
      }
    }

    try {
      const userPrompt = `Consensus-Based Analysis for ${symbol}:
Price: ${price}
EMAs: 8=${ema8}, 20=${ema20}, 50=${ema50}
MACD Histogram: ${macd?.histogram ?? 'N/A'}
Pattern: ${pattern}
Bollinger Bands: ${upperBB && lowerBB ? `Upper=${upperBB}, Lower=${lowerBB}` : 'N/A'}
RSI: ${rsi ?? 'N/A'}
Volume: ${vol ?? 'N/A'}
Consensus: ${consensus.buyIndicators} BUY, ${consensus.sellIndicators} SELL indicators agree
Confluence Score: ${consensus.confluenceScore}%
High Confidence: ${consensus.highConfidence}
Market Phase: ${marketPhase}
Trigger Reason: ${triggerReason || 'Consensus analysis triggered'}

IMPORTANT:
- Analyze RSI for divergence (oversold <30, overbought >70)
- Check for Bollinger Band squeezes/breakouts
- If volume is low, reduce confidence and be more cautious
- Only give strong signals when multiple indicators align
- If trigger contains "Trend" or "MACD Cross", give definitive BUY/SELL even if RSI neutral

CRITICAL: Keep reasoning EXTREMELY CONCISE - maximum 5 words (e.g., 'EMA Aligned + MACD Cross')

Provide comprehensive analysis following consensus-based strategy principles.`;

      const result = await generateText({
        model: groq('llama3-8b-8192'),
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.3,
      });

      console.log('[BACKGROUND] Groq response received');

      // Parse AI response
      let cleanedText = result.text.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```(?:json)?\n?/g, '').trim();
      }
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.signal && parsed.confidence !== undefined) {
          aiResponse = {
            signal: parsed.signal as SignalType,
            confidence: Math.min(100, Math.max(0, parsed.confidence)),
            riskLevel: parsed.riskLevel || aiResponse.riskLevel,
            marketPhase: parsed.marketPhase || marketPhase,
            analysis: (parsed.analysis || '').substring(0, 200),
            reasoning: (parsed.reasoning || '').substring(0, 300)
          };
        }
      }
    } catch (aiError) {
      console.warn('[BACKGROUND] AI failed, using consensus-based analysis:', aiError instanceof Error ? aiError.message : String(aiError));
    }

    // ========== SEND PROFESSIONAL TELEGRAM MESSAGE (ONLY FOR BUY/SELL) ==========
    // Sniper Bot: Only send Telegram notifications for BUY/SELL signals, never for NEUTRAL
    if (aiResponse.signal === 'BUY' || aiResponse.signal === 'SELL') {
      console.log('[BACKGROUND] Sending Telegram signal...');
      await sendProfessionalTelegramSignal({
        symbol,
        signal: aiResponse.signal,
        price,
        analysis: aiResponse.analysis,
        reasoning: aiResponse.reasoning,
        confidence: aiResponse.confidence,
        riskLevel: aiResponse.riskLevel,
        marketPhase: aiResponse.marketPhase,
        pattern,
        volatilityAlert: volatility.alert,
        confluenceScore: consensus.confluenceScore,
        indicatorBreakdown: `${consensus.buyIndicators} BUY / ${consensus.sellIndicators} SELL indicators`,
        rsi,
        upperBB,
        lowerBB,
        atr
      });

      console.log('[BACKGROUND] Analysis complete and sent to Telegram');
    } else {
      console.log('[BACKGROUND] NEUTRAL signal - no Telegram message sent (Sniper Bot mode)');
    }

  } catch (error) {
    console.error('[BACKGROUND] Error in background processing:', error);
    // Send error notification to Telegram
    try {
      await sendTelegramSignal({
        symbol: data.symbol,
        signal: 'NEUTRAL' as SignalType,
        price: data.price,
        analysis: `Error in analysis: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0,
        riskLevel: 'HIGH',
      });
    } catch (telegramError) {
      console.error('[BACKGROUND] Failed to send error notification:', telegramError);
    }
  }
}

// Professional Telegram message formatting
// Simplified Telegram message formatting
async function sendProfessionalTelegramSignal(message: {
  symbol: string;
  signal: SignalType;
  price: number;
  analysis: string;
  reasoning: string;
  confidence: number;
  riskLevel: string;
  marketPhase: string;
  pattern: string;
  volatilityAlert: string;
  confluenceScore: number;
  indicatorBreakdown: string;
  rsi?: number;
  upperBB?: number;
  lowerBB?: number;
  atr?: number;
}): Promise<void> {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[TELEGRAM] Credentials not configured');
    return;
  }

  // Handle NEUTRAL signals with minimal message
  if (message.signal === 'NEUTRAL') {
    const text = `⚪ ${message.symbol}: NEUTRAL (Waiting for Confluence)`;
    try {
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'Markdown',
          }),
        }
      );
    } catch (error) {
      console.error('[TELEGRAM] Failed to send neutral signal:', error);
    }
    return;
  }

  // Calculate TP/SL levels using ATR
  const atr = message.atr || 0.001; // Default ATR if not provided
  const riskMultiplier = message.riskLevel === 'HIGH' ? 1 : message.riskLevel === 'MEDIUM' ? 1.5 : 2;
  const rewardMultiplier = 3; // 3:1 reward-to-risk ratio

  let stopLoss: number;
  let takeProfit: number;

  if (message.signal === 'BUY') {
    stopLoss = message.price - (atr * riskMultiplier);
    takeProfit = message.price + (atr * rewardMultiplier);
  } else { // SELL
    stopLoss = message.price + (atr * riskMultiplier);
    takeProfit = message.price - (atr * rewardMultiplier);
  }

  // Create concise reasoning (max 5 words)
  const conciseReasoning = message.reasoning
    .split(' ')
    .slice(0, 5)
    .join(' ')
    .replace(/[.,;:!?]$/, ''); // Remove trailing punctuation

  const signalEmoji = message.signal === 'BUY' ? '🟢' : '🔴';

  const text = `${signalEmoji} ${message.signal} ${message.symbol}

🎯 Entry: ${message.price.toFixed(5)}
🛑 Stop Loss: ${stopLoss.toFixed(5)}
💰 Take Profit: ${takeProfit.toFixed(5)}

📊 ${conciseReasoning}`.trim();

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'Markdown',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[TELEGRAM] Failed to send signal:', error);
    }
  } catch (error) {
    console.error('[TELEGRAM] Error sending signal:', error);
  }
}