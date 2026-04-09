import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { addSignal } from '@/lib/signal-store';
import { sendTelegramSignal } from '@/lib/telegram';
import type { ForexSignalRequest, ForexSignal, SignalType } from '@/lib/types';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

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

ACCOUNT SIZE RISK GUIDELINES:
You will receive the trader's account balance. Adjust your risk assessment accordingly:
- Micro accounts (<$50): Be VERY conservative. Recommend only high-probability setups. Warn about leverage risks.
- Mini accounts ($50-$200): Conservative approach. Focus on major pairs with lower volatility.
- Small accounts ($200-$1000): Standard retail advice. Balance opportunity with risk management.
- Standard accounts (>$1000): Normal trading recommendations with proper position sizing.

Always tailor lot size recommendations and risk levels to the specific account balance provided.

Provide a concise but thorough analysis combining technical indicators with geopolitical context. Be specific about how current events might affect the currency pair.

IMPORTANT: You MUST respond ONLY with a valid JSON object in this exact format (no markdown, no extra text, no code blocks):
{"signal": "BUY" | "SELL" | "NEUTRAL", "confidence": <number 0-100>, "riskLevel": "LOW" | "MEDIUM" | "HIGH", "analysis": "<your analysis text>"}`;

interface AnalysisResponse {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  analysis: string;
}

export async function POST(req: Request) {
  try {
    const body: ForexSignalRequest & { accountBalance?: number } = await req.json();
    const { symbol, price, ema8, ema20, ema50, macd, sl, tp, atr, accountBalance = 27 } = body;

    // Validate required fields
    if (!symbol || typeof price !== 'number') {
      return Response.json(
        { error: 'Missing required fields: symbol and price are required' },
        { status: 400 }
      );
    }

    const maxRiskPerTrade = accountBalance * 0.02;
    const recommendedLot = (accountBalance * 0.01) / 100;
    const accountCategory = accountBalance < 50 ? 'Micro' : accountBalance < 200 ? 'Mini' : accountBalance < 1000 ? 'Small' : 'Standard';
    
    // Determine volatility based on ATR relative to price
    // ATR as percentage of price: < 0.5% = LOW, 0.5-1.5% = MEDIUM, > 1.5% = HIGH
    let volatility: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (atr && price) {
      const atrPercent = (atr / price) * 100;
      if (atrPercent < 0.5) {
        volatility = 'LOW';
      } else if (atrPercent > 1.5) {
        volatility = 'HIGH';
      }
    }

    const userPrompt = `Analyze this Forex data and provide a trading signal:

TRADER ACCOUNT INFO:
Account Balance: $${accountBalance.toFixed(2)} (${accountCategory} Account)
Max Risk Per Trade (2%): $${maxRiskPerTrade.toFixed(2)}
Recommended Lot Size: ${recommendedLot.toFixed(3)} lots

MARKET DATA:
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

    let text: string;
    try {
      const result = await generateText({
        model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.7,
        maxTokens: 1024,
      });
      
      text = result.text;
    } catch (groqError: unknown) {
      const errorMessage = groqError instanceof Error ? groqError.message : 'Unknown Groq API error';
      console.error('[v0] Groq API error:', errorMessage);
      return Response.json(
        { 
          success: false,
          error: 'Groq API error',
          details: errorMessage,
          suggestion: 'Check your GROQ_API_KEY and model availability'
        },
        { status: 502 }
      );
    }
    
    if (!text || text.trim().length === 0) {
      console.error('[v0] Groq returned empty response');
      return Response.json(
        { 
          success: false,
          error: 'Empty response from AI',
          details: 'Groq returned an empty response'
        },
        { status: 502 }
      );
    }
    
    // Parse the JSON response from Groq
    let aiResponse: AnalysisResponse;
    try {
      // Clean up potential markdown code blocks and extract JSON
      let cleanedText = text.trim();
      // Remove markdown code blocks if present
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```(?:json)?\n?/g, '').trim();
      }
      // Try to find JSON object in the response
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      aiResponse = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('[v0] Failed to parse Groq response:', text);
      return Response.json(
        { 
          success: false,
          error: 'Failed to parse AI response',
          rawResponse: text.substring(0, 300),
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        },
        { status: 500 }
      );
    }

    // Validate the response structure with defaults for missing optional fields
    if (!aiResponse.signal || !['BUY', 'SELL', 'NEUTRAL'].includes(aiResponse.signal)) {
      aiResponse.signal = 'NEUTRAL';
    }
    if (typeof aiResponse.confidence !== 'number' || aiResponse.confidence < 0 || aiResponse.confidence > 100) {
      aiResponse.confidence = 50;
    }
    if (!aiResponse.riskLevel || !['LOW', 'MEDIUM', 'HIGH'].includes(aiResponse.riskLevel)) {
      aiResponse.riskLevel = 'MEDIUM';
    }
    if (!aiResponse.analysis || typeof aiResponse.analysis !== 'string') {
      aiResponse.analysis = 'Analysis unavailable';
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
      sl,
      tp,
      atr,
      volatility,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[v0] Analysis error:', errorMessage);
    return Response.json(
      { 
        success: false,
        error: 'Failed to analyze forex data',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
