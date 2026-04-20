import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { detectPattern, determineMarketPhase } from './pattern-detection';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a Multi-Asset M5 Scalper. 
Assets may include Forex, Gold, or Crypto. Focus on 1:2 R/R.

CORE RULES:
1. TREND (M5): 
   - BUY: Price > Blue (EMA 50) AND Yellow (EMA 8) > Red (EMA 20).
   - SELL: Price < Blue AND Yellow < Red.
2. OVEREXTENSION:
   - SELL: RSI > 70 + Bearish Pattern.
   - BUY: RSI < 30 + Bullish Pattern.
3. SAFETY:
   - NO BUY if RSI > 65.
   - NO SELL if RSI < 35.

Return JSON ONLY: {"action": "BUY"|"SELL"|"NEUTRAL", "sl_dist": number, "tp_dist": number, "reason": "string"}`;

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { symbol, price, history = [], ema8, ema20, ema50, rsi, atr, vol, localPattern } = data;

    const isForex = symbol.includes("USD") && !symbol.includes("XAU");
    const precision = isForex ? 5 : 2;

    const pattern = detectPattern(history);
    const phase = determineMarketPhase(price, ema8, ema20, ema50);
    
    const avgVol = history.reduce((sum: number, c: any) => sum + (c.vol || 0), 0) / (history.length || 1);
    const volOk = (vol || 0) > avgVol;

    const userPrompt = `
      ASSET: ${symbol} | Price: ${price} | RSI: ${rsi}
      EMAs: 8:${ema8}, 20:${ema20}, 50:${ema50}
      PATTERNS: Local:${localPattern}, AI_Detect:${pattern}
      PHASE: ${phase} | ATR: ${atr} | VOL_OK: ${volOk}
    `;

    const result = await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || '{"action":"NEUTRAL"}');

    if (parsed.action !== 'NEUTRAL') {
      await sendProfessionalSignal({ 
        symbol, action: parsed.action, price, reason: parsed.reason, 
        sl: (parsed.sl_dist || atr * 2), tp: (parsed.tp_dist || atr * 4), precision 
      });
    }

    return Response.json(parsed);
  } catch (error) {
    return Response.json({ action: 'NEUTRAL', reason: 'System error' });
  }
}

async function sendProfessionalSignal(d: any) {
  const slPrice = d.action === 'BUY' ? d.price - d.sl : d.price + d.sl;
  const tpPrice = d.action === 'BUY' ? d.price + d.tp : d.price - d.tp;

  const text = `${d.action === 'BUY' ? '🟢' : '🔴'} **${d.action} ${d.symbol}**\n\n` +
               `Entry: ${d.price.toFixed(d.precision)}\n` +
               `SL: ${slPrice.toFixed(d.precision)}\n` +
               `TP: ${tpPrice.toFixed(d.precision)}\n\n` +
               `📝 ${d.reason}`;
  
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
  });
}