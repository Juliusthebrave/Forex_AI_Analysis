import { generateText, Output } from 'ai';
import { z } from 'zod';
import { addSignal } from '@/lib/signal-store';
import { sendTelegramSignal } from '@/lib/telegram';
import type { ForexSignalRequest, ForexSignal, SignalType } from '@/lib/types';

const SYSTEM_PROMPT = `You are an expert Forex market analyst with deep knowledge of technical analysis and current geopolitical events. Your analysis takes place in April 2026.

CURRENT GEOPOLITICAL CONTEXT (April 2026):
- US Federal Reserve has maintained rates at 4.25% amid moderating inflation
- European Central Bank signaling potential rate cuts in Q2 2026
- China-Taiwan tensions have eased following diplomatic talks, boosting Asian markets
- Middle East oil production stable after new OPEC+ agreements
- USD strength persists against emerging market currencies
- JPY weakness continues as Bank of Japan maintains ultra-loose policy
- GBP volatility due to ongoing UK-EU trade renegotiations
- AUD benefiting from strong commodity demand, particularly lithium and rare earths

TECHNICAL ANALYSIS GUIDELINES:
- EMA 8 crossing above EMA 20: Short-term bullish signal
- EMA 8 crossing below EMA 20: Short-term bearish signal
- Price above all EMAs (8, 20, 50): Strong bullish trend
- Price below all EMAs: Strong bearish trend
- MACD line crossing above signal line: Bullish momentum
- MACD line crossing below signal line: Bearish momentum
- Positive MACD histogram: Increasing bullish momentum
- Negative MACD histogram: Increasing bearish momentum

Provide a concise but thorough analysis combining technical indicators with geopolitical context. Be specific about how current events might affect the currency pair.`;

const analysisSchema = z.object({
  signal: z.enum(['BUY', 'SELL', 'NEUTRAL']),
  confidence: z.number().min(0).max(100),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  analysis: z.string(),
});

export async function POST(req: Request) {
  try {
    const body: ForexSignalRequest = await req.json();
    const { symbol, price, ema8, ema20, ema50, macd } = body;

    // Validate required fields
    if (!symbol || typeof price !== 'number') {
      return Response.json(
        { error: 'Missing required fields: symbol and price are required' },
        { status: 400 }
      );
    }

    const userPrompt = `Analyze this Forex data and provide a trading signal:

Symbol: ${symbol}
Current Price: ${price}
EMA 8: ${ema8}
EMA 20: ${ema20}
EMA 50: ${ema50}
MACD Line: ${macd?.line ?? 'N/A'}
MACD Signal: ${macd?.signal ?? 'N/A'}
MACD Histogram: ${macd?.histogram ?? 'N/A'}

Technical Observations:
- Price vs EMA8: ${price > ema8 ? 'Above' : 'Below'}
- Price vs EMA20: ${price > ema20 ? 'Above' : 'Below'}
- Price vs EMA50: ${price > ema50 ? 'Above' : 'Below'}
- EMA Alignment: ${ema8 > ema20 && ema20 > ema50 ? 'Bullish (8>20>50)' : ema8 < ema20 && ema20 < ema50 ? 'Bearish (8<20<50)' : 'Mixed'}
- MACD Momentum: ${(macd?.histogram ?? 0) > 0 ? 'Bullish' : 'Bearish'}

Provide your analysis considering both technical indicators and current April 2026 geopolitical factors.`;

    const result = await generateText({
      model: 'openai/gpt-4o',
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      output: Output.object({ schema: analysisSchema }),
    });

    const aiResponse = result.object;

    if (!aiResponse) {
      return Response.json(
        { error: 'Failed to generate analysis' },
        { status: 500 }
      );
    }

    // Create signal record
    const forexSignal: ForexSignal = {
      id: crypto.randomUUID(),
      symbol,
      signal: aiResponse.signal as SignalType,
      price,
      analysis: aiResponse.analysis,
      confidence: aiResponse.confidence,
      riskLevel: aiResponse.riskLevel,
      timestamp: new Date(),
      telegramSent: false,
    };

    // Send to Telegram
    const telegramSent = await sendTelegramSignal({
      symbol,
      signal: aiResponse.signal as SignalType,
      price,
      analysis: aiResponse.analysis,
      confidence: aiResponse.confidence,
      riskLevel: aiResponse.riskLevel,
    });

    forexSignal.telegramSent = telegramSent;

    // Store signal
    addSignal(forexSignal);

    return Response.json({
      success: true,
      signal: forexSignal,
    });
  } catch (error) {
    console.error('[v0] Analysis error:', error);
    return Response.json(
      { error: 'Failed to analyze forex data' },
      { status: 500 }
    );
  }
}
