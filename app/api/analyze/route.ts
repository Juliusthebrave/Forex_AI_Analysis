import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a Universal Multi-Asset Scalper. You adapt your logic based on the Symbol provided.

STRATEGY: DOW-HOMMA + EMA STACKING
- Yellow: EMA 8 | Red: EMA 20 | Blue: EMA 50

1. ASSET ADAPTATION:
   - XAUUSD (Gold): Highly volatile. Respects RSI 75/25 extremes. Expect larger ATR.
   - EURUSD/Forex: High liquidity, smaller moves. Respects EMA 20 (Red) pullbacks strictly.
   - Others: Follow the EMA stack (Yellow > Red > Blue = Uptrend).

2. THE TREND RULE:
   - BUY ONLY if Price > Blue EMA AND Yellow > Red.
   - SELL ONLY if Price < Blue EMA AND Yellow < Red.
   - If Price is sandwiching between EMAs, return NEUTRAL.

3. EXIT LOGIC:
   - Always maintain 1:2 Risk/Reward.
   - Use 2.0x ATR for SL and 4.0x ATR for TP.

RETURN ONLY JSON:
{"action": "BUY"|"SELL"|"NEUTRAL", "sl_dist": number, "tp_dist": number, "reason": "string"}`;

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { symbol, price, history = [] } = data;

    // Detect if we are dealing with Forex (5 decimals) or Gold/Crypto
    const isForex = symbol.includes("USD") && !symbol.includes("XAU");
    const pipFormat = isForex ? "0.00001" : "0.01";

    const ema8 = data.ema8 || 0;
    const ema20 = data.ema20 || 0;
    const ema50 = data.ema50 || 0;
    const rsi = data.rsi || 50;
    const atr = data.atr || (isForex ? 0.00015 : 1.5);

    const userPrompt = `
    SYMBOL: ${symbol}
    PRICE: ${price} (Format: ${pipFormat})
    ---
    EMAs: Yellow(8): ${ema8}, Red(20): ${ema20}, Blue(50): ${ema50}
    RSI: ${rsi} | ATR: ${atr}
    ---
    TASK: 
    1. Determine if the EMA Stack is Bullish, Bearish, or Choppy.
    2. Check for a Homma Candle (Engulfing/Hammer/Star) at the Red line.
    3. Ensure RSI isn't over-extended.
    4. Provide SL/TP distances based on 2x and 4x ATR.`;

    const result = await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || '{"action":"NEUTRAL"}');

    // Ensure distances are never 0
    const finalSl = parsed.sl_dist || (atr * 2);
    const finalTp = parsed.tp_dist || (atr * 4);

    if (parsed.action !== 'NEUTRAL') {
      await sendTelegram(symbol, parsed.action, price, parsed.reason, rsi, finalSl, finalTp);
    }

    return Response.json({
      action: parsed.action,
      sl_dist: finalSl,
      tp_dist: finalTp,
      reason: parsed.reason
    });

  } catch (error) {
    return Response.json({ action: 'NEUTRAL', reason: 'System error' });
  }
}

async function sendTelegram(symbol: string, action: string, price: number, reason: string, rsi: number, sl: number, tp: number) {
  const emoji = action === "BUY" ? "🚀" : "📉";
  const text = `${emoji} **${action} ${symbol}**\n💰 Price: ${price}\n🔥 RSI: ${rsi.toFixed(1)}\n🛡️ SL Dist: ${sl.toFixed(5)}\n🎯 TP Dist: ${tp.toFixed(5)}\n📝 ${reason}`;
  
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
  });
}