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

const SYSTEM_PROMPT = `You are a professional Dow-Homma Scalper. You use EMAs to filter out "fake" signals and trade only with the major trend.

DATA INPUTS:
- You will receive price, RSI, ATR, and EMAs (8, 20, 50, 200).
- You will receive a 30-candle history.

1. TREND FILTER (The Golden Rule):
- If Price < EMA 200: ONLY look for SELL signals. Strict rejection of all BUYS.
- If Price > EMA 200: ONLY look for BUY signals. Strict rejection of all SELLS.

2. ENTRY LOGIC (Homma Candlesticks):
- BUY: Bullish Engulfing or Hammer that touches or pulls back to the EMA 20 or EMA 50 while ABOVE EMA 200.
- SELL: Bearish Engulfing or Shooting Star that touches or pulls back to the EMA 20 or EMA 50 while BELOW EMA 200.

3. VOLATILITY & EXIT:
- SL distance: 2.0x ATR.
- TP distance: 4.0x ATR (1:2 RR).

4. PICKINESS:
- If RSI > 70 do not BUY. If RSI < 30 do not SELL.
- If the trend is messy or price is "chopping" through the EMA 200, return "NEUTRAL".

RETURN FORMAT (JSON ONLY):
{"action": "BUY"|"SELL"|"NEUTRAL", "sl_dist": number, "tp_dist": number, "reason": "short explanation of pattern + EMA alignment"}`;

interface AnalysisResponse {
  action: 'BUY' | 'SELL' | 'NEUTRAL';
  sl_dist: number;
  tp_dist: number;
  reason: string;
}

export async function POST(req: Request) {
  try {
    const receivedData = await req.json();
    
    // Check if symbol and price exist
    if (!receivedData.symbol || typeof receivedData.price !== 'number') {
      return Response.json({ action: 'NEUTRAL', reason: 'Invalid data received' });
    }

    const analysis = await analyzeDowHommaSignal(receivedData);
    return Response.json(analysis);
  } catch (error) {
    console.error('[API] CRITICAL ERROR:', error);
    return Response.json({ action: 'NEUTRAL', reason: 'Analysis failed' });
  }
}

async function analyzeDowHommaSignal(data: any): Promise<AnalysisResponse> {
  const { symbol, price, history = [] } = data;
  
  // 1. Extract EMAs correctly from the incoming data
  const ema8 = data.ema8 ?? 0;
  const ema20 = data.ema20 ?? 0;
  const ema50 = data.ema50 ?? 0;
  const ema200 = data.ema200 ?? 0;
  const rsi = data.rsi ?? 50;
  const atr = data.atr ?? 0.0001;

  // 2. Logic helpers from your pattern-detection.ts
  const pattern = detectPattern(history);
  const marketPhase = determineMarketPhase(price, ema8, ema20, ema50);
  const volatility = calculateVolatilityAlert(history, atr, data.averageAtr || atr, price);

  const formattedHistory = history.slice(-10).map((candle: any, index: number) => {
    return `Candle ${index + 1}: O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`;
  }).join('\n');

  // 3. Construct the prompt that EXPLICITLY gives the AI the EMA values
  const userPrompt = `Dow-Homma M5 Analysis for ${symbol}
  
Current Price: ${price}
EMA 8: ${ema8}
EMA 20: ${ema20}
EMA 50: ${ema50}
EMA 200: ${ema200}
RSI: ${rsi}
ATR: ${atr}
System Pattern Detection: ${pattern}
Market Phase: ${marketPhase}

Recent Price Action:
${formattedHistory}

Is price currently above or below the EMA 200? 
If Price (${price}) is less than EMA 200 (${ema200}), you MUST return NEUTRAL for any bullish patterns.`;

  try {
    const result = await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.1, // Lower temperature for more consistent rule following
    });

    let cleanedText = result.text.trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Enforce 1:2 R/R calculation if AI fails to provide them
    const slDist = parsed.sl_dist || (atr * 2.0);
    const tpDist = parsed.tp_dist || (atr * 4.0);

    if (parsed.action === 'BUY' || parsed.action === 'SELL') {
      await sendProfessionalTelegramSignal({
        symbol,
        signal: parsed.action,
        price,
        analysis: parsed.reason,
        reasoning: parsed.reason,
        confidence: 85,
        riskLevel: 'MEDIUM',
        marketPhase,
        pattern,
        volatilityAlert: volatility.alert,
        confluenceScore: 0,
        indicatorBreakdown: 'EMA + Candlestick Confluence',
        rsi: rsi,
        atr: atr,
        slDist: slDist,
        tpDist: tpDist,
      });
    }

    return {
      action: parsed.action,
      sl_dist: slDist,
      tp_dist: tpDist,
      reason: parsed.reason
    };
  } catch (error) {
    console.error('[AI Error]', error);
    return { action: 'NEUTRAL', sl_dist: atr * 2, tp_dist: atr * 4, reason: 'AI Logic error' };
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