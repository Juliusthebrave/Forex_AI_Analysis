import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are an expert Multi-Asset Scalper (Gold & Forex).
Your goal is 100% trend alignment using EMA Stacking.

INDICATOR COLORS:
- Yellow: EMA 8 (Momentum)
- Red: EMA 20 (Trend)
- Blue: EMA 50 (Baseline)


STRATEGY RULES:
1. BULLISH: Yellow > Red > Blue. Only BUY pullbacks to Red/Blue.
2. BEARISH: Yellow < Red < Blue. Only SELL pullbacks to Red/Blue.
3. RSI FILTER: No BUYS if RSI > 70. No SELLS if RSI < 30.
4. VOLATILITY: Use 2.0x ATR for Stop Loss (SL) and 4.0x ATR for Take Profit (TP).

ASSET HANDLER:
- XAUUSD: Use 2 decimal points. Highly volatile.
- EURUSD/Forex: Use 5 decimal points. Small pips.

Return ONLY JSON:
{"action": "BUY"|"SELL"|"NEUTRAL", "sl_dist": number, "tp_dist": number, "reason": "string"}`;

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { symbol, price, history = [] } = data;

    // 1. Identify Market Type to handle decimal precision
    const isForex = symbol.includes("USD") && !symbol.includes("XAU");
    const precision = isForex ? 5 : 2;

    const ema8 = data.ema8 || 0;
    const ema20 = data.ema20 || 0;
    const ema50 = data.ema50 || 0;
    const rsi = data.rsi || 50;
    const atr = data.atr || (isForex ? 0.0001 : 1.5);

    // 2. Clear Data Injection for AI
    // Replace your current userPrompt with this:
    const userPrompt = `
    ASSET: ${symbol} | Price: ${price}
    ---
    EMA 8 (Yellow): ${ema8}
    EMA 20 (Red): ${ema20}
    EMA 50 (Blue): ${ema50}
    EMA 200 (Trend): ${data.ema200}  <-- ADD THIS LINE
    RSI: ${rsi} | ATR: ${atr}
    ---
    STRICT TREND RULE: 
    If Price (${price}) is BELOW EMA 200 (${data.ema200}), you are in a CRASH. 
    Do NOT issue BUY signals. Only look for SELL opportunities.
    `;

    const result = await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || '{"action":"NEUTRAL"}');

    // 3. Fallback Math for distances
    const slDist = parsed.sl_dist || (atr * 2);
    const tpDist = parsed.tp_dist || (atr * 4);

    if (parsed.action !== 'NEUTRAL') {
      await sendProfessionalSignal({
        symbol,
        action: parsed.action,
        price,
        reason: parsed.reason,
        rsi,
        atr,
        sl: slDist,
        tp: tpDist,
        precision
      });
    }

    return Response.json({ action: parsed.action, sl_dist: slDist, tp_dist: tpDist, reason: parsed.reason });

  } catch (error) {
    return Response.json({ action: 'NEUTRAL', reason: 'System error' });
  }
}

// 4. THE PROFESSIONAL DESIGN (Matches your uploaded screenshots)
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