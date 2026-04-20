import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { detectPattern, determineMarketPhase } from '../../../lib/pattern-detection';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a Professional M5 Scalper.
Focus: 1:2 R/R and Trend Alignment.

CORE RULES:
1. TREND: 
   - BUY: Price > Blue AND Yellow > Red. Entry on pullback to Red.
   - SELL: Price < Blue AND Yellow < Red. Entry on pullback to Red.
2. OVEREXTENSION:
   - SELL if RSI > 70 + Bearish Pattern.
   - BUY if RSI < 30 + Bullish Pattern.
3. FILTERS:
   - NO BUY if RSI > 65 or Price below EMA 200 (CRASH ZONE).
   - NO SELL if RSI < 35 or Price above EMA 200.

Return JSON ONLY: {"action": "BUY"|"SELL"|"NEUTRAL", "sl_dist": number, "tp_dist": number, "reason": "string"}`;

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { symbol, price, history = [] } = data;
    const isForex = symbol.includes("USD") && !symbol.includes("XAU");
    const precision = isForex ? 5 : 2;

    const { ema8, ema20, ema50, ema200, rsi, atr, vol } = data;
    const pattern = detectPattern(history);
    const phase = determineMarketPhase(price, ema8, ema20, ema50);
    
    const avgVol = history.reduce((sum: number, c: any) => sum + (c.vol || 0), 0) / (history.length || 1);
    const volOk = (vol || 0) > avgVol;

    const userPrompt = `
      ASSET: ${symbol} | Price: ${price} | RSI: ${rsi}
      EMAs: 8:${ema8}, 20:${ema20}, 50:${ema50}, 200:${ema200}
      PATTERN: ${pattern} | PHASE: ${phase} | ATR: ${atr} | VOL_OK: ${volOk}
    `;

    const result = await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || '{"action":"NEUTRAL"}');

    // Fallback Math for Distances if AI fails
    const sl = parsed.sl_dist || (atr * 2);
    const tp = parsed.tp_dist || (atr * 4);

    if (parsed.action !== 'NEUTRAL') {
      await sendProfessionalSignal({ symbol, action: parsed.action, price, reason: parsed.reason, sl, tp, precision });
    }

    return Response.json({ ...parsed, sl_dist: sl, tp_dist: tp });
  } catch (error) {
    return Response.json({ action: 'NEUTRAL', reason: 'Error in M5 Logic' });
  }
}

async function sendProfessionalSignal(d: any) {
  const slPrice = d.action === 'BUY' ? d.price - d.sl : d.price + d.sl;
  const tpPrice = d.action === 'BUY' ? d.price + d.tp : d.price - d.tp;
  const text = `${d.action === 'BUY' ? '🟢' : '🔴'} **${d.action} ${d.symbol}**\n\nEntry: ${d.price.toFixed(d.precision)}\nSL: ${slPrice.toFixed(d.precision)}\nTP: ${tpPrice.toFixed(d.precision)}\n\nReason: ${d.reason}`;
  
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
  });
}