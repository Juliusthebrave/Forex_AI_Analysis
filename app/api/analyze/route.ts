import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { SignalType } from '@/lib/types';
import {
  detectPattern,
  determineMarketPhase,
  calculateVolatilityAlert,
} from '@/lib/pattern-detection';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// DOW-HOMMA M1 PRICE ACTION SIGNAL GENERATOR with Volatility-Adjusted Exits
const SYSTEM_PROMPT = `You are a professional Dow-Homma Scalper. You use EMAs to filter out "fake" signals and trade only with the major trend.

DATA INPUTS:
- You will receive price, RSI, ATR, and EMAs (8, 20, 50, 200).
- You will receive a 30-candle history.

1. TREND FILTER (The Golden Rule):
- If Price < EMA 200: ONLY look for SELL signals. Strict rejection of all BUYS.
- If Price > EMA 200: ONLY look for BUY signals. Strict rejection of all SELLS.

2. ENTRY LOGIC (Homma Candlesticks):
- BUY: Bullish Engulfing or Hammer that touches or pulls back to the EMA 20 or EMA 50 while above EMA 200.
- SELL: Bearish Engulfing or Shooting Star that touches or pulls back to the EMA 20 or EMA 50 while below EMA 200.

3. VOLATILITY & EXIT:
- SL distance: 2.0x ATR.
- TP distance: 4.0x ATR (1:2 RR).

4. PICKINESS:
- If RSI is overbought (>70) do not BUY. If RSI is oversold (<30) do not SELL.
- If the trend is messy or price is "chopping" through the EMA 200, return "NEUTRAL".

RETURN FORMAT (JSON ONLY):
{"action": "BUY"|"SELL"|"NEUTRAL", "sl_dist": number, "tp_dist": number, "reason": "short explanation of pattern + EMA alignment"}`;

interface AnalysisResponse {
  action: 'BUY' | 'SELL' | 'NEUTRAL';
  sl_dist: number;  // Stop Loss distance (2.0x ATR)
  tp_dist: number;  // Take Profit distance (4.0x ATR)
  reason: string;
}

export async function POST(req: Request) {
  console.log('[API] POST /api/analyze - START');

  try {
    const receivedData = await req.json();
    console.log('[API] Received data for Dow-Homma analysis:', {
      symbol: receivedData.symbol,
      price: receivedData.price,
      historyLength: Array.isArray(receivedData.history) ? receivedData.history.length : 0,
    });

    const { symbol, price, history = [] } = receivedData;

    if (!symbol || typeof price !== 'number' || !Array.isArray(history) || history.length < 5) {
      console.warn('[API] Missing required data or insufficient history');
      return Response.json({ action: 'NEUTRAL', sl_dist: 0, tp_dist: 0, reason: 'Insufficient price history' });
    }

    const analysis = await analyzeDowHommaSignal(receivedData);
    return Response.json(analysis);
  } catch (outerError) {
    const errorMsg = outerError instanceof Error ? outerError.message : String(outerError);
    console.error('[API] ‼️ CRITICAL ERROR:', errorMsg);
    return Response.json({ action: 'NEUTRAL', reason: 'Unable to perform Dow-Homma analysis' });
  }
}

async function analyzeDowHommaSignal(data: {
  symbol: string;
  price: number;
  ema8?: number;
  ema20?: number;
  ema50?: number;
  macd?: any;
  upperBB?: number;
  lowerBB?: number;
  rsi?: number;
  vol?: number;
  history: any[];
  atr?: number;
  averageAtr?: number;
  triggerReason?: string;
}): Promise<AnalysisResponse> {
  const { symbol, price, history, triggerReason = '' } = data;
  const pattern = detectPattern(history);
  const marketPhase = determineMarketPhase(price, data.ema8 ?? 0, data.ema20 ?? 0, data.ema50 ?? 0);
  const volatility = calculateVolatilityAlert(history, data.atr || 0, data.averageAtr || 0, price);

  const formattedHistory = history.slice(-10).map((candle: any, index: number) => {
    return `Candle ${index + 1}: open=${candle.open}, high=${candle.high}, low=${candle.low}, close=${candle.close}, volume=${candle.volume ?? 'N/A'}`;
  }).join('\n');

  const atrValue = data.atr || 0.0001;
  const slDistance = atrValue * 2.0;    // 2.0x ATR for Stop Loss
  const tpDistance = atrValue * 4.0;    // 4.0x ATR for Take Profit (1:2 R/R)

  const userPrompt = `Dow-Homma M1 Scalping with Volatility-Adjusted Exits

Market snapshot:
Symbol: ${symbol}
Price: ${price}
ATR: ${atrValue.toFixed(8)}
Pattern: ${pattern}
Market Phase: ${marketPhase}
Volume: ${data.vol ?? 'N/A'}

For this setup:
- SL distance should be: ${slDistance.toFixed(8)} (2.0x ATR)
- TP distance should be: ${tpDistance.toFixed(8)} (4.0x ATR)

Recent candles (most recent first):
${formattedHistory}

Analyze the Dow structure (Higher Highs/Lows vs Lower Highs/Lows) and Homma triggers (Engulfing/Hammer/Shooting Star).
Return JSON: {"action": "BUY"|"SELL"|"NEUTRAL", "sl_dist": ${slDistance.toFixed(8)}, "tp_dist": ${tpDistance.toFixed(8)}, "reason": "explanation"}`;

  try {
    const result = await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.2,
    });

    let cleanedText = result.text.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```(?:json)?\n?/g, '').trim();
    }

    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const action = parsed.action === 'BUY' || parsed.action === 'SELL' ? parsed.action : 'NEUTRAL';
    const reason = typeof parsed.reason === 'string' && parsed.reason.length > 0
      ? parsed.reason
      : action === 'NEUTRAL'
        ? 'Sideways or incomplete Dow-Homma setup'
        : 'Dow-Homma setup identified';

    const atrValue = data.atr || 0.0001;
    const slDist = typeof parsed.sl_dist === 'number' ? parsed.sl_dist : atrValue * 2.0;
    const tpDist = typeof parsed.tp_dist === 'number' ? parsed.tp_dist : atrValue * 4.0;

    const response: AnalysisResponse = {
      action,
      sl_dist: slDist,
      tp_dist: tpDist,
      reason: reason.substring(0, 200),
    };

    if (action === 'BUY' || action === 'SELL') {
      await sendProfessionalTelegramSignal({
        symbol,
        signal: action,
        price,
        analysis: reason,
        reasoning: reason,
        confidence: 80,
        riskLevel: 'MEDIUM',
        marketPhase,
        pattern,
        volatilityAlert: volatility.alert,
        confluenceScore: 0,
        indicatorBreakdown: 'Dow-Homma analysis',
        rsi: data.rsi,
        upperBB: data.upperBB,
        lowerBB: data.lowerBB,
        atr: data.atr,
        slDist: slDist,
        tpDist: tpDist,
      });
    }

    return response;
  } catch (error) {
    console.error('[AI] Dow-Homma analysis failed:', error);
    const defaultAtr = data.atr || 0.0001;
    return { action: 'NEUTRAL', sl_dist: defaultAtr * 2.0, tp_dist: defaultAtr * 4.0, reason: 'Analysis error' };
  }
}

// Professional Telegram message formatting with Volatility-Adjusted Exits
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
  slDist?: number;
  tpDist?: number;
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

  // Calculate TP/SL levels using Volatility-Adjusted distances (2.0x ATR for SL, 4.0x ATR for TP)
  const slDistance = message.slDist || (message.atr || 0.001) * 2.0;
  const tpDistance = message.tpDist || (message.atr || 0.001) * 4.0;

  let stopLoss: number;
  let takeProfit: number;

  if (message.signal === 'BUY') {
    stopLoss = message.price - slDistance;
    takeProfit = message.price + tpDistance;
  } else { // SELL
    stopLoss = message.price + slDistance;
    takeProfit = message.price - tpDistance;
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
🛑 SL: ${stopLoss.toFixed(5)} (${slDistance.toFixed(5)})
💰 TP: ${takeProfit.toFixed(5)} (${tpDistance.toFixed(5)})
📊 R/R: 1:2 | ATR ${message.atr?.toFixed(5) || 'N/A'}
📝 ${conciseReasoning}`.trim();

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