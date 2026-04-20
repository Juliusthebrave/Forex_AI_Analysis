import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { detectPattern, determineMarketPhase } from './pattern-detection';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are an elite Multi-Asset Scalper. You specialize in XAUUSD and Forex.
Your goal is to avoid "Late Entries" and catch reversals.

INDICATORS:
- Yellow: EMA 8 | Red: EMA 20 | Blue: EMA 50

CORE TRADING RULES:
1. TREND TRADING (Safe):
   - BUY: Price > Blue AND Yellow > Red. Entry ONLY on pullbacks to Red.
   - SELL: Price < Blue AND Yellow < Red. Entry ONLY on pullbacks to Red.

2. REVERSAL TRADING (Aggressive):
   - SELL: If RSI > 70 AND a Bearish Pattern (Engulfing/Falling Star) appears, you may SELL even if price is above Blue.
   - BUY: If RSI < 30 AND a Bullish Pattern (Hammer/Engulfing) appears, you may BUY even if price is below Blue.

3. SAFETY GATES (Strict):
   - NO BUYS if RSI > 65 (Prevents buying the peak).
   - NO SELLS if RSI < 35 (Prevents selling the bottom).
   - NO TRADES if Volume is lower than Average (Prevents choppy losses).

RETURN ONLY JSON:
{"action": "BUY"|"SELL"|"NEUTRAL", "sl_dist": number, "tp_dist": number, "reason": "string"}`;

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { symbol, price, history = [] } = data;

    const isForex = symbol.includes("USD") && !symbol.includes("XAU");
    const precision = isForex ? 5 : 2;

    const ema8 = data.ema8 || 0;
    const ema20 = data.ema20 || 0;
    const ema50 = data.ema50 || 0;
    const rsi = data.rsi || 50;
    const atr = data.atr || (isForex ? 0.0001 : 1.5);
    const currentVol = data.vol || 0;

    // 1. Run Logic from pattern-detection.ts
    const pattern = detectPattern(history);
    const phase = determineMarketPhase(price, ema8, ema20, ema50);
    
    // Calculate Average Volume
    const avgVol = history.length > 0 
      ? history.reduce((sum: number, c: any) => sum + (c.vol || 0), 0) / history.length 
      : 0;
    const isVolConfirmed = currentVol > (avgVol * 1.1); // 10% higher than average

    // 2. Build the AI Prompt with all current "Truths"
    const userPrompt = `
    ASSET: ${symbol} | PRICE: ${price}
    EMAs: Y: ${ema8}, R: ${ema20}, B: ${ema50}
    RSI: ${rsi} | ATR: ${atr} | VOL: ${currentVol} (Avg: ${avgVol.toFixed(0)})
    PATTERN: ${pattern} | PHASE: ${phase}
    VOL_CONFIRMED: ${isVolConfirmed}

    ANALYSIS:
    - If VOL_CONFIRMED is false, prioritize NEUTRAL unless the pattern is perfect.
    - If RSI is ${rsi} and the phase is ${phase}, should we enter or wait for a pullback?
    - Ensure SL/TP follows the 1:2 ratio using 2x and 4x ATR.`;

    const result = await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || '{"action":"NEUTRAL"}');

    const slDist = parsed.sl_dist || (atr * 2);
    const tpDist = parsed.tp_dist || (atr * 4);

    if (parsed.action !== 'NEUTRAL') {
      await sendProfessionalSignal({
        symbol, action: parsed.action, price, reason: parsed.reason,
        rsi, atr, sl: slDist, tp: tpDist, precision
      });
    }

    return Response.json({ action: parsed.action, sl_dist: slDist, tp_dist: tpDist, reason: parsed.reason });

  } catch (error) {
    return Response.json({ action: 'NEUTRAL', reason: 'System error' });
  }
}

async function sendProfessionalSignal(d: any) {
  const emoji = d.action === 'BUY' ? '🟢' : '🔴';
  const slPrice = d.action === 'BUY' ? d.price - d.sl : d.price + d.sl;
  const tpPrice = d.action === 'BUY' ? d.price + d.tp : d.price - d.tp;

  const text = `${emoji} **${d.action} ${d.symbol}**\n\n` +
               `🎯 **Entry:** ${d.price.toFixed(d.precision)}\n` +
               `🛑 **SL:** ${slPrice.toFixed(d.precision)} (${d.sl.toFixed(d.precision)})\n` +
               `💰 **TP:** ${tpPrice.toFixed(d.precision)} (${d.tp.toFixed(d.precision)})\n` +
               `📊 **R/R: 1:2 | ATR:** ${d.atr.toFixed(d.precision)}\n` +
               `📝 ${d.reason}`;
  
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
  });
}